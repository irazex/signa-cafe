# Signa Cafe — TASKS

## 🟡 В работе

_(пусто)_

## ⬜ Backlog

- [ ] Свои фото к постам вместо фото из меню (сейчас переиспользуются `assets/menu-*.webp`)
- [ ] Индонезийская версия постов (ID) — структура готова, нужен только блок `"id"` в JSON
- [ ] Отправить sitemap в Google Search Console и Bing Webmaster (задеплоено, ждёт отправки)
- [ ] Рассмотреть server-side рендер для 4 основных страниц (сейчас закрыты `<noscript>`-фолбэком)

## 📝 Открытые вопросы к пользователю

- [ ] **Фото блюд из Syrve.** Пароль `analytics` / `Syrve2024Prod` к `iiko_analytics`
      больше не подходит (проверено 04.09 и по Tailscale, и по 127.0.0.1 - `password
      authentication failed`). Нужен актуальный доступ + подтверждение, что фото блюд
      вообще лежат в БД, а не только в RMS через RPC. Пока генератор берёт обложки
      из 12 локальных `assets/menu-*.webp`.
- [ ] **Установка крона на VPS.** Скрипты готовы (`tools/cron-weekly.sh`), но на VPS
      нужно: склонировать репо в `/home/razex/signa-cafe`, положить `.openai_key`
      и `~/.razex-creds/signa-ftp.txt`, добавить строку в crontab. Требует согласия -
      это ключи на удалённой машине.
- [ ] **Пул блюд конечен:** 12 позиций в `content.json` = 12 недель. Что дальше -
      расширять меню, разрешить повторы с новым углом, или писать не только о блюдах?

## ✅ Сделано (последнее)

- [x] **Автогенерация постов через gpt-5.5** — `tools/story-gen.mjs` + `tools/story-prompt.mjs`.
      Два прохода: писатель (EN+RU по JSON-схеме) и отдельный редактор русского языка,
      который переписывает текст как изначально русский. Валидатор ловит кальки,
      анафору, английские слова в русской прозе, «93k» вместо «93 000 IDR», длинное тире.
      Реестр блюд не даёт повторов. Сгенерировано 5 постов, 03.09 и назад по четвергам.
- [x] **Мобильная навигация** — бургер стал настоящим меню со всеми 5 разделами.
      Попутно найден и исправлен пред­существующий баг: шапка переполнялась
      (scrollWidth 410 при вьюпорте 375) и бургер уезжал за правый край - на телефоне
      навигации не было вообще.
- [x] **RSS-видимость** — `<link rel=alternate>` на всех 4 страницах + видимая кнопка
      подписки в архиве историй.
- [x] **IndexNow** — `tools/deploy-stories.sh` пингует Bing/Yandex при публикации,
      ключ `ec5bcb2216acef66611f2f3c568e3fc4.txt` в корне сайта.
- [x] **Menu JSON-LD** — было 5 пустых секций, стало 12 блюд с ценами, фото,
      `suitableForDiet` и ссылками на посты (`tools/build-menu-schema.mjs`).
- [x] **speakable** в BlogPosting — для голосовых ассистентов.

- [x] **Раздел Stories — еженедельные SEO-посты о блюдах** — server-rendered PHP
      (`story.php` / `stories.php`), EN+RU с hreflang, JSON-LD (BlogPosting + MenuItem +
      FAQPage + BreadcrumbList), RSS `/feed.xml`, генерируемый `/sitemap.xml`, `/llms.txt`
      для ИИ-ботов, вкладка Stories в админке, `tools/new-story.mjs` + `--check` валидатор.
      Два первых поста: сырники и пицца Маргарита. Задеплоено 2026-09-04, все URL 200.
- [x] **Фикс невидимости сайта для ИИ-ботов** — `<noscript>` на index/menu/about/visit
      расширены с 287 символов до 1.3-3.9 тыс. (генерируется `tools/build-noscript.mjs`
      из content.json, чтобы цены не разъезжались). `robots.txt` явно разрешает
      GPTBot / ClaudeBot / PerplexityBot / Google-Extended / CCBot по именам.
- [x] Docs: AGENTS.md и CLAUDE.md — один файл через симлинк — `5dcde82`
- [x] Analytics: tracker в site.jsx на всех 4 страницах — `bfc2f7a`
- [x] hydrateContent: version-gated localStorage — `bd4980c`
