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
        .min(6)
        .max(20),
      password: Joi.string()
        .required()
        .min(6)
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
        return next("User empty");
      }

      res.json({ token: auth.getJWTForUser(newUser) });
    } catch (e) {
      console.error("Register failed: ", e.toString());
      next("Register failed");
    }
  }
);

router.post(
  "/login",
  celebrate({
    [Segments.BODY]: Joi.object().keys({
      username: Joi.string()
        .required()
        .min(6)
        .max(20),
      password: Joi.string()
        .required()
        .min(6)
    })
  }),
  async (req, res, next) => {
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
  }
);

router.get("/profile", auth.authenticate, async (req, res, next) => {
  res.json(req.user);
});

module.exports = router;
