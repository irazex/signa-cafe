# История версии v2 и список доработок прода

> Часть инструкций Signa Cafe Website. Вынесено из `CLAUDE.md` 14.11.2026 дословно; ядро и карта всех документов - в `CLAUDE.md`.
> **Когда открывать:** когда нужно понять, что вошло в v2 в мае 2026 и какие доработки прода ещё не сделаны.
> Пути и ссылки в тексте даны от корня репозитория. Новое по теме дописывать сюда: отдельным разделом с датой, сразу под этой шапкой.

## v2 Features (24 May 2026)

- **9 секций**: Hero / Brand / Feedback / Menu / Promos / Signature / Experience / Order / FAQ / Location / Footer
- **Reviews badge** — full-width black strip "★★★★★ 4.7 on Google · 1,426+ reviews ↗" после Brand
- **Promos section** — bakery −30% nightly, pizza hour, birthday perk, loyalty
- **FAQ section** — accordion с 8 вопросами + FAQ JSON-LD для rich snippets
- **Open/Close live timeline** — индикатор `OPEN 08:00 ●—pin—23:00` с движущимся пином (auto-updates 30s, Asia/Makassar timezone)
- **Section rail** — sticky левая навигация 01-10 на desktop ≥1100px
- **content.json** — single source of truth для site/menu/promos/FAQ/signature/contacts
- **admin.php** + `src/admin.jsx` — content editor с 6 табами. Вход - **своя форма на PHP-сессии** (`lib/auth.php`), Basic Auth снят 05.09.2026. Логины `razex` и `admin`, один пароль (`~/.razex-creds/signa-admin.txt`), кука на 30 дней, кнопка выхода в сайдбаре.
- **SEO** — Restaurant + Organization + BreadcrumbList + FAQPage JSON-LD, Open Graph, Twitter, hreflang en/ru/id, robots.txt, sitemap.xml
- **Real menu** — 12 items с реальными ценами из signa.dishi.rest (Syrniki 93k, Big Breakfast 79k, Margarita 69k, Pasta 89k, Salmon Poke 145k, etc.)

## Production hardening (TODO)

- [x] Pre-compile JSX (убрать Babel-standalone) - 09.10.2026, `tools/build-js.mjs`
- [ ] WebP версии для photos (`cwebp -q 78 ...`)
- [ ] Lazy loading для images ниже fold
- [ ] OG meta tags для социальных шер
- [ ] Sitemap.xml + robots.txt (после прода с реальным domain)
- [x] Google Analytics — 23.09.2026: контейнер GTM-WN7NK7GD на страницах, внутри него
      тег GA4 `G-1D77CPGEML` на Initialization - All Pages. Новая страница = не забыть
      оба блока (отложенный загрузчик из `index.html` в `<head>` и `<noscript>` сразу
      после `<body>`), иначе она выпадет из
      статистики молча. ⚠ Контейнером владеет `signacafe@gmail.com`, а не `i@razex.ru`:
      кабинет GTM открывается только из того браузера, где залогинен этот аккаунт
- [ ] Дополнить переводы для Brand/Menu/Signature/Experience/Order секций (сейчас захардкоден EN)

---

*Последнее обновление: 2026-10-09 - GTM грузится после открытия страницы; почта на сайте mail@signa.cafe*
*2026-10-09 - JSX собирается заранее (`npm run build` → `js/`), React production с нашего хоста, gzip и годовой кэш `/js/`; мобильный Lighthouse 35 → 69*
*2026-09-23 - подключён Google Tag Manager (GTM-WN7NK7GD) на публичные страницы; админка и PWA столов намеренно без счётчика*
*2026-09-07 - добавлен HANDOVER.md (точка входа без контекста); Stories перенесены на IJEN SPA*
*2026-09-05 - Basic Auth заменён на форму входа с PHP-сессией (admin.php + lib/auth.php)*
*Полная переделка с шаблона Montoya на React 18 + Babel standalone*
