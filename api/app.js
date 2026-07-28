const express = require("express");
const cors = require("cors");

const routes = require("./src/routes");
const webhookRoutes = require("./src/routes/webhook.routes");

const {
    notFoundHandler,
    errorHandler,
} = require("./src/middleware/error.middleware");

const app = express();

// Global middleware
app.use(cors());
app.use(express.json({
    verify: (req, res, buffer) => {
        if (req.originalUrl.startsWith("/api/webhooks/gitea")) {
            req.rawBody = Buffer.from(buffer);
        }
    },
}));
app.use(express.urlencoded({ extended: true }));

// API routes
app.use("/api/webhooks", webhookRoutes);
app.use("/api", routes);

// Error middleware must be placed after routes
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
