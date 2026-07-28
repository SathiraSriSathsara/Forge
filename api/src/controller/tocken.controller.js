const { Tocken } = require("../models");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { encryptToken } = require("../utils/tokenCrypto");

// Save tocken
exports.createTocken = asyncHandler(async (req, res) => {
  const { name, platform, username, tocken } = req.body;

  if (!name || !platform || !username || !tocken) {
    throw new ApiError(
      400,
      "name, platform, username and tocken are required",
    );
  }

  const normalizedPlatform = platform.trim().toLowerCase();

  if (!["github", "gitea"].includes(normalizedPlatform)) {
    throw new ApiError(400, "Unsupported platform");
  }

  const encryptedTocken = encryptToken(tocken);

  const savedTocken = await Tocken.create({
    name: name.trim(),
    platform: normalizedPlatform,
    username: username.trim(),
    tocken: encryptedTocken,
  });

  return res.status(201).json({
    success: true,
    message: "Git token saved successfully",
    data: {
      id: savedTocken.id,
      name: savedTocken.name,
      platform: savedTocken.platform,
      username: savedTocken.username,
    },
  });
});

// Get all tockens
exports.getAllTockens = asyncHandler(async (req, res) => {
  const tockens = await Tocken.findAll({
    attributes: [
      "id",
      "name",
      "platform",
      "username",
      "createdAt",
      "updatedAt",
    ],
    order: [["createdAt", "DESC"]],
  });

  return res.status(200).json({
    success: true,
    count: tockens.length,
    data: tockens,
  });
});

// Delete tocken by id
exports.deleteTockenById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const tocken = await Tocken.findByPk(id);

  if (!tocken) {
    throw new ApiError(404, "Tocken not found");
  }

  await tocken.destroy();

  return res.status(200).json({
    success: true,
    message: "Tocken deleted successfully",
  });
});