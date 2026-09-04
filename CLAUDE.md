# Signa Cafe Website — AI Project Instructions

> Версия: **v2** (deployed 2026-05-24). Обновлено с full marketing/content/SEO pass на базе v1.
> Этот файл — инструкция для любого AI-агента (Claude, GPT, Cursor, Copilot и др.), работающего с проектом.
> **ОБЯЗАТЕЛЬНО** обновляй этот файл после каждого изменения в проекте.

## v2 Features (24 May 2026)

- **9 секций**: Hero / Brand / Feedback / Menu / Promos / Signature / Experience / Order / FAQ / Location / Footer
- **Reviews badge** — full-width black strip "★★★★★ 4.7 on Google · 1,426+ reviews ↗" после Brand
- **Promos section** — bakery −30% nightly, pizza hour, birthday perk, loyalty
- **FAQ section** — accordion с 8 вопросами + FAQ JSON-LD для rich snippets
- **Open/Close live timeline** — индикатор `OPEN 08:00 ●—pin—23:00` с движущимся пином (auto-updates 30s, Asia/Makassar timezone)
- **Section rail** — sticky левая навигация 01-10 на desktop ≥1100px
- **content.json** — single source of truth для site/menu/promos/FAQ/signature/contacts
- **admin.html** + `src/admin.jsx` — password-protected content editor с 6 табами. Server-side `.htaccess` Basic Auth (user `admin`) + client-side SHA-256 gate (defense-in-depth). Пароли — см. локальные creds.
- **SEO** — Restaurant + Organization + BreadcrumbList + FAQPage JSON-LD, Open Graph, Twitter, hreflang en/ru/id, robots.txt, sitemap.xml
- **Real menu** — 12 items с реальными ценами из signa.dishi.rest (Syrniki 93k, Big Breakfast 79k, Margarita 69k, Pasta 89k, Salmon Poke 145k, etc.)

## Stories — еженедельные SEO-посты (v3, sept 2026)

> **Почему PHP, а не React.** Проверено запросом с User-Agent ClaudeBot: раньше живой
> `signa.cafe` отдавал 8558 байт HTML, из которых видимого текста — **287 символов**
> (только `<noscript>`). React+Babel транспилируется в браузере, а GPTBot / ClaudeBot /
> PerplexityBot / CCBot **JS не выполняют** и индексировали пустой `<div id="root">`.
> Googlebot JS выполняет, поэтому он-то страницу видел. Раздел Stories поэтому
> рендерится **на сервере**: весь текст в сыром HTML с первого байта.

### Как это устроено

```
data/stories.json      ← единственный источник правды (посты EN+RU)
lib/stories.php        ← общие хелперы: загрузка, i18n, <head>, header, footer, CTA
story.php              ← одна статья       → /stories/<slug>, /stories/ru/<slug>
stories.php            ← индекс раздела    → /stories, /stories/ru
feed.php               ← RSS               → /feed.xml
sitemap.php            ← карта сайта       → /sitemap.xml  (статический файл УДАЛЁН)
llms.php               ← сводка для ИИ     → /llms.txt
tools/dev-router.php   ← локальный превью-роутер для `php -S` (повторяет mod_rewrite)
tools/new-story.mjs    ← скелет нового поста + `--check` валидатор SEO
tools/build-noscript.mjs ← генерит <noscript> для 4 React-страниц из content.json
```

**Билд-шага нет.** Меняешь `data/stories.json` → заливаешь по FTP → всё обновилось,
включая sitemap, RSS и llms.txt. Роутинг — в `.htaccess`, секция 6.

### Публикация поста — три пути

```bash
# A. Автогенерация через gpt-5.5 (основной путь)
node tools/story-gen.mjs                                # 1 пост на ближайший свободный четверг
node tools/story-gen.mjs --count 5 --date 2026-09-03 --back   # пачка назад по неделям
node tools/story-gen.mjs --rewrite <slug>               # перегенерить существующий пост
node tools/story-gen.mjs --dish 7 --dry-run             # конкретное блюдо, без записи
tools/deploy-stories.sh                                 # FTP + IndexNow + пинг sitemap

# B. Руками через скелет
node tools/new-story.mjs "Napoleon cake with Nutella"   # скелет на ближайший четверг
node tools/new-story.mjs --check                        # валидатор
php -S 127.0.0.1:8099 -t . tools/dev-router.php         # превью на http://127.0.0.1:8099/stories

# C. Через админку
# /admin.html → таб Stories → правки → Export stories.json → залить в /data/stories.json
```

### Генератор — как он устроен

`tools/story-gen.mjs` + `tools/story-prompt.mjs`. **Два прохода модели, а не один:**

