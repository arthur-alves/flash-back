const grid = document.getElementById("grid");
const emptyMsg = document.getElementById("empty");
const searchInput = document.getElementById("search");
const tagsRow = document.getElementById("tags-row");

let allGames = [];
let activeTag = "";

function hashHue(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

function buildCard(game) {
  const card = document.createElement("a");
  card.className = "card";
  card.href = `play.html?slug=${encodeURIComponent(game.slug)}`;

  const cover = document.createElement("div");
  cover.className = "card-cover";

  if (game.cover) {
    const img = document.createElement("img");
    img.src = `covers/${game.slug}.${game.cover}`;
    img.alt = game.title;
    cover.appendChild(img);
  } else {
    const hue = hashHue(game.slug);
    cover.style.setProperty("--hue1", `hsl(${hue}, 70%, 55%)`);
    cover.style.setProperty("--hue2", `hsl(${(hue + 60) % 360}, 70%, 55%)`);
    cover.textContent = game.title.slice(0, 1).toUpperCase();
  }

  const title = document.createElement("div");
  title.className = "card-title";
  title.textContent = game.title;

  card.appendChild(cover);
  card.appendChild(title);
  return card;
}

function renderGames(games) {
  grid.innerHTML = "";
  emptyMsg.classList.toggle("hidden", games.length > 0);
  for (const game of games) {
    grid.appendChild(buildCard(game));
  }
}

function applyFilters() {
  const q = searchInput.value.toLowerCase().trim();
  let filtered = allGames;

  if (activeTag) {
    filtered = filtered.filter((g) => (g.tags || []).includes(activeTag));
  }
  if (q) {
    filtered = filtered.filter((g) => g.title.toLowerCase().includes(q));
  }

  renderGames(filtered);
}

async function loadGames() {
  const res = await fetch("/api/games");
  allGames = await res.json();
  applyFilters();
}

async function loadTags() {
  const res = await fetch("/api/tags");
  if (!res.ok) return;
  const tags = await res.json();

  if (tags.length === 0) return;

  tagsRow.classList.remove("hidden");
  tagsRow.innerHTML = "";

  const allChip = document.createElement("button");
  allChip.className = "tag-chip active";
  allChip.textContent = "Todos";
  allChip.dataset.tag = "";
  allChip.addEventListener("click", () => setActiveTag(""));
  tagsRow.appendChild(allChip);

  for (const { tag, count } of tags) {
    const chip = document.createElement("button");
    chip.className = "tag-chip";
    chip.textContent = `${tag} (${count})`;
    chip.dataset.tag = tag;
    chip.addEventListener("click", () => setActiveTag(tag));
    tagsRow.appendChild(chip);
  }
}

function setActiveTag(tag) {
  activeTag = tag;
  for (const chip of tagsRow.querySelectorAll(".tag-chip")) {
    chip.classList.toggle("active", chip.dataset.tag === tag);
  }
  applyFilters();
}

searchInput.addEventListener("input", applyFilters);

loadGames();
loadTags();
