const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const { isValidSwf } = require("./lib/validateSwf");
const { detectImageExt } = require("./lib/validateImage");
const { slugify } = require("./lib/slugify");
const auth = require("./lib/auth");

const PORT = process.env.PORT || 4000;
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 200);

const CATALOG_PATH = path.join(__dirname, "..", "data", "catalog.json");
const COLLECTIONS_PATH = path.join(__dirname, "..", "data", "collections.json");
const GAMES_DIR = path.join(__dirname, "..", "games");
const COVERS_DIR = path.join(__dirname, "..", "data", "covers");
const COLLECTION_COVERS_DIR = path.join(__dirname, "..", "data", "covers", "collections");
const PUBLIC_DIR = path.join(__dirname, "..", "public");

const app = express();
app.use(express.json());

// ---- Storage helpers ----

function loadCatalog() {
  if (!fs.existsSync(CATALOG_PATH)) return [];
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf-8"));
  // Older entries may not have a tags array yet.
  for (const g of catalog) {
    if (!Array.isArray(g.tags)) g.tags = [];
  }
  return catalog;
}

function saveCatalog(catalog) {
  fs.mkdirSync(path.dirname(CATALOG_PATH), { recursive: true });
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2) + "\n");
}

function loadCollections() {
  if (!fs.existsSync(COLLECTIONS_PATH)) return [];
  return JSON.parse(fs.readFileSync(COLLECTIONS_PATH, "utf-8"));
}

function saveCollections(collections) {
  fs.mkdirSync(path.dirname(COLLECTIONS_PATH), { recursive: true });
  fs.writeFileSync(COLLECTIONS_PATH, JSON.stringify(collections, null, 2) + "\n");
}

function uniqueSlug(existingSlugs, baseSlug) {
  const existing = new Set(existingSlugs);
  if (!existing.has(baseSlug)) return baseSlug;
  let i = 2;
  while (existing.has(`${baseSlug}-${i}`)) i++;
  return `${baseSlug}-${i}`;
}

function removeExistingCovers(dir, slug) {
  for (const ext of ["jpg", "png", "webp"]) {
    const p = path.join(dir, `${slug}.${ext}`);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

function saveCover(dir, slug, buffer) {
  const ext = detectImageExt(buffer);
  if (!ext) return null;
  fs.mkdirSync(dir, { recursive: true });
  removeExistingCovers(dir, slug);
  fs.writeFileSync(path.join(dir, `${slug}.${ext}`), buffer);
  return ext;
}

function publicGame(g) {
  return {
    slug: g.slug,
    title: g.title,
    description: g.description,
    cover: g.cover || null,
    tags: g.tags || [],
  };
}

// ---- Public API ----

app.get("/api/games", (req, res) => {
  const q = (req.query.q || "").toLowerCase().trim();
  const tag = (req.query.tag || "").toLowerCase().trim();
  let games = loadCatalog();
  if (q) {
    games = games.filter((g) => g.title.toLowerCase().includes(q));
  }
  if (tag) {
    games = games.filter((g) => (g.tags || []).some((t) => t.toLowerCase() === tag));
  }
  res.json(games.map(publicGame));
});

app.get("/api/games/:slug", (req, res) => {
  const games = loadCatalog();
  const game = games.find((g) => g.slug === req.params.slug);
  if (!game) return res.status(404).json({ error: "game_not_found" });
  res.json(game);
});

app.get("/api/tags", (req, res) => {
  const games = loadCatalog();
  const counts = new Map();
  for (const g of games) {
    for (const t of g.tags || []) {
      counts.set(t, (counts.get(t) || 0) + 1);
    }
  }
  const tags = [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => a.tag.localeCompare(b.tag));
  res.json(tags);
});

app.get("/api/collections", (req, res) => {
  const collections = loadCollections();
  res.json(
    collections.map((c) => ({
      slug: c.slug,
      name: c.name,
      description: c.description,
      cover: c.cover || null,
      count: c.games.length,
    }))
  );
});

app.get("/api/collections/:slug", (req, res) => {
  const collections = loadCollections();
  const collection = collections.find((c) => c.slug === req.params.slug);
  if (!collection) return res.status(404).json({ error: "collection_not_found" });

  const catalog = loadCatalog();
  const gamesBySlug = new Map(catalog.map((g) => [g.slug, g]));
  const games = collection.games
    .map((slug) => gamesBySlug.get(slug))
    .filter(Boolean)
    .map(publicGame);

  res.json({
    slug: collection.slug,
    name: collection.name,
    description: collection.description,
    cover: collection.cover || null,
    games,
  });
});

// ---- Admin API (protected) ----

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
});

// Lightweight "am I logged in as admin?" check, used by public pages (e.g.
// play.html) to decide whether to show admin-only controls like the cover
// capture button.
app.get("/api/admin/session", auth.requireAdminApi, (req, res) => {
  res.json({ ok: true });
});

app.get("/api/admin/games", auth.requireAdminApi, (req, res) => {
  res.json(loadCatalog());
});

