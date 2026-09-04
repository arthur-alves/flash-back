// Theme toggle (light/dark). The initial theme is applied synchronously by an
// inline snippet in each page's <head> (to avoid a flash of the wrong theme);
// this file only wires up the toggle button.
const THEME_STORAGE_KEY = "flash-games-server:theme";

function initThemeToggle(buttonEl) {
  function apply(theme) {
    document.documentElement.dataset.theme = theme;
    buttonEl.innerHTML = theme === "light" ? iconSvg("moon") : iconSvg("sun");
    buttonEl.title = theme === "light" ? "Mudar para tema escuro" : "Mudar para tema claro";
  }

  buttonEl.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    localStorage.setItem(THEME_STORAGE_KEY, next);
    apply(next);
  });

  apply(document.documentElement.dataset.theme || "dark");
}
