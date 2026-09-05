const grid = document.getElementById("grid");
const emptyMsg = document.getElementById("empty");

let lastCollections = [];

function hashHue(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

function buildCollectionCard(collection) {
  const card = document.createElement("a");
  card.className = "card";
  card.href = `collection?slug=${encodeURIComponent(collection.slug)}`;

  const cover = document.createElement("div");
  cover.className = "card-cover";

  if (collection.cover) {
    cover.classList.add("has-image");
    const img = document.createElement("img");
    img.src = `covers/collections/${collection.slug}.${collection.cover}?v=${collection.coverVersion || 0}`;
    img.alt = collection.name;
    cover.appendChild(img);
  } else {
    const hue = hashHue(collection.slug);
    cover.style.setProperty("--hue1", `hsl(${hue}, 70%, 55%)`);
    cover.style.setProperty("--hue2", `hsl(${(hue + 60) % 360}, 70%, 55%)`);
    cover.textContent = collection.name.slice(0, 1).toUpperCase();
  }

  const title = document.createElement("div");
  title.className = "card-title";
  title.textContent = collection.name;

  const count = document.createElement("div");
  count.className = "card-subtitle";
  count.textContent = tCount("games_count", collection.count);

  card.append(cover, title, count);

  if (collection.description) {
    const desc = document.createElement("div");
    desc.className = "card-description";
    desc.textContent = collection.description;
    card.appendChild(desc);
  }

  return card;
}

function render() {
  grid.innerHTML = "";
  emptyMsg.classList.toggle("hidden", lastCollections.length > 0);
  for (const collection of lastCollections) {
    grid.appendChild(buildCollectionCard(collection));
  }
}

async function main() {
  const res = await fetch("/api/collections");
  lastCollections = await res.json();
  render();
}

initViewToggle(grid, document.getElementById("view-toggle"));
initThemeToggle(document.getElementById("theme-select"));
initLangToggle(document.getElementById("lang-select"));

function onLanguageChange() {
  render();
}

main();
