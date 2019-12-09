const express = require("express");
const router = express.Router();

router.post("/register", (req, res) => {
  res.json({ status: -1, message: "Not yet implemented" });
});

module.exports = router;
