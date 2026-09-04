const grid = document.getElementById("grid");
const emptyMsg = document.getElementById("empty");
const searchInput = document.getElementById("search");

let allGames = [];

function hashHue(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

function renderGames(games) {
  grid.innerHTML = "";
  emptyMsg.classList.toggle("hidden", games.length > 0);

  for (const game of games) {
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
    grid.appendChild(card);
  }
}

async function loadGames() {
  const res = await fetch("/api/games");
  allGames = await res.json();
  renderGames(allGames);
}

searchInput.addEventListener("input", () => {
  const q = searchInput.value.toLowerCase().trim();
  const filtered = q
    ? allGames.filter((g) => g.title.toLowerCase().includes(q))
    : allGames;
  renderGames(filtered);
});

loadGames();
