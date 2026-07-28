const { User } = require("../models");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { verifyAccessToken } = require("../utils/jwt");

const authenticate = asyncHandler(async (req, res, next) => {
  const authorization = req.get("authorization");

  if (!authorization || !authorization.startsWith("Bearer ")) {
    throw new ApiError(401, "Authentication required");
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token) {
    throw new ApiError(401, "Authentication required");
  }

  let payload;

  try {
    payload = verifyAccessToken(token);
  } catch (error) {
    if (error.message && error.message.startsWith("JWT_SECRET")) {
      throw new ApiError(500, "JWT authentication is not configured");
    }

    throw new ApiError(401, "Invalid or expired access token");
  }

  if (!/^[1-9]\d*$/.test(String(payload.sub || ""))) {
    throw new ApiError(401, "Invalid or expired access token");
  }

  const user = await User.findByPk(payload.sub);

  if (!user) {
    throw new ApiError(401, "Access token user no longer exists");
  }

  req.user = user;
  next();
});

module.exports = {
  authenticate,
};
