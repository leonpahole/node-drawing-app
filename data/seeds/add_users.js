const auth = require("../../services/auth");

exports.seed = knex => {
  return knex("users")
    .del()
    .then(async () => {
      const users = await Promise.all(
        [1, 2, 3, 4, 5].map(async i => {
          return {
            id: i,
            username: "username" + i,
            password_digest: await auth.hashPassword("password" + i)
          };
        })
      );

      return knex("users").insert(users);
    });
};