app.post(
  "/api/admin/games",
  auth.requireAdminApi,
  (req, res, next) => {
    upload.fields([{ name: "swf", maxCount: 1 }, { name: "cover", maxCount: 1 }])(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  },
  (req, res) => {
    const file = req.files?.swf?.[0];
    const coverFile = req.files?.cover?.[0];
    const title = (req.body.title || "").trim();
    const description = (req.body.description || "").trim();
    const tags = [
      ...new Set(
        (req.body.tags || "")
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean)
      ),
    ].sort();

    if (!file) {
      return res.status(400).json({ error: "no_file" });
    }
    if (!title) {
      return res.status(400).json({ error: "title_required" });
    }
    if (!isValidSwf(file.buffer)) {
      return res.status(400).json({
        error: "invalid_swf",
      });
    }
    if (coverFile && !detectImageExt(coverFile.buffer)) {
      return res.status(400).json({
        error: "invalid_cover",
      });
    }

    const catalog = loadCatalog();
    const slug = uniqueSlug(catalog.map((g) => g.slug), slugify(title));
    const filename = `${slug}.swf`;

    fs.mkdirSync(GAMES_DIR, { recursive: true });
    fs.writeFileSync(path.join(GAMES_DIR, filename), file.buffer);

    const coverExt = coverFile ? saveCover(COVERS_DIR, slug, coverFile.buffer) : null;

    const entry = {
      slug,
      title,
      description,
      file: filename,
      sizeBytes: file.buffer.length,
      cover: coverExt,
      tags,
    };

    catalog.push(entry);
    catalog.sort((a, b) => a.title.localeCompare(b.title));
    saveCatalog(catalog);

    res.status(201).json(entry);
  }
);

app.post(
  "/api/admin/games/:slug/cover",
  auth.requireAdminApi,
  (req, res, next) => {
    upload.single("cover")(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  },
  (req, res) => {
    const catalog = loadCatalog();
    const game = catalog.find((g) => g.slug === req.params.slug);
    if (!game) return res.status(404).json({ error: "game_not_found" });

    if (!req.file) {
      return res.status(400).json({ error: "no_image" });
    }

    const ext = detectImageExt(req.file.buffer);
    if (!ext) {
      return res.status(400).json({
        error: "invalid_cover",
      });
    }

    game.cover = saveCover(COVERS_DIR, game.slug, req.file.buffer);
    saveCatalog(catalog);
    res.json(game);
  }
);

app.put("/api/admin/games/:slug/tags", auth.requireAdminApi, (req, res) => {
  const catalog = loadCatalog();
  const game = catalog.find((g) => g.slug === req.params.slug);
  if (!game) return res.status(404).json({ error: "game_not_found" });

  const tags = Array.isArray(req.body.tags) ? req.body.tags : [];
  game.tags = [...new Set(tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean))].sort();

  saveCatalog(catalog);
  res.json(game);
});

app.delete("/api/admin/games/:slug", auth.requireAdminApi, (req, res) => {
  const catalog = loadCatalog();
  const index = catalog.findIndex((g) => g.slug === req.params.slug);
  if (index === -1) return res.status(404).json({ error: "game_not_found" });

  const [removed] = catalog.splice(index, 1);
  const filePath = path.join(GAMES_DIR, removed.file);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  removeExistingCovers(COVERS_DIR, removed.slug);
  saveCatalog(catalog);

  // Also drop the game from any collection it belonged to.
  const collections = loadCollections();
  let changed = false;
  for (const c of collections) {
    const idx = c.games.indexOf(removed.slug);
    if (idx !== -1) {
      c.games.splice(idx, 1);
      changed = true;
    }
  }
  if (changed) saveCollections(collections);

  res.json({ ok: true });
});

// ---- Admin: collections ----

app.get("/api/admin/collections", auth.requireAdminApi, (req, res) => {
  res.json(loadCollections());
});

app.post("/api/admin/collections", auth.requireAdminApi, (req, res) => {
  const name = (req.body.name || "").trim();
  const description = (req.body.description || "").trim();

  if (!name) {
    return res.status(400).json({ error: "collection_name_required" });
  }

  const collections = loadCollections();
  const slug = uniqueSlug(collections.map((c) => c.slug), slugify(name));

  const entry = { slug, name, description, games: [], cover: null };
  collections.push(entry);
  saveCollections(collections);

  res.status(201).json(entry);
});

app.put("/api/admin/collections/:slug", auth.requireAdminApi, (req, res) => {
  const collections = loadCollections();
  const collection = collections.find((c) => c.slug === req.params.slug);
  if (!collection) return res.status(404).json({ error: "collection_not_found" });

  if (typeof req.body.name === "string" && req.body.name.trim()) {
    collection.name = req.body.name.trim();
  }
  if (typeof req.body.description === "string") {
    collection.description = req.body.description.trim();
  }

  saveCollections(collections);
  res.json(collection);
});

