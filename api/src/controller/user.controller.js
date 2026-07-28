const { User } = require("../models");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const bcrypt = require("bcrypt");

function serializeUser(user) {
    const { password, ...safeUser } = user.toJSON();
    return safeUser;
}

/**
 * Create a new user
 * POST /api/users
 */
const createUser = asyncHandler(async (req, res) => {
    const { firstName, lastName, email, username, password } = req.body;

    if (!firstName || !lastName || !email || !username || !password) {
        throw new ApiError(400, "All fields are required");
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
        where: { email: normalizedEmail },
    });

    if (existingUser) {
        throw new ApiError(409, "A user with this email already exists");
    }

    // hash the password before saving to the database
    const hashedPassword = await bcrypt.hash(password, 10);


    const user = await User.create({
        firstName,
        lastName,
        email: normalizedEmail,
        username,
        password: hashedPassword,
    });

    res.status(201).json({
        success: true,
        message: "User created successfully",
        data: serializeUser(user),
    });
});

/**
 * Get all users
 * GET /api/users
 */
const getUsers = asyncHandler(async (req, res) => {
    const users = await User.findAll({
        order: [["id", "DESC"]],
    });

    res.status(200).json({
        success: true,
        count: users.length,
        data: users,
    });
});

/**
 * Get one user
 * GET /api/users/:id
 */
const getUserById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const user = await User.findByPk(id);

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    res.status(200).json({
        success: true,
        data: user,
    });
});

/**
 * Update a user
 * PUT /api/users/:id
 */
const updateUser = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, email, age } = req.body;

    const user = await User.findByPk(id);

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    await user.update({
        name: name ?? user.name,
        email: email ?? user.email,
        age: age ?? user.age,
    });

    res.status(200).json({
        success: true,
        message: "User updated successfully",
        data: user,
    });
});

/**
 * Delete a user
 * DELETE /api/users/:id
 */
const deleteUser = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const user = await User.findByPk(id);

    if (!user) {
        throw new ApiError(404, "User not found");
    }

    await user.destroy();

    res.status(200).json({
        success: true,
        message: "User deleted successfully",
    });
});

module.exports = {
    createUser,
    getUsers,
    getUserById,
    updateUser,
    deleteUser,
};
