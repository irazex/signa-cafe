// Prompt builder for the weekly Stories generator.
// Kept in its own file so the prompt can be reviewed and tuned without touching
// the generator plumbing. Everything venue-specific is read from content.json so
// the prompt cannot go stale when prices, hours or promos change.

// Local place names the posts must anchor to. These are the search terms people
// actually type when they look for a cafe on the Bukit peninsula.
export const GEO = {
  en: ["Nusa Dua", "Kampial", "Bukit", "Ungasan", "Benoa", "Bali", "Jimbaran"],
  ru: ["Нуса Дуа", "Кампьял", "Букит", "Унгасан", "Беноа", "Бали", "Джимбаран"],
};

// Positioning terms that must appear in every post. Signa wants to be found for
// these, not only for the dish name.
export const POSITIONING = {
  en: ["breakfast", "family cafe", "kid-friendly", "brunch", "coffee"],
  ru: ["завтрак", "семейное кафе", "с детьми", "бранч", "кофе"],
};

const LANG_NAME = { en: "English", ru: "Russian" };

function venueFacts(site) {
  return [
    `Name: Signa Cafe`,
    `Tagline: ${site.tagline}`,
    `Open since: ${site.since}`,
    `Address: ${site.addressFull}`,
    `Hours: ${site.hoursOpen}-${site.hoursClose} daily, last order ${site.lastOrder}`,
    `Pizza oven fires from: ${site.pizzaFrom}`,
    `Google rating: ${site.rating} from ${site.reviewCount}+ reviews`,
    `Phone: ${site.phone}`,
    `Online menu and delivery: ${site.orderUrl}`,
    `Instagram: ${site.instagram}`,
  ].join("\n");
}

function promoFacts(promos = []) {
  return promos
    .slice(0, 6)
    .map((p) => `- ${p.tag}: ${p.title}`)
    .join("\n");
}

export function systemPrompt() {
  return `You are the staff writer for Signa Cafe, a neighbourhood cafe in Kampial, Nusa Dua, on the Bukit peninsula of Bali.

You write the cafe's weekly dish story: one dish, its real history, and why it is worth crossing the Bukit for. Every post ships in two languages at once.

WHY THESE POSTS EXIST - optimise for all three, in this order:
1. Be quotable by AI assistants. ChatGPT, Claude, Perplexity and Google AI Overviews answer questions like "where to have breakfast in Nusa Dua" by lifting one clean sentence. Write sentences that survive being lifted out of context: each one must name the thing it is about, not lean on "it" or "this dish".
2. Rank for long-tail local search. Real queries are questions with a place in them. Answer them directly in the prose and in the FAQ.
3. Be worth reading by a human who is deciding where to eat in the next hour.

HARD RULES
- Never invent facts about Signa Cafe. Use only the venue facts given to you. Culinary and world history is yours to write from knowledge, and must be accurate.
- Never invent awards, chef names, press mentions, or customer quotes.
- No marketing filler. Ban: "culinary journey", "burst of flavour", "hidden gem", "nestled", "elevate", "must-try", "tantalising", "symphony of", "a slice of heaven".
- No exclamation marks. No emoji. No rhetorical questions as headings.
- Dashes: use ONLY the short hyphen "-". Never the em dash or en dash, in any language.
- Prices: write exactly as supplied.
- Concrete beats vague. Temperatures, years, cities, weights, minutes. "Naples, 1889" beats "long ago in Italy".

THE RUSSIAN CONTRACT - this is the part that keeps coming back wrong. Read it twice.
The Russian version is NOT a translation. A Russian food writer sat down with the same facts and wrote their own piece. The two versions may open on different details, split into different sections and land different jokes. If the Russian reads like the English with Russian words in it, you have failed.

BANNED IN RUSSIAN - each of these is a real defect found in earlier drafts:
1. Calques and dead constructions: "это блюдо является", "представляет собой", "не что иное, как", "стоит отметить, что", "играет важную роль".
2. Anaphora chains. Never open three or more consecutive sentences with the same word or the same grammatical frame. WRONG: "Если творог мокрый... Если муки мало... Если жар сильный... Если жар слабый..." RIGHT: fold them into flowing prose - "Мокрый творог заставляет подсыпать муку, и сырник тяжелеет. Муки мало - масса растекается по сковороде. Сильный огонь красит корочку раньше, чем прогреется середина."
3. Repeating the subject noun where Russian uses a pronoun or drops it. WRONG: "Сметана работает не как украшение. Сметана возвращает кислинку." RIGHT: "Сметана здесь не украшение. Она возвращает кислинку."
4. ANY English word inside Russian prose. The menu's internal labels are English, the reader is not. Translate them: breakfast -> завтрак, Popular -> популярное, veg -> вегетарианское, Chef's -> выбор шефа. Never write "входит в раздел breakfast" or "отметка Popular и тег veg". The dish's Latin menu name may appear at most once, in brackets, and only if it genuinely helps someone order.
5. Menu metadata as prose. Badges, tags and category names are site furniture. Do not narrate them.
6. Wrong verb collocations. Check that the verb actually goes with the noun. WRONG: "с чем пить сырники". RIGHT: "с чем есть сырники" or "что пить с сырниками".
7. Monotone rhythm. Vary sentence length deliberately - a four-word sentence next to a twenty-word one. Five sentences of the same length in a row read like a manual.
8. Translationese abstractions used as endings: "дают ясный ответ", "честное знакомство с", "важная деталь", "в чистом виде".

REQUIRED IN RUSSIAN: normal Russian word order, live verbs, the register of a good food column in a magazine - a person talking to another person who is hungry. Concrete nouns. Where the English version explains, the Russian version is allowed to simply state.
Prices in Russian prose are written in full with a space: "93 000 IDR". Never "93k".

CATEGORY NOUNS: name the dish with the noun a native speaker of that language would use. Get this wrong and the whole post loses credibility.`;
}

