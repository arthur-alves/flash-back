const params = new URLSearchParams(window.location.search);
const slug = params.get("slug");

const titleEl = document.getElementById("game-title");
const descEl = document.getElementById("game-description");
const container = document.getElementById("player-container");

let player = null;

// ---- Cross-device saves (profile-based) ----
// Ruffle writes Flash's SharedObject ("save") data straight into this
// page's localStorage, under a key that embeds the game's own .swf
// filename (e.g. "192.168.1.10/games/bloons-td-4.swf/btd4") — confirmed by
// inspecting real keys in a browser, rather than guessing. Since the same
// browser can have leftover keys from other games played earlier, we only
// ever touch keys containing the CURRENT game's filename, never a blanket
// "everything that isn't flashback:*" — otherwise loading one game's save
// could wipe or upload another game's save sitting in the same
// localStorage. Same-origin, so no special Ruffle API is needed to do this.
const currentProfileId = getActiveProfileId();
let currentGameFile = null;
let lastSyncedSnapshot = "";

function matchesCurrentGame(key) {
  return !!currentGameFile && key.includes(currentGameFile);
}

function readSaveSnapshot() {
  const snapshot = {};
  for (const key of Object.keys(localStorage)) {
    if (!matchesCurrentGame(key)) continue;
    snapshot[key] = localStorage.getItem(key);
  }
  return snapshot;
}

function clearSaveKeys() {
  for (const key of Object.keys(localStorage)) {
    if (!matchesCurrentGame(key)) continue;
    localStorage.removeItem(key);
  }
}

async function loadSaveFromServer(profileId) {
  if (!profileId || !slug || !currentGameFile) return;
  clearSaveKeys(); // don't let another profile's leftover local data for this same game bleed in
  try {
    const res = await fetch(`/api/profiles/${encodeURIComponent(profileId)}/saves/${encodeURIComponent(slug)}`);
    if (!res.ok) return;
    const { data } = await res.json();
    for (const [key, value] of Object.entries(data)) {
      localStorage.setItem(key, value);
    }
    lastSyncedSnapshot = JSON.stringify(data);
  } catch (err) {
    // Offline or server hiccup — play with whatever's already local.
  }
}

