const express = require("express");
const { celebrate, Joi, Segments } = require("celebrate");
const router = express.Router();
const auth = require("../services/auth");

const User = require("../data/models/User");
const Room = require("../data/models/Room");

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
      const room = await Room.where({ author_id: req.user.id }).fetch({
        withRelated: [
          { users: qb => qb.columns("id", "username", "joined_room_id") },
          { author: qb => qb.columns("id", "username") }
        ]
      });

      res.json({
        room: { room }
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
        .min(6)
        .max(20)
    })
  }),
  async (req, res, next) => {
    try {
      const newRoom = await new Room({
        name: req.body.name,
        author_id: req.user.id
      }).save();

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
      await User.where({
        id: req.user.id
      }).save(
        {
          joined_room_id: null,
          joined_room_time: null
        },
        { patch: true }
      );

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
