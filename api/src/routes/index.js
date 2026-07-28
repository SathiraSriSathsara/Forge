const express = require("express");
const userRoutes = require("./user.routes");
const repoRoutes = require("./repo.routes");
const tockenRoutes = require("./tocken.routes");

const router = express.Router();

router.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "API is running",
    });
});

router.use("/users", userRoutes);
router.use("/repos", repoRoutes);
router.use("/tockens", tockenRoutes);

module.exports = router;