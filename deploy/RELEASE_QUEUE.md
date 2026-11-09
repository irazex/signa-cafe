# Signa Cafe release queue

## signa-stories-recovery-20261109

- Owner thread: `01a06f49-ffde-7933-9b13-b8900a0e6aaf` (task author).
- Repository: `irazex/signa-cafe`; source SHA: `3db3b9b19f6015ba2bb462bf3acedb5101f3b9a1`.
- Source snapshot SHA-256: `17665916b7d7759ff1c9ff035bfa2ba9e160b39f7569ab00867060872c1aa10c`; archive `signa-stories-3db3b9b1.tar`. Contains only committed `tools/`, `data/`, `content.json`; no credentials or production env.
- State: **DEPLOYING**; started 2026-11-09 (WITA). Implemented locally on fresh `4fe9609`, source pushed fast-forward. 11/11 Node 20 offline gates passed; prior critic findings corrected and regression-tested. Install under shared/project mutexes, then actual content acceptance and independent POST.
- Physical target: VPS `103.174.115.136:8022`, `/home/razex/signa-cafe-repo` (Node 20 cron); website `atlas.multihost.cloud/signa.cafe` (Apache/PHP via existing FTP path).
- Shared mutex: `/home/razex/deploy-locks/buildfarm-global.lock`; project mutex `.story-runtime/weekly.lock`. Never remove another owner's lock.
- Migrations: none. Preserve live `data/story-costs.json`, existing stories, unpushed commits, `.env`, and all runtime response/notification state.
- Tests: 11/11 local offline tests passed on Node 20 and current Node, including real-Git cron retry, unresolved response, strict budget, corrupt ledger/story data, timezone and native prose guards; Bash syntax and existing 8-story validation passed. Network fix proved 5/5 photo HTTP 200 on VPS without paid generation.
- CI/CD profile: Signa has no qualified native CI/blue-green profile. This release uses the existing reviewed script/FTP path, source checksum, exclusive locks, backup and task-specific read-back. No claim of automatic CI/CD or blue-green installation; no Bank-only profile reused.
- Rollback: back up VPS tools + story/cost data and public stories JSON before install; restore only changed tool bytes at previous `4fe9609` and public JSON if needed. Do not roll back/remove actual cost records, response state or Telegram evidence. Existing pages remain served during the CLI install.
- Acceptance: one native EN/RU/ID article published on recovery date, one queued for 2026-11-12; exact public JSON/image read-back; future post hidden until its date; RSS/sitemap/llms reflect current content; Telegram accepted once; repeat cron does not call OpenAI or duplicate notification; model gpt-5.5 and $3/day, $10/month caps intact.
- Paid scope: only recovery article and next Thursday's reserve, bounded by existing caps; no backfill of missed weeks.
- Evidence: local test output + independent review; deployment/read-back receipt to be added after success. A source commit is not DONE.
