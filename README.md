# Flash Games Server

Self-hosted library of classic Flash games, played directly in the browser via [Ruffle](https://ruffle.rs) — no plugins, no Flash Player install. Think of it as a "RomM for Flash games": browse a library, organize it into collections and tags, and play everything from a normal web browser.

Game files are sourced from the community-maintained [AmmarSAA/flash-games-directory](https://github.com/AmmarSAA/flash-games-directory), which describes itself as a fan preservation effort (see [Legal note](#legal-note)).

## Features

- **Browsable library** with live search, tag filters, and grid/list view toggle
- **Collections** — curated groups of games, each with its own page; a game can belong to more than one
- **In-browser Flash emulation** via a self-hosted Ruffle build — no CDN dependency, no plugin install
- **Fullscreen mode** and an optional **CRT scanline overlay**, handy for the many games shipped at very low native resolutions
- **Light/dark theme**, remembered across visits
- **Admin panel** to upload your own `.swf` games and cover art, protected by a real login (not the browser's native Basic Auth popup)
- Uploads are validated by **file content**, not extension — a renamed `.txt` won't pass as a `.swf`
- **Simple JSON storage** — no database, easy to inspect/edit/back up by hand
- Icons via inlined [Lucide](https://lucide.dev) SVGs (self-hosted, ISC license)

## Requirements

- Node.js 18+
- `unzip` available on `PATH` (used by the Ruffle fetch script)
- Docker + Docker Compose (only if you want to run it containerized)

## Quick start (Node, no Docker)

```bash
npm install

# Downloads the Ruffle web player (self-hosted, no CDN dependency)
npm run fetch-ruffle

# Downloads the game list + .swf files from the source repo and builds data/catalog.json
npm run scrape

# Optional: apply curated PT-BR descriptions/tags for well-known titles
npm run descriptions
npm run tags

npm start
```

Open **http://localhost:4000**. First run will feel empty on the admin side — see [First-time setup](#first-time-setup) below.

## Quick start (Docker)

```bash
docker compose up -d --build
```

`docker-compose.yml` mounts `./volumes/{games,data,ruffle}` as persistent volumes. On first container start, the entrypoint automatically runs the equivalent of `fetch-ruffle` and `scrape` into those volumes — this only happens once; later restarts reuse what's already there instead of re-downloading everything.

Open **http://localhost:4000** (or whatever port you mapped).

## First-time setup

The admin panel doesn't ship with a default password. The first time you open it, you'll be walked through creating your own account:

1. Go to **http://localhost:4000/admin.html**
2. You'll be redirected to **`/setup.html`** automatically (this only happens once — before an account exists)
3. Choose a username and a password (8+ characters)
4. You're logged in immediately and land on the admin panel

From then on, `/admin.html` requires logging in at **`/login.html`**. Sessions are stored as an HttpOnly cookie and last 30 days, but they live in server memory — restarting the server/container logs everyone out (you'll just need to log in again, the account itself isn't affected).

### Forgot your password?

There's no email/SMS recovery — this is meant to run reset via an environment variable, which works whether you manage the server from a terminal or entirely through Portainer's web UI:

1. Set the environment variable `RESET_ADMIN=true` on the container (in Portainer: **Containers → flash-games-server → Duplicate/Edit → Env** tab, or edit the stack's `docker-compose.yml` and redeploy)
2. Restart the container
3. Visit `/admin.html` again — you'll land back on the setup wizard to create a fresh account
4. **Set `RESET_ADMIN` back to `false` (or remove it) and restart again** — otherwise every restart wipes the account you just created

If you're running it directly with Node instead of Docker, the equivalent is:

```bash
RESET_ADMIN=true npm start
# stop it (Ctrl+C) once you see the "admin account cleared" message, then:
npm start
```

## Using the library

- **Search** — the box in the top bar filters by title as you type
- **Tags** — click a tag chip to filter the library down to that tag; click "Todos" to clear it
- **Collections** (`/collections.html`) — curated groups; click one to see just its games
- **Grid/List toggle** — top-right button; list view also shows each game's description
- **Theme toggle** — sun/moon icon, switches light/dark, remembered in your browser
- **Playing a game** — click any card, then:
  - **Tela cheia** button for fullscreen (uses the browser's native Fullscreen API)
  - **CRT** button overlays scanlines + a vignette — purely cosmetic CSS, doesn't touch how Ruffle renders the game, but helps a lot with games that shipped at tiny native resolutions

## Managing games (admin)

The easiest way is the admin panel (`/admin.html`):

1. **Adicionar novo jogo** — pick a `.swf` file, a title, optional description/cover/tags, then submit
2. In the **Jogos cadastrados** table you can, per game:
   - Click the cover thumbnail to upload/replace it
   - Edit tags directly in the text field (comma-separated)
   - Toggle collection membership via the chip buttons
   - Remove the game entirely (deletes the file + its cover from disk too)

You can also do it by hand: drop a `.swf` file into `games/`, then add an entry to `data/catalog.json`:

```json
{
  "slug": "my-game",
  "title": "My Game",
  "description": "Optional description.",
  "file": "my-game.swf",
  "sizeBytes": 123456,
  "cover": null,
  "tags": ["puzzle", "arcade"]
}
```

To add a cover image by hand, place a file at `data/covers/<slug>.<ext>` (`jpg`, `png` or `webp`) and set `"cover": "<ext>"` in the catalog entry.

## Managing collections (admin)

In the **Coleções** section of the admin panel:

1. Create a collection with a name and optional description
2. Click its thumbnail to give it cover art (falls back to a color+initial card like games do, if you skip this)
3. Scroll down to the games table — click a collection's chip on any game's row to add/remove it from that collection (a game can be in as many collections as you want)
4. Edit or delete a collection from the list — deleting a collection never deletes the games in it

Collections show up as cards on `/collections.html` and get their own page at `/collection.html?slug=...`.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | Port the server listens on |
| `MAX_UPLOAD_MB` | `200` | Max size (MB) for `.swf`/cover uploads in the admin panel |
| `RESET_ADMIN` | unset | Set to `true` to wipe the admin account on next startup and re-trigger the setup wizard |

## Project structure

```
server/
  index.js              Express app (public + admin API, static file serving)
  lib/
    validateSwf.js       Checks the FWS/CWS/ZWS magic bytes of uploaded .swf files
    validateImage.js     Checks JPEG/PNG/WebP magic bytes of uploaded covers
    auth.js               Account setup, scrypt password hashing, cookie
                           sessions, and the RESET_ADMIN escape hatch
    slugify.js
  scripts/
    scrape.js             Fetches games + builds catalog.json
    fetch-ruffle.js       Downloads the self-hosted Ruffle build
    apply-descriptions.js / descriptions.json   Curated PT-BR descriptions
    apply-tags.js / tags.json                    Curated genre tags
data/
  catalog.json           Game metadata (committed to git)
  collections.json       Curated collections (committed to git)
  admin.json             Admin username + salted password hash (gitignored)
  covers/                 Cover images — games and data/covers/collections/ (gitignored)
games/                    Downloaded .swf files (gitignored, run `npm run scrape`)
public/
  index.html              Full game library + tag filters
  collections.html        All collections
  collection.html          One collection's games
  play.html                Ruffle player (fullscreen, CRT toggle)
  setup.html / login.html  Admin auth
  admin.html               Admin panel (games, covers, tags, collections)
  js/                       One script per page, plus shared icons.js/theme.js/viewToggle.js
  css/style.css             Everything, theme-aware via CSS variables
```

## Legal note

This project does not redistribute Flash game files itself — the `scrape` script downloads them at setup time from the source repository, which describes itself as a fan preservation effort. All game rights remain with their original creators. If you are a rights holder and want a game removed, please open an issue.

## License

MIT — see [LICENSE](LICENSE).
