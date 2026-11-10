#!/bin/sh
set -eu
mkdir -p dist
# Only publish browser assets; NEVER publish server.py or credentials.
for file in index.html v84.js backup.js sw.js manifest.webmanifest icon-192.png icon-512.png favicon.png splash-strideeleven.jpg; do
  test -f "$file"
  cp "$file" "dist/$file"
done
