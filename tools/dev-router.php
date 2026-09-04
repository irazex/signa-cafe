<?php
/**
 * tools/dev-router.php — local preview router for `php -S`.
 * Mirrors the mod_rewrite rules in .htaccess so /stories/<slug> etc. work
 * on the built-in server. Never uploaded to the host; Apache does this job there.
 *
 *   php -S localhost:8099 -t . tools/dev-router.php
 */
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

$map = [
    '#^/stories/?$#'                 => ['stories.php', []],
    '#^/stories/ru/?$#'              => ['stories.php', ['lang' => 'ru']],
    '#^/stories/ru/([a-z0-9-]+)/?$#' => ['story.php',   ['slug' => 1, 'lang' => 'ru']],
    '#^/stories/([a-z0-9-]+)/?$#'    => ['story.php',   ['slug' => 1]],
    '#^/feed\.xml$#'                 => ['feed.php',    []],
    '#^/sitemap\.xml$#'              => ['sitemap.php', []],
    '#^/llms\.txt$#'                 => ['llms.php',    []],
    '#^/admin/?$#'                   => ['admin.html',  []],
];

foreach ($map as $re => [$target, $params]) {
    if (preg_match($re, $path, $m)) {
        foreach ($params as $k => $v) $_GET[$k] = is_int($v) ? $m[$v] : $v;
        if (substr($target, -4) === '.php') { require __DIR__ . '/../' . $target; return true; }
        return false; // let the static file handler serve it
    }
}
return false;
