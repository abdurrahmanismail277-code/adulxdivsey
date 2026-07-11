const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
// Load contact handler. Prefer an Express-style module in `api/contact.js`,
// but fall back to Netlify-style functions (netlify/functions/contact.js)
// by adapting `exports.handler(event)` to an Express `req,res` handler.
let contactHandler;
try {
  const expressPath = path.join(__dirname, '..', 'api', 'contact');
  const netlifyPath = path.join(__dirname, '..', 'netlify', 'functions', 'contact');

  let mod;
  if (fs.existsSync(expressPath + '.js')) {
    mod = require(expressPath);
  } else if (fs.existsSync(netlifyPath + '.js')) {
    mod = require(netlifyPath);
  } else if (fs.existsSync(path.join(__dirname, '..', 'contact.js'))) {
    mod = require(path.join(__dirname, '..', 'contact.js'));
  } else {
    throw new Error('No contact handler found (searched api/contact, netlify/functions/contact, contact.js)');
  }

  if (typeof mod === 'function') {
    // Already an express-style handler
    contactHandler = mod;
  } else if (mod && typeof mod.handler === 'function') {
    // Netlify-style function: adapt to Express
    contactHandler = async (req, res) => {
      const event = {
        httpMethod: req.method,
        headers: req.headers || {},
        queryStringParameters: Object.keys(req.query || {}).length ? req.query : null,
        body: req.body && Object.keys(req.body).length ? JSON.stringify(req.body) : (req.rawBody || undefined),
        path: req.path
      };

      try {
        const result = await mod.handler(event);
        const status = result && result.statusCode ? result.statusCode : 200;
        if (result && result.headers) {
          Object.entries(result.headers).forEach(([k, v]) => res.set(k, v));
        }

        const body = result && result.body;
        if (typeof body === 'string') {
          try {
            const parsed = JSON.parse(body);
            return res.status(status).json(parsed);
          } catch (e) {
            return res.status(status).send(body);
          }
        }

        return res.status(status).json(body);
      } catch (err) {
        return res.status(500).json({ message: 'Contact handler error', detail: err.message });
      }
    };
  } else {
    throw new Error('Contact handler has unexpected shape');
  }
} catch (err) {
  // During startup, we want the require to succeed; provide a failing handler that returns 500.
  contactHandler = (req, res) => res.status(500).json({ message: 'Contact handler failed to load', detail: err.message });
}
const authStore = require("./auth-store");

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
const publicPath = path.join(__dirname, "..");

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
