# Signa Stories: stopped publishing, recovered 9 November 2026

## Confirmed failure

The cron remained active at `0 9 * * 4` (Asia/Makassar). Last live story before recovery was dated 24 September. Its logs show rejected text on 24 September and 15 October, and photo-fetch failures on 1, 8, 22, 29 October and 5 November. This was not the monthly cap: October used $1.13 and November was $0 before this repair.

Node 20 on the VPS attempted unreachable IPv6 addresses during automatic address-family selection. The same Syrve photo returned HTTP 200 with curl while Node fetch timed out. With IPv4-first DNS **and** automatic family selection disabled, five consecutive Node requests returned 200. DNS ordering alone is insufficient on this host.

Other defects prolonged the outage: dates were calculated from the last September article, repeatedly selecting 1 October; a text retry regenerated every language without providing the rejected draft; errors stayed in a file instead of reaching the owner.

## Final behavior

- Shared IPv4 setup for photo/OpenAI/Telegram clients; three bounded retries for transient photo failures. Own verified dish photo remains mandatory before any paid call.
- Future Thursday selected from today's WITA date; missed weeks are not backfilled. An already prepared slot is reused on repeat cron.
- Independent English, Russian and Indonesian editions remain separate. Accepted languages checkpoint after each stage; changes to business facts or prompt rules invalidate the checkpoint. A retry receives only its own previous native JSON and exact validation failures, at most twice.
- Exact multi-word menu names such as Big Breakfast are allowed in Indonesian; generic English menu copy remains rejected. Metadata/facts reject observed internal writing notes. Human review corrected the two recovery posts before publication.
- Project cron lock and generator lock prevent concurrent writers; stale-lock recovery is serialised. No reset-hard, no untracked-draft publication, no commit of unrelated staged files.
- Error notifications go to the owner's existing Telegram topic. Announcements record a pending/sent result and do not blindly replay an unknown send. JPEG is uploaded directly instead of asking Telegram to fetch a remote WebP/image URL.

## Budget and observed costs

Model stays `gpt-5.5`; editorial reasoning is `low`. Caps stay $3/day, $10/month, $5/run. Before each paid request, the ledger must parse and cover a conservative maximum request cost. Unknown prices, unresolved previous responses or ambiguous create results block further paid work. A create POST is never blindly retried. Abandoned/incomplete usage is recorded; response IDs are accounted once.

One real acceptance run exposed an incomplete ID response, which was cancelled and booked. Already-billed completed editions were recovered with read-only Responses GETs. Recovery mode forbids any paid fallback and verifies original input context. A final recovery with `--budget 0` assembled the first article without new generation.

Total Signa November spend after this work is **$1.5253 in the ledger**, including all failed/rejected/incomplete attempts. It is computed from actual API tokens against the verified rate card, not an account-wide billing export. No caps were raised and no missed-week batch was generated. The ledger was preserved before/after deployment and repeat cron with SHA-256 `9a34418fca8615c0ee0833889a6b495d5182309ac492fcf345944ae4fc5198f6`.

## Acceptance evidence

- Runtime source `77db70820d85cbf9ec7847880748731a565fb5b6`; source snapshot SHA-256 `d6c9c5a7cad18b8c61cbc9e15cf1a84e5b12a9006a67aef9cee3a9bda934de50`.
- 17/17 autonomous tests on Node 20. Tests use fixtures/local Git, no API credentials or paid requests. Bash syntax and all 10 story records pass validation.
- Big Breakfast EN/RU/ID published 9 November, 85 000 IDR, own dish photo. Independent editorial POST confirmed exact live paragraphs/metadata and image against accepted source.
- OMG EN/RU/ID prepared for 12 November, 50 000 IDR, its own Syrve photo. Independent editorial PRE accepted the queued content. The original eight stories remain unchanged.
- First announcement accepted by Telegram, message 18422; GBP draft 18423; failure alert 18424 proved the error path. Repeat cron kept message 18422 and spent $0, reusing the 12 November slot; exit 0 at 13:59:17 WITA.
- Public JSON read-back exact, assets uploaded before data, IndexNow HTTP 200. Detailed endpoint/image receipt: `deploy/evidence/signa-stories-recovery-20261109.json`.
- Backups: `/home/razex/backups/signa-stories-recovery-20261109/`; installation and activation used the shared physical lock `/home/razex/deploy-locks/buildfarm-global.lock` and project lock. No database migrations or production business writes.

## Practical limits

This is the existing reviewed CLI/FTP release path. Signa has no qualified native CI/CD/blue-green profile; that infrastructure is not claimed as implemented. Build/typecheck/migration gates are N/A for these plain JS/PHP-data changes; applicable offline tests, source checks, backups and live checks were performed.

VPS GitHub push still lacks credentials. Cron retains its local commit and publishes by FTP. All current recovery content/costs have been archived through the local checkout. This pre-existing credential item remains in TASKS; no key was copied to the VPS during this repair.

The future calendar event itself has not occurred. Active crontab and queued/hidden date are confirmed now; actual 12 November opening/announcement remains a future runtime event.
