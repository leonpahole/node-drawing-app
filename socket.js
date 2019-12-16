const Room = require("./data/models/Room");
const User = require("./data/models/User");
const socketioJwt = require("socketio-jwt");

const util = require("./services/randomWord");

const SECONDS_FOR_ROUND = 20;
const MIN_PLAYERS_TO_START_GAME = 2;

let roomData = {};

const pickNextDrawingMember = members => {
  let membersToDrawRemaining = false;

  console.log(members);
  for (let i = 0; i < members.length; i++) {
    if (members[i].hasDrawn === false) {
      membersToDrawRemaining = true;
      break;
    }
  }

  if (!membersToDrawRemaining) return [null, null];

  let randomMemberIndex = -1;
  do {
    randomMemberIndex = Math.floor(Math.random() * members.length);
  } while (members[randomMemberIndex].hasDrawn);

  return [members[randomMemberIndex], randomMemberIndex];
};

const pickAttributesFromUser = user => {
  return {
    id: user.id,
    username: user.username,
    points: user.points
  };
};

module.exports = server => {
  const io = require("socket.io")(server);

  const rooms = io.of("/rooms");
  const room = io.of("/room");

  rooms
    .on(
      "connection",
      socketioJwt.authorize({
        secret: process.env.JWT_SECRET,
        timeout: 15000
      })
    )
    .on("authenticated", async socket => {
      console.log(socket.decoded_token.username + " has conected");

      const rooms = await Room.forge()
        .orderBy("created_at", "DESC")
        .fetchAll({
          withRelated: [
            { users: qb => qb.columns("id", "username", "joined_room_id") },
            { author: qb => qb.columns("id", "username") }
          ]
        });

      socket.emit("rooms", rooms);
    });

  room
    .on(
      "connection",
      socketioJwt.authorize({
        secret: process.env.JWT_SECRET,
        timeout: 15000
      })
    )
    .on("authenticated", async socket => {
      /* get room to join from query */
      socket.joinedRoomID = socket.handshake.query.roomID;

      if (socket.joinedRoomID) {
        /* get user from the socket */
        try {
          const connectedUser = await User.where({
            id: socket.decoded_token.id
          }).fetch({
            columns: ["id", "username"]
          });

          socket.connectedUser = {
            socket,
            points: 0,
            id: connectedUser.id,
            username: connectedUser.attributes.username,
            hasDrawn: false /* whether or not user has already drawn in the game */
          };
        } catch (e) {
          socket.disconnect();
        }
      } else {
        socket.disconnect();
      }

      if (socket.connectedUser) {
        /* join user to the room */
        socket.join(socket.joinedRoomID);

        /* create room game data in memory if not created yet */
        if (roomData[socket.joinedRoomID] == null) {
          roomData[socket.joinedRoomID] = {
            members: [socket.connectedUser]
          };
        } else {
          /* add user to members if room created */
          roomData[socket.joinedRoomID].members.push(socket.connectedUser);
        }

        io.of("rooms").emit("userJoined", {
          roomID: socket.joinedRoomID,
          user: pickAttributesFromUser(socket.connectedUser)
        });

        socket.to(socket.joinedRoomID).emit("userJoined", {
          user: pickAttributesFromUser(socket.connectedUser)
        });

        console.log("EMITTING MEMBERS");
        console.log(roomData);
        /* send members of room to user */
        socket.emit(
          "members",
          roomData[socket.joinedRoomID].members.map(m => {
            return pickAttributesFromUser(m);
          })
        );

        /* draw handler: emit coordinates to all in the room except myself */
        socket.on("draw", coordinates => {
          socket.to(socket.joinedRoomID).emit("draw", coordinates);
        });

        /* system message is identified by type: system */
        const sendSystemMessage = (roomID, message) => {
          io.of("room")
            .to(roomID)
            .emit("chat", {
              type: "system",
              message
            });
        };

        /* starts a new round by finding user to draw, word to draw and creating timeout for game ending */
        const startGameRound = async () => {
          try {
            const [
              nextDrawingMember,
              nextDrawingMemberIndex
            ] = pickNextDrawingMember(roomData[socket.joinedRoomID].members);

            if (nextDrawingMember == null) {
              sendSystemMessage(
                socket.joinedRoomID,
                'Game has finished. Press "start game" to start a new game.'
              );
              io.of("room")
                .to(socket.joinedRoomID)
                .emit("gameEnded", {});
              roomData[socket.joinedRoomID].gameStarted = false;
            }

            /* tell everyone who new user to guess is */
            sendSystemMessage(
              socket.joinedRoomID,
              "Next user: " + nextDrawingMember.username
            );

            await new Promise(resolve => {
              let secondsBeforeStart = 5;
              const interval = setInterval(() => {
                if (secondsBeforeStart <= 0) {
                  clearInterval(interval);
                  resolve();
                }
                sendSystemMessage(
                  socket.joinedRoomID,
                  "New round starting in " + secondsBeforeStart
                );
                secondsBeforeStart--;
              }, 1000);
            });

            const randomWord = util.randomWord();

            /* signal that round has started */
            io.of("rooms").emit("roundStarted", {
              roomID: socket.joinedRoomID
            });

            /* send start signal to everyone except user that is drawing */
            nextDrawingMember.socket
              .to(socket.joinedRoomID)
              .emit("roundStarted", {
                userDrawing: pickAttributesFromUser(nextDrawingMember)
              });

            /* send start signal and word to the user that is drawing */
            nextDrawingMember.socket.emit("roundStarted", {
              word: randomWord,
              userDrawing: pickAttributesFromUser(nextDrawingMember)
            });

            sendSystemMessage(
              socket.joinedRoomID,
              `New round has started: ${nextDrawingMember.username} is drawing`
            );

            roomData[socket.joinedRoomID].gameTime = SECONDS_FOR_ROUND;

            roomData[socket.joinedRoomID].word = randomWord;

            roomData[socket.joinedRoomID].drawingMember = nextDrawingMember;

            roomData[socket.joinedRoomID].members[
              nextDrawingMemberIndex
            ].hasDrawn = true;

            /* set up interval to send system messages about game time */
            roomData[socket.joinedRoomID].gameTimeInterval = setInterval(
              async () => {
                await gameRoundInterval(socket.joinedRoomID);
              },
              1000
            );
          } catch (e) {
            sendSystemMessage(
              socket.joinedRoomID,
              `Round has not been started due to system error. Please try refreshing.`
            );
            console.log(e);
          }
        };

        const gameRoundInterval = async roomID => {
          const gameTime = roomData[roomID].gameTime;

          if (gameTime % 10 == 0 || gameTime <= 5) {
            sendSystemMessage(roomID, gameTime + " s left in this round");
          }

          roomData[roomID].gameTime--;

          if (gameTime - 1 <= 0) {
            await endRoundAndStartNextRound(roomID);
          }
        };

        const endRoundAndStartNextRound = async (roomID, winner = null) => {
          /* clear countdown interval */
          if (roomData[roomID].gameTimeInterval) {
            clearInterval(roomData[roomID].gameTimeInterval);
          }

          const correctWord = roomData[roomID].word;

          if (!winner) {
            sendSystemMessage(
              roomID,
              "Round ended without winner. The word was " + correctWord
            );
          } else {
            sendSystemMessage(
              roomID,
              "User " +
                winner.username +
                " correctly guessed the word " +
                correctWord
            );
          }

          /* tell everyone that round has ended */
          io.of("room")
            .to(roomID)
            .emit("roundEnded", {
              correctWord,
              userGuessed: winner
                ? {
                    id: winner.id,
                    username: winner.username
                  }
                : null,
              points: 30
            });

          io.of("room")
            .to(roomID)
            .emit("draw", [{ x: -2, y: -2 }]);

          await startGameRound();
        };

        /* global chat and guessing game */
        socket.on("chat", async data => {
          let { message } = data;
          message = message.trim();

          if (message.length > 0) {
            /* send chat message to whole room */
            io.of("room")
              .to(socket.joinedRoomID)
              .emit("chat", {
                message,
                user: {
                  id: socket.connectedUser.id,
                  username: socket.connectedUser.username
                }
              });

            const drawingMember = roomData[socket.joinedRoomID].drawingMember;

            /* if not current user, check guess */
            if (drawingMember && drawingMember.id !== socket.connectedUser.id) {
              const wordForGuessing = roomData[socket.joinedRoomID].word;
              if (message.toLowerCase() === wordForGuessing) {
                endRoundAndStartNextRound(
                  socket.joinedRoomID,
                  socket.connectedUser
                );
              }
            }
          }
        });

        socket.on("startGame", async () => {
          let error = null;

          const room = await Room.where({ id: socket.joinedRoomID }).fetch({
            columns: ["author_id"]
          });

          if (room.attributes.author_id === socket.connectedUser.id) {
            if (roomData[socket.joinedRoomID].gameStarted !== true) {
              roomData[socket.joinedRoomID].gameStarted = true;
              await startGameRound();
            } else {
              error = "Game already running";
            }
          } else {
            error = "Not owner of the room";
          }

          if (error) {
            console.log("start game failed", error);
            socket.emit("gameStarted_error", { error });
          }
        });

        socket.on("disconnect", async reason => {
          /* tell everyone that user left and remove it from members array */
          roomData[socket.joinedRoomID].members = roomData[
            socket.joinedRoomID
          ].members.filter(m => m.id !== socket.connectedUser.id);

          io.of("rooms").emit("userLeft", {
            roomID: socket.joinedRoomID,
            userID: socket.connectedUser.id
          });
          io.of("room")
            .to(socket.joinedRoomID)
            .emit("userLeft", { userID: socket.connectedUser.id });

          /*
          await User.where({
            id: user.id
          }).save(
            {
              joined_room_id: null,
              joined_room_time: null
            },
            { patch: true }
          );
          */
        });
      }
    });

  /*
  io.on("connection", async socket => {
    const rooms = await Room.fetchAll({
      withRelated: [
        { users: qb => qb.columns("id", "username", "joined_room_id") },
        { author: qb => qb.columns("id", "username") }
      ]
    });
    socket.emit("rooms", rooms);
  });
  */

  return io;
};
