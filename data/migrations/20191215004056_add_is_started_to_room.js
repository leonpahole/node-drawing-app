exports.up = function(knex) {
  return knex.schema.alterTable("rooms", tbl => {
    tbl.boolean("game_started").defaultTo(false);
  });
};

exports.down = function(knex) {};
