<?php
/**
 * story.php — one weekly story, rendered server-side.
 * Routed by .htaccess:  /stories/<slug>  and  /stories/ru/<slug>
 */
require __DIR__ . '/lib/stories.php';

$lang  = st_lang();
$slug  = preg_replace('/[^a-z0-9-]/', '', strtolower((string)($_GET['slug'] ?? '')));
$data  = st_load();
$post  = $slug ? st_find($data['posts'], $slug) : null;

if (!$post) {
    http_response_code(404);
    header('Location: ' . st_url(null, $lang, false), true, 302);
    exit;
}

$b        = st_body($post, $lang);
$site     = st_site();
$canon    = st_url($slug, $lang);
// Every language this post actually exists in, lang => absolute url.
$alts = [];
foreach (ST_LANGS as $l) if (st_has($post, $l)) $alts[$l] = st_url($slug, $l);
$others = array_diff_key($alts, [$lang => true]);
$image    = ST_BASE . '/' . ltrim($post['cover'] ?? 'assets/photo-breakfast.webp', '/');
$readMin  = st_read_min($b);
$modified = $post['updated'] ?? $post['date'];

// Related: the three most recent other posts that exist in this language.
$related = array_values(array_filter($data['posts'],
    fn($p) => $p['slug'] !== $slug && st_has($p, $lang)));
$related = array_slice($related, 0, 3);

// ---------- structured data ----------
$jsonld = [];

$jsonld[] = [
    '@context' => 'https://schema.org',
    '@type' => 'BlogPosting',
    '@id' => $canon . '#post',
    'headline' => $b['title'] ?? $post['slug'],
    'description' => $b['description'] ?? '',
    'image' => [$image],
    'datePublished' => $post['date'],
    'dateModified' => $modified,
    'inLanguage' => $lang,
    'keywords' => $b['keywords'] ?? '',
    'wordCount' => preg_match_all('/[\p{L}\p{N}]+/u', st_plain($b)),
    'timeRequired' => 'PT' . $readMin . 'M',
    'articleSection' => $b['category'] ?? 'Food',
    'mainEntityOfPage' => ['@type' => 'WebPage', '@id' => $canon],
    // Voice assistants read the headline and the lead aloud when answering
    // "where can I get X near Nusa Dua".
    'speakable' => [
        '@type' => 'SpeakableSpecification',
        'cssSelector' => ['.story-title', '.story-lead'],
    ],
    'author' => ['@type' => 'Organization', 'name' => 'Signa Cafe', '@id' => ST_BASE . '/#org'],
    'publisher' => [
        '@type' => 'Organization', 'name' => 'Signa Cafe', '@id' => ST_BASE . '/#org',
        'logo' => ['@type' => 'ImageObject', 'url' => ST_BASE . '/assets/logo-dotted-sigma.png'],
    ],
    'about' => ['@type' => 'Restaurant', 'name' => 'Signa Cafe', '@id' => ST_BASE . '/#restaurant'],
    'contentLocation' => [
        '@type' => 'Place', 'name' => 'Nusa Dua, Benoa, Bali, Indonesia',
        'address' => [
            '@type' => 'PostalAddress',
            'streetAddress' => 'Jl. Dharmawangsa, Jl. Raya Kampial',
            'addressLocality' => 'Benoa, Nusa Dua', 'addressRegion' => 'Bali',
            'postalCode' => '80361', 'addressCountry' => 'ID',
        ],
        'geo' => ['@type' => 'GeoCoordinates', 'latitude' => -8.817627, 'longitude' => 115.190137],
    ],
    // Full prose in the graph too: AI crawlers that only parse JSON-LD still get the article.
    'articleBody' => st_plain($b),
];

if (!empty($post['dish']['name'])) {
    $priceDigits = preg_replace('/[^0-9]/', '', explode(' ', (string)($post['dish']['price'] ?? ''))[0]);
    $item = [
        '@context' => 'https://schema.org',
        '@type' => 'MenuItem',
        'name' => $post['dish']['name'],
        'description' => $b['description'] ?? '',
        'image' => $image,
    ];
    if ($priceDigits !== '') {
        $item['offers'] = [
            '@type' => 'Offer',
            'price' => $priceDigits,
            'priceCurrency' => 'IDR',
            'availability' => 'https://schema.org/InStock',
            'url' => $post['dish']['menuUrl'] ?? $site['orderUrl'],
        ];
    }
    if (!empty($post['tags']) && in_array('vegetarian', $post['tags'], true)) {
        $item['suitableForDiet'] = 'https://schema.org/VegetarianDiet';
    }
    $jsonld[] = $item;
}

if (!empty($b['faq'])) {
    $jsonld[] = [
        '@context' => 'https://schema.org',
        '@type' => 'FAQPage',
        'mainEntity' => array_map(fn($f) => [
            '@type' => 'Question', 'name' => $f['q'],
            'acceptedAnswer' => ['@type' => 'Answer', 'text' => $f['a']],
        ], $b['faq']),
    ];
}

$jsonld[] = [
    '@context' => 'https://schema.org',
    '@type' => 'BreadcrumbList',
    'itemListElement' => [
        ['@type' => 'ListItem', 'position' => 1, 'name' => 'Signa Cafe', 'item' => ST_BASE . '/'],
        ['@type' => 'ListItem', 'position' => 2, 'name' => st_t('section', $lang), 'item' => st_url(null, $lang)],
        ['@type' => 'ListItem', 'position' => 3, 'name' => $b['title'] ?? $slug, 'item' => $canon],
    ],
];

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: public, max-age=600');

