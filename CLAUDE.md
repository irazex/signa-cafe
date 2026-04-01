# Signa Cafe Website — AI Project Instructions

> Этот файл — инструкция для любого AI-агента (Claude, GPT, Cursor, Copilot и др.), работающего с проектом.
> **ОБЯЗАТЕЛЬНО** обновляй этот файл после каждого изменения в проекте.

## Быстрый старт

```bash
# Локальный сервер для разработки
cd "/Users/razex/Documents/SIGNA/Signa 1.0 Nusa dua/site/Signa /HTML"
python3 -m http.server 8080

# Деплой на хостинг (FTP)
FTP_URL="ftp://atlas.multihost.cloud/signa.cafe"
FTP_CRED="aqq17894:z3zwa3qwXz3zwa3qwX"
curl -s -T <файл> "$FTP_URL/<файл>" --user "$FTP_CRED"
```

## Структура проекта

```
HTML/
├── index.html          # Главная страница (hero, галерея, feedback, меню категорий)
├── about.html          # О ресторане (команда, история, фото)
├── contact.html        # Контакты (карта, форма, телефон, WhatsApp)
├── review.html         # Отзывы (Google Review, жалобы, предложения)
├── tables.html         # Бронирование столов (PWA, ссылки на dishi.rest)
├── style.css           # Стили (69KB, кастом в конце файла — секция "SIGNA CUSTOM FIXES")
├── contact.php         # Обработчик формы обратной связи (PHP mail)
├── manifest.json       # PWA манифест для tables.html
├── favicon.ico/.png    # Иконки
├── robots.txt          # Robots
├── sitemap.xml         # Sitemap
├── css/                # CSS шаблона (assets.css, content.css, showcase.css, shortcodes.css, all.min.css)
├── js/                 # JavaScript (jquery.min.js, clapat.js, common.js, plugins.js, scripts.js, contact.js)
├── images/             # Изображения (jpg + webp, ~76 файлов)
└── webfonts/           # Font Awesome шрифты
```

### Файлы-шаблонные остатки (НЕ используются)
project01-08.html, multimedia.html, shortcodes.html, typography.html, guest register.html, table.html, tablesnew.html

## Архитектура

### Шаблон
**Montoya Creative Portfolio** (ThemeForest) — jQuery + GSAP + ScrollTrigger. Минифицированный CSS в начале style.css, кастомные правила в конце.

### Шрифты
| Где | Шрифт | Примечание |
|-----|-------|------------|
| Hero "SIGNA CAFE" | Six Caps | Только латиница, только hero-title |
| Заголовки, бегущая строка, подписи фото, меню | Oswald 500 | + text-transform: uppercase, transform: scaleX(0.75) |
| Основной текст, кнопки | Poppins | Дефолт шаблона |

### Ключевые CSS-классы
```css
.hero-title.primary-font-title — SIGNA CAFE (Six Caps, calc(1.3rem + 31.4vw))
.next-hero-title.primary-font-title — SIGNA CAFE внизу страницы (тот же размер)
.big-title.primary-font-title — бегущая строка (Oswald, scaleX(0.75), uppercase)
.slide-title.primary-font-title — подписи к фотографиям галереи
.list-rotator.primary-font-title li — категории меню (pizza and pasta, etc.)
.primary-font-title:not(.hero-title):not(.next-hero-title) — cap для остальных (max 180px)
```

### CSS: Где вносить изменения
Все кастомные стили — **в конце style.css** после комментария `/* ======= SIGNA CUSTOM FIXES ======= */`. НЕ трогать минифицированную часть в начале файла.

## Система переводов (i18n)

### Как работает
Скрипт в `<head>` index.html (и упрощённый в about/contact/review/tables):
1. Словарь `T = { ru: {...}, id: {...} }` — ключ EN → значение переведённое
2. `markElements()` — помечает элементы атрибутом `data-signa-i18n="1"`, сохраняет оригинал в `data-signa-orig`
3. `applyLang(lang)` — применяет перевод на лету (без перезагрузки)
4. `window.signaSetLang(lang)` — глобальная функция, вызывается из флажков
5. Сортировка ключей по длине (длинные первые) чтобы избежать частичных замен

### Как добавить перевод
1. Добавить ключ в `T.ru` и `T.id` в `<script>` в `<head>`
2. Если элемент не ловится автоматически — добавить `data-signa-i18n="1"` и `data-signa-orig-html="..."` в HTML
3. Для элементов с `<br/>` — убрать `<br/>`, объединить текст в одну строку

### Покрытие
| Язык | Ключи | Статус |
|------|-------|--------|
| EN | 68 | 100% (базовый) |
| RU | 70 | ✅ Полный |
| ID | 65 | ⚠️ ~96%, 3-5 ключей не хватает |

### Флажки языков
В header рядом с меню-бургером. Класс `.lang-flag`, data-lang="en/ru/id". Активный: `.lang-flag.active { opacity: 1 }`.

## Внешние интеграции

| Сервис | URL/ID | Назначение |
|--------|--------|------------|
| Google Analytics 4 | G-1D77CPGEML | Аналитика |
| Google Ads | AW-16559305966 | Реклама |
| Dishi.rest | signa.dishi.rest/outlet/11650 | Онлайн-меню + бронь столов |
| GoFood | gofood.link/a/L3hUVxW | Доставка еды |
| Grab Food | food.grab.com/... | Доставка еды |
| WhatsApp | wa.me/+6288987127671 | Жалобы менеджеру |
| Google Forms | forms.gle/kEvTuhfnYaoqoU6j9 | Предложения по улучшению |
| Google Review | g.page/r/CZpcFedoGOxKEAE/review | Отзывы |
| Instagram | instagram.com/signa.cafe | Соцсети |