1. **Писатель** — получает факты заведения из `content.json`, блюдо, заголовки прошлых
   постов (чтобы не повторять угол) и пишет EN+RU по строгой JSON-схеме.
2. **Редактор русского** — отдельный вызов, который переписывает только русскую версию
   как изначально русский текст. Один проход этого не даёт: писатель хорош в фактах
   и плох в интонации.

**Реестр блюд** — повторов не будет: блюдо считается использованным по имени, по `menuId`
и по файлу обложки. Пул конечен (12 позиций в `content.json`), при исчерпании выход 2.

**Валидатор** (`validate()`) заворачивает на повторную генерацию, если находит:
кальки («является», «представляет собой»), три подряд одинаково начатых предложения,
английские слова в русской прозе (только строчные и ярлыки меню — «White Castle»
и «XIX» пропускаются), «93k» вместо «93 000 IDR», длинное тире, восклицательные знаки,
меньше трёх топонимов, отсутствие слов позиционирования, короткий объём.

### Крон — почему на VPS, а не на хостинге

`tools/cron-weekly.sh`, строка в crontab: `0 9 * * 4`.

На multihost.cloud крон невозможен: **SSH отключён**, и главное — OpenAI блокирует
egress-регион хостинга (см. комментарий в `key.php`, из-за него админка ходит в OpenAI
из браузера пользователя). VPS `103.174.115.136` до `api.openai.com` достаёт (проверено),
Node 20 и crontab есть, FTP-порт открыт. Поэтому VPS генерит и заливает по FTP.

Крон датирует пост **следующим свободным четвергом**, а не текущим днём. Значит есть
неделя на вычитку, а публикация происходит сама по дате через `st_load()`.

### Инварианты — не сломать

1. **Stories не должны стать React.** Смысл раздела в том, что текст в сыром HTML.
   Любая «оптимизация» в сторону клиентского рендера убивает индексацию ИИ-ботами.
2. **`sitemap.xml` больше не файл** — это rewrite на `sitemap.php`. Не создавать статический.
3. **`<noscript>` на 4 React-страницах генерируется**, руками не править —
   `node tools/build-noscript.mjs` после каждой правки `content.json`
   (иначе цены в фолбэке разъедутся с ценами в приложении).
4. **Даты в будущем скрыты** — `st_load()` отбрасывает посты с `date > сегодня`.
   Это и есть планировщик: пишешь пост заранее, он появится сам.
5. **Ключевые слова**: в каждом посте должны быть Nusa Dua / Ungasan / Bukit / Benoa /
   Jimbaran / Kampial. `--check` ругается, если топонимов нет.
6. **`robots.txt`** явно разрешает GPTBot, ClaudeBot, PerplexityBot, Google-Extended,
   CCBot и остальных по именам. Не убирать — это сигнал согласия на обучение и цитирование.
7. **`<номер>.txt` в корне — ключ IndexNow**, не удалять. Без него
   `tools/deploy-stories.sh` не сможет пинговать Bing/Yandex.
8. **Menu JSON-LD в `menu.html` генерируется** — `node tools/build-menu-schema.mjs`
   после правок `content.json` или новых постов (он проставляет `subjectOf` на посты).
9. **Русский текст — не перевод.** Если правишь промт, не трогай секцию
   THE RUSSIAN CONTRACT, не разобравшись: она написана по конкретным дефектам.

---

## Быстрый старт

```bash
# Локальный сервер для разработки
cd "/Users/razex/Documents/CLAUD MAIN AGENT/_Projects/signa-cafe-repo"
python3 -m http.server 8080
# открыть http://localhost:8080

# Деплой на хостинг (FTP)
FTP_URL="ftp://atlas.multihost.cloud/signa.cafe"
FTP_CRED="aqq17894:$(cat ~/.razex-creds/signa-ftp.txt)"
curl -s --ftp-create-dirs -T <local-file> "$FTP_URL/<remote-path>" --user "$FTP_CRED"
```

## Структура проекта (новая, May 2026)

