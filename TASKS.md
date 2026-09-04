# Signa Cafe — TASKS

## 🟡 В работе

_(пусто)_

## ⬜ Backlog

- [ ] Написать посты 3-8 (Napoleon cake, Salmon poke, Norwegian salmon soup, Big Breakfast,
      Caesar, Mango smoothie bowl) — по одному в неделю, четверг
- [ ] Свои фото к постам вместо фото из меню (сейчас переиспользуются `assets/menu-*.webp`)
- [ ] Индонезийская версия постов (ID) — структура готова, нужен только блок `"id"` в JSON
- [ ] Отправить sitemap в Google Search Console и Bing Webmaster после деплоя
- [ ] Рассмотреть server-side рендер для 4 основных страниц (сейчас закрыты `<noscript>`-фолбэком)

## 📝 Открытые вопросы к пользователю

_(пусто)_

## ✅ Сделано (последнее)

- [x] **Раздел Stories — еженедельные SEO-посты о блюдах** — server-rendered PHP
      (`story.php` / `stories.php`), EN+RU с hreflang, JSON-LD (BlogPosting + MenuItem +
      FAQPage + BreadcrumbList), RSS `/feed.xml`, генерируемый `/sitemap.xml`, `/llms.txt`
      для ИИ-ботов, вкладка Stories в админке, `tools/new-story.mjs` + `--check` валидатор.
      Два первых поста: сырники и пицца Маргарита.
- [x] **Фикс невидимости сайта для ИИ-ботов** — `<noscript>` на index/menu/about/visit
      расширены с 287 символов до 1.3-3.9 тыс. (генерируется `tools/build-noscript.mjs`
      из content.json, чтобы цены не разъезжались). `robots.txt` явно разрешает
      GPTBot / ClaudeBot / PerplexityBot / Google-Extended / CCBot по именам.
- [x] Docs: AGENTS.md и CLAUDE.md — один файл через симлинк — `5dcde82`
- [x] Analytics: tracker в site.jsx на всех 4 страницах — `bfc2f7a`
- [x] hydrateContent: version-gated localStorage — `bd4980c`
