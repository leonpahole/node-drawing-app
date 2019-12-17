const express = require("express");
const { celebrate, Joi, Segments } = require("celebrate");
const router = express.Router();
const auth = require("../services/auth");

const User = require("../data/models/User");

router.post(
  "/register",
  celebrate({
    [Segments.BODY]: Joi.object().keys({
      username: Joi.string()
        .required()
        .min(4)
        .max(20),
      password: Joi.string()
        .required()
        .min(4)
    })
  }),
  async (req, res, next) => {
    try {
      const userWithSameUsername = await User.where({
        username: req.body.username
      }).fetch({ require: false });

      if (userWithSameUsername != null) {
        return next("User with given username already exists");
      }

      const newUser = await new User({
        username: req.body.username,
        password_digest: await auth.hashPassword(req.body.password)
      }).save();

      if (newUser == null) {
        return next("User not found");
      }

      res.json({ token: auth.getJWTForUser(newUser) });
    } catch (e) {
      console.error("Register failed: ", e.toString());
      next("Internal server error");
    }
  }
);

router.post("/login", async (req, res, next) => {
  try {
    const user = await User.where({
      username: req.body.username
    }).fetch();

    const isAuthenitcated = await auth.verifyPassword(
      req.body.password,
      user.attributes.password_digest
    );

    if (isAuthenitcated) {
      res.json({ token: auth.getJWTForUser(user.attributes) });
      return;
    }
  } catch (e) {
    console.error("Login failed: ", e.toString());
  }

  next("Login failed");
});

router.get("/me", auth.authenticate, async (req, res, next) => {
  res.json({
    user: {
      id: req.user.id,
      username: req.user.attributes.username
    }
  });
});

router.get(
  "/:user_id",
  auth.authenticate,
  celebrate({
    [Segments.PARAMS]: Joi.object().keys({
      user_id: Joi.number()
        .integer()
        .min(1)
    })
  }),
  async (req, res, next) => {
    try {
      const user = await User.where({ id: req.params.user_id }).fetch({
        columns: [
          "id",
          "username",
          "created_at",
          "correct_guesses",
          "games_played",
          "points"
        ]
      });

      res.json({ user });
    } catch (e) {
      console.log(`Fetch user error`, e);
      next(`Internal server error`);
    }
  }
);

module.exports = router;
