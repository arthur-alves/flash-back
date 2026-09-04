// Shared grid/list view toggle, used by /, /collections and /collection.
const VIEW_STORAGE_KEY = "flashback:view-mode";

function initViewToggle(gridEl, buttonEl) {
  function apply(mode) {
    gridEl.classList.toggle("list-view", mode === "list");
    buttonEl.innerHTML =
      mode === "list" ? iconSvg("layout-grid") + " Grade" : iconSvg("list") + " Lista";
    buttonEl.dataset.mode = mode;
  }

  buttonEl.addEventListener("click", () => {
    const next = buttonEl.dataset.mode === "list" ? "grid" : "list";
    localStorage.setItem(VIEW_STORAGE_KEY, next);
    apply(next);
  });

  apply(localStorage.getItem(VIEW_STORAGE_KEY) === "list" ? "list" : "grid");
}
