const express = require("express");

const {
  cloneRepo,
} = require("../controller/repo.controller");

const router = express.Router();

/**
 * POST /api/repos/clone
 *
 * Clone a repository when it does not exist.
 * Update and clean it when it already exists.
 */
router.post("/clone", cloneRepo);

module.exports = router;