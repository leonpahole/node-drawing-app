exports.up = function(knex) {
  return knex.schema.alterTable("users", tbl => {
    tbl
      .integer("joined_room_id")
      .nullable()
      .references("rooms.id");
    tbl.timestamp("joined_room_time").nullable();
  });
};

exports.down = function(knex) {};
