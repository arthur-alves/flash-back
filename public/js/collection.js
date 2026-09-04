const params = new URLSearchParams(window.location.search);
const slug = params.get("slug");

const titleEl = document.getElementById("collection-title");
const descEl = document.getElementById("collection-description");
const grid = document.getElementById("grid");
const emptyMsg = document.getElementById("empty");

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

async function main() {
  if (!slug) {
    titleEl.textContent = "Coleção não especificada";
    return;
  }

  const res = await fetch(`/api/collections/${encodeURIComponent(slug)}`);
  if (!res.ok) {
    titleEl.textContent = "Coleção não encontrada";
    return;
  }

  const collection = await res.json();
  titleEl.textContent = collection.name;
  document.title = `${collection.name} — Flash Games Server`;
  descEl.textContent = collection.description || "";

  emptyMsg.classList.toggle("hidden", collection.games.length > 0);
  for (const game of collection.games) {
    grid.appendChild(buildCard(game));
  }
}

main();
