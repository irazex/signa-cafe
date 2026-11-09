# Signa Cafe release queue

## signa-stories-recovery-20261109

- Owner thread: `01a06f49-ffde-7933-9b13-b8900a0e6aaf` (task author).
- Repository: `irazex/signa-cafe`; source SHA: `77db70820d85cbf9ec7847880748731a565fb5b6`.
- Source snapshot SHA-256: `d6c9c5a7cad18b8c61cbc9e15cf1a84e5b12a9006a67aef9cee3a9bda934de50`; archive `signa-stories-77db7082.tar`. Contains only committed `tools/`, `data/`, `content.json`; no credentials or production env.
- State: **DEPLOYING**; started 2026-11-09 (WITA). Implemented locally on fresh `4fe9609`, source pushed fast-forward. 17/17 Node 20 offline gates passed; prior critic findings corrected and regression-tested. Install under shared/project mutexes, then actual content acceptance and independent POST.
- Physical target: VPS `103.174.115.136:8022`, `/home/razex/signa-cafe-repo` (Node 20 cron); website `atlas.multihost.cloud/signa.cafe` (Apache/PHP via existing FTP path).
- Shared mutex: `/home/razex/deploy-locks/buildfarm-global.lock`; project mutex `.story-runtime/weekly.lock`. Never remove another owner's lock.
- Migrations: none. Preserve live `data/story-costs.json`, existing stories, unpushed commits, `.env`, and all runtime response/notification state.
- Tests: 17/17 local offline tests passed on Node 20 and current Node, including real-Git cron retry, unresolved response, strict budget, corrupt ledger/story data, timezone and native prose guards; Bash syntax and existing 8-story validation passed. Network fix proved 5/5 photo HTTP 200 on VPS without paid generation.
- CI/CD profile: Signa has no qualified native CI/blue-green profile. This release uses the existing reviewed script/FTP path, source checksum, exclusive locks, backup and task-specific read-back. No claim of automatic CI/CD or blue-green installation; no Bank-only profile reused.
- Rollback: back up VPS tools + story/cost data and public stories JSON before install; restore only changed tool bytes at previous `4fe9609` and public JSON if needed. Do not roll back/remove actual cost records, response state or Telegram evidence. Existing pages remain served during the CLI install.
- Acceptance: one native EN/RU/ID article published on recovery date, one queued for 2026-11-12; exact public JSON/image read-back; future post hidden until its date; RSS/sitemap/llms reflect current content; Telegram accepted once; repeat cron does not call OpenAI or duplicate notification; model gpt-5.5 and $3/day, $10/month caps intact.
- Paid scope: only recovery article and next Thursday's reserve, bounded by existing caps; no backfill of missed weeks.
- Evidence: local test output + independent review; deployment/read-back receipt to be added after success. A source commit is not DONE.

- Superseded snapshot: source `3db3b9b19f6015ba2bb462bf3acedb5101f3b9a1`, digest `17665916b7d7759ff1c9ff035bfa2ba9e160b39f7569ab00867060872c1aa10c`. Final runtime adds definite-create rejection classification, serialized stale-lock recovery, and ledger-only failure commits. Reinstall waits for the currently owned single generation to end; no interruption or replay.

- Recovery acceptance update: first ID response ended incomplete at its output ceiling; final usage was recorded ($0.9964 total for this attempt), no article activated. Latest source keeps accepted language checkpoints, supports explicit GET-only recovery of already-billed responses, and uses GPT-5.5 reasoning low. Caps/output limits unchanged. Superseded source `450d61f7ee1ba025b8c4a3c99d4def4fb12ff8d7`, digest `dc087c3d6717dcd9409001f5f3f9a41c6370f8889e429d223c153e78c0b1da00`.

- Final recovery guard: known billed response read failure stops before new generation; original input_items must match current factual prompt. ID checker exempts only the exact multi-word menu name, while generic English copy is still rejected. Superseded source `f8e4729a677eff0983f90c028b2535033155225e`, digest `644bf6ed78f2e7329c1b428b39d8df636b3e6f2fa907061f910fbfc8c2dd7be0`.

- Reviewed content accepted: Big Breakfast EN/RU/ID completed from already-billed responses; final recovery used --budget0 and made no create calls. Editorial PRE PASS after targeted native corrections. Total November spend $1.1418, all failed/incomplete attempts included. Original 8 posts deep-equal previous source. New source includes reviewed article/assets, strict GET-only recovery, prompt-version checkpoints and native-writing corrections. Superseded source `2ea49a178d4b75aa53d255a45ed1dbe8cef32ec4`, digest `80028839d4e4344f75abce35d54b96c213b6620cf97281f6e317919e386a9042`.

- First activation read-back: public reviewed Big Breakfast RU URL HTTP200, correct dish cover and old cringe phrase absent. deploy-stories exact public JSON match, assets before JSON, costs published, IndexNow HTTP200. Running ordinary weekly job to announce once and prepare 2026-11-12.

- Final reserve accepted by independent editor for 2026-11-12: OMG EN/RU/ID, 50 000 IDR, exact Syrve dish image. No paid backfill or budget increases. Ordinary run proved failure alerts, retained accepted languages and booked all costs; after its geo rejection the existing billed candidate was corrected offline. Retry now receives its own previous JSON, and public fact fields reject internal writing notes. Code PRE PASS and 17/17 Node20 offline tests. November Signa total $1.5253. Superseded source `5a225bf44bdbca1c42e8ff33460c263f6cf9156a`, digest `a279a84fee0f439e2467b0f7e66a8a54eadf0fa963ecdbd661f7c9cf0f0d7839`.
