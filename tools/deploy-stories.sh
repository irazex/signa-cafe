#!/usr/bin/env bash
# Publishes the stories data file to signa.cafe and tells search engines about it.
# Everything the site renders (pages, /feed.xml, /sitemap.xml, /llms.txt) is built
# from data/stories.json at request time, so this one file is the whole deploy.
#
#   tools/deploy-stories.sh              upload + ping
#   tools/deploy-stories.sh --no-ping    upload only
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

FTP_HOST="ftp://atlas.multihost.cloud/signa.cafe"
FTP_USER="aqq17894"
CRED_FILE="${SIGNA_FTP_CRED_FILE:-$HOME/.razex-creds/signa-ftp.txt}"

[ -f "$CRED_FILE" ] || { echo "missing FTP password file: $CRED_FILE" >&2; exit 1; }
FTP_CRED="$FTP_USER:$(cat "$CRED_FILE")"

up() {
  local local_path="$1" remote_path="${2:-$1}"
  curl -sS --ftp-create-dirs --max-time 120 --retry 3 --retry-all-errors \
       -T "$local_path" "$FTP_HOST/$remote_path" --user "$FTP_CRED"
  echo "  uploaded $local_path"
}

echo "deploying stories to signa.cafe"
up data/stories.json

[ "${1:-}" = "--no-ping" ] && { echo "done (no ping)"; exit 0; }

# IndexNow: Bing, Yandex and Seznam accept a push and crawl within minutes
# instead of waiting for their own schedule. Google ignores it but reads the
# sitemap, which is regenerated from the same file.
KEY_FILE=$(ls "$ROOT"/*.txt 2>/dev/null | grep -E '/[0-9a-f]{32}\.txt$' | head -1 || true)
if [ -n "$KEY_FILE" ]; then
  KEY=$(basename "$KEY_FILE" .txt)
  URLS=$(node -e '
    const s = require("./data/stories.json");
    const live = s.posts.filter(p => p.date <= new Date().toISOString().slice(0,10));
    const u = ["https://signa.cafe/stories", "https://signa.cafe/stories/ru"];
    for (const p of live) { u.push(`https://signa.cafe/stories/${p.slug}`); u.push(`https://signa.cafe/stories/ru/${p.slug}`); }
    console.log(JSON.stringify(u));
  ')
  BODY=$(node -e "
    const urls = $URLS;
    console.log(JSON.stringify({ host: 'signa.cafe', key: '$KEY', keyLocation: 'https://signa.cafe/$KEY.txt', urlList: urls }));
  ")
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 60 \
    -H 'Content-Type: application/json' -d "$BODY" https://api.indexnow.org/indexnow || echo "000")
  echo "  IndexNow -> HTTP $code"
else
  echo "  IndexNow skipped: no key file in repo root" >&2
fi

# There is no Google equivalent any more - the /ping?sitemap endpoint was retired
# and now answers 404. Google picks the sitemap up from robots.txt on its own
# schedule; a one-off resubmit is a manual job in Search Console.

echo "done"
