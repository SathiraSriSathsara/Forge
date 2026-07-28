require("dotenv").config();

const app = require("./app");
const sequelize = require("./src/config/db.config");

const PORT = process.env.PORT || 3000;

async function startServer() {
    try {
        await sequelize.authenticate();

        console.log("MySQL database connected successfully.");

        await sequelize.sync();

        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("Unable to start the server:");
        console.error(error.message);

        process.exit(1);
    }
}

startServer();