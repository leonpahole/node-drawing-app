const express = require("express");
const { celebrate, Joi, Segments } = require("celebrate");
const router = express.Router();
const auth = require("../services/auth");

const User = require("../data/models/User");
const Room = require("../data/models/Room");

const { randomWord } = require("../services/randomWord");

const MIN_PLAYERS_TO_START_GAME = 3;

/* all rooms */
router.get("/", auth.authenticate, async (req, res, next) => {
  try {
    res.json({
      rooms: await Room.fetchAll({
        withRelated: [
          { users: qb => qb.columns("id", "username", "joined_room_id") },
          { author: qb => qb.columns("id", "username") }
        ]
      })
    });
  } catch (e) {
    console.error(`Error fetching rooms: `, e.toString());
    next("Error fetching");
  }
});

router.get("/joined", auth.authenticate, async (req, res, next) => {
  try {
    const user = await User.where({ id: req.user.id }).fetch({
      withRelated: [
        {
          room_joined: qb =>
            qb.columns(
              "id",
              "name",
              "user_drawing_id",
              "author_id",
              "game_started",
              "word_drawing"
            )
        },
        { "room_joined.user_drawing": qb => qb.columns("id", "username") }
      ]
    });

    if (req.user.id !== user.relations.room_joined.user_drawing_id) {
      delete user.relations.room_joined.word_drawing;
    }

    res.json({ room: user.relations.room_joined });
  } catch (e) {
    console.error(`Error fetching room: `, e.toString());
    next("Error fetching");
  }
});

/* single room */
router.get(
  "/:room_id",
  auth.authenticate,
  celebrate({
    [Segments.PARAMS]: Joi.object().keys({
      room_id: Joi.number()
        .integer()
        .min(1)
    })
  }),
  async (req, res, next) => {
    try {
      const room = await Room.where({ id: req.user.id }).fetch({
        withRelated: [
          { users: qb => qb.columns("id", "username", "joined_room_id") },
          { author: qb => qb.columns("id", "username") }
        ]
      });

      res.json({
        room
      });
    } catch (e) {
      console.error(`Error fetching room: `, e.toString());
      next("Error fetching");
    }
  }
);

router.post("/start_game", auth.authenticate, async (req, res, next) => {
  try {
    if (req.user.relations.room_joined) {
      if (req.user.relations.room_joined.relations.author.id === req.user.id) {
        if (
          req.user.relations.room_joined.relations.users.length >
          MIN_PLAYERS_TO_START_GAME
        ) {
          const randomWord = randomWord();

          await Room.where({
            id: req.user.relations.room_joined.id
          }).save(
            {
              game_started: true,
              word_drawing: randomWord,
              user_drawing_id: req.user.id
            },
            { patch: true }
          );

          const io = req.app.get("io");
          io.of("rooms").emit("gameStarted", {
            roomID: req.user.relations.room_joined.id
          });
          io.of("room")
            .to(req.user.relations.room_joined.id)
            .emit("gameStarted", {
              userDrawing: { username: req.user.username, id: req.user.id }
            });

          res.json({ started: true, word: randomWord });
        } else {
          return next("Not enough players in room");
        }
      } else {
        return next("Not owner of room");
      }
    } else {
      return next("Not in any room");
    }
  } catch (e) {
    console.error("Start room failed: ", e.toString());
    next("Start room failed");
  }
});

/* create room */
router.post(
  "/",
  auth.authenticate,
  celebrate({
    [Segments.BODY]: Joi.object().keys({
      name: Joi.string()
        .required()
        .min(6)
        .max(20)
    })
  }),
  async (req, res, next) => {
    try {
      const { id } = await new Room({
        name: req.body.name,
        author_id: req.user.id
      }).save();

      const newRoom = await Room.where({ id }).fetch({
        withRelated: [
          { users: qb => qb.columns("id", "username", "joined_room_id") },
          { author: qb => qb.columns("id", "username") }
        ]
      });

      const io = req.app.get("io");
      io.of("rooms").emit("newRoom", newRoom);

      res.json({ id: newRoom.id });
    } catch (e) {
      console.error("Create room failed: ", e.toString());
      next("Create room failed");
    }
  }
);

/* join room */
router.post(
  "/join/:room_id",
  auth.authenticate,
  celebrate({
    [Segments.PARAMS]: Joi.object().keys({
      room_id: Joi.number()
        .integer()
        .min(1)
    })
  }),
  async (req, res, next) => {
    try {
      await User.where({
        id: req.user.id
      }).save(
        {
          joined_room_id: req.params.room_id,
          joined_room_time: new Date()
        },
        { patch: true }
      );

      const io = req.app.get("io");
      io.of("rooms").emit("userJoined", {
        roomID: req.params.room_id,
        user: req.user
      });
      io.of("room")
        .to(req.params.room_id)
        .emit("userJoined", { user: req.user });

      res.json({ joined: true });
    } catch (e) {
      console.error("Join room failed: ", e.toString());
      next("Join room failed");
    }
  }
);

/* leave room */
router.delete(
  "/leave",
  auth.authenticate,
  celebrate({
    [Segments.PARAMS]: Joi.object().keys({
      room_id: Joi.number()
        .integer()
        .min(1)
    })
  }),
  async (req, res, next) => {
    try {
      const user = await User.where({
        id: req.user.id
      }).fetch();

      await User.where({
        id: req.user.id
      }).save(
        {
          joined_room_id: null,
          joined_room_time: null
        },
        { patch: true }
      );

      const io = req.app.get("io");
      io.of("rooms").emit("userLeft", {
        roomID: user.joined_room_id,
        userID: req.user.id
      });
      io.of("room")
        .to(req.params.room_id)
        .emit("userLeft", { userID: req.user.id });

      res.json({ left: true });
    } catch (e) {
      console.error("Leave room failed: ", e.toString());
      next("Leave room failed");
    }
  }
);

router.delete(
  "/:room_id",
  auth.authenticate,
  celebrate({
    [Segments.PARAMS]: Joi.object().keys({
      room_id: Joi.number()
        .integer()
        .min(1)
    })
  }),
  async (req, res, next) => {
    try {
      const room = await Room.where({
        id: req.params.room_id
      }).fetch();

      if (room.attributes.author_id !== req.user.id) {
        console.error("Room deletion failed: permission denied");
        next("Permission denied");
      }

      await room.destroy();

      res.json({ deleted: resp });
    } catch (e) {
      console.error("Room deletion failed: ", e.toString());
      next("Room deletion failed");
    }
  }
);

module.exports = router;
