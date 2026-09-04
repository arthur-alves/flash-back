const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const { isValidSwf } = require("./lib/validateSwf");
const { detectImageExt } = require("./lib/validateImage");
const { slugify } = require("./lib/slugify");
const { requireAdminAuth } = require("./lib/adminAuth");

const PORT = process.env.PORT || 4000;
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB || 200);

const CATALOG_PATH = path.join(__dirname, "..", "data", "catalog.json");
const GAMES_DIR = path.join(__dirname, "..", "games");
const COVERS_DIR = path.join(__dirname, "..", "data", "covers");
const PUBLIC_DIR = path.join(__dirname, "..", "public");

const app = express();

function loadCatalog() {
  if (!fs.existsSync(CATALOG_PATH)) return [];
  return JSON.parse(fs.readFileSync(CATALOG_PATH, "utf-8"));
}

function saveCatalog(catalog) {
  fs.mkdirSync(path.dirname(CATALOG_PATH), { recursive: true });
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2));
}

function uniqueSlug(catalog, baseSlug) {
  const existing = new Set(catalog.map((g) => g.slug));
  if (!existing.has(baseSlug)) return baseSlug;
  let i = 2;
  while (existing.has(`${baseSlug}-${i}`)) i++;
  return `${baseSlug}-${i}`;
}

function removeExistingCovers(slug) {
  for (const ext of ["jpg", "png", "webp"]) {
    const p = path.join(COVERS_DIR, `${slug}.${ext}`);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

function saveCover(slug, buffer) {
  const ext = detectImageExt(buffer);
  if (!ext) return null;
  fs.mkdirSync(COVERS_DIR, { recursive: true });
  removeExistingCovers(slug);
  fs.writeFileSync(path.join(COVERS_DIR, `${slug}.${ext}`), buffer);
  return ext;
}

// ---- Public API ----

app.get("/api/games", (req, res) => {
  const q = (req.query.q || "").toLowerCase().trim();
  let games = loadCatalog();
  if (q) {
    games = games.filter((g) => g.title.toLowerCase().includes(q));
  }
  res.json(
    games.map((g) => ({
      slug: g.slug,
      title: g.title,
      description: g.description,
      cover: g.cover || null,
    }))
  );
});

app.get("/api/games/:slug", (req, res) => {
  const games = loadCatalog();
  const game = games.find((g) => g.slug === req.params.slug);
  if (!game) return res.status(404).json({ error: "Game not found" });
  res.json(game);
});

// ---- Admin API (protected) ----

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
});

app.get("/api/admin/games", requireAdminAuth, (req, res) => {
  res.json(loadCatalog());
});

app.post(
  "/api/admin/games",
  requireAdminAuth,
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

    if (!file) {
      return res.status(400).json({ error: "Nenhum arquivo enviado." });
    }
    if (!title) {
      return res.status(400).json({ error: "Título é obrigatório." });
    }
    if (!isValidSwf(file.buffer)) {
      return res.status(400).json({
        error:
          "Arquivo inválido: o conteúdo não corresponde a um arquivo .swf (assinatura FWS/CWS/ZWS não encontrada).",
      });
    }
    if (coverFile && !detectImageExt(coverFile.buffer)) {
      return res.status(400).json({
        error: "Capa inválida: envie uma imagem JPG, PNG ou WebP de verdade.",
      });
    }

    const catalog = loadCatalog();
    const slug = uniqueSlug(catalog, slugify(title));
    const filename = `${slug}.swf`;

    fs.mkdirSync(GAMES_DIR, { recursive: true });
    fs.writeFileSync(path.join(GAMES_DIR, filename), file.buffer);

    const coverExt = coverFile ? saveCover(slug, coverFile.buffer) : null;

    const entry = {
      slug,
      title,
      description,
      file: filename,
      sizeBytes: file.buffer.length,
      cover: coverExt,
    };

    catalog.push(entry);
    catalog.sort((a, b) => a.title.localeCompare(b.title));
    saveCatalog(catalog);

    res.status(201).json(entry);
  }
);

app.post(
  "/api/admin/games/:slug/cover",
  requireAdminAuth,
  (req, res, next) => {
    upload.single("cover")(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  },
  (req, res) => {
    const catalog = loadCatalog();
    const game = catalog.find((g) => g.slug === req.params.slug);
    if (!game) return res.status(404).json({ error: "Game not found" });

    if (!req.file) {
      return res.status(400).json({ error: "Nenhuma imagem enviada." });
    }

    const ext = detectImageExt(req.file.buffer);
    if (!ext) {
      return res.status(400).json({
        error: "Capa inválida: envie uma imagem JPG, PNG ou WebP de verdade.",
      });
    }

    game.cover = saveCover(game.slug, req.file.buffer);
    saveCatalog(catalog);
    res.json(game);
  }
);

app.delete("/api/admin/games/:slug", requireAdminAuth, (req, res) => {
  const catalog = loadCatalog();
  const index = catalog.findIndex((g) => g.slug === req.params.slug);
  if (index === -1) return res.status(404).json({ error: "Game not found" });

  const [removed] = catalog.splice(index, 1);
  const filePath = path.join(GAMES_DIR, removed.file);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  removeExistingCovers(removed.slug);

  saveCatalog(catalog);
  res.json({ ok: true });
});

app.use("/admin.html", requireAdminAuth);
app.use("/games", express.static(GAMES_DIR, { fallthrough: false }));
app.use("/covers", express.static(COVERS_DIR));
app.use(express.static(PUBLIC_DIR));

app.listen(PORT, () => {
  console.log(`flash-games-server listening on http://0.0.0.0:${PORT}`);
});
