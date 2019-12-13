const db = require("../db");

const User = db.model("User", {
  tableName: "users",
  room_joined() {
    return this.belongsTo("Room", "joined_room_id", "id");
  },
  rooms() {
    return this.hasMany("Room", "author_id");
  }
});

module.exports = User;
