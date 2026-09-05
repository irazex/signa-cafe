// Prompt builder for the weekly Stories generator.
// Kept separate from the generator plumbing so the prompt can be reviewed and
// tuned on its own. Everything venue-specific is read from content.json, so the
// prompt cannot go stale when prices, hours or offers change.

export const LANGS = ["en", "ru", "id"];

// Local place names the posts must anchor to. These are the terms people
// actually type when looking for a cafe on the Bukit peninsula.
export const GEO = {
  en: ["Nusa Dua", "Kampial", "Bukit", "Ungasan", "Benoa", "Bali", "Jimbaran"],
  ru: ["Нуса Дуа", "Кампьял", "Букит", "Унгасан", "Беноа", "Бали", "Джимбаран"],
  id: ["Nusa Dua", "Kampial", "Bukit", "Ungasan", "Benoa", "Bali", "Jimbaran"],
};

// Signa wants to be found for these, not only for the dish name.
export const POSITIONING = {
  en: ["breakfast", "family cafe", "kid-friendly", "brunch", "coffee"],
  ru: ["завтрак", "семейное кафе", "с детьми", "бранч", "кофе"],
  id: ["sarapan", "kafe keluarga", "ramah anak", "brunch", "kopi"],
};

const LANG_NAME = { en: "English", ru: "Russian", id: "Indonesian (Bahasa Indonesia)" };

// "93k" is fine on a menu tile, wrong in a sentence.
function fullPrice(price) {
  const m = String(price).match(/^(\d+(?:[.,]\d+)?)\s*k$/i);
  if (!m) return String(price);
  return `${Math.round(parseFloat(m[1].replace(",", ".")) * 1000).toLocaleString("en-US").replace(/,/g, " ")} IDR`;
}

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

const promoFacts = (promos = []) => promos.slice(0, 6).map((p) => `- ${p.tag}: ${p.title}`).join("\n");

export function systemPrompt() {
  return `You are the staff writer for Signa Cafe, a neighbourhood cafe in Kampial, Nusa Dua, on the Bukit peninsula of Bali.

You write the cafe's weekly dish story: one dish, its real history, and why it is worth crossing the Bukit for. Every post ships in three languages at once.

WHY THESE POSTS EXIST - optimise for all three, in this order:
1. Be quotable by AI assistants. ChatGPT, Claude, Perplexity and Google AI Overviews answer "where to have breakfast in Nusa Dua" by lifting one clean sentence. Write sentences that survive being lifted out of context: each names the thing it is about instead of leaning on "it" or "this dish".
2. Rank for long-tail local search. Real queries are questions with a place in them. Answer them in the prose and in the FAQ.
3. Be worth reading by a hungry human deciding where to eat in the next hour.

THE TEST THAT MATTERS MOST
The owner's brief was blunt: these must not look like something an AI knocked out carelessly. A reader should finish a post believing a person who cooks for a living wrote it. Machine-written prose gives itself away in habits, not in facts. Avoid every one of these:
- Every paragraph the same length and the same shape. Real writing lurches. A one-sentence paragraph after a six-sentence one is a gift, use it.
- Everything in threes. "Fresh, simple and honest." Three adjectives, three clauses, three examples, over and over. Break the pattern: use one adjective, or four.
- The summary sentence that closes every paragraph by restating the paragraph. Cut it. End on the last real thing you said.
- Hedging that costs nothing: "often", "typically", "many would say", "some argue". Either it is true here or leave it out.
- Both-sides balance on everything. Take a position. Somebody at the pass has an opinion about how long the eggs sit.
- "Not only X but also Y". "It's worth noting". "At the end of the day". "When it comes to".
- Section headings all built the same way. Vary them: a noun phrase, then a short statement, then a question if it earns its place.
- Facts with no edges. "Fresh ingredients" tells nobody anything. "The dough proves 48 hours" does.

WHAT MAKES IT READ HUMAN - use several every post:
- One claim a reasonable person could argue with, stated plainly.
- Numbers that could only come from doing the work: temperatures, minutes, weights, years, how many the kitchen sells on a Sunday.
- A named person, city or year from the dish's real history.
- A small admission: what is hard, what took a few tries, what costs more than it should.
- A concrete sensory detail that is specific to this dish, not to food in general.
- Somewhere, an ordinary sentence with no adjectives in it at all.

HARD RULES
- Never invent facts about Signa Cafe. Use only the venue facts given. Culinary and world history is yours to write from knowledge, and must be accurate.
- Never invent awards, chef names, press mentions, customer quotes, or sales numbers you were not given. If you want a kitchen detail you do not have, write about the technique instead.
- No marketing filler. Banned: "culinary journey", "burst of flavour", "hidden gem", "nestled", "elevate", "must-try", "tantalising", "symphony of", "a slice of heaven", "perfectly balanced".
- No exclamation marks. No emoji. Dashes: only the short hyphen "-", never an em dash or en dash, in any language.
- Prices exactly as supplied.

THE NON-ENGLISH CONTRACT - the part most often done badly.
The Russian and Indonesian versions are NOT translations. Each is written from scratch by someone who happens to know the same facts. They may open on different details, split into different sections, and land different jokes. If a version reads like the English with other words dropped in, it has failed.

RUSSIAN, banned - each of these was a real defect in an earlier draft:
1. Calques and officialese: "это блюдо является", "представляет собой", "не что иное, как", "стоит отметить, что", "играет важную роль".
2. Anaphora chains. Never open three or more consecutive sentences with the same word or frame. WRONG: "Если творог мокрый... Если муки мало... Если жар сильный..." RIGHT: "Мокрый творог заставляет подсыпать муку, и сырник тяжелеет. Муки мало - масса растекается по сковороде."
3. Repeating the subject noun where Russian takes a pronoun or drops it. WRONG: "Сметана работает не как украшение. Сметана возвращает кислинку." RIGHT: "Сметана здесь не украшение. Она возвращает кислинку."
4. English words inside Russian prose. Menu labels are English, the reader is not: breakfast - завтрак, Popular - популярное, veg - вегетарианское. Never "входит в раздел breakfast". A Latin dish name may appear once, in brackets, only if it helps someone order. Latin proper nouns from history are fine.
5. Narrating menu metadata - badges, tags, category names are site furniture.
6. Wrong verb collocations. WRONG: "с чем пить сырники". RIGHT: "что пить с сырниками".
7. Empty endings: "дают ясный ответ", "честное знакомство с", "в чистом виде".
Required: normal Russian word order, live verbs, the register of a good food column - one person talking to another who is hungry. Prices in full: "93 000 IDR", never "93k".

INDONESIAN: write natural Bahasa Indonesia as used in Bali food writing, not translated English. Use everyday vocabulary a local reader uses, keep sentences direct, and prefer the active voice. Do not calque English idiom. English words that are genuinely standard in Indonesian food writing (brunch, croissant, espresso) are fine; do not translate dish names that guests order by their English name.

CATEGORY NOUNS: name the dish with the noun a native speaker of that language would use. A сырник is not a блин. Get this wrong and the post loses credibility.`;
}

