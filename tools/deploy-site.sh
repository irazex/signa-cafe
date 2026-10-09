#!/usr/bin/env bash
# Publishes the four React pages (index/menu/about/visit), their compiled
# bundles in js/ and .htaccess to signa.cafe, then reads everything back.
# Stories have their own script: tools/deploy-stories.sh.
#
#   tools/deploy-site.sh
#
# Order matters: bundles first (new URLs, nothing links to them yet), then
# .htaccess (rolled back on its own if the site starts answering 5xx), then the
# pages that switch visitors to the new bundles.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

FTP_HOST="ftp://atlas.multihost.cloud/signa.cafe"
FTP_USER="aqq17894"
CRED_FILE="${SIGNA_FTP_CRED_FILE:-$HOME/.razex-creds/signa-ftp.txt}"
SITE="https://signa.cafe"
PAGES=(index.html menu.html about.html visit.html)

[ -f "$CRED_FILE" ] || { echo "missing FTP password file: $CRED_FILE" >&2; exit 1; }
FTP_CRED="$FTP_USER:$(cat "$CRED_FILE")"

# Prod must be a commit everyone can see: deploy = rsync-style overwrite, and
# what is not in origin/main cannot be rolled back to.
[ -z "$(git status --porcelain)" ] || { echo "working tree is dirty - commit first" >&2; exit 1; }
git fetch -q origin
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || { echo "HEAD is not origin/main - push or pull first" >&2; exit 1; }
node tools/build-js.mjs --check

up() {
  local local_path="$1" remote_path="${2:-$1}"
  curl -sS --ftp-create-dirs --max-time 120 --retry 3 --retry-all-errors \
       -T "$local_path" "$FTP_HOST/$remote_path" --user "$FTP_CRED"
  echo "  uploaded $local_path"
}
code() { curl -sS -o /dev/null -w '%{http_code}' --max-time 30 "$1" || echo 000; }

echo "deploying site to signa.cafe"
for f in js/*.js; do up "$f"; done

BACKUP="$(mktemp -d)/htaccess.prod"
curl -sS --max-time 60 "$FTP_HOST/.htaccess" --user "$FTP_CRED" -o "$BACKUP"
up .htaccess
for u in / /stories /admin "/js/core.js"; do
  c=$(code "$SITE$u")
  case "$c" in
    2*|3*) ;;
    *) echo "  $u answered $c after .htaccess - restoring the previous one" >&2
       curl -sS -T "$BACKUP" "$FTP_HOST/.htaccess" --user "$FTP_CRED"
       exit 1 ;;
  esac
done

for p in "${PAGES[@]}"; do up "$p"; done
up src/site.jsx

echo "read-back"
fail=0
for p in "${PAGES[@]}"; do
  live=$(curl -sS --max-time 30 "$SITE/$p")
  for v in $(grep -o 'js/[a-z]*\.js?v=[0-9a-f]*' "$p"); do
    printf '%s' "$live" | grep -q "$v" || { echo "  $p: live page does not link $v" >&2; fail=1; }
  done
done
for f in js/*.js; do
  remote=$(curl -sS --compressed --max-time 60 "$SITE/$f" | shasum | cut -c1-40)
  [ "$remote" = "$(shasum < "$f" | cut -c1-40)" ] || { echo "  $f: live copy differs" >&2; fail=1; }
done
hdr=$(curl -sS -D - -o /dev/null -H 'Accept-Encoding: gzip' "$SITE/js/core.js")
printf '%s' "$hdr" | grep -qi '^content-encoding: gzip' || { echo "  js/core.js is not compressed" >&2; fail=1; }
printf '%s' "$hdr" | grep -qi '^cache-control: .*immutable' || { echo "  js/core.js is not cached as immutable" >&2; fail=1; }
[ "$fail" = 0 ] && echo "done" || exit 1
