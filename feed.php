<?php
/** feed.php — RSS 2.0 for the Stories section. Served at /feed.xml (see .htaccess). */
require __DIR__ . '/lib/stories.php';

$lang  = st_lang();
$data  = st_load();
$posts = array_slice(array_values(array_filter($data['posts'], fn($p) => st_has($p, $lang))), 0, 30);

header('Content-Type: application/rss+xml; charset=utf-8');
header('Cache-Control: public, max-age=1800');
echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <title>Signa Cafe — <?= e(st_t('section', $lang)) ?></title>
  <link><?= e(st_url(null, $lang)) ?></link>
  <description><?= e(st_t('index_sub', $lang)) ?></description>
  <language><?= $lang === 'ru' ? 'ru-RU' : 'en-US' ?></language>
  <lastBuildDate><?= $posts ? date(DATE_RSS, strtotime($posts[0]['date'])) : date(DATE_RSS) ?></lastBuildDate>
  <atom:link href="<?= ST_BASE ?>/feed.xml<?= $lang === 'ru' ? '?lang=ru' : '' ?>" rel="self" type="application/rss+xml" />
<?php foreach ($posts as $p): $b = st_body($p, $lang); $u = st_url($p['slug'], $lang); ?>
  <item>
    <title><?= e($b['title'] ?? $p['slug']) ?></title>
    <link><?= e($u) ?></link>
    <guid isPermaLink="true"><?= e($u) ?></guid>
    <pubDate><?= date(DATE_RSS, strtotime($p['date'])) ?></pubDate>
    <category><?= e($b['category'] ?? 'Food') ?></category>
    <description><?= e($b['description'] ?? '') ?></description>
    <content:encoded><![CDATA[<?= str_replace(']]>', ']]&gt;', st_plain($b)) ?>]]></content:encoded>
  </item>
<?php endforeach; ?>
</channel>
</rss>