```
signa-cafe-repo/
├── index.html              # Главная страница: React 18 + Babel + Google Fonts (Anton/Onest/JetBrains Mono/Caveat)
├── src/                    # JSX исходники (транспилируются Babel в браузере)
│   ├── app.jsx             # Top-level App, TWEAK_DEFAULTS, мapping пропов
│   ├── sections.jsx        # 9 секций + i18n STRINGS + LangToggle (982+ строк)
│   ├── stickers.jsx        # SVG-стикеры + ScrapLayer + useReveal hook
│   ├── syrnik-3d.jsx       # 3D-сырник через Three.js (для HeroVariantE)
│   ├── tweaks-panel.jsx    # Dev tweaks panel (по умолчанию скрыт, open=false)
│   └── styles.css          # Все стили (~1500 строк), включая landscape low-height media
├── assets/                 # 20 файлов: бренд (star.png, logo-dotted-sigma.png, bernard.png),
│                           # фото блюд (photo-*.jpg), 3D-модель (syrnik-model.obj + textures)
├── uploads/                # User uploads (pasted images, mtl files)
├── data/stories.json       # посты раздела Stories (EN+RU) — см. раздел выше
├── lib/stories.php         # рендер-хелперы Stories
├── story.php · stories.php · feed.php · sitemap.php · llms.php   # server-side рендер
├── tools/                  # new-story.mjs · build-noscript.mjs · dev-router.php
├── tablesnew.html          # PWA-обёртка → редирект на dishi.rest/m/signa/table-map (inline manifest)
├── tables/tablesnew.html   # Мирор того же PWA (по реальному URL который сохранён на iPad/iPhone)
└── CLAUDE.md               # Этот файл
```

### Старая версия (удалена 2026-05-23)
- Шаблон Montoya (HTML/jQuery/GSAP), 16 HTML страниц + style.css + css/js/images/webfonts/
- Backup был у пользователя локально
- Если нужно посмотреть на старую вёрстку — git log → раньше коммита `75a317a` (2026-04)

## Архитектура

### Стек
- **HTML + React 18.3.1** + Babel standalone (пинированные версии с integrity hashes)
- **No build step** — JSX транспилируется в браузере
- **Static-first** — деплой на любой статический хостинг
- **Шрифты**: Anton (display, all caps), Onest (body, Cyrillic+Latin), JetBrains Mono (mono labels), Caveat (handwritten notes)
- **Брендовые цвета**: Red `#EB3300`, Black `#000000`, Paper `#FFFEF9`, Cool Gray `#C8C9C7`

### Hero responsive (mobile=D, desktop=B) — May 2026
В `app.jsx` `heroVariant: "responsive"` (default).
Hook `useIsMobile(768)` в `sections.jsx` детектит viewport через `matchMedia`.
- **Desktop (>768px)** → `HeroVariantB` — dotted Sigma wordmark + EAT.MEET.CREATE.
- **Mobile (≤768px)** → `HeroVariantD` — asymmetric SIGNA. wordmark слева + tagline справа

Tweaks panel (dev only) даёт выбрать конкретный variant (`responsive`, `A`, `B`, `C`, `D`, `E`).

### i18n — STRINGS dict (sections.jsx top)
3 языка: **EN / RU / ID**.
- `T = (lang) => (key) => STRINGS[lang][key] || STRINGS.en[key] || key`
- `window.T` экспортирован для использования в любом компоненте
- `LangToggle` в header — `<window.LangToggle lang={lang} onChange={setLang}/>`

**Покрытые секции** (имеют переводы): Header nav, Hero (все variants), Feedback, Location, Footer, Bottom CTA.
**Не покрыто** (захардкоден EN): Brand, Menu items, Signature, Experience, Order. Можно дополнить — расширить STRINGS + использовать `T(lang)("key")` в JSX.

### Google Maps — реальная карта
`LocationSection` в `sections.jsx` использует `<iframe src="https://www.google.com/maps?q=Signa+Cafe...&output=embed">` — embed без API key (unofficial, но работает уже годами).
Класс `.loc-map.loc-map-google` в `styles.css` — высота 360px desktop / 260px mobile, лёгкий grayscale filter.

