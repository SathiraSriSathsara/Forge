const express = require("express");

const {
    createUser,
    getUsers,
    getUserById,
    updateUser,
    deleteUser,
} = require("../controller/user.controller");

const router = express.Router();

router
    .route("/")
    .post(createUser)
    .get(getUsers);

router
    .route("/:id")
    .get(getUserById)
    .put(updateUser)
    .delete(deleteUser);

module.exports = router;