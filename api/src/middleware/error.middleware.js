const { ValidationError, UniqueConstraintError } = require("sequelize");

const notFoundHandler = (req, res, next) => {
    const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);

    error.statusCode = 404;

    next(error);
};

const errorHandler = (error, req, res, next) => {
    console.error(error);

    let statusCode = error.statusCode || 500;
    let message = error.message || "Internal server error";
    let errors = error.errors || null;

    if (error instanceof UniqueConstraintError) {
        statusCode = 409;
        message = "The provided value already exists";

        errors = error.errors.map((item) => ({
            field: item.path,
            message: item.message,
        }));
    }

    if (error instanceof ValidationError) {
        statusCode = 400;
        message = "Validation failed";

        errors = error.errors.map((item) => ({
            field: item.path,
            message: item.message,
        }));
    }

    res.status(statusCode).json({
        success: false,
        message,
        errors,
        ...(process.env.NODE_ENV === "development" && {
            stack: error.stack,
        }),
    });
};

module.exports = {
    notFoundHandler,
    errorHandler,
};