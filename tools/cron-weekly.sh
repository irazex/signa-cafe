#!/usr/bin/env bash
# Weekly Stories cron. Runs on the VPS every Thursday.
#
# Why the VPS and not the web host: multihost.cloud has no SSH, and its egress
# region is blocked by the OpenAI API (see key.php). The VPS reaches both
# api.openai.com and the signa.cafe FTP, so it does the work and pushes the
# result over FTP.
#
# The generated post is dated the NEXT free Thursday, so there is a full week to
# read it before it appears. st_load() hides future-dated posts, so publication
# happens by itself on the date - no second cron needed.
#
# Install:
#   0 9 * * 4  /home/razex/signa-cafe/tools/cron-weekly.sh >> /home/razex/logs/signa-stories.log 2>&1
set -euo pipefail

REPO="${SIGNA_REPO:-/home/razex/signa-cafe}"
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] $*"; }

cd "$REPO"
log "=== weekly stories run ==="

# Start from whatever is on main so a post written by hand is never clobbered.
git fetch --quiet origin main
git reset --hard --quiet origin/main

BEFORE=$(node -e 'console.log(require("./data/stories.json").posts.length)')

if ! node tools/story-gen.mjs --count 1 --verbose; then
  log "generation FAILED - nothing published"
  exit 1
fi

AFTER=$(node -e 'console.log(require("./data/stories.json").posts.length)')
if [ "$AFTER" -le "$BEFORE" ]; then
  log "no new post produced (dish pool may be exhausted) - stopping"
  exit 0
fi

NEW=$(node -e '
  const p = require("./data/stories.json").posts;
  const n = p.slice().sort((a,b) => a.date < b.date ? 1 : -1)[0];
  console.log(`${n.date} ${n.slug}`);
')
log "new post: $NEW"

git add data/stories.json
git -c user.name="signa-cron" -c user.email="hi@signa.cafe" \
    commit --quiet -m "Stories: weekly post ${NEW}"
git push --quiet origin main
log "pushed to origin/main"

tools/deploy-stories.sh
log "=== done ==="
