#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm ci
npm --prefix web ci --include=dev
npm --prefix web run build
mkdir -p release
# Explicit allowlist: never package local credentials, databases or installed dependencies.
stage=$(mktemp -d)
trap 'rm -rf -- "$stage"' EXIT
zip -q -r "$stage/nav.zip" app.js config.js db.js sqlite.js package.json package-lock.json routes web/dist uploads/default-favicon.png scripts/configure-env.cjs LICENSE NOTICE
mv "$stage/nav.zip" release/nav.zip
cp scripts/install.sh release/install.sh
(cd release && sha256sum nav.zip install.sh > SHA256SUMS)
