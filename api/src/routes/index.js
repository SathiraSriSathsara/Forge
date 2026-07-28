const express = require("express");
const userRoutes = require("./user.routes");

const router = express.Router();

router.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "API is running",
    });
});

router.use("/users", userRoutes);

module.exports = router;