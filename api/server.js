require("dotenv").config({
    path: [".env.local", ".env"],
});

const app = require("./app");
const { sequelize } = require("./src/models");

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
    try {
        await sequelize.authenticate();

        console.log("MySQL database connected successfully.");

        await sequelize.sync();

        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
            console.log(`API available at http://localhost:${PORT}/api`);
        });
    } catch (error) {
        console.error("Unable to start the server:");
        console.error(error);

        process.exit(1);
    }
}

startServer();
