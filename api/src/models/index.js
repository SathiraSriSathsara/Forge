const sequelize = require("../config/db.config.js");
const User = require("./user/user.model.js");

const db = {
    sequelize,
    User,
};

module.exports = db;