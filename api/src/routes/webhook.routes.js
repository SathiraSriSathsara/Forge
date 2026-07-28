const express = require("express");

const {
  handleGiteaWebhook,
} = require("../controller/repo.controller");

const router = express.Router();

router.post("/gitea/:repoId", handleGiteaWebhook);

module.exports = router;
