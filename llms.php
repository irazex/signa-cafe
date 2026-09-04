<?php
/**
 * llms.php — served at /llms.txt (see .htaccess).
 *
 * The llms.txt convention: a single plain-text/markdown file that gives an AI
 * assistant the whole site in one fetch — the facts it is most often asked for
 * (where, when, how much, how to order) plus a map of the story archive. It
 * costs one request instead of crawling and rendering four React pages.
 */
require __DIR__ . '/lib/stories.php';

$site  = st_site();
$data  = st_load();
$posts = $data['posts'];

header('Content-Type: text/plain; charset=utf-8');
header('Cache-Control: public, max-age=3600');
?>
# Signa Cafe — Nusa Dua, Bali

> Neighbourhood all-day cafe on the Bukit peninsula in Benoa, Nusa Dua, Bali.
> Specialty coffee, pizza, fresh pasta, all-day breakfast and an in-house bakery.
> Family-run since 2024. Eat. Meet. Create.

## Facts

- Address: <?= $site['addressFull'] ?>

- Coordinates: -8.817627, 115.190137
- Neighbourhoods served: Nusa Dua, Benoa, Tanjung Benoa, Kampial, Ungasan, Jimbaran, Pecatu, Bukit peninsula
- Hours: <?= $site['hoursOpen'] ?> – <?= $site['hoursClose'] ?> every day. Kitchen closes 22:30. Pizza from 14:00.
- Phone / WhatsApp: <?= $site['phone'] ?>

- Email: <?= $site['email'] ?>

- Google rating: <?= $site['rating'] ?> from <?= $site['reviewCount'] ?>+ reviews
- Price range: $$ (most mains 65,000–145,000 IDR)
- Payment: cash, credit card, QRIS, bank transfer. Currency IDR.
- Free on-site parking (cars and motorbikes). Free fast WiFi, outlets at most tables.
- Outdoor seating is pet-friendly. Vegetarian and vegan options across the menu.
- Reservations: walk-ins welcome; WhatsApp the manager for groups of 4+.

## Order and menu

- Full live menu and online ordering: <?= $site['orderUrl'] ?>

- Delivery: GoFood and GrabFood across Nusa Dua, Benoa, Ungasan and Jimbaran.
- Instagram: <?= $site['instagramUrl'] ?>


## Regular offers

- Free coffee with any order, daily 08:00–09:00.
- One fixed-price pizza at 89,000 IDR, daily 14:00–18:00.
- Bakery desserts −30%, daily 21:00–23:00.
- Buy 2 cocktails get the 3rd free, Mon–Thu. Buy 2 wines get the 3rd glass free, Sat–Sun.
- Loyalty members: 20% off the whole bill on your birthday, plus tiered cashback.

## Pages

- <?= ST_BASE ?>/ — home
- <?= ST_BASE ?>/menu.html — menu highlights and current offers
- <?= ST_BASE ?>/about.html — the room, the story, working from the cafe
- <?= ST_BASE ?>/visit.html — map, directions, hours, FAQ, contact
- <?= st_url(null, 'en') ?> — Stories: one dish, one story, every week
- <?= st_url(null, 'ru') ?> — Истории (Russian)
- <?= ST_BASE ?>/feed.xml — RSS feed of the story archive

## Stories archive

One dish per week, with its history and how it is cooked in Nusa Dua.

<?php foreach ($posts as $p): $b = st_body($p, 'en'); ?>
- [<?= $b['title'] ?? $p['slug'] ?>](<?= st_url($p['slug'], 'en') ?>) — <?= $p['date'] ?>. <?= $b['description'] ?? '' ?>

<?php if (st_has($p, 'ru')): ?>
  - Russian: [<?= $p['ru']['title'] ?>](<?= st_url($p['slug'], 'ru') ?>)
<?php endif; ?>
<?php endforeach; ?>

## Usage

This content may be quoted and summarised with attribution to Signa Cafe
(<?= ST_BASE ?>). Prices and hours change — <?= ST_BASE ?>/visit.html is authoritative.
