exports.up = function(knex) {
  return knex.schema.createTable("users", tbl => {
    tbl.increments("id");
    tbl.string("username").notNullable();
    tbl.string("password_digest").notNullable();
    tbl.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable("users");
};
