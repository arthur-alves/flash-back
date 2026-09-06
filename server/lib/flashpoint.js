// Lets the admin panel search the Flashpoint Archive (flashpointarchive.org)
// and import a game directly from its original hosting URL, when that URL
// is still alive. Deliberately does NOT use Flashpoint's GameZIP mirrors
// (unstable.life) — those require depending on an unofficial third-party
// player site to resolve a working download URL, which is more fragile and
// more invasive than just trying the same "Launch Command" URLs Flashpoint
// itself lists for the entry.
//
// "Respect" scenario: every request identifies itself with a real User-Agent
// and a timeout, requests to flashpointarchive.org and to individual
// candidate hosts are always sequential (never parallel/burst), and a
// server-side cooldown throttles how often an admin (or a bug in the UI)
// can trigger a search/import in the first place. This is a manually
// triggered, one-game-at-a-time tool — not a bulk scraper.
const https = require("https");
const http = require("http");
const { isValidSwf } = require("./validateSwf");

const USER_AGENT = "FlashBack/1.0 (+https://github.com/arthur-alves/flash-back) game importer";
const REQUEST_TIMEOUT_MS = 8000;
const BETWEEN_REQUESTS_DELAY_MS = 500;

const SEARCH_COOLDOWN_MS = 2000;
const IMPORT_COOLDOWN_MS = 3000;
let lastSearchAt = 0;
let lastImportAt = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function checkCooldown(lastAt, cooldownMs) {
  const elapsed = Date.now() - lastAt;
  return elapsed >= cooldownMs ? 0 : cooldownMs - elapsed;
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https:") ? https : http;
    const req = client.get(
      url,
      { headers: { "User-Agent": USER_AGENT }, timeout: REQUEST_TIMEOUT_MS },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return resolve(fetchText(new URL(res.headers.location, url).href));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`GET ${url} -> ${res.statusCode}`));
        }
        let data = "";
        res.setEncoding("utf-8");
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      }
    );
    req.on("timeout", () => req.destroy(new Error(`GET ${url} timed out`)));
    req.on("error", reject);
  });
}

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https:") ? https : http;
    const req = client.get(
      url,
      { headers: { "User-Agent": USER_AGENT }, timeout: REQUEST_TIMEOUT_MS },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return resolve(fetchBuffer(new URL(res.headers.location, url).href));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`GET ${url} -> ${res.statusCode}`));
        }
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      }
    );
    req.on("timeout", () => req.destroy(new Error(`GET ${url} timed out`)));
    req.on("error", reject);
  });
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

// Returns the number of ms the caller should wait before this would be
// allowed, or 0 if it's fine to proceed right now (and marks it as used).
function trySearchSlot() {
  const wait = checkCooldown(lastSearchAt, SEARCH_COOLDOWN_MS);
  if (wait === 0) lastSearchAt = Date.now();
  return wait;
}

function tryImportSlot() {
  const wait = checkCooldown(lastImportAt, IMPORT_COOLDOWN_MS);
  if (wait === 0) lastImportAt = Date.now();
  return wait;
}

// Flashpoint's own image CDN, keyed off the entry's UUID — no search or
// detail-page scraping needed to find it, the URL is always this shape.
function logoUrl(id) {
  return `https://infinity.unstable.life/images/Logos/${id.slice(0, 2)}/${id.slice(2, 4)}/${id}.png?type=jpg`;
}

// The search results page already labels each entry's type ("Flash game",
// "Flash animation", "HTML5 game", "Unity game", "Java game", ...) right in
// the markup — filtering on that costs nothing extra (no additional
// requests), unlike actually checking whether a working .swf download link
// exists for each result, which would mean fetching every result's detail
// page and trying its candidate hosts before showing anything. That's left
// for import time (one game at a time, on click) to keep search itself
// respectful of flashpointarchive.org and the third-party hosts it links to.
async function search(query) {
  const url = `https://flashpointarchive.org/search?query=${encodeURIComponent(query)}`;
  const html = await fetchText(url);

  const results = [];
  const blockRe = /<div class="fp-search-result">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
  let block;
  while ((block = blockRe.exec(html))) {
    const section = block[1];
    const titleMatch = section.match(/<a class="fp-search-result-title" href="\/view\?id=([0-9a-f-]+)">([^<]*)/);
    const infoMatch = section.match(/<div class="fp-search-result-info">([^<-]*)/);
    if (!titleMatch) continue;

    const type = infoMatch ? infoMatch[1].trim() : "";
    if (!type.startsWith("Flash")) continue;

    const id = titleMatch[1];
    results.push({
      id,
      title: decodeEntities(titleMatch[2]),
      type,
      logo: logoUrl(id),
    });
  }
  return results;
}

function extractRow(html, label) {
  const re = new RegExp(`<th>${label}:</th>\\s*<td>([\\s\\S]*?)</td>`);
  const match = html.match(re);
  return match ? decodeEntities(match[1].replace(/<[^>]+>/g, "")) : "";
}

function extractLaunchCommands(html) {
  const commands = [];
  const re = /<th>Launch Command:<\/th>\s*<td>([^<]*)<\/td>/g;
  let match;
  while ((match = re.exec(html))) {
    const url = decodeEntities(match[1]);
    if (url && !url.startsWith("http://localflash/") && !commands.includes(url)) {
      commands.push(url);
    }
  }
  return commands;
}

async function getEntry(id) {
  const html = await fetchText(`https://flashpointarchive.org/view?id=${encodeURIComponent(id)}`);

  const titleMatch = html.match(/<div class="fp-content-header">([^<]*)<\/div>/);
  return {
    id,
    title: titleMatch ? decodeEntities(titleMatch[1]) : "",
    description: extractRow(html, "Original Description"),
    platform: extractRow(html, "Platform"),
    launchCommands: extractLaunchCommands(html),
  };
}

// Tries each candidate URL in turn (sequentially, with a delay between
// attempts out of courtesy to whatever server is still hosting each one),
// and returns the buffer + source URL of the first one that's a genuine
// .swf file. Returns null if none of them pan out — the caller should treat
// that as "skip this game" rather than falling back to anything else.
async function fetchFirstValidSwf(candidateUrls) {
  for (let i = 0; i < candidateUrls.length; i++) {
    if (i > 0) await sleep(BETWEEN_REQUESTS_DELAY_MS);
    try {
      const buffer = await fetchBuffer(candidateUrls[i]);
      if (isValidSwf(buffer)) {
        return { buffer, sourceUrl: candidateUrls[i] };
      }
    } catch (err) {
      // Dead link, timeout, non-200, whatever — just move on to the next candidate.
    }
  }
  return null;
}

// Best-effort fetch of the entry's logo/cover image from Flashpoint's own
// image CDN (not a third-party host, so this doesn't need the same
// candidate-list/fallback treatment as the .swf itself). Returns null on
// any failure — a missing cover is never a reason to fail the import.
async function fetchLogo(id) {
  try {
    return await fetchBuffer(logoUrl(id));
  } catch (err) {
    return null;
  }
}

module.exports = { search, getEntry, fetchFirstValidSwf, fetchLogo, trySearchSlot, tryImportSlot };
