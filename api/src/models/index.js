const sequelize = require("../config/db.config.js");
const User = require("./user/user.model.js");
const Tocken = require("./tocken/tocken.model.js");
const Repo = require("./repo-location/repo.model.js");

Tocken.hasMany(Repo, {
  foreignKey: "tocken_id",
  as: "repos",
});

Repo.belongsTo(Tocken, {
  foreignKey: "tocken_id",
  as: "tocken",
});

const db = {
    sequelize,
    User,
    Tocken,
    Repo,
};

module.exports = db;