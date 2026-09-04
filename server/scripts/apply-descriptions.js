// Merges curated descriptions.json into data/catalog.json by slug.
// Safe to re-run after `npm run scrape` (which preserves existing descriptions too).
const fs = require("fs");
const path = require("path");

const CATALOG_PATH = path.join(__dirname, "..", "..", "data", "catalog.json");
const DESCRIPTIONS_PATH = path.join(__dirname, "descriptions.json");

const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf-8"));
const descriptions = JSON.parse(fs.readFileSync(DESCRIPTIONS_PATH, "utf-8"));

let updated = 0;
for (const game of catalog) {
  if (descriptions[game.slug] && game.description !== descriptions[game.slug]) {
    game.description = descriptions[game.slug];
    updated++;
  }
}

fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2));
console.log(`Updated ${updated} descriptions in ${CATALOG_PATH}.`);
