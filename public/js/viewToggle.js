// Shared grid/list view toggle, used by index.html, collections.html and collection.html.
const VIEW_STORAGE_KEY = "flash-games-server:view-mode";

function initViewToggle(gridEl, buttonEl) {
  function apply(mode) {
    gridEl.classList.toggle("list-view", mode === "list");
    buttonEl.textContent = mode === "list" ? "▦ Grade" : "☰ Lista";
    buttonEl.dataset.mode = mode;
  }

  buttonEl.addEventListener("click", () => {
    const next = buttonEl.dataset.mode === "list" ? "grid" : "list";
    localStorage.setItem(VIEW_STORAGE_KEY, next);
    apply(next);
  });

  apply(localStorage.getItem(VIEW_STORAGE_KEY) === "list" ? "list" : "grid");
}