## Деплой

### Хостинг
- **Провайдер**: multihost.cloud (cPanel)
- **cPanel**: https://atlas.multihost.cloud:2083
- **Логин**: aqq17894
- **Пароль**: z3zwa3qwXz3zwa3qwX
- **SSH**: ОТКЛЮЧЁН на аккаунте
- **Путь на сервере**: /signa.cafe/

### FTP деплой (из терминала)
```bash
FTP_URL="ftp://atlas.multihost.cloud/signa.cafe"
FTP_CRED="aqq17894:z3zwa3qwXz3zwa3qwX"

# Загрузить один файл
curl -s -T <local-file> "$FTP_URL/<remote-file>" --user "$FTP_CRED"

# Загрузить все HTML + CSS
for f in index.html about.html contact.html review.html tables.html style.css; do
  curl -s -T "$f" "$FTP_URL/$f" --user "$FTP_CRED"
done
```

### GitHub
- **Репо**: https://github.com/irazex/signa-cafe
- **Ветка**: main

### Cache busting
При изменении style.css обновлять `?v=timestamp` во всех HTML:
```bash
STAMP=$(date +%s)
for f in *.html; do sed -i '' "s/style\.css?v=[0-9]*/style.css?v=${STAMP}/" "$f"; done
```

## Мобильная версия (max-width: 768px)

### Текущие правила
- Hero: min-height: auto, max-height: 80dvh, overflow: visible
- Звезда: margin-top: 20px (не налезает на флажки)
- Feedback в hero: только кнопка "Жалоба" (2-й и 3-й items скрыты)
- Бегущая строка: выглядывает на ~20% снизу

### Русский язык на мобильном
- Бегущая строка: `html[lang="ru"] .big-title { font-size: 55% }` (Oswald шире Six Caps)
- Кнопки: Oswald, font-weight 500

## Известные проблемы

1. **273 !important** в CSS — конфликты с минифицированным шаблоном
2. **contact.php** — не проверена работоспособность на хостинге
3. **PWA иконки** (icon-192.png, icon-512.png) — могут отсутствовать
4. **GA4 не на tables.html** — добавить аналитику
5. **Три.js / Smooth Scrollbar** — упоминаются но не используются, можно убрать ссылки

## JavaScript

### Библиотеки (CDN)
- GSAP 3.11.4 (анимации)
- ScrollTrigger (scroll-анимации)
- Flip (DOM-анимации)
- imagesLoaded 5.0.0
- jQuery (локальный, 89KB)

### Локальные скрипты
- clapat.js — фреймворк шаблона
- common.js — общая логика
- plugins.js — jQuery плагины
- scripts.js — кастомная логика
- contact.js — валидация форм

## Правила для AI-агентов

1. **ВСЕГДА** вноси CSS изменения в секцию "SIGNA CUSTOM FIXES" в конце style.css
2. **НЕ ТРОГАЙ** минифицированную часть CSS в начале файла
3. **ПОСЛЕ КАЖДОГО ИЗМЕНЕНИЯ** обнови cache bust: `?v=timestamp` во всех HTML
4. **ПОСЛЕ ДЕПЛОЯ** залей изменённые файлы на FTP
5. **ПЕРЕВОДЫ**: добавляй в оба словаря (ru + id), ключи сортируются по длине автоматически
6. **ШРИФТЫ**: Six Caps ТОЛЬКО для .hero-title и .next-hero-title. Всё остальное — Oswald
7. **ОБНОВИ ЭТОТ ФАЙЛ** после любых структурных изменений (новые страницы, интеграции, переводы)

---

*Последнее обновление: 2026-04-01*
*Автор: Claude Code + Razex*

## Обязательные действия после изменений

### Чеклист (выполнять КАЖДЫЙ раз после правок)
1. ✅ Обновить `?v=timestamp` в HTML файлах (cache bust)
2. ✅ Загрузить изменённые файлы на FTP
3. ✅ Закоммитить и запушить на GitHub:
   ```bash
   cd /Users/razex/Documents/SIGNA/signa-cafe-repo
   # Скопировать изменённые файлы из рабочей директории
   cp "/Users/razex/Documents/SIGNA/Signa 1.0 Nusa dua/site/Signa /HTML/"*.html .
   cp "/Users/razex/Documents/SIGNA/Signa 1.0 Nusa dua/site/Signa /HTML/style.css" .
   cp "/Users/razex/Documents/SIGNA/Signa 1.0 Nusa dua/site/Signa /HTML/CLAUDE.md" .
   git add -A && git commit -m "описание изменений" && git push
   ```
4. ✅ Обновить этот файл (CLAUDE.md) если изменилась структура, добавлены переводы, интеграции и т.д.

### КРИТИЧЕСКИ ВАЖНО
- **НЕ ЗАБЫВАЙ коммитить на GitHub** — это единственный бэкап проекта
- **НЕ ЗАБЫВАЙ обновлять CLAUDE.md** — следующий AI-агент должен знать актуальное состояние
- **НЕ ЗАБЫВАЙ деплоить на FTP** — иначе пользователи не увидят изменения
