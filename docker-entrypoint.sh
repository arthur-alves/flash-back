#!/bin/sh
set -e

# games/, data/ and public/ruffle/ are expected to be mounted as volumes so
# downloads persist across container restarts/rebuilds.

if [ ! -f public/ruffle/ruffle.js ]; then
  echo "[entrypoint] Ruffle not found, fetching..."
  node server/scripts/fetch-ruffle.js
fi

exec "$@"
