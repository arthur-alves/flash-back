const params = new URLSearchParams(window.location.search);
const slug = params.get("slug");

const titleEl = document.getElementById("game-title");
const descEl = document.getElementById("game-description");
const container = document.getElementById("player-container");

async function main() {
  if (!slug) {
    titleEl.textContent = "Jogo não especificado";
    return;
  }

  const res = await fetch(`/api/games/${encodeURIComponent(slug)}`);
  if (!res.ok) {
    titleEl.textContent = "Jogo não encontrado";
    return;
  }

  const game = await res.json();
  titleEl.textContent = game.title;
  document.title = `${game.title} — Flash Games Server`;
  descEl.textContent = game.description || "";

  const ruffle = window.RufflePlayer.newest();
  const player = ruffle.createPlayer();
  player.style.width = "100%";
  player.style.height = "100%";
  container.appendChild(player);

  player.load(`/games/${encodeURIComponent(game.file)}`);
}

document.getElementById("back-link").innerHTML = iconSvg("arrow-left") + " Biblioteca";

const fullscreenBtn = document.getElementById("fullscreen-btn");

function updateFullscreenBtn() {
  fullscreenBtn.innerHTML = document.fullscreenElement
    ? iconSvg("minimize") + " Sair da tela cheia"
    : iconSvg("maximize") + " Tela cheia";
}

fullscreenBtn.addEventListener("click", () => {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    container.requestFullscreen().catch((err) => {
      console.error("Fullscreen request failed:", err);
    });
  }
});

document.addEventListener("fullscreenchange", updateFullscreenBtn);
updateFullscreenBtn();

const CRT_STORAGE_KEY = "flash-games-server:crt-enabled";
const crtBtn = document.getElementById("crt-btn");

function setCrt(enabled) {
  container.classList.toggle("crt-on", enabled);
  crtBtn.classList.toggle("active", enabled);
  crtBtn.innerHTML = iconSvg("monitor") + " CRT";
  localStorage.setItem(CRT_STORAGE_KEY, enabled ? "1" : "0");
}

crtBtn.addEventListener("click", () => {
  setCrt(!container.classList.contains("crt-on"));
});

setCrt(localStorage.getItem(CRT_STORAGE_KEY) === "1");
initThemeToggle(document.getElementById("theme-toggle"));

main();
