# Flash Games Server

Self-hosted library of classic Flash games, played directly in the browser via [Ruffle](https://ruffle.rs) — no plugins, no Flash Player install. Think of it as a "RomM for Flash games."

Game files are sourced from the community-maintained [AmmarSAA/flash-games-directory](https://github.com/AmmarSAA/flash-games-directory).

## Features

- Browsable game library with search
- In-browser Flash emulation via a self-hosted Ruffle build (no external CDN)
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

npm start
```

Then open http://localhost:4000

## Adding your own games

Drop a `.swf` file into `games/`, then add an entry to `data/catalog.json`:

```json
{
  "slug": "my-game",
  "title": "My Game",
  "description": "Optional description.",
  "file": "my-game.swf",
  "sizeBytes": 123456,
  "cover": null
}
```

To add a cover image, place a JPG at `data/covers/<slug>.jpg` and set `"cover": true` in the catalog entry.

## Project structure

```
server/
  index.js            Express app (API + static file serving)
  scripts/
    scrape.js          Fetches games + builds catalog.json
    fetch-ruffle.js    Downloads the self-hosted Ruffle build
data/
  catalog.json         Game metadata (committed to git)
  covers/               Optional cover images (gitignored, generate locally)
games/                  Downloaded .swf files (gitignored, run `npm run scrape`)
public/                 Frontend (library grid + player page)
```

## Deploying with Docker

A `Dockerfile` will be added once the MVP is validated locally. For now, run it directly with Node — `npm start` binds to `PORT` (default `4000`).

## Legal note

This project does not redistribute Flash game files itself — the `scrape` script downloads them at setup time from the source repository, which describes itself as a fan preservation effort. All game rights remain with their original creators. If you are a rights holder and want a game removed, please open an issue.

## License

MIT — see [LICENSE](LICENSE).
