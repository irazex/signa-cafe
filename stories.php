<?php
/**
 * stories.php — the Stories index.
 * Routed by .htaccess:  /stories  and  /stories/ru
 */
require __DIR__ . '/lib/stories.php';

$lang  = st_lang();
$data  = st_load();
$posts = array_values(array_filter($data['posts'], fn($p) => st_has($p, $lang)));
$canon = st_url(null, $lang);
$alt   = $lang === 'ru' ? 'en' : 'ru';

$jsonld = [];
$jsonld[] = [
    '@context' => 'https://schema.org',
    '@type' => 'Blog',
    '@id' => $canon . '#blog',
    'name' => 'Signa Cafe — ' . st_t('section', $lang),
    'description' => st_t('index_sub', $lang),
    'url' => $canon,
    'inLanguage' => $lang,
    'publisher' => ['@type' => 'Organization', 'name' => 'Signa Cafe', '@id' => ST_BASE . '/#org'],
    'about' => ['@type' => 'Restaurant', 'name' => 'Signa Cafe', '@id' => ST_BASE . '/#restaurant'],
    'blogPost' => array_map(function ($p) use ($lang) {
        $b = st_body($p, $lang);
        return [
            '@type' => 'BlogPosting',
            'headline' => $b['title'] ?? $p['slug'],
            'description' => $b['description'] ?? '',
            'url' => st_url($p['slug'], $lang),
            'datePublished' => $p['date'],
            'image' => ST_BASE . '/' . ltrim($p['cover'] ?? '', '/'),
        ];
    }, $posts),
];
$jsonld[] = [
    '@context' => 'https://schema.org',
    '@type' => 'BreadcrumbList',
    'itemListElement' => [
        ['@type' => 'ListItem', 'position' => 1, 'name' => 'Signa Cafe', 'item' => ST_BASE . '/'],
        ['@type' => 'ListItem', 'position' => 2, 'name' => st_t('section', $lang), 'item' => $canon],
    ],
];

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: public, max-age=600');

st_head([
    'lang' => $lang,
    'title' => $lang === 'ru'
        ? 'Истории блюд — Signa Cafe, Нуса Дуа, Бали'
        : 'Stories — one dish, one story, every week | Signa Cafe, Nusa Dua',
    'description' => st_t('index_sub', $lang),
    'keywords' => $lang === 'ru'
        ? 'истории блюд Бали, кафе Нуса Дуа, еда Букит, рецепты Бали, Signa Cafe, Унгасан, Беноа, Джимбаран'
        : 'food stories Bali, Nusa Dua cafe, dish history, Bukit Bali food, Signa Cafe, Ungasan, Benoa, Jimbaran, food blog Bali',
    'canonical' => $canon,
    'altUrl' => st_url(null, $alt),
    'xdefault' => st_url(null, 'en'),
    'image' => ST_BASE . '/assets/photo-breakfast.webp',
    'jsonld' => $jsonld,
]);
?>
<body data-screen-label="stories index">
<div class="signa-app">
<?php st_header($lang, st_url(null, $alt, false)); ?>

<main>
  <section class="page-hero">
    <div class="s-label"><span class="dot"></span><span class="ix">STORIES</span> <?= e(st_t('kicker', $lang)) ?></div>
    <h1 class="page-hero-title"><?= e(st_t('index_title_a', $lang)) ?> <span class="r"><?= e(st_t('index_title_b', $lang)) ?></span></h1>
    <p class="page-hero-sub"><?= e(st_t('index_sub', $lang)) ?></p>
  </section>

  <section class="s-section story-index">
    <?php if (!$posts): ?>
      <p class="story-empty"><?= e(st_t('empty', $lang)) ?></p>
    <?php else: ?>
      <?php foreach ($posts as $i => $p): $b = st_body($p, $lang); ?>
      <article class="story-row <?= $i === 0 ? 'is-lead' : '' ?>">
        <a class="story-row-link" href="<?= e(st_url($p['slug'], $lang, false)) ?>">
          <?php if (!empty($p['cover'])): ?>
          <span class="story-row-img">
            <img src="/<?= e(ltrim($p['cover'], '/')) ?>"
                 alt="<?= e($b['coverAlt'] ?? $b['title'] ?? '') ?>"
                 loading="<?= $i === 0 ? 'eager' : 'lazy' ?>" width="800" height="560" />
          </span>
          <?php endif; ?>
          <span class="story-row-text">
            <span class="story-row-meta">
              <?= e(strtoupper($b['category'] ?? 'FOOD')) ?> ·
              <?= e(st_date($p['date'], $lang)) ?> ·
              <?= st_read_min($b) ?> <?= e(st_t('read', $lang)) ?>
            </span>
            <h2 class="story-row-title"><?= e($b['title'] ?? $p['slug']) ?></h2>
            <span class="story-row-lead"><?= e($b['lead'] ?? $b['description'] ?? '') ?></span>
            <span class="story-row-cta"><?= e(st_t('read_more', $lang)) ?> →</span>
          </span>
        </a>
      </article>
      <?php endforeach; ?>
    <?php endif; ?>
  </section>

  <?php st_cta($lang); ?>
</main>

<?php st_footer($lang); ?>
</div>
</body>
</html>
