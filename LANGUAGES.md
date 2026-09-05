← [Back to README](README.md)

# Adding a language

FlashBack's UI text lives in a single dictionary file, `public/js/i18n.js`. No build step, no `.json` files fetched over the network, no server-side rendering involved. Default language is **English** (`en`); **Portuguese** (`pt`) is the second one.

## How it works

1. `TRANSLATIONS` in `public/js/i18n.js` is a plain object: `{ en: { key: "text", ... }, pt: { key: "texto", ... } }`.
2. `LANGUAGES` (top of the same file) lists the installed languages. This populates the language `<select>` in the top bar of every page.
3. Static text in HTML is marked with `data-i18n="key"` (sets `textContent`), `data-i18n-html="key"` (sets `innerHTML`, only used for the footer credits, which contain links), `data-i18n-placeholder="key"` (input placeholders) or `data-i18n-title="key"` (tooltip `title` attributes).
4. Each page's own script calls `initLangToggle(selectEl)` on load, which populates the dropdown, applies the saved language (or English by default) to every `data-i18n*` element, and wires up the `<select>`.
5. Text built dynamically in JS (button labels set via `innerHTML`, table rows, confirm()/prompt() dialogs, status messages) calls `t("key")` directly instead of using a hardcoded string.
6. If a page defines a global `onLanguageChange()` function, it's called after the dropdown changes, used to re-render anything built dynamically (tag chips, admin tables, collection cards) so it picks up the new language immediately instead of requiring a reload.

Switching or adding a language never requires a server restart or a build step.

## The `t()` helper

```js
t("key")                      // looks up the string in the current language
t("key", { name: "Foo" })     // replaces {name} in the string with "Foo"
tCount("games_count", 3)      // picks games_count_one / games_count_other based on n, and fills {n}
tError("title_required")      // looks up err_title_required, see "Server error codes" below
```

Lookup order for `t()`: current language, then English, then the raw key itself (so a missing translation shows something recognizable instead of "undefined").

## Server error codes

The API never returns UI text, validation errors come back as short codes, e.g. `{"error": "title_required"}`. The frontend translates them via `tError(code)`, which looks up `err_<code>` in the dictionary. If you add a new validation error on the server (`server/index.js`), give it a `snake_case` code and add matching `err_<code>` entries to **both** languages in `i18n.js`, otherwise it'll just display the raw code as a fallback, which is ugly but never crashes.

## Adding a new language

1. Add a block to `TRANSLATIONS` in `public/js/i18n.js`, e.g. for Spanish:
   ```js
   es: {
     tag_all: "Todos",
     nav_all_games: "Todos los juegos",
     // ...every other key from the "en" block, translated
   },
   ```
   Easiest way: copy the entire `en: { ... }` block, rename it, and translate each value. That guarantees you don't miss a key.
2. Register it in `LANGUAGES`:
   ```js
   const LANGUAGES = [
     { id: "en", name: "English" },
     { id: "pt", name: "Português" },
     { id: "es", name: "Español" }, // <-- add this
   ];
   ```
3. Reload any page: the new language shows up in the dropdown immediately.

## Adding a new translatable string

1. Add the key to **both** language blocks in `i18n.js` (English first, as the fallback).
2. In HTML, use `data-i18n="your_key"` (or the `-html`/`-placeholder`/`-title` variant) on the element, and keep a sensible English default as its literal content/attribute, that way the page still reads correctly even if JS fails to load.
3. In JS, call `t("your_key")` instead of hardcoding text. If the string appears inside an element built dynamically (tables, cards, chips), make sure it gets rebuilt in `onLanguageChange()` too, or it'll stay in the old language until the next reload.

## Why not JSON files fetched over the network?

This project intentionally avoids async config loading (see the same reasoning behind `themes-registry.js`): a synchronous, always-available JS object means there's no flash of untranslated content, no race between "page rendered" and "dictionary loaded", and no extra HTTP request per page load. For a project this size, a plain object is simpler than a loader.
