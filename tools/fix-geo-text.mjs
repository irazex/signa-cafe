#!/usr/bin/env node
// Take the low-demand district out of the prose - without calling a model.
//
// --fix-geo in story-gen.mjs re-anchors the headline fields, but the body, the
// FAQ and the headings keep whatever the writer put there. Rewriting those
// through the API costs real money for what is, in practice, deleting a
// prepositional phrase. This does it deterministically and for free.
//
// Rules:
//   1. The postal address is left alone - "Jl. Raya Kampial" is where the cafe
//      actually is, and one honest mention is the point.
//   2. Everywhere else: if the sentence already names a primary district, the
//      secondary phrase is deleted; if it does not, the name is swapped for the
//      primary one, so the sentence keeps its meaning.
//
//   node tools/fix-geo-text.mjs --dry-run     show every edit, write nothing
//   node tools/fix-geo-text.mjs               apply
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STORE = path.join(ROOT, "data/stories.json");
const dryRun = process.argv.includes("--dry-run");

const PRIMARY = {
  en: ["Nusa Dua", "Bukit", "Ungasan"],
  ru: ["Нуса Дуа", "Букит", "Унгасан"],
  id: ["Nusa Dua", "Bukit", "Ungasan"],
};
const MAIN = { en: "Nusa Dua", ru: "Нуса Дуа", id: "Nusa Dua" };
const SECONDARY = /Kampial|Кампьял[а-яё]*/gi;
// The street address, in any language version. Never touched.
const ADDRESS = /Raya Kampial/;

// Ordered: the longest, most specific phrasings first, so a general rule never
// eats a sentence a precise rule would have handled better.
const RULES = {
  en: [
    [/\s*,?\s*in Kampial,\s*(between|near)\b/gi, " $1"],
    [/\b(in|at|from|to|through|across to)\s+Kampial\s*,\s*/gi, ""],
    [/\b(in|at|from|to|through|across to)\s+Kampial\b/gi, ""],
    [/\bKampial\s+(sits|is|lies)\b/gi, "The cafe $1"],
    [/\s*,\s*Kampial\s*,/gi, ", "],
    [/\bKampial\b/g, ""],
  ],
  ru: [
    // JS \b is defined by ASCII \w, so it never fires next to Cyrillic.
    // Boundaries here are explicit lookarounds instead.
    [/\s*,?\s*в\s+Кампьяле,\s*(между|недалеко|рядом)(?![а-яё])/gi, " $1"],
    [/\s+в\s+Кампьял[еа]?(?![а-яё])/gi, ""],
    [/\s*до\s+Кампьяла(?![а-яё])/gi, ""],
    [/(?<![а-яё])Кампьял(?![а-яё])\s+расположен(?![а-яё])/gi, "Кафе расположено"],
    [/(?<![а-яё])Кампьял(?![а-яё])\s+(находится|лежит)/gi, "Кафе $1"],
    [/(?<![а-яё])Кампьял[а-яё]*/gi, ""],
  ],
  id: [
    [/\s*,?\s*di\s+Kampial,\s*(antara|dekat|di jalur)\b/gi, " $1"],
    [/\b(di|ke|dari|menyeberang ke|belokan ke)\s+Kampial\b/gi, ""],
    [/\s*,\s*Kampial\s*,/gi, ", "],
    [/\bSigna Cafe\s+Kampial\b/gi, "Signa Cafe"],
    [/\bKampial\b/g, ""],
  ],
};

// Shapes that mean a deletion cut too deep and left a noun without its
// complement, or a preposition without its object.
const DANGLING = [
  /\b(ritme|ritma|rhythm|pace|ритм[еа]?)\s*[,.]/i,
  /\b(di|ke|dari|in|at|of|в|из|до)\s*[,.]/i,
  /\s,/,
  /\(\s*\)/,
];

/** Tidy the punctuation and spacing a deletion leaves behind. */
function tidy(s) {
  return s
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/,\s*,/g, ",")
    .replace(/\(\s*\)/g, "")
    .replace(/\s+-\s+-\s+/g, " - ")
    .replace(/,\s*\./g, ".")
    .replace(/\.\s*\./g, ".")
    .replace(/^\s*[,;]\s*/, "")
    .trim();
}

