#!/bin/sh
set -e

# games/, data/ and public/ruffle/ are expected to be mounted as volumes so
# downloads persist across container restarts/rebuilds.

if [ ! -f public/ruffle/ruffle.js ]; then
  echo "[entrypoint] Ruffle not found, fetching..."
  node server/scripts/fetch-ruffle.js
fi

if [ ! -f data/catalog.json ] || [ "$(find games -maxdepth 1 -name '*.swf' | head -1)" = "" ]; then
  echo "[entrypoint] Game catalog/files missing, scraping..."
  node server/scripts/scrape.js
fi

exec "$@"
