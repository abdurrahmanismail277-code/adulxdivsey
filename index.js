const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

function requireFirstAvailable(paths) {
  for (const modulePath of paths) {
    try {
      return require(modulePath);
    } catch (error) {
      if (error.code !== "MODULE_NOT_FOUND") throw error;
    }
  }

  throw new Error(`None of these modules could be loaded: ${paths.join(", ")}`);
}

const contactHandler = requireFirstAvailable(["./contact", "./api/contact"]);
const authStore = requireFirstAvailable(["./auth-store", "./backend/auth-store"]);

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!match) continue;

    const key = match[1];
    let value = match[2] || "";
    value = value.replace(/^(['"])(.*)\1$/, "$2");

    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(path.join(__dirname, ".env"));
loadEnvFile(path.join(__dirname, "backend", ".env"));

const app = express();
const publicPath = __dirname;

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.all("/api/contact", contactHandler);

function sendAuthResult(res, result) {
  res.status(result.status).json(result.body);
}

app.post("/api/auth/register", (req, res) => {
  sendAuthResult(res, authStore.registerUser(req.body || {}));
});

app.post("/api/auth/login", (req, res) => {
  sendAuthResult(res, authStore.loginUser(req.body || {}));
});

app.post("/auth/register", (req, res) => {
  sendAuthResult(res, authStore.registerUser(req.body || {}));
});

app.post("/auth/login", (req, res) => {
  sendAuthResult(res, authStore.loginUser(req.body || {}));
});

app.use(express.static(publicPath, {
  index: "index.html",
  extensions: ["html"]
}));

app.get(/^\/(?!api\/).*/, (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

module.exports = app;
