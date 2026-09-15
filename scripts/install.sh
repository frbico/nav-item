#!/usr/bin/env bash
# frbico/nav-item shared-host installer; downloads only this repository's release.
set -euo pipefail
umask 077
RELEASE=v1.1.0
BASE="https://github.com/frbico/nav-item/releases/download/$RELEASE"
for tool in devil curl unzip tar; do command -v "$tool" >/dev/null || { echo "Missing command: $tool" >&2; exit 1; }; done
node_bin=${NODE_BIN:-}
if [[ -z "$node_bin" ]]; then
  for candidate in /usr/local/bin/node24 /usr/local/bin/node22; do
    if [[ -x "$candidate" ]]; then node_bin=$candidate; break; fi
  done
fi
[[ -n "$node_bin" && -x "$node_bin" ]] || { echo 'Set NODE_BIN to Node.js 22.13+ (24 recommended).' >&2; exit 1; }
"$node_bin" -e "require('node:sqlite').DatabaseSync || process.exit(1)"
npm_bin=${NPM_BIN:-${node_bin/node/npm}}
[[ -x "$npm_bin" ]] || { echo 'Set NPM_BIN to the matching npm executable.' >&2; exit 1; }
user=$(id -un)
host=$(hostname)
if [[ -z ${DOMAIN:-} ]]; then
  case "$host" in
    *ct8*) DOMAIN="$user.ct8.pl";;
    *hostuno*) DOMAIN="$user.useruno.com";;
    *serv00*) DOMAIN="$user.serv00.net";;
    *) echo 'Unknown host: set DOMAIN to your registered website domain.' >&2; exit 1;;
  esac
fi
[[ "$DOMAIN" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*[a-zA-Z0-9]$ && "$DOMAIN" != *..* ]] || { echo 'Invalid DOMAIN' >&2; exit 1; }
site_type=$(devil www list | awk -v domain="$DOMAIN" '$1 == domain {print $2}')
[[ -z "$site_type" || "$site_type" == nodejs ]] || { echo 'This domain already has a non-Node website; choose a different DOMAIN.' >&2; exit 1; }
work="$HOME/domains/$DOMAIN/public_nodejs"
stage=$(mktemp -d)
trap 'rm -rf -- "$stage"' EXIT
mkdir -p "$stage/bin"
ln -s "$node_bin" "$stage/bin/node"
export PATH="$stage/bin:$PATH"
curl --fail --location --retry 3 "$BASE/nav.zip" -o "$stage/nav.zip"
curl --fail --location --retry 3 "$BASE/SHA256SUMS" -o "$stage/SHA256SUMS"
expected=$(awk '$2 == "nav.zip" {print $1}' "$stage/SHA256SUMS")
actual=$("$node_bin" -e "console.log(require('crypto').createHash('sha256').update(require('fs').readFileSync(process.argv[1])).digest('hex'))" "$stage/nav.zip")
[[ "$expected" =~ ^[a-f0-9]{64}$ && "$actual" == "$expected" ]] || { echo 'Archive checksum mismatch' >&2; exit 1; }
mkdir "$stage/app"
unzip -q "$stage/nav.zip" -d "$stage/app"
(cd "$stage/app" && "$npm_bin" ci --omit=dev --omit=optional --ignore-scripts && NAV_SQLITE_DRIVER=builtin "$node_bin" -e "require('./sqlite');require('sharp')({create:{width:1,height:1,channels:3,background:'white'}}).png().toBuffer().then(()=>console.log('SQLite and image processing ready')).catch(e=>{console.error(e);process.exit(1)})")
if [[ -z "$site_type" ]]; then devil www add "$DOMAIN" nodejs "$node_bin"; fi
mkdir -p "$work"
if [[ -f "$work/app.js" || -f "$work/.env" || -d "$work/database" ]]; then
  echo 'Existing installation detected; no application files changed. Follow README upgrade/backup instructions.' >&2
  exit 1
fi
cp -R "$stage/app/." "$work/"
cd "$work"
mkdir -p database uploads
if [[ ! -f .env ]]; then NAV_SQLITE_DRIVER=builtin "$node_bin" scripts/configure-env.cjs; fi
# FreeBSD always uses built-in SQLite; retain existing credentials on upgrades.
chmod 600 .env
"$node_bin" -e "require('./config')"
devil www restart "$DOMAIN"
printf 'Installed %s. Site: https://%s/  Admin: https://%s/admin\nCredentials: %s/.env\n' "$RELEASE" "$DOMAIN" "$DOMAIN" "$work"
