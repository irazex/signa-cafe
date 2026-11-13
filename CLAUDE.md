# Signa Cafe Website — AI Project Instructions

> Версия: **v2** (deployed 2026-05-24). Обновлено с full marketing/content/SEO pass на базе v1.
> Этот файл — инструкция для любого AI-агента (Claude, GPT, Cursor, Copilot и др.), работающего с проектом.
> **После изменения обновляй документ темы, а не этот файл** - куда что писать, см. раздел «Куда писать новое» ниже. Бюджет этого файла - 25 КБ: он читается целиком в каждой сессии (`AGENTS.md` - симлинк на него), а Codex видит только первые 32 КиБ.
>
> Берёшь проект без контекста - начни с [HANDOVER.md](HANDOVER.md): состояние прода,
> что крутится само (два крона), деньги, доступы и что смотреть после ближайшего
> четверга. Здесь - устройство и инварианты, в [TASKS.md](TASKS.md) - незакрытое.

## Куда писать новое и карта документов

До 14.11.2026 файл весил 51 КБ, из них 30 КБ - раздел про Stories. Теперь подробности по темам лежат в `docs/agents/` (на сайт эта папка не выкатывается: `tools/deploy-site.sh` заливает только страницы, `js/` и `.htaccess`).

| Документ | Что внутри | Когда открывать |
|---|---|---|
| `docs/agents/stories.md` | Stories: еженедельные SEO-посты - устройство, крон, генератор и промты, три пути публикации, учёт расхода на OpenAI, инварианты | Перед ЛЮБОЙ правкой раздела историй: `stories.php`, `story.php`, генерации и промтов, недельного крона, RSS, sitemap, `llms.php`, IndexNow, анонса в Telegram. Сначала его раздел про инварианты |
| `docs/agents/history-and-todo.md` | Что вошло в v2 (май 2026) и список несделанных доработок прода | Когда нужно понять историю версии или выбрать доработку прода |

- Новая механика, инвариант или грабля - в документ темы, отдельным разделом с датой сразу под его шапкой. Темы нет в таблице - новый файл в `docs/agents/` с такой же шапкой и строка в таблице.
- Ход и итог задачи - `TASKS.md`; состояние прода, кроны, деньги и доступы - `HANDOVER.md`; разбор инцидента - `docs/incidents/`.
- Сюда - только то, что нужно знать в любой задаче: структура, архитектура, правила.
- Stories тратят деньги OpenAI при каждой генерации: модель и потолок расхода описаны в `docs/agents/stories.md` («Сколько это стоит»); не менять модель и не запускать генерацию повторно, не прочитав этот раздел.


## Быстрый старт

```bash
# Локальный сервер для разработки (повторяет mod_rewrite, Stories тоже работают)
cd "/Volumes/Crucial X9/_AI live here_/Projects/Active/Signa Cafe Website"
npm install                      # один раз: Babel, esbuild, React для сборки
npm run build                    # после ЛЮБОЙ правки src/*.jsx
php -S 127.0.0.1:8099 -t . tools/dev-router.php
# открыть http://127.0.0.1:8099

# Деплой 4 страниц + js/ + .htaccess (проверяет сборку, коммит и read-back)
tools/deploy-site.sh

# Залить отдельный файл (ассет и т.п.)
FTP_URL="ftp://atlas.multihost.cloud/signa.cafe"
FTP_CRED="aqq17894:$(cat ~/.razex-creds/signa-ftp.txt)"
curl -s --ftp-create-dirs -T <local-file> "$FTP_URL/<remote-path>" --user "$FTP_CRED"
```

## Структура проекта (новая, May 2026)

