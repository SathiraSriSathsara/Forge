const fs = require("node:fs");
const path = require("node:path");

const destination = path.join(__dirname, "..", "public", "assets", "vendor");
fs.mkdirSync(destination, { recursive: true });
fs.copyFileSync(
  path.join(__dirname, "..", "node_modules", "sweetalert2", "dist", "sweetalert2.all.min.js"),
  path.join(destination, "sweetalert2.all.min.js"),
);
