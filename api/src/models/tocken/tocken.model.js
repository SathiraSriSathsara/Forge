const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db.config.js");

const Tocken = sequelize.define(
  "Tocken",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    platform: {
      type: DataTypes.ENUM("github", "gitea"),
      allowNull: false,
    },

    username: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },

    tocken: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
  },
  {
    tableName: "Tocken",
    timestamps: true,
    underscored: true,
  },
);

module.exports = Tocken;