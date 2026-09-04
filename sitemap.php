<?php
/**
 * sitemap.php — generated sitemap. Served at /sitemap.xml (see .htaccess).
 * Replaces the old hand-maintained sitemap.xml so new stories appear the
 * moment data/stories.json changes, with no build or manual edit.
 */
require __DIR__ . '/lib/stories.php';

$data  = st_load();
$posts = $data['posts'];
$today = date('Y-m-d');

// Static React pages: URL => [lastmod, changefreq, priority]
$pages = [
    '/'           => ['weekly',  '1.0'],
    '/menu.html'  => ['weekly',  '0.9'],
    '/about.html' => ['monthly', '0.8'],
    '/visit.html' => ['monthly', '0.8'],
];

header('Content-Type: application/xml; charset=utf-8');
header('Cache-Control: public, max-age=3600');
echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
<?php foreach ($pages as $path => [$freq, $prio]): ?>
  <url>
    <loc><?= ST_BASE . $path ?></loc>
    <lastmod><?= $today ?></lastmod>
    <changefreq><?= $freq ?></changefreq>
    <priority><?= $prio ?></priority>
    <xhtml:link rel="alternate" hreflang="en" href="<?= ST_BASE . $path ?>?lang=en" />
    <xhtml:link rel="alternate" hreflang="ru" href="<?= ST_BASE . $path ?>?lang=ru" />
    <xhtml:link rel="alternate" hreflang="id" href="<?= ST_BASE . $path ?>?lang=id" />
    <xhtml:link rel="alternate" hreflang="x-default" href="<?= ST_BASE . $path ?>" />
  </url>
<?php endforeach; ?>
<?php foreach (ST_LANGS as $l): ?>
  <url>
    <loc><?= st_url(null, $l) ?></loc>
    <lastmod><?= $posts ? e($posts[0]['date']) : $today ?></lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
<?php endforeach; ?>
<?php foreach ($posts as $p): foreach (ST_LANGS as $l): if (!st_has($p, $l)) continue; ?>
  <url>
    <loc><?= st_url($p['slug'], $l) ?></loc>
    <lastmod><?= e($p['updated'] ?? $p['date']) ?></lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
<?php foreach (ST_LANGS as $alt): if (!st_has($p, $alt)) continue; ?>
    <xhtml:link rel="alternate" hreflang="<?= $alt ?>" href="<?= st_url($p['slug'], $alt) ?>" />
<?php endforeach; ?>
    <xhtml:link rel="alternate" hreflang="x-default" href="<?= st_url($p['slug'], 'en') ?>" />
  </url>
<?php endforeach; endforeach; ?>
</urlset>
