// Downloads .swf files from AmmarSAA/flash-games-directory and builds data/catalog.json
const fs = require("fs");
const path = require("path");
const https = require("https");

const REPO_OWNER = "AmmarSAA";
const REPO_NAME = "flash-games-directory";
const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents`;

const GAMES_DIR = path.join(__dirname, "..", "..", "games");
const CATALOG_PATH = path.join(__dirname, "..", "..", "data", "catalog.json");

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "flash-games-server" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(httpGetJson(res.headers.location));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`GET ${url} -> ${res.statusCode}`));
      }
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(JSON.parse(data)));
    }).on("error", reject);
  });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, { headers: { "User-Agent": "flash-games-server" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlinkSync(destPath);
        return resolve(downloadFile(res.headers.location, destPath));
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        return reject(new Error(`GET ${url} -> ${res.statusCode}`));
      }
      res.pipe(file);
      file.on("finish", () => file.close(resolve));
    }).on("error", (err) => {
      file.close();
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      reject(err);
    });
  });
}

function slugify(filename) {
  return filename.replace(/\.swf$/i, "").toLowerCase();
}

function toTitle(filename) {
  const nameWithoutExt = filename.replace(/\.swf$/i, "");
  return nameWithoutExt
    .split("-")
    .map((word) => (word.length ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ");
}

async function main() {
  console.log(`Fetching file list from ${REPO_OWNER}/${REPO_NAME}...`);
  const files = await httpGetJson(API_URL);

  if (!Array.isArray(files)) {
    throw new Error("Unexpected GitHub API response: " + JSON.stringify(files).slice(0, 300));
  }

  const swfFiles = files.filter((f) => f.type === "file" && f.name.toLowerCase().endsWith(".swf"));
  console.log(`Found ${swfFiles.length} .swf files.`);

  fs.mkdirSync(GAMES_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(CATALOG_PATH), { recursive: true });

  const existingCatalog = fs.existsSync(CATALOG_PATH)
    ? JSON.parse(fs.readFileSync(CATALOG_PATH, "utf-8"))
    : [];
  const existingBySlug = new Map(existingCatalog.map((g) => [g.slug, g]));

  const catalog = [];

  for (const file of swfFiles) {
    const slug = slugify(file.name);
    const destPath = path.join(GAMES_DIR, file.name);
    const alreadyDownloaded = fs.existsSync(destPath) && fs.statSync(destPath).size === file.size;

    if (!alreadyDownloaded) {
      process.stdout.write(`Downloading ${file.name} (${(file.size / 1024).toFixed(0)} KB)... `);
      await downloadFile(file.download_url, destPath);
      console.log("done");
    }

    const previous = existingBySlug.get(slug) || {};

    catalog.push({
      slug,
      title: previous.title || toTitle(file.name),
      description: previous.description || "",
      file: file.name,
      sizeBytes: file.size,
      cover: previous.cover || null,
      tags: previous.tags || [],
    });
  }

  catalog.sort((a, b) => a.title.localeCompare(b.title));
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2) + "\n");
  console.log(`\nCatalog written to ${CATALOG_PATH} (${catalog.length} games).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
