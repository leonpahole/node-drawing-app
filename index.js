const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const bodyParser = require("body-parser");
const { errors, isCelebrate } = require("celebrate");

const userRoutes = require("./routes/users");
const roomRoutes = require("./routes/rooms");

const app = express();

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(morgan("common"));

app.get("/", (req, res) => {
  res.send("Drawing api works\n");
});

app.use("/users", userRoutes);
app.use("/rooms", roomRoutes);

app.use((err, req, res, next) => {
  if (!isCelebrate(err)) {
    res.json({ error: true, message: err.toString() });
  }

  next(err);
});

app.use(errors());

module.exports = app;
