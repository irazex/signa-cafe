#!/usr/bin/env node
// Weekly Stories generator. Picks a dish that has never been written about,
// asks the model for an EN+RU post, validates it and writes it into
// data/stories.json. Run by cron every Thursday; also runnable by hand.
//
//   node tools/story-gen.mjs                       one post, next free Thursday
//   node tools/story-gen.mjs --count 5 --date 2026-09-03 --back
//   node tools/story-gen.mjs --dish 7              force a dish by menu id
//   node tools/story-gen.mjs --rewrite <slug>      redo an existing post in place
//   node tools/story-gen.mjs --dry-run             print, write nothing
//
// Exit codes: 0 ok, 1 hard failure, 2 nothing to do (all dishes used).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { systemPrompt, userPrompt, ruEditorPrompt, schema, GEO, POSITIONING } from "./story-prompt.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STORIES = path.join(ROOT, "data", "stories.json");
const CONTENT = path.join(ROOT, "content.json");
const LANGS = ["en", "ru"];

// ---------- cli ----------
const argv = process.argv.slice(2);
const flag = (name, def = null) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? def : argv[i + 1];
};
const has = (name) => argv.includes(`--${name}`);

const opts = {
  count: Number(flag("count", 1)),
  date: flag("date"),
  back: has("back"),
  dish: flag("dish"),
  rewrite: flag("rewrite"),
  model: flag("model", "gpt-5.5"),
  dryRun: has("dry-run"),
  noEdit: has("no-edit"),
  verbose: has("verbose"),
};

const log = (...a) => console.log(...a);
const warn = (...a) => console.warn("  !", ...a);

// ---------- io ----------
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

function apiKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY.trim();
  const f = path.join(ROOT, ".openai_key");
  if (fs.existsSync(f)) return fs.readFileSync(f, "utf8").trim();
  throw new Error("no OpenAI key: set OPENAI_API_KEY or create .openai_key");
}

// ---------- dates ----------
const iso = (d) => d.toISOString().slice(0, 10);

// Thursday is publication day. Returns the next Thursday strictly after every
// date already present, so repeated cron runs never collide.
function nextThursday(after) {
  const d = new Date(`${after}T00:00:00Z`);
  do { d.setUTCDate(d.getUTCDate() + 1); } while (d.getUTCDay() !== 4);
  return iso(d);
}
const shiftDays = (isoDate, n) => {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};

// ---------- ledger ----------
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-zа-я0-9]+/gi, " ").trim();

function usedDishKeys(posts) {
  const keys = new Set();
  for (const p of posts) {
    if (p.dish?.name) keys.add(norm(p.dish.name));
    if (p.dish?.menuId != null) keys.add(`id:${p.dish.menuId}`);
    if (p.cover) keys.add(`img:${p.cover}`);
  }
  return keys;
}

function isUsed(dish, keys) {
  return keys.has(norm(dish.title)) || keys.has(`id:${dish.id}`) || keys.has(`img:${dish.img}`);
}

// Headline of each existing post, fed back to the model so it varies the angle.
const anglesOf = (posts) => posts.map((p) => `${p.dish?.name}: ${p.en?.title || ""}`).filter(Boolean);

function slugify(s) {
  return String(s).toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

// ---------- model call ----------
async function chat({ key, messages, jsonSchema, maxTokens = 16000 }) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: opts.model,
      messages,
      response_format: { type: "json_schema", json_schema: jsonSchema },
      max_completion_tokens: maxTokens,
    }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`OpenAI: ${json.error.message}`);
  const choice = json.choices?.[0];
  if (choice?.finish_reason === "length") throw new Error("model hit the token ceiling, raise max_completion_tokens");
  const text = choice?.message?.content;
  if (!text) throw new Error(`empty completion (finish_reason=${choice?.finish_reason})`);
  if (opts.verbose) log(`    tokens: ${json.usage?.prompt_tokens}p + ${json.usage?.completion_tokens}c`);
  return JSON.parse(text);
}

// Second pass over the Russian only. The writer pass is good at facts and
// structure and bad at sounding native; this fixes the second without touching
// the first.
async function editRussian(ru, dish, key) {
  const one = schema(["ru"]).schema.properties.ru;
  return chat({
    key,
    messages: [
      { role: "system", content: "Ты русскоязычный редактор гастрономических текстов. Ты переписываешь чужие тексты так, чтобы они читались как изначально русские. Факты не трогаешь." },
      { role: "user", content: ruEditorPrompt(ru, dish) },
    ],
    jsonSchema: { name: "signa_story_ru", strict: true, schema: one },
    maxTokens: 12000,
  });
}

