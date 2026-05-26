<?php
/**
 * analytics.php — reads JSONL event logs and returns aggregated stats.
 *
 * Behind Basic Auth (.htaccess <Files "analytics.php">). Admin tab calls
 * this with query: ?days=7&bots=0
 *
 * Returns JSON:
 * {
 *   period_days, include_bots,
 *   page_views, unique_sessions, sessions_human, sessions_bot,
 *   by_day: { "YYYY-MM-DD": count, ... },
 *   top_clicks: { target: count, ... },
 *   lang_split, devices, top_referrers, top_pages,
 *   scroll_depth: { sectionIdx: sessionCount, ... },
 *   sample: [...recent events for sanity check...]
 * }
 */

header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store, no-cache, must-revalidate");

$log_dir = __DIR__ . '/analytics';

$days = max(1, min(180, intval($_GET['days'] ?? 7)));
$include_bots = !empty($_GET['bots']);

$now = time();
$start = $now - $days * 86400;

// Collect events
$events = [];
$files = glob($log_dir . '/*.jsonl') ?: [];
foreach ($files as $f) {
    $date = basename($f, '.jsonl');
    $file_ts = strtotime($date . ' 00:00:00 UTC');
    if ($file_ts === false || $file_ts < $start - 86400) continue;
    $fp = @fopen($f, 'r');
    if (!$fp) continue;
    while (($line = fgets($fp)) !== false) {
        $r = json_decode($line, true);
        if (!is_array($r)) continue;
        if (!$include_bots && !empty($r['bot'])) continue;
        if (($r['ts'] ?? 0) < $start) continue;
        $events[] = $r;
    }
    fclose($fp);
}

// Aggregate
$pv_count = 0;
$human_sids = [];
$bot_sids = [];
$by_day = [];        // YYYY-MM-DD -> count
$clicks = [];        // target -> count
$lang_counts = [];
$devices = ['mobile' => 0, 'tablet' => 0, 'desktop' => 0];
$referrers = [];     // host -> count
$pages = [];         // path -> count
$tz_counts = [];     // timezone -> count
$scroll_max_per_sid = []; // sid -> max section index seen

foreach ($events as $r) {
    $t = $r['t'] ?? '';
    $sid = $r['sid'] ?? '';
    $d = is_array($r['d'] ?? null) ? $r['d'] : [];
    if (empty($r['bot'])) $human_sids[$sid] = true;
    else                  $bot_sids[$sid] = true;

    if ($t === 'pv') {
        $pv_count++;
        $day = gmdate('Y-m-d', $r['ts']);
        $by_day[$day] = ($by_day[$day] ?? 0) + 1;

        $lang = $d['lang'] ?? 'en';
        $lang_counts[$lang] = ($lang_counts[$lang] ?? 0) + 1;

        $vw = intval($d['vw'] ?? 0);
        if ($vw > 0) {
            if ($vw < 768)        $devices['mobile']++;
            elseif ($vw < 1024)   $devices['tablet']++;
            else                  $devices['desktop']++;
        }

        $ref = (string)($d['ref'] ?? '');
        if ($ref) {
            $host = parse_url($ref, PHP_URL_HOST);
            if ($host && stripos($host, 'signa.cafe') === false) {
                $referrers[$host] = ($referrers[$host] ?? 0) + 1;
            }
        }

        $path = (string)($d['path'] ?? '/');
        $pages[$path] = ($pages[$path] ?? 0) + 1;

        $tz = (string)($d['tz'] ?? '');
        if ($tz) $tz_counts[$tz] = ($tz_counts[$tz] ?? 0) + 1;
    } elseif ($t === 'click') {
        $target = (string)($d['target'] ?? 'unknown');
        $clicks[$target] = ($clicks[$target] ?? 0) + 1;
    } elseif ($t === 'scroll') {
        $section = (string)($d['section'] ?? '');
        // section is like "04_menu" -> idx = 4
        $idx = intval(substr($section, 0, 2));
        if (!isset($scroll_max_per_sid[$sid]) || $idx > $scroll_max_per_sid[$sid]) {
            $scroll_max_per_sid[$sid] = $idx;
        }
    }
}

// Scroll funnel: how many SESSIONS reached at least section i
$max_section_idx = 0;
foreach ($scroll_max_per_sid as $m) if ($m > $max_section_idx) $max_section_idx = $m;
$scroll_funnel = [];
for ($i = 0; $i <= $max_section_idx; $i++) {
    $count = 0;
    foreach ($scroll_max_per_sid as $m) if ($m >= $i) $count++;
    $scroll_funnel[$i] = $count;
}

// Sort
ksort($by_day);
arsort($clicks);
arsort($referrers);
arsort($pages);
arsort($tz_counts);

// Latest 30 events for sanity check
$sample = array_slice($events, -30);

echo json_encode([
    'period_days'      => $days,
    'include_bots'     => $include_bots,
    'generated_at'     => gmdate('c'),
    'total_events'     => count($events),
    'page_views'       => $pv_count,
    'unique_sessions'  => count($human_sids) + ($include_bots ? count($bot_sids) : 0),
    'sessions_human'   => count($human_sids),
    'sessions_bot'     => count($bot_sids),
    'by_day'           => $by_day,
    'top_clicks'       => array_slice($clicks, 0, 25, true),
    'lang_split'       => $lang_counts,
    'devices'          => $devices,
    'top_referrers'    => array_slice($referrers, 0, 15, true),
    'top_pages'        => array_slice($pages, 0, 15, true),
    'top_timezones'    => array_slice($tz_counts, 0, 10, true),
    'scroll_funnel'    => $scroll_funnel,
    'sample'           => $sample,
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
