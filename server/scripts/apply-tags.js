// Merges curated tags.json into data/catalog.json by slug.
// Safe to re-run after `npm run scrape` (which preserves existing tags too).
const fs = require("fs");
const path = require("path");

const CATALOG_PATH = path.join(__dirname, "..", "..", "data", "catalog.json");
const TAGS_PATH = path.join(__dirname, "tags.json");

const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf-8"));
const tagsMap = JSON.parse(fs.readFileSync(TAGS_PATH, "utf-8"));

let updated = 0;
for (const game of catalog) {
  const tags = tagsMap[game.slug];
  if (tags && JSON.stringify(game.tags) !== JSON.stringify(tags)) {
    game.tags = tags;
    updated++;
  }
}

fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2) + "\n");
console.log(`Updated tags for ${updated} games in ${CATALOG_PATH}.`);
