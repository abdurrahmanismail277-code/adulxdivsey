const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const contactHandler = require("../api/contact");

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

const app = express();
const frontendPath = path.join(__dirname, "..", "frontend");

app.use(cors());
app.use(express.json());
app.use(express.static(frontendPath));

app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/contact", contactHandler);
app.options("/api/contact", contactHandler);

module.exports = app;
