# Signa Cafe Website — AI Project Instructions

> Этот файл — инструкция для любого AI-агента (Claude, GPT, Cursor, Copilot и др.), работающего с проектом.
> **ОБЯЗАТЕЛЬНО** обновляй этот файл после каждого изменения в проекте.

## Быстрый старт

```bash
# Локальный сервер для разработки
cd "/Users/razex/Documents/CLAUD MAIN AGENT/_Projects/signa-cafe-repo"
python3 -m http.server 8080
# открыть http://localhost:8080

# Деплой на хостинг (FTP)
FTP_URL="ftp://atlas.multihost.cloud/signa.cafe"
FTP_CRED="aqq17894:z3zwa3qwXz3zwa3qwX"
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
FTP_CRED="aqq17894:z3zwa3qwXz3zwa3qwX"

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
- **Пароль**: z3zwa3qwXz3zwa3qwX
- **SSH**: ОТКЛЮЧЁН
- **FTP path**: `/home/aqq17894/signa.cafe/` (абсолютный путь для FTP команд)
- **URL**: https://signa.cafe

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

*Последнее обновление: 2026-05-24*
*Полная переделка с шаблона Montoya на React 18 + Babel standalone*
