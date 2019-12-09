require("dotenv").config();

module.exports = {
  development: {
    client: "pg",
    connection: `postgres://${process.env.POSTGRES_USER || "root"}:${
      process.env.POSTGRES_PASSWORD
    }@${process.env.POSTGRES_URL || "localhost"}/${process.env.POSTGRES_DB ||
      "drawing"}`,
    migrations: {
      directory: "./data/migrations"
    },
    seeds: { directory: "./data/seeds" }
  },

  testing: {
    client: "pg",
    connection: {
      host: process.POSTGRES_URL,
      port: process.env.DB_PORT || 5432,
      user: process.env.POSTGRES_USER || "root",
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB || "drawing"
    },
    migrations: {
      directory: "./data/migrations"
    },
    seeds: { directory: "./data/seeds" }
  },

  production: {
    client: "pg",
    connection: {
      host: process.POSTGRES_URL,
      port: process.env.DB_PORT || 5432,
      user: process.env.POSTGRES_USER || "root",
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB || "drawing"
    },
    migrations: {
      directory: "./data/migrations"
    },
    seeds: { directory: "./data/seeds" }
  }
};
