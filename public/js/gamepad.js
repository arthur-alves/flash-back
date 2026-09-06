// Gamepad → keyboard bridge. Ruffle has no native gamepad support (it only
// listens for standard DOM keyboard events, like any web app), so this
// polls the browser's Gamepad API every frame and dispatches synthetic
// KeyboardEvents for whichever buttons/axes are mapped — same mechanism a
// real key press uses, confirmed against a live game before building this
// out further.
//
// Every action has TWO independently configurable sides: which physical
// gamepad control triggers it, and which keyboard key it sends. Both need
// to be user-editable — the physical side varies per controller, but the
// keyboard side varies per *game*, since Flash games never agreed on one
// control scheme (jump might be Z, X, S, Space, Ctrl...).
const GAMEPAD_ACTIONS = ["up", "down", "left", "right", "a", "b", "start"];

// Physical controls follow the W3C "Standard Gamepad" layout most browsers
// normalize recognized controllers (Xbox/PlayStation/generic) to: buttons
// 12-15 are the D-pad, 0/1 are the two "main" face buttons, 9 is Start. Key
// targets are a reasonable default for "modern platformer" conventions —
// not a universal answer, just a starting point to remap from.
const GAMEPAD_DEFAULTS = {
  up: { control: { type: "button", index: 12 }, key: { key: "ArrowUp", code: "ArrowUp", keyCode: 38 } },
  down: { control: { type: "button", index: 13 }, key: { key: "ArrowDown", code: "ArrowDown", keyCode: 40 } },
  left: { control: { type: "button", index: 14 }, key: { key: "ArrowLeft", code: "ArrowLeft", keyCode: 37 } },
  right: { control: { type: "button", index: 15 }, key: { key: "ArrowRight", code: "ArrowRight", keyCode: 39 } },
  a: { control: { type: "button", index: 0 }, key: { key: "z", code: "KeyZ", keyCode: 90 } },
  b: { control: { type: "button", index: 1 }, key: { key: "x", code: "KeyX", keyCode: 88 } },
  start: { control: { type: "button", index: 9 }, key: { key: "Enter", code: "Enter", keyCode: 13 } },
};

function gamepadStorageKey(gameSlug) {
  return `flashback:gamepad:${gameSlug}`;
}

function cloneDefaults() {
  return JSON.parse(JSON.stringify(GAMEPAD_DEFAULTS));
}

function loadGamepadMapping(gameSlug) {
  const mapping = cloneDefaults();
  try {
    const raw = localStorage.getItem(gamepadStorageKey(gameSlug));
    if (raw) {
      const saved = JSON.parse(raw);
      for (const action of GAMEPAD_ACTIONS) {
        if (saved[action]?.control) mapping[action].control = saved[action].control;
        if (saved[action]?.key) mapping[action].key = saved[action].key;
      }
    }
  } catch (err) {
    // Corrupt/old data — fall back to defaults above.
  }
  return mapping;
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
  let listenButtonCallback = null;
  let onConnectionChange = null;

  function dispatchKey(type, keyTarget) {
    dispatchTarget.dispatchEvent(
      new KeyboardEvent(type, {
        key: keyTarget.key,
        code: keyTarget.code,
        keyCode: keyTarget.keyCode,
        which: keyTarget.keyCode,
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
      if (listenButtonCallback) {
        for (let i = 0; i < pad.buttons.length; i++) {
          if (pad.buttons[i].pressed) {
            const cb = listenButtonCallback;
            listenButtonCallback = null;
            cb({ type: "button", index: i });
            break;
          }
        }
      } else {
        for (const action of GAMEPAD_ACTIONS) {
          const entry = mapping[action];
          const isActive = isControlActive(pad, entry.control);
          const wasActive = !!heldState[action];
          if (isActive && !wasActive) dispatchKey("keydown", entry.key);
          if (!isActive && wasActive) dispatchKey("keyup", entry.key);
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
      mapping = { ...mapping, [action]: { ...mapping[action], control } };
    },
    setKey(action, key) {
      mapping = { ...mapping, [action]: { ...mapping[action], key } };
    },
    persist() {
      localStorage.setItem(gamepadStorageKey(gameSlug), JSON.stringify(mapping));
    },
    resetToDefaults() {
      mapping = cloneDefaults();
    },
    // Calls `cb(control)` the next time any physical button is pressed,
    // instead of feeding it to the game — used by the remap UI's "press a
    // button" step.
    listenForNextInput(cb) {
      listenButtonCallback = cb;
    },
    // Calls `cb(keyTarget)` the next time a real keyboard key is pressed,
    // capturing it instead of letting it reach the game — used by the
    // remap UI's "press a key" step, so any game's actual key (S, Space,
    // Ctrl, whatever) can be captured directly instead of typed by name.
    listenForNextKey(cb) {
      const handler = (event) => {
        event.preventDefault();
        event.stopPropagation();
        window.removeEventListener("keydown", handler, true);
        cb({ key: event.key, code: event.code, keyCode: event.keyCode });
      };
      window.addEventListener("keydown", handler, true);
    },
    cancelListening() {
      listenButtonCallback = null;
    },
    onConnectionChange(cb) {
      onConnectionChange = cb;
    },
  };
}
