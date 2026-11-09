#!/usr/bin/env bash
# Thursday: announce today's live article, then prepare exactly next Thursday.
# Manual reruns reuse an existing slot and do not create another paid article.
set -euo pipefail
REPO="${SIGNA_REPO:-/home/razex/signa-cafe-repo}"
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"
export TZ=Asia/Makassar
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] $*"; }
cd "$REPO"
mkdir -p .story-runtime
exec 9>.story-runtime/weekly.lock
if ! flock -n 9; then log "weekly stories already running - skipped"; exit 0; fi
RUN_LOG=$(mktemp)
PHASE="обновление кода"
finish() {
  local status=$?
  trap - EXIT
  if [ "$status" -ne 0 ]; then
    # A rejected article still costs money. Persist and publish its ledger even
    # though there is no article to commit/deploy, so admin sees actual spend.
    if ! git diff --quiet -- data/story-costs.json; then
      if git add data/story-costs.json && git -c user.name=signa-cron -c user.email=mail@signa.cafe \
          commit --quiet -m "Stories: record failed generation costs $(date +%F)"; then
        git push --quiet origin main 2>/dev/null || log "cost commit kept locally - push unavailable"
      fi
      tools/deploy-stories.sh --costs-only || log "cost ledger upload FAILED - local ledger retained"
    fi
    log "FAILED at: $PHASE"
    node tools/notify-telegram.mjs --failure "$PHASE" \
      --details "$(tail -n 4 "$RUN_LOG")" || log "failure notification FAILED"
  fi
  rm -f "$RUN_LOG"
  exit "$status"
}
trap finish EXIT
log "=== weekly stories run ==="
# Never discard unpushed stories or the cost ledger.
git fetch --quiet origin main
if ! git pull --quiet --rebase --autostash origin main; then
  git rebase --abort 2>/dev/null || true
  log "pull --rebase failed - stop before generating on an uncertain tree"
  exit 1
fi

git diff --cached --quiet || { log "unexpected staged files - stopping"; exit 1; }

TODAY=$(date +%F)
LIVE_SLUG=$(node -e '
  const p = require("./data/stories.json").posts.find(p => p.date === process.argv[1]);
  if (p) console.log(p.slug);
' "$TODAY")
PHASE="уведомление о публикации"
ANNOUNCEMENT_FAILED=0
if [ -n "$LIVE_SLUG" ]; then
  code=$(curl -4 -sS -o /dev/null -w '%{http_code}' --max-time 30 "https://signa.cafe/stories/$LIVE_SLUG" || true)
  if [ "$code" != "200" ]; then
    PHASE="восстановление публикации"
    tools/deploy-stories.sh --no-ping
    code=$(curl -4 -sS -o /dev/null -w '%{http_code}' --max-time 30 "https://signa.cafe/stories/$LIVE_SLUG" || true)
    [ "$code" = "200" ] || { log "live story unavailable (HTTP $code)"; exit 1; }
  fi
  if node tools/notify-telegram.mjs --slug "$LIVE_SLUG" --once; then
    log "announced $LIVE_SLUG"
  else
    ANNOUNCEMENT_FAILED=1
    log "telegram announcement FAILED - see .story-runtime state before resending"
  fi
else
  log "nothing dated $TODAY - skipping announcement"
fi

NEXT=$(node --input-type=module -e '
  import {baliDate,nextThursday} from "./tools/story-schedule.mjs";
  console.log(nextThursday(baliDate()));
')
EXISTS=$(node -e 'console.log(require("./data/stories.json").posts.some(p=>p.date===process.argv[1])?"yes":"no")' "$NEXT")
PHASE="генерация истории EN/RU/ID"
if [ "$EXISTS" = "yes" ]; then
  log "slot $NEXT already prepared - reusing it without paid generation"
else
  node tools/story-gen.mjs --count 1 --date "$NEXT" --verbose 2>&1 | tee "$RUN_LOG"
fi
PHASE="подготовка фотографий и карточек"
node tools/og-images.mjs >/dev/null
PHASE="сохранение истории"
git add data/stories.json data/story-costs.json
# Only referenced covers: abandoned drafts must not be accidentally published.
  while IFS= read -r asset; do [ -z "$asset" ] || git add -- "$asset"; done < <(node -e '
    const fs=require("fs"),path=require("path");
    for(const p of require("./data/stories.json").posts){
      const og="assets/og/"+path.basename(p.cover).replace(/\.[a-z0-9]+$/i,".jpg");
      for(const f of [p.cover,og]) if(fs.existsSync(f)) console.log(f);
    }
  ')
if ! git diff --cached --quiet; then
  git -c user.name=signa-cron -c user.email=mail@signa.cafe commit --quiet -m "Stories: queue $NEXT"
  git push --quiet origin main 2>/dev/null || log "story commit kept locally - push unavailable"
fi
PHASE="выкладка истории и фотографий"
tools/deploy-stories.sh
if [ "$ANNOUNCEMENT_FAILED" = "1" ]; then PHASE="уведомление о публикации"; exit 1; fi
log "=== done: next story $NEXT is queued ==="
