exports.up = function(knex) {
  return knex.schema.createTable("users", tbl => {
    tbl.increments("id");
    tbl.string("username");
    tbl.string("password_digest");
    tbl.timestamp("createdAt").defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {};
