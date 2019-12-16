exports.up = function(knex) {
  return knex.schema.alterTable("rooms", tbl => {
    tbl
      .integer("user_drawing_id")
      .nullable()
      .references("users.id");
    tbl.string("word_drawing").nullable();
  });
};

exports.down = function(knex) {};
