const express = require("express");
const cors = require("cors");

const routes = require("./src/routes");

const {
    notFoundHandler,
    errorHandler,
} = require("./src/middleware/error.middleware");

const app = express();

// Global middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use("/api", routes);

// Error middleware must be placed after routes
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;