// Theme picker. The initial theme is applied synchronously by an inline
// snippet in each page's <head> (to avoid a flash of the wrong theme, see
// any page's <head> for the pattern); this file wires up the <select> and
// handles switching afterwards.
const THEME_STORAGE_KEY = "flash-games-server:theme";

function currentTheme() {
  return localStorage.getItem(THEME_STORAGE_KEY) || DEFAULT_THEME;
}

function applyTheme(themeId) {
  const link = document.getElementById("theme-link");
  if (link) link.href = `css/themes/${themeId}.css`;
}

function initThemeToggle(selectEl) {
  selectEl.innerHTML = "";
  for (const theme of THEMES) {
    const option = document.createElement("option");
    option.value = theme.id;
    option.textContent = theme.name;
    selectEl.appendChild(option);
  }

  selectEl.value = currentTheme();

  selectEl.addEventListener("change", () => {
    localStorage.setItem(THEME_STORAGE_KEY, selectEl.value);
    applyTheme(selectEl.value);
  });
}
