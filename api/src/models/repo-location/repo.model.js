const { DataTypes } = require("sequelize");
const sequelize = require("../../config/db.config.js");

const Repo = sequelize.define(
  "Repo",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    repo_name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },

    saved_location: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },

    repo_url: {
      type: DataTypes.STRING(500),
      allowNull: false,
      unique: true,
    },

    branch: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: "main",
    },

    tocken_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Tocken",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },

    webhook_secret: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },

    image_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },

    last_commit: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    last_updated: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "Repo",
    timestamps: true,
    underscored: true,
  },
);

module.exports = Repo;
