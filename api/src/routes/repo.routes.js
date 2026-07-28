const express = require("express");

const {
  cloneRepo,
  getRepos,
} = require("../controller/repo.controller");

const router = express.Router();

/**
 * POST /api/repos/clone
 *
 * Clone a repository when it does not exist.
 * Update and clean it when it already exists.
 */
router.get("/", getRepos);
router.post("/clone", cloneRepo);

module.exports = router;
