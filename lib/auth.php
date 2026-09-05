<?php
/**
 * lib/auth.php — cookie-session login for /admin, replacing Apache Basic Auth.
 *
 * WHY THE CHANGE (05.09.2026). Basic Auth looked fine from curl and was fine
 * for Apache, but real browsers never showed the password box: Arc and the
 * Claude in-app browser both rendered Apache's raw "401 Unauthorized" page
 * with nowhere to type. The documented workaround — putting the login in the
 * URL as https://user:pass@signa.cafe/admin.html — authenticates the document
 * and then breaks the app, because Chromium refuses the page's own subresource
 * requests once the base URL carries credentials: the admin came up on
 * "Could not load content.json" even though that file is public and returns
 * 200 to anonymous curl. Basic Auth also has no logout and no styled form.
 *
 * A session cookie has none of those problems, and it is the same mechanism
 * every other admin panel in this stack uses.
 *
 * Credentials live in .admin-auth.php at the webroot. A .php file is executed,
 * never served as source, and section 1 of .htaccess denies it over HTTP as
 * well; it is gitignored like .htpasswd so the hash stays off GitHub.
 */

const AUTH_COOKIE    = 'signa_admin';
const AUTH_LIFETIME  = 2592000;   // 30 days — one-person admin, re-typing is the enemy
const AUTH_MAX_TRIES = 8;         // per window, per IP
const AUTH_WINDOW    = 900;       // 15 minutes

function auth_root(): string { return dirname(__DIR__); }

function auth_boot(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
          || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    session_name(AUTH_COOKIE);
    session_set_cookie_params([
        'lifetime' => AUTH_LIFETIME,
        'path'     => '/',
        'httponly' => true,
        'secure'   => $https,
        'samesite' => 'Lax',
    ]);
    session_start();
}

/** ['login' => '$2y$...bcrypt hash...'] */
function auth_users(): array {
    $f = auth_root() . '/.admin-auth.php';
    if (!is_file($f)) return [];
    $u = require $f;
    return is_array($u) ? $u : [];
}

function auth_verify(string $user, string $pass): bool {
    $users = auth_users();
    $user  = strtolower(trim($user));
    $known = isset($users[$user]);
    // Hash even for an unknown login, so a wrong name and a wrong password
    // cost the same wall-clock time and cannot be told apart.
    $hash  = $known ? $users[$user] : '$2y$10$0000000000000000000000000000000000000000000000000000u';
    $ok    = password_verify($pass, $hash);
    return $known && $ok;
}

function auth_ok(): bool {
    auth_boot();
    return !empty($_SESSION['admin_user']);
}

function auth_login(string $user): void {
    auth_boot();
    session_regenerate_id(true);          // kill any fixated id
    $_SESSION['admin_user'] = strtolower(trim($user));
    $_SESSION['admin_since'] = time();
}

function auth_logout(): void {
    auth_boot();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000,
                  $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
}

// ---------- brute-force throttle -------------------------------------------
// Keyed by IP, stored in a webroot dotfile. Every write is best-effort: if the
// file cannot be written the throttle silently does nothing, because locking
// the owner out of his own admin is worse than the attack it prevents.

function auth_throttle_path(): string { return auth_root() . '/.admin-throttle.json'; }

function auth_throttle_read(): array {
    $f = auth_throttle_path();
    if (!is_file($f)) return [];
    $j = json_decode((string)@file_get_contents($f), true);
    if (!is_array($j)) return [];
    $now = time();
    foreach ($j as $ip => $rec) {
        if (($rec['until'] ?? 0) < $now - AUTH_WINDOW) unset($j[$ip]);
    }
    return $j;
}

function auth_throttle_write(array $j): void {
    @file_put_contents(auth_throttle_path(), json_encode($j), LOCK_EX);
}

function auth_ip(): string {
    return (string)($_SERVER['REMOTE_ADDR'] ?? 'cli');
}

/** Seconds left on the lockout, 0 when the caller may try again. */
function auth_locked_for(): int {
    $rec = auth_throttle_read()[auth_ip()] ?? null;
    if (!$rec || ($rec['tries'] ?? 0) < AUTH_MAX_TRIES) return 0;
    return max(0, (int)($rec['until'] ?? 0) - time());
}

function auth_note_fail(): void {
    $j   = auth_throttle_read();
    $ip  = auth_ip();
    $rec = $j[$ip] ?? ['tries' => 0, 'until' => 0];
    $rec['tries'] = (int)$rec['tries'] + 1;
    $rec['until'] = time() + AUTH_WINDOW;
    $j[$ip] = $rec;
    auth_throttle_write($j);
}

function auth_clear_fails(): void {
    $j = auth_throttle_read();
    unset($j[auth_ip()]);
    auth_throttle_write($j);
}

// ---------- guards ----------------------------------------------------------

/** JSON endpoints: 401 and stop. admin.jsx turns this into a reload-to-login. */
function auth_require_api(): void {
    if (auth_ok()) return;
    http_response_code(401);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode(['error' => 'AUTH_REQUIRED']);
    exit;
}

