<?php
/**
 * lib/stories.php — shared rendering helpers for the Stories section.
 *
 * WHY THIS IS PHP AND NOT REACT
 * The rest of signa.cafe is React + Babel transpiled in the browser. That is
 * fine for humans and survivable for Googlebot (it runs JS), but AI crawlers —
 * GPTBot, ClaudeBot, PerplexityBot, CCBot, Amazonbot — do NOT execute
 * JavaScript. They fetch raw HTML. A React page gives them an empty
 * <div id="root">. Since the entire point of this section is SEO + being
 * quoted by AI assistants, every story is rendered server-side into plain
 * HTML that is complete on first byte.
 *
 * Data source: /data/stories.json (hand-edited or via /admin.html -> Stories).
 * No build step: change the JSON, upload it, the site is updated.
 */

if (!defined('SIGNA_STORIES')) define('SIGNA_STORIES', 1);

const ST_BASE   = 'https://signa.cafe';
const ST_LANGS  = ['en', 'ru'];
const ST_WPM    = 180; // reading speed used for the "N min read" label

// ---------- data ----------

function st_load(): array {
    $path = __DIR__ . '/../data/stories.json';
    if (!is_readable($path)) return ['version' => '0', 'posts' => []];
    $raw = file_get_contents($path);
    $data = json_decode($raw, true);
    if (!is_array($data) || empty($data['posts'])) return ['version' => '0', 'posts' => []];
    // newest first, and drop anything dated in the future (scheduled posts)
    $today = date('Y-m-d');
    $data['posts'] = array_values(array_filter($data['posts'], function ($p) use ($today) {
        return !empty($p['slug']) && !empty($p['date']) && $p['date'] <= $today;
    }));
    usort($data['posts'], fn($a, $b) => strcmp($b['date'], $a['date']));
    return $data;
}

function st_find(array $posts, string $slug): ?array {
    foreach ($posts as $p) if ($p['slug'] === $slug) return $p;
    return null;
}

/** Site-wide facts (phone, hours, address) reused from the React site's content.json. */
function st_site(): array {
    static $site = null;
    if ($site !== null) return $site;
    $defaults = [
        'phone' => '+62 896 540 27190', 'email' => 'hi@signa.cafe',
        'addressFull' => 'Jl. Dharmawangsa, Jl. Raya Kampial, Benoa, Nusa Dua, Bali 80361',
        'hoursOpen' => '08:00', 'hoursClose' => '23:00',
        'orderUrl' => 'https://signa.dishi.rest/',
        'instagramUrl' => 'https://www.instagram.com/signa.cafe/',
        'rating' => '4.7', 'reviewCount' => '1426',
    ];
    $path = __DIR__ . '/../content.json';
    if (is_readable($path)) {
        $c = json_decode(file_get_contents($path), true);
        if (!empty($c['site']) && is_array($c['site'])) return $site = array_merge($defaults, $c['site']);
    }
    return $site = $defaults;
}

// ---------- language ----------

function st_lang(): string {
    $l = strtolower((string)($_GET['lang'] ?? 'en'));
    return in_array($l, ST_LANGS, true) ? $l : 'en';
}

/** Per-post body in the requested language, falling back to English. */
function st_body(array $post, string $lang): array {
    if (!empty($post[$lang]) && is_array($post[$lang])) return $post[$lang];
    return $post['en'] ?? [];
}

function st_has(array $post, string $lang): bool {
    return !empty($post[$lang]['title']);
}

// ---------- urls ----------

function st_url(?string $slug = null, string $lang = 'en', bool $absolute = true): string {
    $p = '/stories' . ($lang === 'ru' ? '/ru' : '') . ($slug ? '/' . $slug : '');
    return $absolute ? ST_BASE . $p : $p;
}

// ---------- text ----------

function e($s): string { return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }

function st_plain(array $b): string {
    $out = (string)($b['lead'] ?? '');
    foreach (($b['blocks'] ?? []) as $blk) {
        $out .= ' ' . ($blk['h'] ?? '');
        foreach (($blk['p'] ?? []) as $p) $out .= ' ' . $p;
    }
    return trim(preg_replace('/\s+/u', ' ', $out));
}

function st_read_min(array $b): int {
    $words = preg_match_all('/[\p{L}\p{N}]+/u', st_plain($b));
    return max(1, (int)round($words / ST_WPM));
}

function st_date(string $iso, string $lang): string {
    $ts = strtotime($iso);
    if ($lang === 'ru') {
        $m = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
        return (int)date('j', $ts) . ' ' . $m[(int)date('n', $ts) - 1] . ' ' . date('Y', $ts);
    }
    return date('j F Y', $ts);
}

