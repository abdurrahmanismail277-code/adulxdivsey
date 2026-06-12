const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const usersPath = path.join(__dirname, "users.json");

function readUsers() {
  if (!fs.existsSync(usersPath)) return [];

  try {
    const users = JSON.parse(fs.readFileSync(usersPath, "utf8"));
    return Array.isArray(users) ? users : [];
  } catch {
    return [];
  }
}

function writeUsers(users) {
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedPassword) {
  const [salt, hash] = String(storedPassword || "").split(":");
  if (!salt || !hash) return false;

  const candidate = crypto.scryptSync(String(password), salt, 64);
  const stored = Buffer.from(hash, "hex");
  return stored.length === candidate.length && crypto.timingSafeEqual(stored, candidate);
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    created_at: user.created_at
  };
}

function registerUser({ username, email, password }) {
  const cleanEmail = normalizeEmail(email);
  const cleanUsername = String(username || "").trim();

  if (!cleanEmail || !password) {
    return { status: 400, body: { success: false, msg: "Email and password are required." } };
  }

  const users = readUsers();
  if (users.some((user) => user.email === cleanEmail)) {
    return { status: 409, body: { success: false, msg: "An account with this email already exists." } };
  }

  const user = {
    id: crypto.randomUUID(),
    username: cleanUsername,
    email: cleanEmail,
    password: hashPassword(password),
    created_at: new Date().toISOString()
  };

  users.push(user);
  writeUsers(users);

  return {
    status: 201,
    body: {
      success: true,
      msg: "Account created successfully.",
      user: publicUser(user)
    }
  };
}

function loginUser({ email, password }) {
  const cleanEmail = normalizeEmail(email);

  if (!cleanEmail || !password) {
    return { status: 400, body: { success: false, msg: "Email and password are required." } };
  }

  const user = readUsers().find((item) => item.email === cleanEmail);
  if (!user || !verifyPassword(password, user.password)) {
    return { status: 401, body: { success: false, msg: "Invalid email or password." } };
  }

  return {
    status: 200,
    body: {
      success: true,
      msg: "Login successful.",
      user: publicUser(user)
    }
  };
}

module.exports = {
  loginUser,
  registerUser
};
