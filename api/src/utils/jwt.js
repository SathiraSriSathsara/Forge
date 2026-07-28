const jwt = require("jsonwebtoken");

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (typeof secret !== "string" || secret.length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters");
  }

  return secret;
}

function signAccessToken(user) {
  return jwt.sign(
    {
      email: user.email,
      username: user.username,
    },
    getJwtSecret(),
    {
      algorithm: "HS256",
      expiresIn: process.env.JWT_EXPIRES_IN || "1h",
      subject: String(user.id),
    },
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, getJwtSecret(), {
    algorithms: ["HS256"],
  });
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
};
