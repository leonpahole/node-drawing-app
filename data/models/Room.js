const db = require("../db");

const Room = db.model("Room", {
  tableName: "rooms",
  users() {
    return this.hasMany("User", "joined_room_id", "id");
  },
  author() {
    return this.belongsTo("User", "author_id");
  }
});

module.exports = Room;
