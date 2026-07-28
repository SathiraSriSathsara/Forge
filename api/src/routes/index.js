const express = require("express");
const authRoutes = require("./auth.routes");
const userRoutes = require("./user.routes");
const repoRoutes = require("./repo.routes");
const tockenRoutes = require("./tocken.routes");
const {
    authenticate,
} = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "API is running",
    });
});

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/repos", authenticate, repoRoutes);
router.use("/tockens", authenticate, tockenRoutes);

module.exports = router;
