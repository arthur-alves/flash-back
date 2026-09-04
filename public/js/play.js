const params = new URLSearchParams(window.location.search);
const slug = params.get("slug");

const titleEl = document.getElementById("game-title");
const descEl = document.getElementById("game-description");
const container = document.getElementById("player-container");

async function main() {
  if (!slug) {
    titleEl.textContent = t("game_not_specified");
    return;
  }

  const res = await fetch(`/api/games/${encodeURIComponent(slug)}`);
  if (!res.ok) {
    titleEl.textContent = t("game_not_found");
    return;
  }

  const game = await res.json();
  titleEl.textContent = game.title;
  document.title = `${game.title} — FlashBack`;
  descEl.textContent = game.description || "";

  const ruffle = window.RufflePlayer.newest();
  const player = ruffle.createPlayer();
  player.style.width = "100%";
  player.style.height = "100%";
  container.appendChild(player);

  player.load(`/games/${encodeURIComponent(game.file)}`);
}

function updateBackLink() {
  document.getElementById("back-link").innerHTML = iconSvg("arrow-left") + " " + t("nav_all_games");
}

const fullscreenBtn = document.getElementById("fullscreen-btn");

function updateFullscreenBtn() {
  fullscreenBtn.innerHTML = document.fullscreenElement
    ? iconSvg("minimize") + " " + t("exit_fullscreen_button")
    : iconSvg("maximize") + " " + t("fullscreen_button");
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

const CRT_STORAGE_KEY = "flashback:crt-enabled";
const crtBtn = document.getElementById("crt-btn");

function setCrt(enabled) {
  container.classList.toggle("crt-on", enabled);
  crtBtn.classList.toggle("active", enabled);
  crtBtn.innerHTML = iconSvg("monitor") + " " + t("crt_button");
  localStorage.setItem(CRT_STORAGE_KEY, enabled ? "1" : "0");
}

crtBtn.addEventListener("click", () => {
  setCrt(!container.classList.contains("crt-on"));
});

initThemeToggle(document.getElementById("theme-select"));
initLangToggle(document.getElementById("lang-select"));
updateBackLink();
updateFullscreenBtn();
setCrt(localStorage.getItem(CRT_STORAGE_KEY) === "1");

function onLanguageChange() {
  updateBackLink();
  updateFullscreenBtn();
  crtBtn.innerHTML = iconSvg("monitor") + " " + t("crt_button");
}

main();
