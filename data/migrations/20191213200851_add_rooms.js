exports.up = function(knex) {
  return knex.schema.createTable("rooms", tbl => {
    tbl.increments("id");
    tbl.string("name").notNullable();
    tbl.timestamps(true, true);

    tbl.integer("author_id");
    tbl
      .foreign("author_id")
      .onDelete("SET NULL")
      .references("users.id");
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable("rooms");
};