```
signa-cafe-repo/
├── admin.php               # Админка: форма входа (lib/auth.php) + оболочка приложения
├── index.html              # Главная страница: React 18 + Google Fonts (Anton/Onest/JetBrains Mono/Caveat)
├── js/                     # СОБРАННЫЙ код страниц (npm run build), в git и на хосте. Руками не править
├── package.json            # только инструменты сборки; у сайта рантайм-зависимостей нет
├── src/                    # JSX исходники (компилирует tools/build-js.mjs в js/)
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
├── tools/                  # build-js.mjs · deploy-site.sh · new-story.mjs · build-noscript.mjs · dev-router.php
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
- **HTML + React 18.3.1** production-сборка, отдаётся с signa.cafe (`js/react.js`), не с unpkg
- **Сборка JSX на Маке, не в браузере** (с 09.10.2026) - `npm run build`, см. «Скорость загрузки».
  Babel в браузере остался только у админки (`admin.jsx`)
- **Static-first** — деплой на любой статический хостинг

### Скорость загрузки (09.10.2026)

Жалоба владельца: переход на сайт из Google Карт открывался так долго, что казалось,
будто сайт лежит. Замер Lighthouse на главной:

| | мобильный | десктоп | реальный замер из Бали |
|---|---|---|---|
| было | 35 баллов, FCP 8.8 с, LCP 15.4 с, TBT 990 мс | 53, LCP 5.8 с | FCP/LCP 3.6 / 3.7 с |
| сборка JSX, gzip | 68-69, FCP ~4.0 с, LCP ~5.5 с, TBT ~50 мс | 78, LCP 2.4 с | FCP = LCP 1.7 с |
| + GTM после загрузки | 84-88, FCP 2.2 с, LCP 3.3-3.9 с, TBT 20-70 мс | 82, LCP 2.2 с | - |

Что было: React development + `@babel/standalone` с unpkg (~900 КБ сжатого JS), JSX
компилировался на телефоне гостя, потом ещё один запрос `content.json` к хосту в
России (RTT из Бали ~280 мс), а хост отдавал текст без сжатия.

Как устроено теперь - инварианты:
1. **`tools/build-js.mjs`** компилирует `src/*.jsx` тем же `@babel/standalone@7.29.0`
   и с теми же опциями, что раньше применял браузер (react + env), и минифицирует
   esbuild. Файлы склеиваются без обёрток - глобальная область общая, как у отдельных
   `<script>`. Результат: `js/react.js` (46 КБ gz), `js/core.js` (24 КБ gz), `js/<page>.js`.
   Текст всех 4 страниц сверен с прежним продом по хэшу - совпал.
2. **Правка `src/*.jsx` без `npm run build` на сайт не попадает.** `tools/deploy-site.sh`
   отказывается деплоить устаревшую сборку, грязное дерево и незапушенный коммит.
3. Блок `JS-BUNDLE` в `<head>` генерируется (хэши `?v=`), руками не править. Он стоит
   **выше** таблиц стилей: inline-скрипт после `<link rel=stylesheet>` ждёт загрузки CSS,
   и ранний запрос `content.json` уезжал на 0.9 с. `site.jsx` берёт этот промис.
4. `.htaccess`: mod_deflate для текста (styles.css 88 → 17 КБ) и `/js/` - год,
   `immutable` (URL меняется вместе с хэшем). На хосте нет brotli и HTTP/2.
5. Preload шрифта Anton идёт по прямому URL `fonts.gstatic.com/s/anton/v27/...` -
   тот же, что Google отдаёт Chrome и Safari. Сменит Google версию - потеряем 12 КБ,
   ничего не сломается; поправить URL по свежему CSS Google Fonts.
6. Что ещё тормозит и в коде не лечится: хост в России (DNS на `ns*.multihost.ru`,
   первый DNS-запрос из Бали ~0.85 с, TTFB ~0.9 с). Лечится Cloudflare перед сайтом -
   открытый вопрос владельцу в TASKS.md.
7. **GTM грузится отложенно** (решение владельца 09.10.2026). GTM + GA4 весят ~314 КБ
   и на медленном телефоне спорили с первым экраном. Инлайн-загрузчик в `<head>`
   (4 страницы + `st_gtm_head()`) вставляет `gtm.js` после `load` + idle, при первом
   касании/скролле/клавише или через 5 с - что раньше. Цена, принятая владельцем: GA4
   не видит визиты короче ~2 с. Не возвращать стандартный сниппет Google «как в
   инструкции» - он грузит контейнер сразу.
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

# Изменить JSX: заливать src/*.jsx бесполезно, страницы грузят js/
npm run build && git commit ... && git push && tools/deploy-site.sh

# Залить новый ассет
curl -s --ftp-create-dirs -T assets/новое-фото.jpg "$FTP_URL/assets/новое-фото.jpg" --user "$FTP_CRED"

# Удалить файл (важно: путь от home /home/aqq17894/, НЕ /signa.cafe — это в /home/)
curl -s --user "$FTP_CRED" -Q "CWD /home/aqq17894/signa.cafe" -Q "DELE filename.ext" "ftp://atlas.multihost.cloud/"
```

**Cache busting**: `js/*.js` версионирует сборка сама (`?v=<хэш>`). `src/styles.css` кэшируется
на час и подключён с ручным `?v=` - поменял стили, подними `?v=` в 4 страницах и в `lib/stories.php`.

### Хостинг
- **Провайдер**: multihost.cloud (cPanel, Apache)
- **cPanel**: https://atlas.multihost.cloud:2083
- **Логин**: aqq17894
- **Пароль**: ⚠️ хранится в `~/.razex-creds/signa-ftp.txt` (gitignored), НЕ в этом репо. Сменён 2026-05-24.
- **SSH**: ОТКЛЮЧЁН
- **FTP path**: `/home/aqq17894/signa.cafe/` (абсолютный путь для FTP команд)
- **URL**: https://signa.cafe
- **Вход в админку**: `https://signa.cafe/admin` (равно `/admin.html`, `/admin.php` - оба
  переписываются в `admin.php`). Своя форма в фирменном стиле, PHP-сессия, кука `signa_admin`
  на 30 дней, `?logout=1` для выхода, троттлинг 8 попыток / 15 минут на IP.
  Логины **`razex`** и **`admin`** - оба с одним паролем из `~/.razex-creds/signa-admin.txt`.
  Хэши (bcrypt) - в `/.admin-auth.php` на хосте, файл gitignored и закрыт по HTTP.
  Сменить пароль: `php -r 'echo password_hash("НОВЫЙ", PASSWORD_BCRYPT), "\n";'`, вписать хэш
  обоим логинам, залить файл по FTP.

### GitHub
- **Репо**: https://github.com/irazex/signa-cafe
- **Ветка**: main

## Внешние интеграции

| Сервис | URL/ID | Где |
|--------|--------|-----|
| Google Tag Manager | GTM-WN7NK7GD | `<head>` + `<noscript>` на index/menu/about/visit (инлайн) и на Stories (через `st_gtm_head()` / `st_gtm_body()` в `lib/stories.php`). Подключён 23.09.2026, с 09.10.2026 грузится отложенно (см. «Скорость загрузки», п. 7) |
| Google Analytics 4 | G-1D77CPGEML (ресурс «Signa.cafe») | тег **GA4 - Signa Cafe** внутри GTM, триггер Initialization - All Pages, версия 2 опубликована 23.09.2026. В коде сайта measurement ID нет и быть не должно - всё через контейнер |
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
7. **JSX компилирует `npm run build`, не браузер** (с 09.10.2026): код по-прежнему пишется как ES2015+ JSX с глобалами через `window.*`, без TypeScript и без import/export. Не возвращать Babel-standalone и unpkg на публичные страницы - это и был тормоз (см. «Скорость загрузки»)
8. **Tweaks panel ВСЕГДА скрыт по умолчанию** — это dev tool
