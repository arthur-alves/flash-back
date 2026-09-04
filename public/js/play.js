const params = new URLSearchParams(window.location.search);
const slug = params.get("slug");

const titleEl = document.getElementById("game-title");
const descEl = document.getElementById("game-description");
const container = document.getElementById("player-container");

let player = null;

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
  player = ruffle.createPlayer();
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

// ---- Cover capture (admin only) ----
// Ruffle renders into a <canvas> inside the player's shadow DOM. Since the
// .swf is served same-origin, the canvas isn't tainted, so canvas.toBlob()
// works without any server-side screenshot process.
const captureCoverBtn = document.getElementById("capture-cover-btn");

function updateCaptureCoverBtn() {
  captureCoverBtn.innerHTML = iconSvg("camera") + " " + t("capture_cover_button");
}

async function checkAdminSession() {
  try {
    const res = await fetch("/api/admin/session");
    if (res.ok) captureCoverBtn.classList.remove("hidden");
  } catch (err) {
    // Not logged in, or offline — leave the button hidden.
  }
}

captureCoverBtn.addEventListener("click", async () => {
  const canvas = player && (player.shadowRoot || player).querySelector("canvas");
  if (!canvas) {
    alert(t("canvas_not_ready"));
    return;
  }

  captureCoverBtn.disabled = true;
  captureCoverBtn.innerHTML = iconSvg("camera") + " " + t("capturing_cover");

  try {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob) throw new Error("canvas.toBlob returned null");

    const formData = new FormData();
    formData.append("cover", blob, "capture.jpg");

    const res = await fetch(`/api/admin/games/${encodeURIComponent(slug)}/cover`, {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      captureCoverBtn.innerHTML = iconSvg("camera") + " " + t("cover_captured_success");
    } else {
      alert(t("error_capturing_cover"));
      updateCaptureCoverBtn();
    }
  } catch (err) {
    alert(t("error_capturing_cover"));
    updateCaptureCoverBtn();
  } finally {
    captureCoverBtn.disabled = false;
    setTimeout(updateCaptureCoverBtn, 2500);
  }
});

initThemeToggle(document.getElementById("theme-select"));
initLangToggle(document.getElementById("lang-select"));
updateBackLink();
updateFullscreenBtn();
updateCaptureCoverBtn();
setCrt(localStorage.getItem(CRT_STORAGE_KEY) === "1");
checkAdminSession();

function onLanguageChange() {
  updateBackLink();
  updateFullscreenBtn();
  updateCaptureCoverBtn();
  crtBtn.innerHTML = iconSvg("monitor") + " " + t("crt_button");
}

main();