/** HTML pages: handle the login POST, or render the form and stop. */
function auth_require_page(): void {
    auth_boot();

    if (isset($_GET['logout'])) {
        auth_logout();
        header('Location: ' . strtok($_SERVER['REQUEST_URI'], '?'));
        exit;
    }

    $err = null;
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' && isset($_POST['signa_login'])) {
        $wait = auth_locked_for();
        if ($wait > 0) {
            $err = 'Too many attempts. Try again in ' . ceil($wait / 60) . ' min.';
        } elseif (!hash_equals((string)($_SESSION['csrf'] ?? ''), (string)($_POST['csrf'] ?? ''))) {
            $err = 'Session expired. Try again.';
        } elseif (auth_verify((string)$_POST['user'], (string)$_POST['pass'])) {
            auth_clear_fails();
            auth_login((string)$_POST['user']);
            // Redirect after POST so a reload does not re-submit the password.
            header('Location: ' . strtok($_SERVER['REQUEST_URI'], '?'));
            exit;
        } else {
            auth_note_fail();
            $err = 'Wrong login or password.';
        }
    }

    if (auth_ok()) return;

    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(16));
    auth_login_page($err, (string)($_POST['user'] ?? ''));
    exit;
}

/**
 * The login screen. Deliberately plain HTML in the same four brand fonts and
 * three brand colours as admin.html, so it does not look like a stray page.
 * The autocomplete attributes matter: they let the browser's password manager
 * save and refill these fields, which Basic Auth never allowed.
 */
function auth_login_page(?string $err, string $user = ''): void {
    http_response_code($err ? 401 : 200);
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate');
    $csrf = htmlspecialchars((string)($_SESSION['csrf'] ?? ''), ENT_QUOTES);
    $u    = htmlspecialchars($user, ENT_QUOTES);
    $e    = $err ? htmlspecialchars($err, ENT_QUOTES) : '';
    ?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Signa Admin — Sign in</title>
<meta name="robots" content="noindex, nofollow" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Onest:wght@300;400;500;600;700&family=JetBrains+Mono:wght@300;400;500&display=swap" rel="stylesheet">
<style>
  :root{
    --black:#000; --paper:#FFFEF9; --red:#EB3300; --gray:#C8C9C7;
    --display:"Anton",sans-serif; --sans:"Onest",system-ui,sans-serif; --mono:"JetBrains Mono",ui-monospace,monospace;
  }
  *{ box-sizing:border-box; margin:0; padding:0; }
  body{
    background:var(--paper); color:var(--black);
    font-family:var(--sans); font-size:14px; line-height:1.5;
    -webkit-font-smoothing:antialiased;
    min-height:100vh; display:flex; align-items:center; justify-content:center;
    padding:24px;
  }
  .gate{ width:100%; max-width:340px; }
  .gate .brand{
    font-family:var(--display); font-size:44px; line-height:1;
    text-transform:uppercase; letter-spacing:-0.01em; margin-bottom:2px;
  }
  .gate .brand .r{ color:var(--red); }
  .gate .sub{
    font-family:var(--mono); font-size:10px; letter-spacing:.14em;
    text-transform:uppercase; color:rgba(0,0,0,.45); margin-bottom:28px;
  }
  .gate label{
    display:block; font-family:var(--mono); font-size:10px; letter-spacing:.08em;
    text-transform:uppercase; color:rgba(0,0,0,.55); margin-bottom:6px;
  }
  .gate input{
    width:100%; font:inherit; color:var(--black); background:#fff;
    border:1px solid var(--gray); border-radius:6px;
    padding:11px 12px; margin-bottom:16px;
    transition:border-color .15s;
  }
  .gate input:focus{ outline:none; border-color:var(--black); }
  .gate button{
    width:100%; appearance:none; border:none; cursor:pointer;
    background:var(--red); color:var(--paper);
    font-family:var(--mono); font-size:12px; letter-spacing:.1em; text-transform:uppercase;
    padding:13px; border-radius:6px;
    transition:filter .15s;
  }
  .gate button:hover{ filter:brightness(1.08); }
  .gate .err{
    background:rgba(235,51,0,.07); border-left:3px solid var(--red);
    padding:10px 12px; margin-bottom:20px; font-size:13px;
  }
  .gate .foot{
    margin-top:24px; font-family:var(--mono); font-size:10px;
    letter-spacing:.06em; color:rgba(0,0,0,.35); text-transform:uppercase;
  }
  .gate .foot a{ color:inherit; }
</style>
</head>
<body>
  <form class="gate" method="post" autocomplete="on">
    <div class="brand">Signa<span class="r">.</span></div>
    <div class="sub">Admin</div>
    <?php if ($e): ?><div class="err"><?= $e ?></div><?php endif; ?>
    <label for="user">Login</label>
    <input id="user" name="user" type="text" value="<?= $u ?>"
           autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false" required />
    <label for="pass">Password</label>
    <input id="pass" name="pass" type="password"
           autocomplete="current-password" required autofocus />
    <input type="hidden" name="csrf" value="<?= $csrf ?>" />
    <button type="submit" name="signa_login" value="1">Sign in</button>
    <div class="foot"><a href="/">&larr; signa.cafe</a></div>
  </form>
</body>
</html>
    <?php
}