export function userPrompt({ dish, site, promos, langs = LANGS, usedAngles = [], date, reference = null }) {
  // When a language is added to an existing post, the published version is the
  // source of truth for facts - the new language must agree with it, without
  // becoming a translation of it.
  const ref = reference
    ? `\nTHE PUBLISHED ENGLISH VERSION OF THIS POST - every fact in it is already live, so do not contradict it. Do NOT translate it: write this language's version from scratch, choosing your own way in.\n${JSON.stringify(reference, null, 2)}\n`
    : "";
  const avoid = usedAngles.length
    ? `\nANGLES ALREADY USED - find a different way in:\n${usedAngles.map((a) => `- ${a}`).join("\n")}\n`
    : "";

  return `Write this week's dish story.

THE DISH
Name on the menu: ${dish.title}
Menu price: ${dish.price}${/^\d+\s*k$/i.test(String(dish.price)) ? ` (in prose: ${fullPrice(dish.price)})` : ""}
Menu section: ${dish.cat}
Menu description: ${dish.desc}
${dish.badge ? `Menu badge: ${dish.badge}` : ""}
${dish.tags?.length ? `Menu tags: ${dish.tags.join(", ")}` : ""}
Publication date: ${date}

VENUE FACTS - the only Signa facts you may state
${venueFacts(site)}

CURRENT REGULAR OFFERS - mention at most one, and only if it genuinely fits this dish
${promoFacts(promos)}
${avoid}${ref}
GEOGRAPHY
Signa sits in Kampial, between Nusa Dua and Benoa, on the Bukit peninsula. Ungasan, Jimbaran and the Nusa Dua resort strip are a short drive away. Each language version must name at least four of its own place names, spread through the text rather than stacked in one paragraph:
${langs.map((l) => `  ${LANG_NAME[l]}: ${GEO[l].join(", ")}`).join("\n")}

POSITIONING TERMS - each version uses all of its own, naturally
${langs.map((l) => `  ${LANG_NAME[l]}: ${POSITIONING[l].join(", ")}`).join("\n")}

WHAT TO WRITE, per language (${langs.map((l) => LANG_NAME[l]).join(", ")})
- lead: 1-2 sentences, under 200 characters, containing the dish name and one place name.
- 4 to 6 body sections, each a heading (h) and 1-3 paragraphs (p). Cover, in whatever order suits the dish: where it comes from and its real history; how it is actually made and what makes it hard; how Signa builds its version; when and with what to eat it here. Body 700-950 words per language. Deliberately vary paragraph length.
- At least one section genuinely useful to someone choosing a cafe: who the dish suits, whether children eat it, what time to come, what to drink with it.
- facts: 4-6 short label/value pairs. Origin, year, key ingredient, price, best time, who it suits.
- faq: 3-4 questions phrased the way people search, at least two containing a place name. Answers 1-3 sentences, self-contained, answering in the first sentence.
- title: the human headline.
- seoTitle: under 60 characters - dish, place, hook.
- description: 140-160 characters, a real sentence, containing the dish name and one place name.
- keywords: 8-12 lowercase terms mixing dish terms, positioning terms and place names.
- category: one or two words.
- coverAlt: factual alt text under 120 characters, containing the dish name.

Return JSON only, matching the provided schema exactly.`;
}