export function userPrompt({ dish, site, promos, lang = ["en", "ru"], usedAngles = [], date }) {
  const geo = `${GEO.en.join(", ")} / ${GEO.ru.join(", ")}`;
  const avoid = usedAngles.length
    ? `\nANGLES ALREADY USED in earlier posts - pick a different way in:\n${usedAngles.map((a) => `- ${a}`).join("\n")}\n`
    : "";

  return `Write this week's dish story.

THE DISH
Name (as printed on the menu): ${dish.title}
Menu price, English prose: ${dish.price}
Menu price, Russian prose: ${rubPrice(dish.price)}
Menu category: ${dish.cat}
Menu description: ${dish.desc}
${dish.badge ? `Menu badge: ${dish.badge}` : ""}
${dish.tags?.length ? `Menu tags: ${dish.tags.join(", ")}` : ""}
Publication date: ${date}

VENUE FACTS - the only Signa facts you may state
${venueFacts(site)}

CURRENT REGULAR OFFERS - mention at most one, only if it genuinely fits the dish
${promoFacts(promos)}
${avoid}
GEOGRAPHY - anchor the post to real places
Signa sits in Kampial, between Nusa Dua and Benoa, on the Bukit peninsula. Ungasan, Jimbaran and the Nusa Dua resort strip are all a short drive away. Work these names in where they belong: ${geo}
Each language version must name at least four of its own geography terms, spread through the text - not stacked in one paragraph.

POSITIONING TERMS - each version must use all of these naturally
English: ${POSITIONING.en.join(", ")}
Russian: ${POSITIONING.ru.join(", ")}

WHAT TO WRITE, per language (${lang.map((l) => LANG_NAME[l]).join(" and ")})
- lead: 1-2 sentences, under 200 characters. The hook. Must contain the dish name and one place name.
- 4 to 6 body sections. Each has a heading (h) and 1-3 paragraphs (p).
  Cover, in an order that suits the dish: where the dish comes from and the real history behind it; how it is actually made and what makes it hard to do well; how Signa's version is built; when and with what to eat it here.
  Body length 700-950 words per language. Paragraphs of 2-5 sentences.
- At least one section must be genuinely useful to someone choosing a cafe: who the dish suits, whether kids eat it, what time to come, what to drink with it.
- facts: 4-6 label/value pairs. Short. Origin, year, key ingredient, price, best time, who it suits.
- faq: 3-4 questions. These must be phrased the way people actually search, and at least two must contain a place name. Answers 1-3 sentences, self-contained, and they must answer the question in the first sentence.
- title: the human headline.
- seoTitle: under 60 characters, dish plus place plus hook.
- description: 140-160 characters, must read as a sentence, must contain the dish name and one place name.
- keywords: 8-12 terms, lowercase, mixing dish terms, positioning terms and place names.
- category: one or two words, e.g. Breakfast / Pizza / History.
- coverAlt: factual alt text for the dish photo, under 120 characters, containing the dish name.

Return JSON only, matching the provided schema exactly.`;
}


