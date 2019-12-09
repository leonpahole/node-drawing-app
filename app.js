const express = require("express");
const app = express();
const cors = require("cors");
const port = 3000;

const userAccountRoutes = require("./routes/userAccount");

app.use(cors());

app.get("/", (req, res) => res.send("Api works"));
app.use("/userAccount", userAccountRoutes);

app.listen(port, () =>
  console.log(`Drawing backend listening on port ${port}`)
);
