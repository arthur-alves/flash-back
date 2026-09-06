// Gamepad → keyboard bridge. Ruffle has no native gamepad support (it only
// listens for standard DOM keyboard events, like any web app), so this
// polls the browser's Gamepad API every frame and dispatches synthetic
// KeyboardEvents for whichever buttons/axes are mapped — same mechanism a
// real key press uses, confirmed against a live game before building this
// out further.
const GAMEPAD_ACTIONS = ["up", "down", "left", "right", "a", "b", "start"];

// What each action becomes as a keyboard event. Flash games never agreed on
// one control scheme (Z/X, A/S, Ctrl/Alt, arrows...), so this is a
// reasonable default for "modern platformer" conventions, not a universal
// answer — the whole point of the remap UI is letting the user fix it
// per game.
const GAMEPAD_KEY_TARGETS = {
  up: { key: "ArrowUp", code: "ArrowUp", keyCode: 38 },
  down: { key: "ArrowDown", code: "ArrowDown", keyCode: 40 },
  left: { key: "ArrowLeft", code: "ArrowLeft", keyCode: 37 },
  right: { key: "ArrowRight", code: "ArrowRight", keyCode: 39 },
  a: { key: "z", code: "KeyZ", keyCode: 90 },
  b: { key: "x", code: "KeyX", keyCode: 88 },
  start: { key: "Enter", code: "Enter", keyCode: 13 },
};

// Default physical bindings, matching the W3C "Standard Gamepad" layout
// most browsers normalize recognized controllers (Xbox/PlayStation/generic)
// to: buttons 12-15 are the D-pad, 0/1 are the two "main" face buttons, 9
// is Start.
const GAMEPAD_DEFAULT_MAPPING = {
  up: { type: "button", index: 12 },
  down: { type: "button", index: 13 },
  left: { type: "button", index: 14 },
  right: { type: "button", index: 15 },
  a: { type: "button", index: 0 },
  b: { type: "button", index: 1 },
  start: { type: "button", index: 9 },
};

function gamepadStorageKey(gameSlug) {
  return `flashback:gamepad:${gameSlug}`;
}

function loadGamepadMapping(gameSlug) {
  try {
    const raw = localStorage.getItem(gamepadStorageKey(gameSlug));
    if (raw) return { ...GAMEPAD_DEFAULT_MAPPING, ...JSON.parse(raw) };
  } catch (err) {
    // Corrupt/old data — fall back to defaults below.
  }
  return { ...GAMEPAD_DEFAULT_MAPPING };
}

function isControlActive(gamepad, control) {
  if (!control) return false;
  if (control.type === "button") {
    const btn = gamepad.buttons[control.index];
    return !!btn && btn.pressed;
  }
  if (control.type === "axis") {
    const value = gamepad.axes[control.index] || 0;
    return control.direction < 0 ? value < -0.5 : value > 0.5;
  }
  return false;
}

// Creates a controller bound to one game. `targetEl` is where the synthetic
// keyboard events get dispatched — document works (Ruffle's listeners
// bubble up), matching what was verified manually beforehand.
function createGamepadController(gameSlug, targetEl) {
  const dispatchTarget = targetEl || document;
  let mapping = loadGamepadMapping(gameSlug);
  let running = false;
  let rafId = null;
  const heldState = {};
  let listenCallback = null;
  let onConnectionChange = null;

  function dispatchKey(type, target) {
    dispatchTarget.dispatchEvent(
      new KeyboardEvent(type, {
        key: target.key,
        code: target.code,
        keyCode: target.keyCode,
        which: target.keyCode,
        bubbles: true,
        cancelable: true,
      })
    );
  }

  function poll() {
    if (!running) return;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads && Array.from(pads).find((p) => p);

    if (onConnectionChange) onConnectionChange(pad ? pad.id : null);

    if (pad) {
      if (listenCallback) {
        for (let i = 0; i < pad.buttons.length; i++) {
          if (pad.buttons[i].pressed) {
            const cb = listenCallback;
            listenCallback = null;
            cb({ type: "button", index: i });
            break;
          }
        }
      } else {
        for (const action of GAMEPAD_ACTIONS) {
          const isActive = isControlActive(pad, mapping[action]);
          const wasActive = !!heldState[action];
          if (isActive && !wasActive) dispatchKey("keydown", GAMEPAD_KEY_TARGETS[action]);
          if (!isActive && wasActive) dispatchKey("keyup", GAMEPAD_KEY_TARGETS[action]);
          heldState[action] = isActive;
        }
      }
    }

    rafId = requestAnimationFrame(poll);
  }

  return {
    start() {
      if (running) return;
      running = true;
      poll();
    },
    stop() {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
    },
    getMapping() {
      return mapping;
    },
    setControl(action, control) {
      mapping = { ...mapping, [action]: control };
    },
    persist() {
      localStorage.setItem(gamepadStorageKey(gameSlug), JSON.stringify(mapping));
    },
    resetToDefaults() {
      mapping = { ...GAMEPAD_DEFAULT_MAPPING };
    },
    // Calls `cb(control)` the next time any physical button is pressed,
    // instead of feeding it to the game — used by the remap UI's "press a
    // button" step.
    listenForNextInput(cb) {
      listenCallback = cb;
    },
    cancelListening() {
      listenCallback = null;
    },
    onConnectionChange(cb) {
      onConnectionChange = cb;
    },
  };
}
