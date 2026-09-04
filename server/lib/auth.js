const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ADMIN_PATH = path.join(__dirname, "..", "..", "data", "admin.json");
const SESSION_COOKIE = "fgs_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// In-memory session store. Sessions don't survive a server restart — that's
// fine for a single self-hosted admin panel and keeps this dependency-free.
const sessions = new Map();

// RESET_ADMIN=true wipes the stored account on startup and forces the setup
// wizard again. Meant to be toggled from Portainer's env var editor (no
// terminal/SSH needed) when the admin forgets their password.
if (process.env.RESET_ADMIN === "true" && fs.existsSync(ADMIN_PATH)) {
  fs.unlinkSync(ADMIN_PATH);
  console.log("");
  console.log("========================================");
  console.log(" RESET_ADMIN=true — admin account cleared.");
  console.log(" Visit /setup to create a new account, then unset");
  console.log(" RESET_ADMIN (or set it back to false) and restart.");
  console.log("========================================");
  console.log("");
}

function isConfigured() {
  return fs.existsSync(ADMIN_PATH);
}

function loadAdmin() {
  if (!isConfigured()) return null;
  return JSON.parse(fs.readFileSync(ADMIN_PATH, "utf-8"));
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function createAdmin(username, password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = hashPassword(password, salt);

  fs.mkdirSync(path.dirname(ADMIN_PATH), { recursive: true });
  fs.writeFileSync(ADMIN_PATH, JSON.stringify({ username, salt, passwordHash }, null, 2) + "\n");
}

function verifyLogin(username, password) {
  const admin = loadAdmin();
  if (!admin) return false;

  const usernameMatches =
    Buffer.byteLength(username) === Buffer.byteLength(admin.username) &&
    crypto.timingSafeEqual(Buffer.from(username), Buffer.from(admin.username));

  if (!usernameMatches) return false;

  const candidateHash = hashPassword(password, admin.salt);
  const storedHash = Buffer.from(admin.passwordHash, "hex");
  const candidateBuf = Buffer.from(candidateHash, "hex");

  if (storedHash.length !== candidateBuf.length) return false;
  return crypto.timingSafeEqual(storedHash, candidateBuf);
}

function createSession() {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { createdAt: Date.now() });
  return token;
}

function destroySession(token) {
  sessions.delete(token);
}

function isValidSession(token) {
  const session = sessions.get(token);
  if (!session) return false;
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const cookies = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    cookies[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return cookies;
}

function setSessionCookie(res, token) {
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`
  );
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

function getSessionToken(req) {
  return parseCookies(req)[SESSION_COOKIE];
}

// Protects /admin and page-like GET requests: redirects to the right page
// instead of returning a bare 401, since these are browser navigations,
// not API calls.
function requireAdminPage(req, res, next) {
  if (!isConfigured()) return res.redirect("/setup");
  const token = getSessionToken(req);
  if (token && isValidSession(token)) return next();
  return res.redirect("/login");
}

// Protects /api/admin/* — these are fetch() calls from already-loaded pages,
// so a JSON 401 (handled by the frontend) is more appropriate than a redirect.
function requireAdminApi(req, res, next) {
  if (!isConfigured()) return res.status(401).json({ error: "not_configured" });
  const token = getSessionToken(req);
  if (token && isValidSession(token)) return next();
  return res.status(401).json({ error: "unauthenticated" });
}

module.exports = {
  isConfigured,
  createAdmin,
  verifyLogin,
  createSession,
  destroySession,
  getSessionToken,
  setSessionCookie,
  clearSessionCookie,
  requireAdminPage,
  requireAdminApi,
};