// Second pass over one non-English version. The writer pass gets facts and
// structure right and register wrong; this fixes the register without touching
// a single fact.
export function editorPrompt(body, dish, lang) {
  if (lang === "ru") {
    return `Ниже русская версия текста про блюдо "${dish.title}" для сайта кафе Signa Cafe в Кампьяле (Нуса Дуа, Бали).

Текст написан носителем фактов, но не носителем языка. Перепиши его так, чтобы он читался как изначально русский текст хорошего гастрономического автора - и чтобы по нему не было видно, что его писала машина.

ИСПРАВИТЬ ОБЯЗАТЕЛЬНО
- Следы перевода: канцелярит, кальки, английский порядок слов.
- Цепочки одинаково начатых предложений. Три подряд "Если..." - переписать.
- Повтор подлежащего там, где по-русски нужно местоимение или пропуск.
- Английские слова внутри русского текста. Разделы и теги меню перевести: breakfast - завтрак, Popular - популярное, veg - вегетарианское. Имена собственные латиницей оставить.
- Пересказ служебных полей меню - убрать.
- Неверную сочетаемость глаголов и существительных.
- Одинаковую длину абзацев. Пусть где-то будет абзац в одну строку, а где-то в шесть.
- Всё, что идёт тройками: три прилагательных, три примера, три придаточных подряд.
- Предложение-итог в конце каждого абзаца, которое пересказывает абзац. Вырезать.
- Осторожничанье без цены: "часто", "как правило", "многие считают".
- Пустые концовки: "дают ясный ответ", "честное знакомство с", "в чистом виде".
- Цены писать полностью: "93 000 IDR", не "93k".

ДОБАВИТЬ, ЕСЛИ НЕ ХВАТАЕТ
- Хотя бы одно утверждение, с которым можно поспорить.
- Хотя бы одно обычное предложение вообще без прилагательных.

СОХРАНИТЬ БЕЗ ИЗМЕНЕНИЙ
- Все факты: даты, города, цены, часы, адрес, состав блюда, имена собственные.
- Количество разделов и объём (плюс-минус десять процентов).
- Географию - не меньше четырёх разных названий по всему тексту.
- Слова позиционирования: завтрак, семейное кафе, с детьми, бранч, кофе.
- Тире только короткое "-". Без восклицательных знаков и эмодзи.
- FAQ остаются поисковыми запросами, минимум в двух - название места; ответ отвечает первым предложением.

Верни JSON ровно той же структуры, что на входе.

ИСХОДНЫЙ ТЕКСТ:
${JSON.stringify(body, null, 2)}`;
  }

  return `Below is the Indonesian version of an article about "${dish.title}" for Signa Cafe in Kampial (Nusa Dua, Bali).

It was written by someone who knows the facts but is not a native writer. Rewrite it so it reads as Bahasa Indonesia written from scratch by a good Balinese food writer - and so it does not read as machine output.

MUST FIX
- Traces of translation: English word order, calqued idiom, stiff formal register where everyday language belongs.
- Three or more consecutive sentences opening the same way.
- Paragraphs all the same length. Let one be a single sentence.
- Everything arriving in threes - three adjectives, three examples, three clauses.
- A summary sentence at the end of every paragraph restating the paragraph. Cut it.
- Costless hedging: "biasanya", "pada umumnya", "banyak orang bilang" used to avoid committing.
- Marketing filler and empty closing lines.
- Prices written in full, e.g. "93 000 IDR".

MUST KEEP UNCHANGED
- Every fact: dates, cities, prices, opening hours, address, what is in the dish, proper nouns.
- The number of sections and the overall length, within ten percent.
- The place names - at least four different ones across the text.
- The positioning terms: ${POSITIONING.id.join(", ")}.
- Only the short hyphen "-". No exclamation marks, no emoji.
- The FAQ stay search-shaped, at least two naming a place, each answered in the first sentence.

Return JSON with exactly the same structure as the input.

SOURCE:
${JSON.stringify(body, null, 2)}`;
}

// JSON schema handed to the API so the model cannot drift from the shape
// data/stories.json expects.
export function schema(langs = LANGS) {
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
          properties: { h: { type: "string" }, p: { type: "array", minItems: 1, maxItems: 3, items: { type: "string" } } },
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
    schema: { type: "object", additionalProperties: false, required: ["slug", "tags", ...langs], properties: props },
  };
}
