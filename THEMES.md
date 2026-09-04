# Creating themes

The whole site is themeable through CSS custom properties (variables). `public/css/style.css` contains **only structure** — layout, spacing, component shapes — and reads every color, font and radius from variables. A theme is just a CSS file that defines those variables; it never needs to touch `style.css` or any HTML/JS.

## How it works

1. `public/css/themes/<id>.css` defines a `:root { --var: value; ... }` block with the full variable contract (below).
2. Every page loads two stylesheets: the active theme file first, then `style.css`.
3. A small inline script in each page's `<head>` reads the saved theme from `localStorage` and points the `<link id="theme-link">` at the right file **before** the page paints, so there's no flash of the wrong theme.
4. `public/js/themes-registry.js` lists the installed themes (id + display name) — this is what populates the `<select>` dropdown in the top bar of every page.
5. `public/js/theme.js` wires up that dropdown: on change, it swaps `theme-link`'s `href` and saves the choice to `localStorage`.

Switching or adding themes never requires a server restart or a build step — it's plain CSS files served statically.

## The variable contract

Every theme file **must** define all of these, or components that rely on the missing ones will render with browser defaults (usually black text/no border, easy to spot):

| Variable | Used for |
| --- | --- |
| `--bg` | Page background (top of the gradient) |
| `--bg2` | Page background (bottom of the gradient) — set equal to `--bg` for a flat background |
| `--surface` | Cards, panels, the top bar |
| `--surface-hover` | Hover/active background for surfaces |
| `--border` | Default border color |
| `--text` | Main text color |
| `--text-dim` | Secondary/muted text |
| `--accent` | Primary brand color (buttons, active states, links) |
| `--accent-rgb` | Same color as `--accent`, as `r, g, b` (no `rgb()` wrapper) — needed for `rgba(var(--accent-rgb), 0.4)` glow effects |
| `--accent2` | Secondary color, used in gradients alongside `--accent` |
| `--accent2-rgb` | Same, as `r, g, b` |
| `--danger` | Destructive actions (delete buttons), error text |
| `--danger-rgb` | Same, as `r, g, b` |
| `--success` | Success messages |
| `--success-rgb` | Same, as `r, g, b` |
| `--radius` | Border-radius used everywhere (buttons, cards, inputs). Use `0px` for a sharp-cornered theme |
| `--glow-strength` | A `0`–`1` multiplier for how strong the neon box-shadow/drop-shadow glows are. Dark themes can go bold (`0.5`–`0.8`); light themes should stay low (`0.1`–`0.25`) or the glow just looks like a smudge on white |
| `--font-body` | Main font stack |
| `--font-heading` | Font stack for `h1`/`h2`/titles — can match `--font-body` or be distinct |

### Why the `-rgb` duplicates?

CSS can't extract the R/G/B components out of a hex color inside `rgba()` without `color-mix()` (not reliable enough across browsers yet for this project's baseline). Keeping a plain `r, g, b` variable alongside the hex one is the simplest cross-browser way to do semi-transparent glows in the theme's own color.

## Adding a new theme

1. Copy an existing file as a starting point, e.g.:
   ```bash
   cp public/css/themes/dark.css public/css/themes/mytheme.css
   ```
2. Edit the values. Keep every variable from the contract above — nothing else needs to change.
3. Register it in `public/js/themes-registry.js`:
   ```js
   const THEMES = [
     { id: "dark", name: "Dark Neon" },
     { id: "light", name: "Light Neon" },
     { id: "geo", name: "Geo (Y2K)" },
     { id: "mytheme", name: "My Theme" }, // <-- add this
   ];
   ```
4. Reload any page — your theme now shows up in the dropdown, no build step, no restart.

That's it. `style.css` doesn't know or care how many themes exist.

## Included themes

- **Dark Neon** (`dark`, default) — deep purple/navy background, magenta + cyan glow accents
- **Light Neon** (`light`) — same accent pairing, toned down for a white background
- **Geo** (`geo`) — a tribute to the [Geo Bootswatch theme](https://github.com/divshot/geo-bootstrap): pure black background, Comic Sans, saturated primary colors (`#ff00ff`, `#00ffff`, `#00ff00`), and zero border-radius. A loving parody of early-2000s/GeoCities web design.

## Design tips

- Pick `--accent` and `--accent2` far enough apart on the color wheel that gradients between them (buttons, active tags, the site title) actually read as a gradient and not a muddy blend.
- If your theme's background is light, drop `--glow-strength` below `0.25` — colored shadows on white backgrounds get "dirty" fast at higher opacity.
- `--radius: 0px` plus a loud, unconventional `--font-body` (like Geo's Comic Sans) goes a long way toward a distinct visual identity without touching a single line of `style.css`.
- Test both the grid and list view of the game library, the player page (with CRT overlay on), and the admin panel's forms/tables — those exercise most of the variable surface at once.
