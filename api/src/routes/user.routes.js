const express = require("express");

const {
    createUser,
    getUsers,
    getUserById,
    updateUser,
    deleteUser,
} = require("../controller/user.controller");
const {
    authenticate,
} = require("../middleware/auth.middleware");

const router = express.Router();

router
    .route("/")
    .post(createUser)
    .get(authenticate, getUsers);

router
    .route("/:id")
    .get(authenticate, getUserById)
    .put(authenticate, updateUser)
    .delete(authenticate, deleteUser);

module.exports = router;
