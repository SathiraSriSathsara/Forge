const express = require("express");

const {
  createTocken,
  getAllTockens,
  deleteTockenById,
} = require("../controller/tocken.controller");

const router = express.Router();

router
  .route("/")
  .post(createTocken)
  .get(getAllTockens);

router
  .route("/:id")
  .delete(deleteTockenById);

module.exports = router;