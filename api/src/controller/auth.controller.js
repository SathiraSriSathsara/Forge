const bcrypt = require("bcrypt");

const { User } = require("../models");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { signAccessToken } = require("../utils/jwt");

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (
    typeof email !== "string" ||
    !email.trim() ||
    typeof password !== "string" ||
    !password
  ) {
    throw new ApiError(400, "email and password are required");
  }

  const user = await User.scope("withPassword").findOne({
    where: {
      email: email.trim().toLowerCase(),
    },
  });

  const passwordMatches = user
    ? await bcrypt.compare(password, user.password)
    : false;

  if (!user || !passwordMatches) {
    throw new ApiError(401, "Invalid email or password");
  }

  let accessToken;

  try {
    accessToken = signAccessToken(user);
  } catch {
    throw new ApiError(500, "JWT authentication is not configured");
  }

  return res.status(200).json({
    success: true,
    message: "Login successful",
    data: {
      accessToken,
      tokenType: "Bearer",
      expiresIn: process.env.JWT_EXPIRES_IN || "1h",
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        username: user.username,
      },
    },
  });
});
