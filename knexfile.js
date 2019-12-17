require("dotenv").config();

const {
  POSTGRES_USER,
  POSTGRES_PASSWORD,
  POSTGRES_DB,
  POSTGRES_URL
} = process.env;

module.exports = {
  log: {
    warn(message) {
      console.log(message);
    },
    error(message) {
      console.log(message);
    },
    deprecate(message) {
      console.log(message);
    },
    debug(message) {
      console.log(message);
    }
  },
  development: {
    client: "pg",
    connection: `postgres://${POSTGRES_USER ||
      "root"}:${POSTGRES_PASSWORD}@${POSTGRES_URL ||
      "localhost"}/${POSTGRES_DB || "drawing"}`,
    migrations: {
      directory: "./data/migrations"
    },
    seeds: { directory: "./data/seeds" }
  },

  testing: {
    client: "pg",
    connection: `postgres://${POSTGRES_USER ||
      "root"}:${POSTGRES_PASSWORD}@${POSTGRES_URL ||
      "localhost"}/${POSTGRES_DB || "drawing"}`,
    migrations: {
      directory: "./data/migrations"
    },
    seeds: { directory: "./data/seeds" }
  },

  production: {
    client: "pg",
    connection: `postgres://${POSTGRES_USER ||
      "root"}:${POSTGRES_PASSWORD}@${POSTGRES_URL ||
      "localhost"}/${POSTGRES_DB || "drawing"}`,
    migrations: {
      directory: "./data/migrations"
    },
    seeds: { directory: "./data/seeds" }
  }
};
