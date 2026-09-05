<?php
/**
 * translate.php — server-side OpenAI proxy for /admin "Translate via GPT".
 *
 * Why a proxy: keeps the OpenAI API key on the server (out of the public
 * JSX bundle and git history). Callers must hold an admin session — the
 * guard below is what makes trusting the request body safe.
 *
 * Setup:
 *   1. Place this file at /signa.cafe/translate.php (webroot)
 *   2. Put OpenAI API key plain-text in /signa.cafe/.openai_key
 *      (.htaccess <FilesMatch "^\.(openai_key|htaccess|htpasswd|...)$">
 *       blocks direct HTTP access)
 *   3. admin.jsx fetches /translate.php with the OpenAI chat-completions
 *      request body — we forward as-is to api.openai.com and stream back.
 *
 * Auth is a PHP session (lib/auth.php), not Basic Auth — changed 05.09.2026.
 */

require_once __DIR__ . '/lib/auth.php';
auth_require_api();   // session login, see lib/auth.php

header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store, no-cache, must-revalidate");

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'POST only']);
    exit;
}

$keyFile = __DIR__ . '/.openai_key';
if (!file_exists($keyFile)) {
    http_response_code(500);
    echo json_encode(['error' => 'OPENAI_KEY_FILE_MISSING', 'detail' => 'Upload /signa.cafe/.openai_key (plain-text key on a single line)']);
    exit;
}
$apiKey = trim(file_get_contents($keyFile));
if (!$apiKey || strpos($apiKey, 'sk-') !== 0) {
    http_response_code(500);
    echo json_encode(['error' => 'OPENAI_KEY_INVALID', 'detail' => 'Key file must contain a key starting with sk-']);
    exit;
}

$body = file_get_contents('php://input');
if (!$body) {
    http_response_code(400);
    echo json_encode(['error' => 'EMPTY_BODY']);
    exit;
}

// Forward to OpenAI
$ch = curl_init('https://api.openai.com/v1/chat/completions');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $body,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $apiKey,
    ],
    CURLOPT_TIMEOUT => 120,
    CURLOPT_SSL_VERIFYPEER => true,
]);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr = curl_error($ch);
curl_close($ch);

if ($curlErr) {
    http_response_code(502);
    echo json_encode(['error' => 'UPSTREAM_FAILURE', 'detail' => $curlErr]);
    exit;
}

http_response_code($httpCode ?: 500);
echo $response;