/** Capitalise if a deletion left the sentence starting lowercase. */
function recapitalise(s) {
  // A keyword is a lowercase phrase with no sentence punctuation - leave it be.
  if (!/[.!?:]/.test(s) && s === s.toLowerCase()) return s;
  return s.replace(/(^|[.!?]\s+)(\p{Ll})/gu, (m, pre, ch) => pre + ch.toUpperCase());
}

function fixString(text, lang) {
  if (!SECONDARY.test(text)) { SECONDARY.lastIndex = 0; return text; }
  SECONDARY.lastIndex = 0;

  // Split on sentences so "already names a primary" is judged per sentence,
  // not per paragraph - a paragraph almost always mentions one somewhere.
  const parts = text.split(/(?<=[.!?])\s+/);
  const out = parts.map((sent) => {
    // The real address stays - but only the sentence that carries it. Guarding
    // the whole paragraph let "Kampial sits between..." ride along next to it.
    if (ADDRESS.test(sent)) return sent;
    if (!/Kampial|Кампьял/i.test(sent)) return sent;
    const hasPrimary = PRIMARY[lang].some((g) => sent.includes(g));
    let next = sent;
    if (hasPrimary) {
      for (const [rx, to] of RULES[lang]) next = next.replace(rx, to);
    } else {
      // Only location in the sentence: swap rather than delete, or the sentence
      // loses the fact it was carrying.
      next = next.replace(/Кампьял[а-яё]*|Kampial/gi, (m) => (/^[a-zа-яё]/.test(m) ? MAIN[lang].toLowerCase() : MAIN[lang]));
    }
    next = recapitalise(tidy(next));

    // Deleting works when the name sat in a prepositional phrase. When it was
    // a bare complement ("the rhythm of Kampial") the deletion strands the
    // noun, so fall back to substituting the primary name instead.
    if (DANGLING.some((rx) => rx.test(next))) {
      next = recapitalise(tidy(sent.replace(/Кампьял[а-яё]*|Kampial/gi, (m) => (/^[a-zа-яё]/.test(m) ? MAIN[lang].toLowerCase() : MAIN[lang]))));
    }
    return next;
  });
  return out.join(" ");
}

const store = JSON.parse(fs.readFileSync(STORE, "utf8"));
let edits = 0, kept = 0;

for (const post of store.posts) {
  // Tags sit at post level, outside the language blocks, and render as the
  // visible tag line under every story - one bare district word per page.
  if (Array.isArray(post.tags)) {
    const before = post.tags.length;
    post.tags = [...new Set(post.tags.filter((t) => !/kampial|кампьял/i.test(t)))];
    if (post.tags.length !== before) { edits++; console.log(`\n${post.slug} [tags]  dropped the district tag`); }
  }
  for (const lang of ["en", "ru", "id"]) {
    const b = post[lang];
    if (!b) continue;
    const walk = (obj, set) => {
      if (typeof obj === "string") {
        const next = fixString(obj, lang);
        if (next !== obj) {
          edits++;
          console.log(`\n${post.slug} [${lang}]`);
          console.log(`  -  ${obj.slice(0, 190)}`);
          console.log(`  +  ${next.slice(0, 190)}`);
          set(next);
        } else if (/Kampial|Кампьял/i.test(obj)) kept++;
        return;
      }
      if (Array.isArray(obj)) {
        obj.forEach((v, i) => walk(v, (n) => { obj[i] = n; }));
        // "kampial cafe" -> "nusa dua cafe" may now equal an existing keyword.
        if (obj.every((v) => typeof v === "string")) {
          const seen = new Set();
          const uniq = obj.filter((v) => (seen.has(v) ? false : (seen.add(v), true)));
          if (uniq.length !== obj.length) obj.splice(0, obj.length, ...uniq);
        }
        return;
      }
      if (obj && typeof obj === "object") return Object.entries(obj).forEach(([k, v]) => walk(v, (n) => { obj[k] = n; }));
    };
    walk(b, () => {});
  }
}

console.log(`\n${edits} string(s) edited, ${kept} mention(s) deliberately kept (the postal address)`);
if (dryRun) { console.log("--dry-run: nothing written"); process.exit(0); }
store.version = new Date().toISOString().slice(0, 10).replace(/-/g, "") + "g";
fs.writeFileSync(STORE, JSON.stringify(store, null, 2) + "\n");
console.log(`written -> data/stories.json`);
