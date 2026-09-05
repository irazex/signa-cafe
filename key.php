<?php
/**
 * key.php — returns the OpenAI API key to authenticated admin clients.
 *
 * Why: OpenAI API blocks the hosting server's region geo (multihost.cloud is
 * RU-based), so we cannot proxy chat completions server-side. Instead the
 * browser calls OpenAI directly using the user's own IP (which is fine).
 * This file hands the key to the browser only after the admin session check
 * passes. Anonymous HTTP gets 401 JSON, and admin.jsx reloads to the login
 * form when it sees that.
 */

require_once __DIR__ . '/lib/auth.php';
auth_require_api();   // session login, see lib/auth.php

header("Cache-Control: no-store, no-cache, must-revalidate, private");
header("Content-Type: application/json; charset=utf-8");

$keyFile = __DIR__ . '/.openai_key';
if (!file_exists($keyFile)) {
    http_response_code(500);
    echo json_encode(['error' => 'KEY_FILE_MISSING']);
    exit;
}
$key = trim(file_get_contents($keyFile));
if (!$key || strpos($key, 'sk-') !== 0) {
    http_response_code(500);
    echo json_encode(['error' => 'KEY_INVALID']);
    exit;
}
echo json_encode(['key' => $key]);