function st_t(string $key, string $lang): string {
    static $S = [
        'en' => [
            'nav_home' => 'Home', 'nav_menu' => 'Menu', 'nav_about' => 'Place',
            'nav_visit' => 'Visit', 'nav_stories' => 'Stories',
            'cta_order' => 'Order →',
            'section' => 'Stories', 'kicker' => 'One dish, one story, every week',
            'index_title_a' => 'ONE DISH,', 'index_title_b' => 'ONE STORY.',
            'index_sub' => 'Every week we take one thing off the Signa menu and write down where it actually comes from — the history, the argument about the recipe, and what it takes to cook it in Nusa Dua.',
            'read' => 'min read', 'read_more' => 'Read the story',
            'facts' => 'The short version', 'faq' => 'Questions people ask',
            'more' => 'More stories', 'back' => 'All stories',
            'order_h' => 'Order it, or come and sit with it',
            'order_p' => 'Signa Cafe is on Jl. Raya Kampial in Benoa, Nusa Dua — ten minutes from Ungasan, fifteen from Jimbaran. Open 08:00 to 23:00, every day.',
            'order_cta' => 'SEE THE FULL MENU', 'visit_cta' => 'FIND US',
            'published' => 'Published', 'updated' => 'Updated',
            'empty' => 'The first story is being written. Check back next week.',
            'other_lang' => 'Читать по-русски',
        ],
        'ru' => [
            'nav_home' => 'Главная', 'nav_menu' => 'Меню', 'nav_about' => 'О нас',
            'nav_visit' => 'Визит', 'nav_stories' => 'Истории',
            'cta_order' => 'Заказать →',
            'section' => 'Истории', 'kicker' => 'Одно блюдо, одна история, каждую неделю',
            'index_title_a' => 'ОДНО БЛЮДО,', 'index_title_b' => 'ОДНА ИСТОРИЯ.',
            'index_sub' => 'Каждую неделю берём одну позицию из меню Signa и разбираемся, откуда она взялась на самом деле: история, спор о рецепте и что нужно, чтобы приготовить это в Нуса Дуа.',
            'read' => 'мин чтения', 'read_more' => 'Читать историю',
            'facts' => 'Коротко', 'faq' => 'Частые вопросы',
            'more' => 'Другие истории', 'back' => 'Все истории',
            'order_h' => 'Закажите или приходите пробовать',
            'order_p' => 'Signa Cafe на Jl. Raya Kampial в Беноа, Нуса Дуа — десять минут от Унгасана, пятнадцать от Джимбарана. Открыто с 08:00 до 23:00, каждый день.',
            'order_cta' => 'СМОТРЕТЬ ВСЁ МЕНЮ', 'visit_cta' => 'КАК НАС НАЙТИ',
            'published' => 'Опубликовано', 'updated' => 'Обновлено',
            'empty' => 'Первая история пишется. Загляните на следующей неделе.',
            'other_lang' => 'Read in English',
        ],
    ];
    return $S[$lang][$key] ?? $S['en'][$key] ?? $key;
}

// ---------- chrome ----------

/**
 * <head> for a stories page. Everything an indexer needs is here in raw HTML:
 * title, description, keywords, canonical, hreflang pair, OG/Twitter, geo.
 */
function st_head(array $o): void {
    $lang  = $o['lang'] ?? 'en';
    $alt   = $lang === 'ru' ? 'en' : 'ru';
    ?>
<!doctype html>
<html lang="<?= e($lang) ?>">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title><?= e($o['title']) ?></title>
<meta name="description" content="<?= e($o['description']) ?>" />
<?php if (!empty($o['keywords'])): ?>
<meta name="keywords" content="<?= e($o['keywords']) ?>" />
<?php endif; ?>
<meta name="author" content="Signa Cafe" />
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
<link rel="canonical" href="<?= e($o['canonical']) ?>" />
<link rel="icon" href="/assets/star.png" type="image/png" />
<link rel="apple-touch-icon" href="/assets/star.png" />
<link rel="alternate" type="application/rss+xml" title="Signa Cafe — Stories" href="<?= ST_BASE ?>/feed.xml" />
<link rel="alternate" hreflang="<?= e($lang) ?>" href="<?= e($o['canonical']) ?>" />
<?php if (!empty($o['altUrl'])): ?>
<link rel="alternate" hreflang="<?= e($alt) ?>" href="<?= e($o['altUrl']) ?>" />
<?php endif; ?>
<link rel="alternate" hreflang="x-default" href="<?= e($o['xdefault'] ?? $o['canonical']) ?>" />
<meta property="og:type" content="<?= e($o['ogType'] ?? 'website') ?>" />
<meta property="og:site_name" content="Signa Cafe" />
<meta property="og:title" content="<?= e($o['title']) ?>" />
<meta property="og:description" content="<?= e($o['description']) ?>" />
<meta property="og:url" content="<?= e($o['canonical']) ?>" />
<meta property="og:image" content="<?= e($o['image'] ?? ST_BASE . '/assets/photo-breakfast.webp') ?>" />
<meta property="og:locale" content="<?= $lang === 'ru' ? 'ru_RU' : 'en_US' ?>" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="<?= e($o['title']) ?>" />
<meta name="twitter:description" content="<?= e($o['description']) ?>" />
<meta name="twitter:image" content="<?= e($o['image'] ?? ST_BASE . '/assets/photo-breakfast.webp') ?>" />
<meta name="geo.region" content="ID-BA" />
<meta name="geo.placename" content="Nusa Dua, Benoa, Bali" />
<meta name="geo.position" content="-8.817627;115.190137" />
<meta name="ICBM" content="-8.817627, 115.190137" />
<?php foreach (($o['jsonld'] ?? []) as $ld): ?>
<script type="application/ld+json"><?= json_encode($ld, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) ?></script>
<?php endforeach; ?>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Onest:wght@300;400;500;600;700&family=Caveat:wght@500;600;700&family=JetBrains+Mono:wght@300;400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/src/styles.css?v=20260904a" />
</head>
<?php
}