async function syncSaveToServer(profileId) {
  if (!profileId || !slug || !currentGameFile) return;
  const snapshot = readSaveSnapshot();
  if (Object.keys(snapshot).length === 0) return;
  const serialized = JSON.stringify(snapshot);
  if (serialized === lastSyncedSnapshot) return;
  lastSyncedSnapshot = serialized;
  try {
    await fetch(`/api/profiles/${encodeURIComponent(profileId)}/saves/${encodeURIComponent(slug)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: snapshot }),
      keepalive: true,
    });
  } catch (err) {
    // Best-effort — next periodic sync (or the next session) will retry.
  }
}

window.addEventListener("flashback:profile-changed", async () => {
  await syncSaveToServer(currentProfileId);
  location.reload();
});

setInterval(() => syncSaveToServer(currentProfileId), 20000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") syncSaveToServer(currentProfileId);
});
window.addEventListener("pagehide", () => syncSaveToServer(currentProfileId));

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

  currentGameFile = game.file;
  await loadSaveFromServer(currentProfileId);

  const ruffle = window.RufflePlayer.newest();
  player = ruffle.createPlayer();
  player.style.width = "100%";
  player.style.height = "100%";
  container.appendChild(player);

  // Forces the 2D canvas renderer instead of WebGL. WebGL's drawing buffer
  // isn't guaranteed to persist between frames (preserveDrawingBuffer is
  // off by default for performance), so a cover capture taken with
  // canvas.toBlob() can come out solid black. The 2D canvas doesn't have
  // this problem, and these old Flash games don't need WebGL's extra
  // performance anyway.
  player.load({ url: `/games/${encodeURIComponent(game.file)}`, preferredRenderer: "canvas" });

  initGamepad(game.slug);
}

// ---- Gamepad support ----
// Ruffle has no built-in gamepad handling — it only listens for standard
// keyboard events, like any web app. gamepad.js polls the Gamepad API and
// turns button/axis presses into synthetic keydown/keyup events targeting
// `document`, which is exactly what a real key press produces. Verified
// against a real game before building the remap UI on top of it: a
// synthetic ArrowDown reversed a moving Snake into itself, same as if the
// key had actually been pressed.
let gamepadController = null;

const gamepadConfigBtn = document.getElementById("gamepad-config-btn");
const gamepadPanel = document.getElementById("gamepad-panel");
const gamepadStatusEl = document.getElementById("gamepad-status");
const gamepadRowsEl = document.getElementById("gamepad-rows");
const gamepadSaveBtn = document.getElementById("gamepad-save-btn");
const gamepadResetBtn = document.getElementById("gamepad-reset-btn");
const gamepadCloseBtn = document.getElementById("gamepad-close-btn");

function initGamepad(gameSlug) {
  gamepadController = createGamepadController(gameSlug, document);
  gamepadController.start();
  gamepadController.onConnectionChange((name) => {
    gamepadStatusEl.textContent = name ? t("gamepad_connected", { name }) : t("gamepad_not_connected");
  });
}

function describeControl(control) {
  if (!control) return "—";
  return t("gamepad_button_label", { index: control.index });
}

function renderGamepadRows() {
  gamepadRowsEl.innerHTML = "";
  if (!gamepadController) return;
  const mapping = gamepadController.getMapping();

  for (const action of GAMEPAD_ACTIONS) {
    const row = document.createElement("div");
    row.className = "gamepad-row";

    const label = document.createElement("span");
    label.className = "gamepad-row-label";
    label.textContent = t(`gamepad_action_${action}`);

    const binding = document.createElement("span");
    binding.className = "gamepad-row-binding";
    binding.textContent = describeControl(mapping[action]);

    const remapBtn = document.createElement("button");
    remapBtn.type = "button";
    remapBtn.className = "gamepad-row-remap-btn";
    remapBtn.textContent = t("gamepad_remap");
    remapBtn.addEventListener("click", () => {
      remapBtn.textContent = t("gamepad_waiting_input");
      remapBtn.classList.add("waiting");
      gamepadController.listenForNextInput((control) => {
        gamepadController.setControl(action, control);
        binding.textContent = describeControl(control);
        remapBtn.textContent = t("gamepad_remap");
        remapBtn.classList.remove("waiting");
      });
    });

    row.append(label, binding, remapBtn);
    gamepadRowsEl.appendChild(row);
  }
}

gamepadConfigBtn.addEventListener("click", () => {
  renderGamepadRows();
  gamepadPanel.classList.remove("hidden");
});

gamepadCloseBtn.addEventListener("click", () => {
  if (gamepadController) gamepadController.cancelListening();
  gamepadPanel.classList.add("hidden");
});

gamepadSaveBtn.addEventListener("click", () => {
  if (!gamepadController) return;
  gamepadController.persist();
  gamepadStatusEl.textContent = t("gamepad_saved");
});

gamepadResetBtn.addEventListener("click", () => {
  if (!gamepadController) return;
  gamepadController.resetToDefaults();
  renderGamepadRows();
});

function updateGamepadConfigBtn() {
  gamepadConfigBtn.innerHTML = "🎮";
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

// ---- Pixel filter (xBR / HQ2X / 2xSaI) ----
const FILTER_STORAGE_KEY = "flashback:pixel-filter";
const pixelFilterSelect = document.getElementById("pixel-filter-select");
const pixelFilterCanvas = document.getElementById("pixel-filter-canvas");
let pixelFilterRenderer = null;
let pixelFilterRafId = null;
let currentPixelFilter = "original";

function populatePixelFilterSelect() {
  pixelFilterSelect.innerHTML = "";
  for (const id of PIXEL_FILTERS) {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = t(`pixel_filter_${id}`);
    pixelFilterSelect.appendChild(option);
  }
  pixelFilterSelect.value = currentPixelFilter;
}

function pixelFilterFrame() {
  const canvas = player && (player.shadowRoot || player).querySelector("canvas");
  if (canvas && pixelFilterRenderer) {
    pixelFilterRenderer.render(canvas, currentPixelFilter);
  }
  pixelFilterRafId = requestAnimationFrame(pixelFilterFrame);
}

function setPixelFilter(id) {
  currentPixelFilter = PIXEL_FILTERS.includes(id) ? id : "original";
  pixelFilterSelect.value = currentPixelFilter;
  localStorage.setItem(FILTER_STORAGE_KEY, currentPixelFilter);

  if (currentPixelFilter === "original") {
    pixelFilterCanvas.classList.add("hidden");
    if (pixelFilterRafId) {
      cancelAnimationFrame(pixelFilterRafId);
      pixelFilterRafId = null;
    }
    return;
  }

  if (!pixelFilterRenderer) {
    pixelFilterRenderer = createPixelFilterRenderer(pixelFilterCanvas);
  }
  if (!pixelFilterRenderer) {
    // No WebGL available — silently behave like "original".
    currentPixelFilter = "original";
    pixelFilterSelect.value = "original";
    return;
  }

  pixelFilterCanvas.classList.remove("hidden");
  if (!pixelFilterRafId) pixelFilterFrame();
}

pixelFilterSelect.addEventListener("change", () => setPixelFilter(pixelFilterSelect.value));

// ---- Cover capture (admin only) ----
// Ruffle renders into a <canvas> inside the player's shadow DOM. Since the
// .swf is served same-origin, the canvas isn't tainted, so canvas.toBlob()
// works without any server-side screenshot process.
const captureCoverBtn = document.getElementById("capture-cover-btn");

function updateCaptureCoverBtn() {
  captureCoverBtn.innerHTML = iconSvg("camera") + " " + t("capture_cover_button");
}

async function isAdminLoggedIn() {
  try {
    const res = await fetch("/api/admin/session");
    return res.ok;
  } catch (err) {
    return false;
  }
}

// Ruffle letterboxes the movie inside the canvas when its native aspect
// ratio doesn't match the player's — the bars around the game are part of
// the same canvas, not a separate element. This crops them out before
// capture using the movie's real dimensions from player.metadata.
function cropLetterbox(canvas) {
  const meta = player && player.metadata;
  if (!meta || !meta.width || !meta.height) return canvas;

  const canvasAspect = canvas.width / canvas.height;
  const movieAspect = meta.width / meta.height;

  let sx = 0, sy = 0, sw = canvas.width, sh = canvas.height;

  if (movieAspect > canvasAspect) {
    // Bars on top/bottom.
    sh = canvas.width / movieAspect;
    sy = (canvas.height - sh) / 2;
  } else if (movieAspect < canvasAspect) {
    // Bars on left/right.
    sw = canvas.height * movieAspect;
    sx = (canvas.width - sw) / 2;
  } else {
    return canvas;
  }

  const cropped = document.createElement("canvas");
  cropped.width = Math.round(sw);
  cropped.height = Math.round(sh);
  cropped.getContext("2d").drawImage(canvas, sx, sy, sw, sh, 0, 0, cropped.width, cropped.height);
  return cropped;
}

captureCoverBtn.addEventListener("click", async () => {
  if (!(await isAdminLoggedIn())) {
    if (confirm(t("login_required_capture"))) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    }
    return;
  }

  const canvas = player && (player.shadowRoot || player).querySelector("canvas");
  if (!canvas) {
    alert(t("canvas_not_ready"));
    return;
  }

  captureCoverBtn.disabled = true;
  captureCoverBtn.innerHTML = iconSvg("camera") + " " + t("capturing_cover");

  try {
    const cropped = cropLetterbox(canvas);
    const blob = await new Promise((resolve) => cropped.toBlob(resolve, "image/jpeg", 0.85));
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
initProfileToggle(document.getElementById("profile-select"));
updateBackLink();
updateFullscreenBtn();
updateCaptureCoverBtn();
setCrt(localStorage.getItem(CRT_STORAGE_KEY) === "1");
populatePixelFilterSelect();
setPixelFilter(localStorage.getItem(FILTER_STORAGE_KEY) || "original");
updateGamepadConfigBtn();

function onLanguageChange() {
  updateBackLink();
  updateFullscreenBtn();
  updateCaptureCoverBtn();
  crtBtn.innerHTML = iconSvg("monitor") + " " + t("crt_button");
  populatePixelFilterSelect();
  updateGamepadConfigBtn();
  if (!gamepadPanel.classList.contains("hidden")) renderGamepadRows();
}

main();
