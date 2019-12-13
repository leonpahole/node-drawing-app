const knexfile = require("../knexfile");

const env = process.env.NODE_ENV || "development";
const configOptions = knexfile[env];

const knex = require("knex")(configOptions);
module.exports = require("bookshelf")(knex);