st_head([
    'lang' => $lang,
    'title' => ($b['seoTitle'] ?? $b['title'] ?? $slug) . ' — Signa Cafe, Nusa Dua',
    'description' => $b['description'] ?? '',
    'keywords' => $b['keywords'] ?? '',
    'canonical' => $canon,
    'alts' => $alts,
    'xdefault' => st_url($slug, 'en'),
    'image' => $image,
    'ogType' => 'article',
    'jsonld' => $jsonld,
]);
?>
<body data-screen-label="story <?= e($slug) ?>">
<div class="signa-app">
<?php st_header($lang, $alts); ?>

<main>
<article class="story" itemscope itemtype="https://schema.org/BlogPosting">

  <div class="story-head">
    <nav class="story-crumbs" aria-label="Breadcrumb">
      <a href="/index.html">Signa</a>
      <span aria-hidden="true">/</span>
      <a href="<?= e(st_url(null, $lang, false)) ?>"><?= e(st_t('section', $lang)) ?></a>
    </nav>

    <div class="s-label">
      <span class="dot"></span>
      <span class="ix"><?= e(strtoupper($b['category'] ?? 'FOOD')) ?></span>
      <?= e(st_date($post['date'], $lang)) ?> · <?= $readMin ?> <?= e(st_t('read', $lang)) ?>
    </div>

    <h1 class="story-title" itemprop="headline"><?= e($b['title'] ?? $slug) ?></h1>

    <?php if (!empty($b['lead'])): ?>
      <p class="story-lead"><?= e($b['lead']) ?></p>
    <?php endif; ?>

    <?php if ($others): ?>
      <p class="story-altlang">
        <?php foreach ($others as $l => $u): ?>
          <a href="<?= e($u) ?>" hreflang="<?= e($l) ?>"><?= e(st_t('lang_label', $l)) ?> →</a>
        <?php endforeach; ?>
      </p>
    <?php endif; ?>
  </div>

  <?php if (!empty($post['cover'])): ?>
  <figure class="story-cover">
    <img src="/<?= e(ltrim($post['cover'], '/')) ?>"
         alt="<?= e($b['coverAlt'] ?? ($b['title'] ?? '')) ?>"
         width="1200" height="800" itemprop="image" />
    <?php if (!empty($post['dish']['name'])): ?>
    <figcaption>
      <b><?= e($post['dish']['name']) ?></b>
      <?php if (!empty($post['dish']['price'])): ?> · <?= e($post['dish']['price']) ?><?php endif; ?>
      · <a href="<?= e($post['dish']['menuUrl'] ?? $site['orderUrl']) ?>" target="_blank" rel="noreferrer">
        <?= e(st_t('on_menu', $lang)) ?> ↗</a>
    </figcaption>
    <?php endif; ?>
  </figure>
  <?php endif; ?>

  <div class="story-body" itemprop="articleBody">
    <?php foreach (($b['blocks'] ?? []) as $blk): ?>
      <?php if (!empty($blk['h'])): ?><h2><?= e($blk['h']) ?></h2><?php endif; ?>
      <?php foreach (($blk['p'] ?? []) as $para): ?><p><?= e($para) ?></p><?php endforeach; ?>
    <?php endforeach; ?>
  </div>

  <?php if (!empty($b['facts'])): ?>
  <aside class="story-facts">
    <h2><?= e(st_t('facts', $lang)) ?></h2>
    <dl>
      <?php foreach ($b['facts'] as $row): ?>
        <div><dt><?= e($row[0] ?? '') ?></dt><dd><?= e($row[1] ?? '') ?></dd></div>
      <?php endforeach; ?>
    </dl>
  </aside>
  <?php endif; ?>

  <?php if (!empty($b['faq'])): ?>
  <section class="story-faq">
    <h2><?= e(st_t('faq', $lang)) ?></h2>
    <?php foreach ($b['faq'] as $f): ?>
      <div class="story-faq-item">
        <h3><?= e($f['q']) ?></h3>
        <p><?= e($f['a']) ?></p>
      </div>
    <?php endforeach; ?>
  </section>
  <?php endif; ?>

  <?php if (!empty($post['tags'])): ?>
  <p class="story-tags"><?php foreach ($post['tags'] as $tg): ?><span><?= e($tg) ?></span><?php endforeach; ?></p>
  <?php endif; ?>

  <p class="story-meta">
    <?= e(st_t('published', $lang)) ?> <time datetime="<?= e($post['date']) ?>" itemprop="datePublished"><?= e(st_date($post['date'], $lang)) ?></time>
    · Signa Cafe, <?= e($site['addressFull']) ?>
  </p>
</article>

<?php st_cta($lang); ?>

<?php if ($related): ?>
<section class="story-more">
  <div class="s-label"><span class="dot"></span><span class="ix">→</span> <?= e(st_t('more', $lang)) ?></div>
  <div class="story-grid">
    <?php foreach ($related as $r): $rb = st_body($r, $lang); ?>
      <a class="story-card" href="<?= e(st_url($r['slug'], $lang, false)) ?>">
        <?php if (!empty($r['cover'])): ?>
          <img src="/<?= e(ltrim($r['cover'], '/')) ?>" alt="<?= e($rb['coverAlt'] ?? $rb['title'] ?? '') ?>" loading="lazy" width="600" height="400" />
        <?php endif; ?>
        <span class="story-card-date"><?= e(st_date($r['date'], $lang)) ?></span>
        <span class="story-card-title"><?= e($rb['title'] ?? $r['slug']) ?></span>
        <span class="story-card-arr" aria-hidden="true">→</span>
      </a>
    <?php endforeach; ?>
  </div>
  <p class="story-back"><a href="<?= e(st_url(null, $lang, false)) ?>">← <?= e(st_t('back', $lang)) ?></a></p>
</section>
<?php endif; ?>
</main>

<?php st_footer($lang); ?>
</div>
</body>
</html>
