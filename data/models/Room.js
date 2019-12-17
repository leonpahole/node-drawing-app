const db = require("../db");

const Room = db.model("Room", {
  tableName: "rooms",
  author() {
    return this.belongsTo("User", "author_id");
  }
});

module.exports = Room;