### Landscape low-height fix (apr 2026)
В `styles.css` в конце — медиа-блок `@media (orientation: landscape) and (max-height: 800px)`:
- `body` → 480px центрированная колонка, тёмные поля по бокам
- Hero font-sizes переведены на vh/vmin (vw был слишком большим)
- Цель — на ноутбуках с маленьким экраном по высоте (типа MacBook 11" в landscape) не растягивать сайт на полную ширину

### Tweaks panel (dev only)
`tweaks-panel.jsx` экспортирует:
- `useTweaks(defaults)` hook — управление state через `useReducer` + URL hash + postMessage
- `<TweaksPanel>` — UI с slider/toggle/radio/color компонентами

По умолчанию `open=false`. Активируется через postMessage `__activate_edit_mode` от внешнего инструмента (edit mode). В production не виден пользователям.

### Деплой на signa.cafe

```bash
FTP_URL="ftp://atlas.multihost.cloud/signa.cafe"
FTP_CRED="aqq17894:$(cat ~/.razex-creds/signa-ftp.txt)"

# Изменить один JSX файл
curl -s -T src/sections.jsx "$FTP_URL/src/sections.jsx" --user "$FTP_CRED"

# Залить новый ассет
curl -s --ftp-create-dirs -T assets/новое-фото.jpg "$FTP_URL/assets/новое-фото.jpg" --user "$FTP_CRED"

# Удалить файл (важно: путь от home /home/aqq17894/, НЕ /signa.cafe — это в /home/)
curl -s --user "$FTP_CRED" -Q "CWD /home/aqq17894/signa.cafe" -Q "DELE filename.ext" "ftp://atlas.multihost.cloud/"
```

**Cache busting**: index.html ссылается на `src/styles.css` без `?v=` (no-cache-bust). Если нужно — добавить `?v=$(date +%s)` к ссылкам в `index.html`.

### Хостинг
- **Провайдер**: multihost.cloud (cPanel, Apache)
- **cPanel**: https://atlas.multihost.cloud:2083
- **Логин**: aqq17894
- **Пароль**: ⚠️ хранится в `~/.razex-creds/signa-ftp.txt` (gitignored), НЕ в этом репо. Сменён 2026-05-24.
- **SSH**: ОТКЛЮЧЁН
- **FTP path**: `/home/aqq17894/signa.cafe/` (абсолютный путь для FTP команд)
- **URL**: https://signa.cafe
- **Admin Basic Auth**: `/admin.html` защищён через `.htaccess` → `.htpasswd` лежит в `/home/aqq17894/.htpasswd` (выше webroot). Пароль для user `admin` — хранится отдельно.

### GitHub
- **Репо**: https://github.com/irazex/signa-cafe
- **Ветка**: main

## Внешние интеграции

| Сервис | URL/ID | Где |
|--------|--------|-----|
| Google Analytics 4 | G-1D77CPGEML | (опционально, не подключено в новом сайте) |
| Dishi.rest (online menu) | signa.dishi.rest/outlet/11650 | hero CTA "MENU" / "ORDER NOW" |
| Dishi table-map | dishi.rest/m/signa/table-map | tablesnew.html PWA редирект |
| GoFood | gofood.link/a/L3hUVxW | OrderSection |
| Grab Food | food.grab.com/... | OrderSection |
| WhatsApp manager | wa.me/+6288987127671 | FeedbackSection "Complain" |
| WhatsApp main | wa.me/+6289654027190 | LocationSection / Footer |
| Google Forms (suggestions) | forms.gle/kEvTuhfnYaoqoU6j9 | FeedbackSection "Share idea" |
| Google Review | g.page/r/CZpcFedoGOxKEAE/review | FeedbackSection "Loved it" |
| Instagram | instagram.com/signa.cafe | Header + Footer |
| Google Maps embed | maps.google.com/maps?q=...&output=embed | LocationSection iframe |

## PWA — Table Map для столов

**Не часть основного сайта**, отдельная страница для официантов с iPad. Сохраняется как PWA на homescreen.

- `/tablesnew.html` и `/tables/tablesnew.html` — обе версии, одинаковый контент
- Inline manifest через `data:application/manifest+json,...` (без отдельного manifest.json)
- Мгновенный редирект на `https://www.dishi.rest/m/signa/table-map`
- При сохранении на homescreen — кэшируется как standalone PWA

## Правила для AI-агентов

1. **Разработка только локально**, деплой через rsync/FTP
2. **Коммит после каждого завершённого изменения** (правило 2026-04-27 — git push сразу после)
3. **Brand & visual**: использовать только утверждённые цвета (Red `#EB3300`, Paper `#FFFEF9`, Ink black). Шрифты — Anton/Onest/JetBrains Mono/Caveat. Никакого italic.
4. **Tile pattern** (44×44 white embossed) — только этот pattern для background
5. **i18n**: при добавлении нового UI-текста — сразу добавить ключ в STRINGS для всех 3 языков (en/ru/id) + использовать `T(lang)("key")`
6. **Hero variants**: trust `useIsMobile` hook, не делать ручные `display: none` для variants
7. **JSX через Babel в браузере**: код пишется как ES2015+ JSX, транспилируется на лету — НЕ добавлять TypeScript/JSX-build steps
8. **Tweaks panel ВСЕГДА скрыт по умолчанию** — это dev tool

## Production hardening (TODO)

- [ ] Pre-compile JSX через esbuild (убрать Babel-standalone ~600KB)
- [ ] WebP версии для photos (`cwebp -q 78 ...`)
- [ ] Lazy loading для images ниже fold
- [ ] OG meta tags для социальных шер
- [ ] Sitemap.xml + robots.txt (после прода с реальным domain)
- [ ] Google Analytics 4 reintegration (G-1D77CPGEML)
- [ ] Дополнить переводы для Brand/Menu/Signature/Experience/Order секций (сейчас захардкоден EN)

---

*Последнее обновление: 2026-09-04 — добавлен server-rendered раздел /stories + noscript-фолбэки*
*Полная переделка с шаблона Montoya на React 18 + Babel standalone*