app.delete("/api/admin/collections/:slug", auth.requireAdminApi, (req, res) => {
  const collections = loadCollections();
  const index = collections.findIndex((c) => c.slug === req.params.slug);
  if (index === -1) return res.status(404).json({ error: "collection_not_found" });

  const [removed] = collections.splice(index, 1);
  removeExistingCovers(COLLECTION_COVERS_DIR, removed.slug);
  saveCollections(collections);
  res.json({ ok: true });
});

app.post(
  "/api/admin/collections/:slug/cover",
  auth.requireAdminApi,
  (req, res, next) => {
    upload.single("cover")(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  },
  (req, res) => {
    const collections = loadCollections();
    const collection = collections.find((c) => c.slug === req.params.slug);
    if (!collection) return res.status(404).json({ error: "collection_not_found" });

    if (!req.file) {
      return res.status(400).json({ error: "no_image" });
    }

    const ext = detectImageExt(req.file.buffer);
    if (!ext) {
      return res.status(400).json({
        error: "invalid_cover",
      });
    }

    collection.cover = saveCover(COLLECTION_COVERS_DIR, collection.slug, req.file.buffer);
    saveCollections(collections);
    res.json(collection);
  }
);

app.post("/api/admin/collections/:slug/games", auth.requireAdminApi, (req, res) => {
  const collections = loadCollections();
  const collection = collections.find((c) => c.slug === req.params.slug);
  if (!collection) return res.status(404).json({ error: "collection_not_found" });

  const gameSlug = (req.body.gameSlug || "").trim();
  const catalog = loadCatalog();
  if (!catalog.some((g) => g.slug === gameSlug)) {
    return res.status(400).json({ error: "game_not_found" });
  }

  if (!collection.games.includes(gameSlug)) {
    collection.games.push(gameSlug);
    saveCollections(collections);
  }

  res.json(collection);
});

app.delete("/api/admin/collections/:slug/games/:gameSlug", auth.requireAdminApi, (req, res) => {
  const collections = loadCollections();
  const collection = collections.find((c) => c.slug === req.params.slug);
  if (!collection) return res.status(404).json({ error: "collection_not_found" });

  const idx = collection.games.indexOf(req.params.gameSlug);
  if (idx !== -1) {
    collection.games.splice(idx, 1);
    saveCollections(collections);
  }

  res.json(collection);
});

// ---- Auth pages/API ----

app.get("/api/setup/status", (req, res) => {
  res.json({ configured: auth.isConfigured() });
});

app.post("/api/setup", (req, res) => {
  if (auth.isConfigured()) {
    return res.status(400).json({ error: "already_configured" });
  }

  const username = (req.body.username || "").trim();
  const password = req.body.password || "";

  if (username.length < 3) {
    return res.status(400).json({ error: "username_too_short" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "password_too_short" });
  }

  auth.createAdmin(username, password);
  const token = auth.createSession();
  auth.setSessionCookie(res, token);
  res.status(201).json({ ok: true });
});

app.post("/api/login", (req, res) => {
  if (!auth.isConfigured()) {
    return res.status(400).json({ error: "not_configured" });
  }

  const username = (req.body.username || "").trim();
  const password = req.body.password || "";

  if (!auth.verifyLogin(username, password)) {
    return res.status(401).json({ error: "invalid_credentials" });
  }

  const token = auth.createSession();
  auth.setSessionCookie(res, token);
  res.json({ ok: true });
});

app.post("/api/logout", (req, res) => {
  const token = auth.getSessionToken(req);
  if (token) auth.destroySession(token);
  auth.clearSessionCookie(res);
  res.json({ ok: true });
});

// ---- Clean URLs (no .html) ----

// Anyone hitting an old/bookmarked *.html URL gets redirected to the clean
// path. This also closes off direct access to admin.html/setup.html via
// static serving, since this runs before express.static below.
app.get(/\.html$/, (req, res) => {
  const clean = req.path.slice(0, -".html".length);
  const qs = req.originalUrl.slice(req.path.length);
  res.redirect(301, (clean === "/index" ? "/" : clean) + qs);
});

app.get("/setup", (req, res) => {
  if (auth.isConfigured()) return res.redirect("/login");
  res.sendFile(path.join(PUBLIC_DIR, "setup.html"));
});

app.get("/admin", auth.requireAdminPage, (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "admin.html"));
});

const CLEAN_PAGES = {
  "/": "index.html",
  "/collections": "collections.html",
  "/collection": "collection.html",
  "/play": "play.html",
  "/login": "login.html",
};

for (const [route, file] of Object.entries(CLEAN_PAGES)) {
  app.get(route, (req, res) => res.sendFile(path.join(PUBLIC_DIR, file)));
}

app.use("/games", express.static(GAMES_DIR, { fallthrough: false }));
app.use("/covers", express.static(COVERS_DIR));
app.use(express.static(PUBLIC_DIR, { index: false }));

app.listen(PORT, () => {
  console.log(`flashback listening on http://0.0.0.0:${PORT}`);
});
