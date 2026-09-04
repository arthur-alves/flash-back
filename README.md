# Flash Games Server

Self-hosted library of classic Flash games, played directly in the browser via [Ruffle](https://ruffle.rs) — no plugins, no Flash Player install. Think of it as a "RomM for Flash games."

Game files are sourced from the community-maintained [AmmarSAA/flash-games-directory](https://github.com/AmmarSAA/flash-games-directory).

## Features

- Browsable game library with search, tag filters and curated collections
- In-browser Flash emulation via a self-hosted Ruffle build (no external CDN)
- Fullscreen mode and an optional CRT scanline overlay for low-res games
- Password-protected admin panel to upload your own `.swf` games and cover
  art, with real content validation (not just trusting the file extension)
- Simple JSON catalog — easy to edit titles/descriptions or add your own games
- No database required

## Requirements

- Node.js 18+
- `unzip` available on `PATH` (used by the Ruffle fetch script)

## Setup

```bash
npm install

# Downloads the Ruffle web player (self-hosted, no CDN dependency)
npm run fetch-ruffle

# Downloads the game list + .swf files from the source repo and builds data/catalog.json
npm run scrape

# (Optional) Apply curated descriptions/tags for well-known titles
npm run descriptions
npm run tags

npm start
```

Then open http://localhost:4000. The admin panel is at http://localhost:4000/admin.html
— credentials are printed to the console on startup unless you set
`ADMIN_USER` / `ADMIN_PASSWORD` as environment variables.

## Running with Docker

```bash
docker compose up -d --build
```

The provided `docker-compose.yml` mounts `./volumes/{games,data,ruffle}` as persistent
volumes. On first run, the container's entrypoint automatically fetches Ruffle and
scrapes the game catalog into those volumes — this only happens once; subsequent
restarts reuse what's already there.

## Adding your own games

The easiest way is the admin panel (`/admin.html`): upload a `.swf`, a title,
and optionally a cover image and tags.

You can also do it by hand: drop a `.swf` file into `games/`, then add an
entry to `data/catalog.json`:

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

To add a cover image by hand, place a file at `data/covers/<slug>.<ext>`
(`jpg`, `png` or `webp`) and set `"cover": "<ext>"` in the catalog entry.

## Collections

Collections are curated groups of games (a game can belong to more than
one). Manage them from the admin panel — create a collection, then click
its chip on any game's row to add/remove it. They're stored in
`data/collections.json` and show up as cards on the homepage and get their
own page (`/collection.html?slug=...`).

## Project structure

```
server/
  index.js            Express app (public + admin API, static file serving)
  lib/
    validateSwf.js     Checks the FWS/CWS/ZWS magic bytes of uploaded .swf files
    validateImage.js    Checks JPEG/PNG/WebP magic bytes of uploaded covers
    adminAuth.js         HTTP Basic Auth middleware for /admin*
    slugify.js
  scripts/
    scrape.js          Fetches games + builds catalog.json
    fetch-ruffle.js    Downloads the self-hosted Ruffle build
    apply-descriptions.js / descriptions.json   Curated PT-BR descriptions
    apply-tags.js / tags.json                    Curated genre tags
data/
  catalog.json         Game metadata (committed to git)
  collections.json     Curated collections (committed to git)
  covers/               Cover images (gitignored, generate locally or via admin)
games/                  Downloaded .swf files (gitignored, run `npm run scrape`)
public/                 Frontend (library, player, collection and admin pages)
```

## Legal note

This project does not redistribute Flash game files itself — the `scrape` script downloads them at setup time from the source repository, which describes itself as a fan preservation effort. All game rights remain with their original creators. If you are a rights holder and want a game removed, please open an issue.

## License

MIT — see [LICENSE](LICENSE).