/** Same markup and classes as the React PageHeader — but plain HTML, no JS needed. */
function st_header(string $lang, ?string $altUrl): void {
    $site = st_site();
    ?>
<header class="signa-header">
  <div class="signa-header-row">
    <a class="signa-mark" href="/index.html">
      <span class="star" aria-hidden="true"></span>
      <span class="name">Signa<span style="color:var(--red)">.</span></span>
    </a>
    <nav>
      <a href="/index.html"><?= e(st_t('nav_home', $lang)) ?></a>
      <a href="/menu.html"><?= e(st_t('nav_menu', $lang)) ?></a>
      <a href="<?= e(st_url(null, $lang, false)) ?>" class="is-current"><?= e(st_t('nav_stories', $lang)) ?></a>
      <a href="/about.html"><?= e(st_t('nav_about', $lang)) ?></a>
      <a href="/visit.html"><?= e(st_t('nav_visit', $lang)) ?></a>
    </nav>
    <?php if ($altUrl): ?>
    <div class="lang-toggle">
      <?php foreach (ST_LANGS as $l): ?>
        <a class="lang-btn <?= $l === $lang ? 'active' : '' ?>"
           href="<?= e($l === $lang ? '#' : $altUrl) ?>"
           hreflang="<?= e($l) ?>"<?= $l === $lang ? ' aria-current="true"' : '' ?>><?= e($l) ?></a>
      <?php endforeach; ?>
    </div>
    <?php endif; ?>
    <a class="desk-cta" href="<?= e($site['orderUrl']) ?>" target="_blank" rel="noreferrer"><?= e(st_t('cta_order', $lang)) ?></a>
    <a class="burger" href="/menu.html" aria-label="Menu"><span></span></a>
  </div>
</header>
<?php
}

function st_footer(string $lang): void {
    $site = st_site();
    ?>
<section class="foot-sec story-foot">
  <div class="foot-mark">SIGNA<span class="r">.</span></div>
  <div class="foot-links">
    <a class="foot-row" href="<?= e($site['instagramUrl']) ?>" target="_blank" rel="noreferrer">
      <span class="lbl">Instagram</span><span class="val">@signa.cafe</span></a>
    <a class="foot-row" href="https://wa.me/<?= e(preg_replace('/\D/', '', $site['phone'])) ?>" target="_blank" rel="noreferrer">
      <span class="lbl">WhatsApp</span><span class="val"><?= e($site['phone']) ?></span></a>
    <a class="foot-row" href="mailto:<?= e($site['email']) ?>">
      <span class="lbl">Email</span><span class="val"><?= e($site['email']) ?></span></a>
    <a class="foot-row" href="<?= e($site['orderUrl']) ?>" target="_blank" rel="noreferrer">
      <span class="lbl"><?= $lang === 'ru' ? 'Заказать' : 'Order online' ?></span><span class="val">signa.dishi.rest ↗</span></a>
    <a class="foot-row" href="/visit.html">
      <span class="lbl"><?= $lang === 'ru' ? 'Адрес' : 'Address' ?></span><span class="val"><?= e($site['addressFull']) ?></span></a>
    <div class="foot-row">
      <span class="lbl"><?= $lang === 'ru' ? 'Часы' : 'Hours' ?></span>
      <span class="val"><?= e($site['hoursOpen']) ?> — <?= e($site['hoursClose']) ?></span></div>
    <a class="foot-row" href="<?= ST_BASE ?>/feed.xml">
      <span class="lbl">RSS</span><span class="val">feed.xml ↗</span></a>
  </div>
  <div class="foot-bottom">
    <span>Signa Cafe · <?= $lang === 'ru' ? 'семейное кафе с 2024' : 'family-run since 2024' ?></span>
    <span>Eat. Meet. Create.</span>
  </div>
</section>
<?php
}

/** Closing block on every story: where to eat it, how to order it. Internal links matter for SEO. */
function st_cta(string $lang): void {
    $site = st_site();
    ?>
<section class="story-cta">
  <h2><?= e(st_t('order_h', $lang)) ?></h2>
  <p><?= e(st_t('order_p', $lang)) ?></p>
  <div class="story-cta-row">
    <a class="h-btn red" href="<?= e($site['orderUrl']) ?>" target="_blank" rel="noreferrer"><?= e(st_t('order_cta', $lang)) ?></a>
    <a class="h-btn outline" href="/visit.html"><?= e(st_t('visit_cta', $lang)) ?></a>
  </div>
</section>
<?php
}
