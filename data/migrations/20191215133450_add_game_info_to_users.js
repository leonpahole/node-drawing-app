exports.up = function(knex) {
  return knex.schema.alterTable("users", tbl => {
    tbl.integer("points").defaultTo(0);
    tbl.integer("correct_guesses").defaultTo(0);
    tbl.integer("games_played").defaultTo(0);
  });
};

exports.down = function(knex) {};