async function generate({ dish, site, promos, usedAngles, date, key }) {
  const data = await chat({
    key,
    messages: [
      { role: "system", content: systemPrompt() },
      { role: "user", content: userPrompt({ dish, site, promos, lang: LANGS, usedAngles, date }) },
    ],
    jsonSchema: schema(LANGS),
  });

  if (!opts.noEdit && data.ru) {
    if (opts.verbose) log("    russian editor pass");
    try {
      data.ru = await editRussian(data.ru, dish, key);
    } catch (e) {
      warn(`russian editor pass failed, keeping first draft: ${e.message}`);
    }
  }
  return { data };
}

// ---------- validation ----------
const wordsOf = (b) => [b.lead, ...b.blocks.flatMap((x) => [x.h, ...x.p])].join(" ").split(/\s+/).filter(Boolean).length;

function validate(post) {
  const issues = [];
  for (const lang of LANGS) {
    const b = post[lang];
    const tag = lang.toUpperCase();
    if (!b) { issues.push(`${tag}: missing`); continue; }

    const blob = [b.lead, ...b.blocks.flatMap((x) => [x.h, ...x.p]), ...b.faq.flatMap((f) => [f.q, f.a])].join(" ");
    const low = blob.toLowerCase();

    const geoHits = GEO[lang].filter((g) => low.includes(g.toLowerCase()));
    if (geoHits.length < 3) issues.push(`${tag}: only ${geoHits.length} place names (${geoHits.join(", ") || "none"})`);

    const posMiss = POSITIONING[lang].filter((t) => !low.includes(t.toLowerCase()));
    if (posMiss.length) issues.push(`${tag}: positioning terms missing: ${posMiss.join(", ")}`);

    const w = wordsOf(b);
    if (w < 450) issues.push(`${tag}: body only ${w} words`);

    const dl = b.description.length;
    if (dl > 165) issues.push(`${tag}: description ${dl} chars (max 165)`);
    if (b.seoTitle.length > 62) issues.push(`${tag}: seoTitle ${b.seoTitle.length} chars (max 62)`);

    if (/[—–]/.test(blob)) issues.push(`${tag}: contains a long dash, house style is "-"`);

    if (lang === "ru") {
      // English leaking into Russian prose. Proper nouns in Latin script are
      // normal in Russian ("White Castle", "McDonald's"), so only lowercase
      // common words and the menu's own English labels count as a defect.
      const LABELS = /^(breakfast|lunch|dinner|pizza|pasta|main|mains|drinks|dessert|popular|veg|vegan|chef|chef's|new|hot|special)$/i;
      const prose = blob.replace(/https?:\/\/\S+/g, " ").replace(/\S+@\S+/g, " ");
      const latin = [...new Set((prose.match(/[A-Za-z][A-Za-z'-]{2,}/g) || [])
        .filter((w) => LABELS.test(w) || /^[a-z]/.test(w)))];
      if (latin.length) issues.push(`RU: english words in russian prose: ${latin.slice(0, 6).join(", ")}`);

      if (/\b\d+\s*k\b/i.test(blob)) issues.push('RU: menu-shorthand price ("93k"), spell it out as "93 000 IDR"');

      // Three or more consecutive sentences opening on the same word.
      const heads = blob.split(/(?<=[.!?])\s+/).map((x) => (x.trim().split(/\s+/)[0] || "").toLowerCase().replace(/[^а-яё]/g, ""));
      let run = 1;
      for (let i = 1; i < heads.length; i++) {
        run = heads[i] && heads[i] === heads[i - 1] ? run + 1 : 1;
        if (run >= 3) { issues.push(`RU: ${run} sentences in a row start with "${heads[i]}"`); break; }
      }

      for (const dead of ["является", "представляет собой", "не что иное", "стоит отметить", "в чистом виде", "ясный ответ"]) {
        if (low.includes(dead)) issues.push(`RU: dead construction "${dead}"`);
      }
    }
    if (/!/.test(blob)) issues.push(`${tag}: contains an exclamation mark`);

    const faqGeo = b.faq.filter((f) => GEO[lang].some((g) => f.q.toLowerCase().includes(g.toLowerCase()))).length;
    if (faqGeo < 1) issues.push(`${tag}: no FAQ question mentions a place`);
  }

  if (post.ru && post.en && post.ru.lead === post.en.lead) issues.push("RU lead identical to EN");
  return issues;
}

// ---------- main ----------
async function main() {
  const content = readJson(CONTENT);
  const store = readJson(STORIES);
  const key = apiKey();

  const site = content.site;
  const promos = content.promos || [];
  const catalog = (content.menu || []).filter((d) => d.img);

  // --rewrite: regenerate one existing post, keeping its slot and its dish.
  if (opts.rewrite) {
    const idx = store.posts.findIndex((p) => p.slug === opts.rewrite);
    if (idx === -1) { console.error(`no post with slug "${opts.rewrite}"`); process.exit(1); }
    const old = store.posts[idx];
    const dish = catalog.find((d) => d.img === old.cover)
      || { id: old.dish.menuId, title: old.dish.name, price: old.dish.price, cat: old.en.category, desc: old.en.lead, img: old.cover };

    log(`rewriting ${old.slug} (${old.date}) - ${dish.title}`);
    const { data } = await generate({ dish, site, promos, usedAngles: [], date: old.date, key });
    const post = { ...old };
    for (const l of LANGS) post[l] = data[l];
    post.tags = data.tags;

    const issues = validate(post);
    issues.forEach((i) => warn(i));
    if (!opts.dryRun) {
      store.posts[idx] = post;
      writeStore(store);
      log(`  written -> ${old.slug}`);
    }
    return;
  }

  // --- batch generation ---
  const results = [];
  for (let n = 0; n < opts.count; n++) {
    const used = usedDishKeys(store.posts);
    const pool = catalog.filter((d) => !isUsed(d, used));

    if (!pool.length) {
      console.error("every dish in the menu already has a post - add dishes to content.json or clear the ledger");
      process.exit(results.length ? 0 : 2);
    }

    let dish;
    if (opts.dish && n === 0) {
      dish = catalog.find((d) => String(d.id) === String(opts.dish) || norm(d.title) === norm(opts.dish));
      if (!dish) { console.error(`dish "${opts.dish}" not found in content.json`); process.exit(1); }
    } else {
      dish = pool[Math.floor(Math.random() * pool.length)];
    }

    // Date: explicit --date for the first post, then step by a week.
    let date;
    if (opts.date) {
      date = n === 0 ? opts.date : shiftDays(results[n - 1].date, opts.back ? -7 : 7);
    } else {
      const newest = store.posts.map((p) => p.date).sort().pop() || iso(new Date());
      date = nextThursday(newest);
    }

    log(`[${n + 1}/${opts.count}] ${date}  ${dish.title}  (${pool.length} dishes left)`);

    let data, attempt = 0, issues;
    while (attempt < 2) {
      attempt++;
      ({ data } = await generate({ dish, site, promos, usedAngles: anglesOf(store.posts), date, key }));
      const probe = { ...data, dish: {}, cover: dish.img };
      issues = validate(probe);
      if (!issues.length) break;
      if (attempt < 2) log(`    retry, ${issues.length} issue(s): ${issues[0]}`);
    }
    issues.forEach((i) => warn(i));

    const post = {
      // The model sometimes appends the publication date to its slug - the date
      // already lives in the post, and it makes the URL worse.
      slug: data.slug && /^[a-z0-9-]+$/.test(data.slug) ? data.slug.replace(/-\d{4}-\d{2}-\d{2}$/, "") : slugify(dish.title),
      date,
      cover: dish.img,
      dish: { name: dish.title, price: dish.price, menuId: dish.id, menuUrl: site.orderUrl },
      tags: data.tags,
    };
    for (const l of LANGS) post[l] = data[l];

    if (store.posts.some((p) => p.slug === post.slug)) post.slug = `${post.slug}-${date.slice(5).replace("-", "")}`;

    store.posts.push(post);
    results.push(post);
    log(`    ok  /stories/${post.slug}  (${wordsOf(post.en)}w en / ${wordsOf(post.ru)}w ru)`);
  }

  if (opts.dryRun) { log("\n--dry-run: nothing written"); return; }
  writeStore(store);
  log(`\nwritten ${results.length} post(s) -> data/stories.json (${store.posts.length} total)`);
}

function writeStore(store) {
  store.posts.sort((a, b) => (a.date < b.date ? 1 : -1));
  store.version = new Date().toISOString().slice(0, 10).replace(/-/g, "") + "a";
  fs.writeFileSync(STORIES, JSON.stringify(store, null, 2) + "\n");
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
