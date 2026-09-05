# Signa Cafe — TASKS

## 🟡 В работе

- [ ] **11. Google Search Console + Bing Webmaster** - ждём токены от владельца.
      Инструмент готов: `node tools/verify-site.mjs --google <token> --bing <token> --deploy`
- [ ] **10б. Google Business Profile через API** - доступ к Business Profile API
      Google выдаёт по заявке, мгновенно его не получить. До одобрения работает
      ручной путь: готовый пост приходит в Telegram вторым сообщением.
- [ ] **Пуш с VPS в GitHub** - крон коммитит локально и деплоит по FTP, но `git push`
      падает без токена. Одна команда от владельца включит архивирование в GitHub.

## ⬜ Backlog


- [ ] Рассмотреть server-side рендер для 4 основных страниц (сейчас закрыты `<noscript>`-фолбэком)
- [ ] Убрать Babel-standalone (~600 КБ в браузере) - это главный тормоз Core Web Vitals
- [ ] Дособрать переводы UI для Brand/Menu/Signature/Experience/Order (там до сих пор EN)

## 📝 Открытые вопросы к пользователю

_(закрыты 05.09.2026 — ответы перенесены в «В работе»)_

## ✅ Сделано (последнее)

- [x] **Каталог блюд из Syrve** (`tools/syrve-menu.mjs`) - через RPC-адаптер (8300),
      джойн `online-content-map` + `menu/5352/items` + `nomenclature/products`.
      **194 блюда** с фото, описанием и ценой против 12 в `content.json` -
      это ~3,7 года еженедельных постов. Бары и бутылки отфильтрованы, остаётся 169.
- [x] **Генератор на `gpt-5.5-pro` через Responses API.** `chat/completions` для pro
      отвечает «This is not a chat model». Запрос идёт в фоновом режиме
      (`background: true` + опрос статуса): один пост занимает 4-6 минут, и обычный
      держащийся сокет успевал умереть с `fetch failed` до ответа.
- [x] **Индонезийский - третий язык.** `ST_LANGS = [en, ru, id]`, роуты `/stories/id/...`,
      hreflang с `x-default`, sitemap, `llms.txt`, RSS, метка «ada di menu».
- [x] **Telegram-уведомление** (`tools/notify-telegram.mjs`) - в «SIGNA AI. Managers»
      (`-1003008104766`, топик 12613) через `@inmyrest_report_bot`. Вторым сообщением
      приходит готовый к вставке пост для Google Business Profile.
- [x] **Крон на VPS** - `0 9 * * 4` (четверг 09:00 WITA), `/home/razex/signa-cafe-repo`.
      Один запуск: анонсирует пост, вышедший сегодня, и пишет пост на следующий четверг.
      Конвейер всегда на неделю вперёд - есть время прочитать и поправить.
- [x] **JPEG-двойники для соцсетей** (`tools/og-images.mjs`) - все обложки были WebP,
      а Telegram Bot API его не принимает вовсе («failed to get HTTP URL content»),
      и часть скраперов пропускает. Теперь `og:image` ведёт на 1200x630 JPEG.
      Попутно: у `about.html` og:image вообще указывал на несуществующий файл.
- [x] **Расширена микроразметка Restaurant** - `areaServed` (Нуса Дуа, Кампьял, Букит,
      Унгасан, Беноа, Джимбаран), `amenityFeature` (WiFi, детское меню, стульчики,
      парковка), `knowsLanguage`, `keywords`, ссылка на блог. Плюс Twitter-карточки
      и `og:url` на menu/about/visit, где их не было.

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