// "93k" is fine on a menu tile, wrong in a Russian sentence.
function rubPrice(price) {
  const m = String(price).match(/^(\d+(?:[.,]\d+)?)\s*k$/i);
  if (!m) return String(price);
  return `${Math.round(parseFloat(m[1].replace(",", ".")) * 1000).toLocaleString("ru-RU").replace(/\u00a0/g, " ")} IDR`;
}

// Second pass. The writer pass gets the facts right; this pass makes the
// Russian sound like it was born in Russian. It may rewrite freely as long as
// no fact changes.
export function ruEditorPrompt(ru, dish) {
  return `Ниже русская версия текста про блюдо "${dish.title}" для сайта кафе Signa Cafe в Кампьяле (Нуса Дуа, Бали).

Текст написан носителем фактов, но не носителем языка. Твоя работа - переписать его так, чтобы он читался как изначально русский текст хорошего гастрономического автора.

ЧТО ИСПРАВИТЬ ОБЯЗАТЕЛЬНО
- Любые следы перевода: канцелярит, кальки, английский порядок слов.
- Цепочки одинаково начатых предложений. Три подряд "Если..." - переписать в живую прозу.
- Повтор подлежащего там, где по-русски нужно местоимение или пропуск.
- Английские слова внутри русского текста. Названия разделов и теги меню перевести: breakfast - завтрак, Popular - популярное, veg - вегетарианское. Латинское название блюда допустимо не больше одного раза и только в скобках.
- Пересказ служебных полей меню (бейджи, теги, названия категорий) - убрать.
- Неверную сочетаемость глаголов и существительных.
- Однообразный ритм. Чередуй короткие и длинные предложения.
- Пустые концовки: "дают ясный ответ", "честное знакомство с", "в чистом виде".
- Цены писать полностью: "93 000 IDR", не "93k".

ЧТО СОХРАНИТЬ БЕЗ ИЗМЕНЕНИЙ
- Все факты: даты, города, цены, часы работы, адрес, состав блюда, имена собственные.
- Количество разделов и общий объем (плюс-минус десять процентов).
- Географию: Нуса Дуа, Кампьял, Букит, Унгасан, Беноа, Джимбаран - должны остаться, не меньше четырех разных названий по всему тексту.
- Слова позиционирования: завтрак, семейное кафе, с детьми, бранч, кофе.
- Тире только короткое "-". Без восклицательных знаков. Без эмодзи.
- Вопросы в FAQ должны остаться поисковыми запросами, минимум в двух - название места. Ответ отвечает на вопрос первым предложением.

Верни JSON ровно той же структуры, что и на входе.

ИСХОДНЫЙ ТЕКСТ:
${JSON.stringify(ru, null, 2)}`;
}

// JSON schema handed to the API so the model cannot drift from the shape
// data/stories.json expects.
export function schema(langs = ["en", "ru"]) {
  const body = {
    type: "object",
    additionalProperties: false,
    required: ["title", "seoTitle", "description", "keywords", "category", "coverAlt", "lead", "blocks", "facts", "faq"],
    properties: {
      title: { type: "string" },
      seoTitle: { type: "string" },
      description: { type: "string" },
      keywords: { type: "array", minItems: 6, maxItems: 14, items: { type: "string" } },
      category: { type: "string" },
      coverAlt: { type: "string" },
      lead: { type: "string" },
      blocks: {
        type: "array",
        minItems: 4,
        maxItems: 6,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["h", "p"],
          properties: {
            h: { type: "string" },
            p: { type: "array", minItems: 1, maxItems: 3, items: { type: "string" } },
          },
        },
      },
      facts: {
        type: "array",
        minItems: 4,
        maxItems: 6,
        items: { type: "array", minItems: 2, maxItems: 2, items: { type: "string" } },
      },
      faq: {
        type: "array",
        minItems: 3,
        maxItems: 4,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["q", "a"],
          properties: { q: { type: "string" }, a: { type: "string" } },
        },
      },
    },
  };

  const props = { slug: { type: "string" }, tags: { type: "array", minItems: 3, maxItems: 8, items: { type: "string" } } };
  for (const l of langs) props[l] = body;

  return {
    name: "signa_story",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["slug", "tags", ...langs],
      properties: props,
    },
  };
}
