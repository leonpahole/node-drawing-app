const Room = require("./data/models/Room");
const User = require("./data/models/User");
const socketioJwt = require("socketio-jwt");

const util = require("./services/randomWord");

const NEXT_ROUND_COUNTDOWN_SECONDS = 5;
const SECONDS_FOR_ROUND = 10;
const MIN_PLAYERS_TO_START_GAME = 2;
const MAX_PLAYERS_IN_ROOM = 8;
const GUESS_POINTS_REWARD = 100;
const MAX_POINTS = 300;
const MINIMUM_POINTS = 10;

let roomData = {};

const pickNextDrawingMember = members => {
  let membersToDrawRemaining = false;

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
  if (user == null) {
    return null;
  }

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

  const getRoom = (room, gameData) => {
    return {
      id: room.id,
      name: room.attributes.name,
      author: room.relations.author,
      status: gameData ? gameData.status : null,
      members: gameData
        ? gameData.members.map(m => pickAttributesFromUser(m))
        : [],
      userDrawing: gameData
        ? pickAttributesFromUser(gameData.drawingMember)
        : null
    };
  };

  const getRoomArray = async data => {
    const rooms = await Room.forge()
      .orderBy("created_at", "DESC")
      .fetchAll({
        withRelated: [{ author: qb => qb.columns("id", "username") }]
      });

    return rooms.map(room => {
      const gameData = data[room.id];
      return getRoom(room, gameData);
    });
  };

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

      const rooms = await getRoomArray(roomData);

      console.log("emitting rooms");
      console.log(rooms);
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

      if (
        roomData[socket.joinedRoomID] &&
        roomData[socket.joinedRoomID].members.length === MAX_PLAYERS_IN_ROOM
      ) {
        socket.disconnect();
        return;
      }

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
              io.of("rooms").emit("gameEnded", {
                roomID: Number(socket.joinedRoomID)
              });
              io.of("room")
                .to(socket.joinedRoomID)
                .emit("gameEnded", {});
              roomData[socket.joinedRoomID].status = "GAME_OVER";
              roomData[socket.joinedRoomID].gameStarted = false;
              roomData[socket.joinedRoomID].drawingMember = null;
              roomData[socket.joinedRoomID].members = roomData[
                socket.joinedRoomID
              ].members.map(m => {
                return { ...m, hasDrawn: false };
              });

              await Promise.all(
                roomData[socket.joinedRoomID].members.map(async m => {
                  await User.query()
                    .where("id", m.id)
                    .increment("games_played", 1);
                })
              );

              return;
            }

            /* tell everyone who new user to guess is */
            sendSystemMessage(
              socket.joinedRoomID,
              "Next user: " + nextDrawingMember.username
            );

            roomData[socket.joinedRoomID].status = "WAITING_ROUND";

            io.of("rooms").emit("roundWaiting", {
              roomID: Number(socket.joinedRoomID)
            });

            io.of("room")
              .to(socket.joinedRoomID)
              .emit("roundWaiting");

            await new Promise(resolve => {
              let secondsBeforeStart = NEXT_ROUND_COUNTDOWN_SECONDS;
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

            roomData[socket.joinedRoomID].status = "ROUND_IN_PROGRESS";

            /* signal that round has started */
            io.of("rooms").emit("roundStarted", {
              roomID: Number(socket.joinedRoomID),
              userDrawing: pickAttributesFromUser(nextDrawingMember)
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

        /* create room game data in memory if not created yet */
        if (roomData[socket.joinedRoomID] == null) {
          roomData[socket.joinedRoomID] = {
            members: [socket.connectedUser],
            status: "NOT_STARTED"
          };
        } else {
          /* add user to members if room created */
          roomData[socket.joinedRoomID].members.push(socket.connectedUser);
        }

        io.of("rooms").emit("userJoined", {
          roomID: Number(socket.joinedRoomID),
          user: pickAttributesFromUser(socket.connectedUser)
        });

        socket.to(socket.joinedRoomID).emit("userJoined", {
          user: pickAttributesFromUser(socket.connectedUser)
        });

        /* send members of room to user */
        socket.emit("room", {
          members: roomData[socket.joinedRoomID].members.map(m =>
            pickAttributesFromUser(m)
          ),
          status: roomData[socket.joinedRoomID].status,
          userDrawing: pickAttributesFromUser(
            roomData[socket.joinedRoomID].drawingMember
          ),
          wordDrawing:
            roomData[socket.joinedRoomID].drawingMember &&
            roomData[socket.joinedRoomID].drawingMember.id ===
              socket.connectedUser.id
              ? roomData[socket.joinedRoomID].word
              : null
        });

        /* draw handler: emit coordinates to all in the room except myself */
        socket.on("draw", coordinates => {
          socket.to(socket.joinedRoomID).emit("draw", coordinates);
        });

        if (
          roomData[socket.joinedRoomID].members.length === MAX_PLAYERS_IN_ROOM
        ) {
          await startGameRound();
        }

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

          let receivedPoints = 0,
            receivedPointsForDrawingUser = 0;

          if (!winner) {
            sendSystemMessage(
              roomID,
              "Round ended without winner. The word was " + correctWord
            );
          } else {
            /* add fixed points just for guessing */
            receivedPoints = GUESS_POINTS_REWARD;

            const secondsRemaining =
              SECONDS_FOR_ROUND - roomData[roomID].gameTime;

            /* add proportional points */
            receivedPoints =
              GUESS_POINTS_REWARD *
              (roomData[roomID].gameTime / SECONDS_FOR_ROUND);

            if (receivedPoints < MINIMUM_POINTS) {
              receivedPoints = MINIMUM_POINTS;
            }

            /* round to nearest 10 */
            receivedPoints = Math.ceil(receivedPoints / 10) * 10;
            receivedPointsForDrawingUser = Math.ceil(receivedPoints / 20) * 10;

            if (winner.points + receivedPoints > MAX_POINTS) {
              receivedPoints = MAX_POINTS - winner.points;
            }

            if (
              roomData[roomID].drawingMember.points +
                receivedPointsForDrawingUser >
              MAX_POINTS
            ) {
              receivedPointsForDrawingUser =
                MAX_POINTS - roomData[roomID].drawingMember.points;
            }

            try {
              await User.query()
                .where("id", winner.id)
                .increment("points", receivedPoints);
              await User.query()
                .where("id", winner.id)
                .increment("correct_guesses", 1);
              await User.query()
                .where("id", roomData[roomID].drawingMember.id)
                .increment("points", receivedPointsForDrawingUser);

              winner.points += receivedPoints;
              roomData[
                roomID
              ].drawingMember.points += receivedPointsForDrawingUser;
            } catch (e) {
              console.error(`Error saving points ${e}`);
            }

            sendSystemMessage(
              roomID,
              "User " +
                winner.username +
                " correctly guessed the word " +
                correctWord +
                " after " +
                secondsRemaining +
                " seconds and received " +
                receivedPoints +
                " points"
            );
          }

          /* tell everyone that round has ended */
          io.of("rooms").emit("roundEnded", {
            roomID: Number(roomID),
            userGuessed: winner ? pickAttributesFromUser(winner) : null,
            userDrawing: pickAttributesFromUser(roomData[roomID].drawingMember),
            receivedPoints,
            receivedPointsForDrawingUser
          });

          io.of("room")
            .to(roomID)
            .emit("roundEnded", {
              correctWord,
              userGuessed: winner ? pickAttributesFromUser(winner) : null,
              userDrawing: pickAttributesFromUser(
                roomData[roomID].drawingMember
              ),
              receivedPoints,
              receivedPointsForDrawingUser
            });

          /* clear canvas */
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
            roomID: Number(socket.joinedRoomID),
            userID: socket.connectedUser.id
          });
          io.of("room")
            .to(socket.joinedRoomID)
            .emit("userLeft", { userID: socket.connectedUser.id });
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
