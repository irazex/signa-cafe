#!/usr/bin/env bash
# Weekly Stories cron. Runs on the VPS every Thursday morning.
#
# Why the VPS and not the web host: multihost.cloud has no SSH, and its egress
# region is blocked by the OpenAI API (see key.php). The VPS reaches both
# api.openai.com and the signa.cafe FTP, so it does the work and pushes the
# result over FTP.
#
# One run does two things, in this order:
#
#   1. ANNOUNCE the post dated today. It was written a week ago and became
#      visible at midnight (st_load hides future dates), so by now it is live
#      and the owner gets a Telegram link he can actually open.
#   2. WRITE the post for next Thursday. That leaves a full week to read it,
#      edit it or throw it away before it publishes itself.
#
# So the pipeline is always one week deep and needs no second cron and no state
# file: "today" is the publish date and "next Thursday" is the draft date.
#
# Install:
#   0 9 * * 4  /home/razex/signa-cafe-repo/tools/cron-weekly.sh >> /home/razex/logs/signa-stories.log 2>&1
set -euo pipefail

REPO="${SIGNA_REPO:-/home/razex/signa-cafe-repo}"
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] $*"; }

cd "$REPO"
log "=== weekly stories run ==="

# Pick up anything written or edited by hand, without ever discarding work that
# has not reached GitHub yet. Never "reset --hard": if the push at the end of a
# previous run failed, that commit is the only copy of last week's post.
git fetch --quiet origin main
if ! git pull --quiet --rebase --autostash origin main; then
  git rebase --abort 2>/dev/null || true
  log "pull --rebase failed - continuing on the local tree"
fi

# ---------- 1. announce whatever went live today ----------
TODAY=$(date +%F)
LIVE_SLUG=$(node -e '
  const posts = require("./data/stories.json").posts;
  const hit = posts.find((p) => p.date === process.argv[1]);
  if (hit) console.log(hit.slug);
' "$TODAY")

if [ -n "$LIVE_SLUG" ]; then
  # Only shout about it once the page really answers - a failed FTP upload last
  # week would otherwise send the owner to a 404.
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 30 \
         "https://signa.cafe/stories/$LIVE_SLUG" || echo 000)
  if [ "$code" = "200" ]; then
    if node tools/notify-telegram.mjs --slug "$LIVE_SLUG"; then
      log "announced $LIVE_SLUG"
    else
      log "telegram notification FAILED for $LIVE_SLUG"
    fi
  else
    log "$LIVE_SLUG is dated today but answers HTTP $code - re-deploying instead of announcing"
    tools/deploy-stories.sh --no-ping || log "re-deploy failed"
  fi
else
  log "nothing dated $TODAY - skipping announcement"
fi

# ---------- 2. write next week's post ----------
BEFORE=$(node -e 'console.log(require("./data/stories.json").posts.length)')

if ! node tools/story-gen.mjs --count 1 --verbose; then
  log "generation FAILED - nothing new queued"
  exit 1
fi

AFTER=$(node -e 'console.log(require("./data/stories.json").posts.length)')
if [ "$AFTER" -le "$BEFORE" ]; then
  log "no new post produced (dish pool may be exhausted) - stopping"
  exit 0
fi

NEW=$(node -e '
  const p = require("./data/stories.json").posts;
  const n = p.slice().sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  console.log(`${n.date} ${n.slug}`);
')
log "queued: $NEW"

# Social cards for the fresh cover, before anything is pushed.
node tools/og-images.mjs >/dev/null || log "og-images failed (non-fatal)"

git add data/stories.json assets/
git -c user.name="signa-cron" -c user.email="hi@signa.cafe" \
    commit --quiet -m "Stories: queue ${NEW}"
# Best-effort. The FTP upload below is the actual publication; GitHub is the
# archive. A missing credential must not stop a post from going out.
if git push --quiet origin main 2>/dev/null; then
  log "pushed to origin/main"
else
  log "push failed - commit kept locally, will go out with the next successful push"
fi

# Upload now even though the post is future-dated: the file is the whole deploy,
# and the site starts showing the post on its own on the date.
tools/deploy-stories.sh

log "=== done ==="
