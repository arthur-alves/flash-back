const express = require("express");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 4000;
const CATALOG_PATH = path.join(__dirname, "..", "data", "catalog.json");
const GAMES_DIR = path.join(__dirname, "..", "games");
const COVERS_DIR = path.join(__dirname, "..", "data", "covers");
const PUBLIC_DIR = path.join(__dirname, "..", "public");

const app = express();

function loadCatalog() {
  if (!fs.existsSync(CATALOG_PATH)) return [];
  return JSON.parse(fs.readFileSync(CATALOG_PATH, "utf-8"));
}

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
      hasCover: Boolean(g.cover),
    }))
  );
});

app.get("/api/games/:slug", (req, res) => {
  const games = loadCatalog();
  const game = games.find((g) => g.slug === req.params.slug);
  if (!game) return res.status(404).json({ error: "Game not found" });
  res.json(game);
});

app.use("/games", express.static(GAMES_DIR, { fallthrough: false }));
app.use("/covers", express.static(COVERS_DIR));
app.use(express.static(PUBLIC_DIR));

app.listen(PORT, () => {
  console.log(`flash-games-server listening on http://0.0.0.0:${PORT}`);
});
