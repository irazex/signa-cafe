<?php
/**
 * track.php — public event collector for /admin analytics.
 *
 * Accepts POST with JSON body: {"events": [{"t": "...", "sid": "...", ...}, ...]}
 * - Validates size and shape
 * - Bot-flag by User-Agent regex
 * - Hashes IP (privacy, no PII stored)
 * - Appends one JSON line per event to analytics/YYYY-MM-DD.jsonl
 *
 * Storage:
 *   analytics/  (folder created automatically, .htaccess blocks direct HTTP)
 *   YYYY-MM-DD.jsonl  one file per day, append-only
 *
 * Designed to be cheap: no DB, no auth, no sessions. /analytics.php reads
 * and aggregates on demand.
 */

header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header("Access-Control-Allow-Origin: *");
    header("Access-Control-Allow-Methods: POST, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type");
    http_response_code(204);
    exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'POST only']);
    exit;
}

$body = file_get_contents('php://input');
if ($body === false || strlen($body) > 16384) {
    http_response_code(413);
    echo json_encode(['error' => 'payload too large']);
    exit;
}
$data = json_decode($body, true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['error' => 'bad json']);
    exit;
}

$events = isset($data['events']) && is_array($data['events']) ? $data['events'] : [$data];
if (count($events) > 80) {
    http_response_code(413);
    echo json_encode(['error' => 'too many events in one batch']);
    exit;
}

// Bot heuristics: UA regex + empty UA
$ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
$ua_lower = strtolower($ua);
$bot_patterns = [
    'bot', 'crawl', 'spider', 'slurp', 'fetch', 'monitor', 'uptime', 'pingdom',
    'lighthouse', 'gtmetrix', 'preview', 'facebookexternalhit', 'tweetbot',
    'gpt', 'claude', 'anthropic', 'openai', 'perplexity',
    'curl', 'wget', 'python', 'java', 'go-http', 'node-fetch', 'okhttp',
    'semrush', 'ahrefs', 'dataforseo', 'mj12bot', 'dotbot', 'rogerbot',
    'screaming frog', 'serpstat', 'sitebulb', 'phantomjs', 'headless',
];
$is_bot = false;
foreach ($bot_patterns as $p) {
    if (strpos($ua_lower, $p) !== false) { $is_bot = true; break; }
}
if (!$ua) $is_bot = true;

// Anonymized IP (12-char hash with site salt)
$ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? ($_SERVER['REMOTE_ADDR'] ?? '');
if (strpos($ip, ',') !== false) { $ip = trim(explode(',', $ip)[0]); }
$ip_hash = $ip ? substr(hash('sha256', $ip . '|signa.cafe|salt'), 0, 12) : '';

// Storage
$log_dir = __DIR__ . '/analytics';
if (!is_dir($log_dir)) {
    if (!@mkdir($log_dir, 0755, true) && !is_dir($log_dir)) {
        http_response_code(500);
        echo json_encode(['error' => 'storage_init_failed']);
        exit;
    }
}
$today_file = $log_dir . '/' . gmdate('Y-m-d') . '.jsonl';
$fp = @fopen($today_file, 'a');
if (!$fp) {
    http_response_code(500);
    echo json_encode(['error' => 'log_open_failed']);
    exit;
}

$now = time();
$count = 0;
foreach ($events as $e) {
    if (!is_array($e)) continue;
    $t = isset($e['t']) ? substr((string)$e['t'], 0, 16) : '';
    $sid = isset($e['sid']) ? substr((string)$e['sid'], 0, 32) : '';
    if (!$t || !$sid) continue;
    // Server-side timestamp wins; clients may be wrong about clock
    $ts = $now;
    $rec = [
        't'   => $t,
        'sid' => $sid,
        'ts'  => $ts,
        'ip'  => $ip_hash,
        'ua'  => substr($ua, 0, 200),
        'bot' => $is_bot,
        'd'   => $e,  // raw event payload (lang, ref, vw, vh, target, section, …)
    ];
    fwrite($fp, json_encode($rec, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n");
    $count++;
}
fclose($fp);

http_response_code(204);
