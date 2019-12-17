const db = require("../db");

const User = db.model("User", {
  tableName: "users",
  rooms() {
    return this.hasMany("Room", "author_id");
  }
});

module.exports = User;
