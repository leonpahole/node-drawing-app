const argon2 = require("argon2");
const User = require("../data/models/User");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const JWT_EXPIRES_IN = "6h";

module.exports = {
  hashPassword: async password => {
    const salt = crypto.randomBytes(32);
    return await argon2.hash(password, { salt });
  },
  verifyPassword: async (password, passwordDigest) => {
    return await argon2.verify(passwordDigest, password);
  },
  getJWTForUser: user => {
    const data = {
      id: user.id,
      username: user.username
    };

    return getJWT(data);
  },
  authenticate: async (req, res, next) => {
    const token = getTokenFromHeader(req);

    let user = null;

    if (token != null) {
      try {
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        user = await User.where({ id: decodedToken.id }).fetch({
          columns: ["id", "username"]
        });
        console.log(user);
      } catch (e) {
        console.error(`Authenticate error`, e.toString());
      }
    } else {
      console.error(`No JWT in header found`);
    }

    if (user == null) {
      return res.status(401).end("Unauthorized");
    }

    req.user = user;
    return next();
  }
};

const getJWT = data => {
  return jwt.sign(data, process.env.JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

const getTokenFromHeader = req => {
  if (
    req.headers.authorization &&
    req.headers.authorization.split(" ")[0] === "Bearer"
  ) {
    return req.headers.authorization.split(" ")[1];
  }

  return null;
};
