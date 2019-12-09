const bcrypt = require("bcrypt");

exports.seed = knex => {
  return knex("users")
    .del()
    .then(async () => {
      const users = await Promise.all(
        [1, 2, 3, 4, 5].map(async i => {
          const salt = await bcrypt.genSalt(10);

          return {
            id: i,
            username: "username" + i,
            password_digest: await bcrypt.hash("password" + i, salt)
          };
        })
      );

      console.log(users);
      return knex("users").insert(users);
    });
};
