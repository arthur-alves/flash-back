// Storage for household "profiles" (no password, just a name — think
// Netflix/Steam Family profile picker) and per-profile game saves.
//
// Implemented today as flat JSON files, matching the rest of the project.
// Every function here is intentionally the only place that touches the
// filesystem, so swapping this for SQLite/MariaDB later (for password-
// protected multi-user accounts) only means rewriting this one module —
// the API routes and frontend never touch the storage layer directly.
const fs = require("fs");
const path = require("path");
const { slugify } = require("./slugify");

const PROFILES_PATH = path.join(__dirname, "..", "..", "data", "profiles.json");
const SAVES_DIR = path.join(__dirname, "..", "..", "data", "saves");

function loadProfiles() {
  if (!fs.existsSync(PROFILES_PATH)) return [];
  return JSON.parse(fs.readFileSync(PROFILES_PATH, "utf-8"));
}

function saveProfiles(profiles) {
  fs.mkdirSync(path.dirname(PROFILES_PATH), { recursive: true });
  fs.writeFileSync(PROFILES_PATH, JSON.stringify(profiles, null, 2) + "\n");
}

function uniqueId(existingIds, baseId) {
  const existing = new Set(existingIds);
  if (!existing.has(baseId)) return baseId;
  let i = 2;
  while (existing.has(`${baseId}-${i}`)) i++;
  return `${baseId}-${i}`;
}

function createProfile(name) {
  const profiles = loadProfiles();
  const id = uniqueId(
    profiles.map((p) => p.id),
    slugify(name)
  );
  const profile = { id, name };
  profiles.push(profile);
  saveProfiles(profiles);
  return profile;
}

function deleteProfile(id) {
  const profiles = loadProfiles();
  const index = profiles.findIndex((p) => p.id === id);
  if (index === -1) return false;
  profiles.splice(index, 1);
  saveProfiles(profiles);
  const dir = path.join(SAVES_DIR, id);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  return true;
}

function profileExists(id) {
  return loadProfiles().some((p) => p.id === id);
}

function savePath(profileId, gameSlug) {
  return path.join(SAVES_DIR, profileId, `${gameSlug}.json`);
}

// A save is just an opaque bag of localStorage key/value pairs (everything
// Ruffle wrote for that game's SharedObject data) — we don't parse or
// understand the contents, just round-trip them.
function getSave(profileId, gameSlug) {
  const file = savePath(profileId, gameSlug);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function putSave(profileId, gameSlug, data) {
  const file = savePath(profileId, gameSlug);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data));
}

module.exports = {
  loadProfiles,
  createProfile,
  deleteProfile,
  profileExists,
  getSave,
  putSave,
};
