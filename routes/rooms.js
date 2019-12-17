const express = require("express");
const { celebrate, Joi, Segments } = require("celebrate");
const router = express.Router();
const auth = require("../services/auth");

const User = require("../data/models/User");
const Room = require("../data/models/Room");

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
      const room = await Room.where({ id: req.params.room_id }).fetch({
        withRelated: [{ author: qb => qb.columns("id", "username") }]
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

/* create room */
router.post(
  "/",
  auth.authenticate,
  celebrate({
    [Segments.BODY]: Joi.object().keys({
      name: Joi.string()
        .required()
        .min(1)
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
        withRelated: [{ author: qb => qb.columns("id", "username") }]
      });

      const io = req.app.get("io");
      io.of("rooms").emit("newRoom", {
        room: {
          id: newRoom.id,
          name: newRoom.attributes.name,
          author: newRoom.relations.author,
          status: "NOT_STARTED"
        }
      });

      res.json({ id: newRoom.id });
    } catch (e) {
      console.error("Create room failed: ", e.toString());
      next("Create room failed");
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
        return next("Permission denied");
      }

      await room.destroy();

      const io = req.app.get("io");
      io.of("rooms").emit("roomRemoved", {
        roomID: Number(req.params.room_id)
      });

      res.json({ deleted: resp });
    } catch (e) {
      console.error("Room deletion failed: ", e.toString());
      next("Room deletion failed");
    }
  }
);

module.exports = router;
