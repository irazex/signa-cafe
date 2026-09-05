#!/usr/bin/env node
// Weekly Stories generator. Picks a dish that has never been written about,
// asks the model for an EN+RU+ID post, pulls the dish photo out of Syrve,
// validates the result and writes it into data/stories.json.
//
//   node tools/story-gen.mjs                        one post, next free Thursday
//   node tools/story-gen.mjs --count 3 --date 2026-09-10
//   node tools/story-gen.mjs --dish "burrata pizza" force a dish by name or id
//   node tools/story-gen.mjs --rewrite <slug>       redo an existing post in place
//   node tools/story-gen.mjs --addlang id           add a missing language to every post
//   node tools/story-gen.mjs --dry-run              print, write nothing
//
// Exit codes: 0 ok, 1 hard failure, 2 nothing to do.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { systemPrompt, userPrompt, editorPrompt, schema, LANGS, GEO, POSITIONING } from "./story-prompt.mjs";
import { fetchDishPhoto } from "./dish-photo.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STORIES = path.join(ROOT, "data", "stories.json");
const CONTENT = path.join(ROOT, "content.json");
const SYRVE = path.join(ROOT, "data", "syrve-menu.json");

// Bottled drinks are somebody else's product, not Signa's cooking, so they make
// weak dish stories. Everything else in the menu is fair game.
// Bought-in bottles have no story of Signa's own - the label already tells it.
const SKIP_CATEGORIES = /^(BOTTLES|SPIRITS|BEER|WINES BY GLASS)/i;

// Names that are not dishes: a bulk preorder, a resold bottle, or the "build
// your own" placeholder. A weekly story needs something a reader can order and
// eat this afternoon.
const SKIP_NAMES = /preorder|\b\d+\s*(kg|pcs)\b|\bcreate your meal\b|^(borjomi|coca-cola|coke|sprite|fanta)\b|\b\d,\d+\s*l\b/i;

// ---------- cli ----------
const argv = process.argv.slice(2);
const flag = (n, d = null) => { const i = argv.indexOf(`--${n}`); return i === -1 ? d : argv[i + 1]; };
const has = (n) => argv.includes(`--${n}`);

const opts = {
  count: Number(flag("count", 1)),
  date: flag("date"),
  back: has("back"),
  dish: flag("dish"),
  rewrite: flag("rewrite"),
  addlang: flag("addlang"),
  slug: flag("slug"),
  model: flag("model", "gpt-5.5-pro"),
  langs: (flag("langs") || LANGS.join(",")).split(","),
  noEdit: has("no-edit"),
  noPhoto: has("no-photo"),
  dryRun: has("dry-run"),
  verbose: has("verbose"),
};

const log = (...a) => console.log(...a);
const warn = (...a) => console.warn("  !", ...a);
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

function apiKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY.trim();
  // .openai_key is gitignored and blocked in .htaccess; ~/.razex-creds is where
  // the machine keeps every other credential, and is what the VPS cron uses.
  for (const f of [path.join(ROOT, ".openai_key"), path.join(os.homedir(), ".razex-creds", "openai.txt")]) {
    if (fs.existsSync(f)) return fs.readFileSync(f, "utf8").trim();
  }
  throw new Error("no OpenAI key: set OPENAI_API_KEY, or create .openai_key or ~/.razex-creds/openai.txt");
}

// ---------- dates ----------
const iso = (d) => d.toISOString().slice(0, 10);
function nextThursday(after) {
  const d = new Date(`${after}T00:00:00Z`);
  do { d.setUTCDate(d.getUTCDate() + 1); } while (d.getUTCDay() !== 4);
  return iso(d);
}
const shiftDays = (isoDate, n) => { const d = new Date(`${isoDate}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return iso(d); };

// ---------- dish catalog ----------
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-zа-я0-9]+/gi, " ").trim();

// Syrve is the real menu (194 dishes with photos); content.json is the fallback
// for a machine that cannot reach the RPC adapter.
// The POS prefixes names with marker emoji - ⭐️ signature, 🌱 vegetarian,
// 🐟/🐔 protein. They are shelf labels for the till, not part of the dish name,
// and they must not reach a title, a slug or a meta description.
const cleanName = (s) =>
  String(s).replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2B00}-\u{2BFF}]/gu, "")
           .replace(/\s{2,}/g, " ").trim();

function catalog() {
  if (fs.existsSync(SYRVE)) {
    const c = readJson(SYRVE);
    return c.dishes
      .filter((d) => !SKIP_CATEGORIES.test(d.category) && !SKIP_NAMES.test(d.name))
      .map((d) => ({
        key: d.id, title: cleanName(d.name), price: d.priceLabel, cat: d.category,
        desc: d.desc, imageUrl: d.imageUrl, source: "syrve",
      }));
  }
  warn("no data/syrve-menu.json - falling back to the 12 dishes in content.json");
  return (readJson(CONTENT).menu || []).filter((d) => d.img).map((d) => ({
    key: `menu:${d.id}`, title: d.title, price: d.price, cat: d.cat,
    desc: d.desc, badge: d.badge, tags: d.tags, img: d.img, source: "content",
  }));
}

function usedKeys(posts) {
  const s = new Set();
  for (const p of posts) {
    if (p.dish?.name) s.add(norm(p.dish.name));
    if (p.dish?.syrveId) s.add(p.dish.syrveId);
    if (p.dish?.menuId != null) s.add(`menu:${p.dish.menuId}`);
    if (p.cover) s.add(`img:${p.cover}`);
  }
  return s;
}
const isUsed = (d, keys) => keys.has(norm(d.title)) || keys.has(d.key) || (d.img && keys.has(`img:${d.img}`));

const anglesOf = (posts) => posts.map((p) => `${p.dish?.name}: ${p.en?.title || ""}`).filter(Boolean);
const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);

// ---------- model ----------
// The Responses API, not chat/completions: the pro models are only served there.
// Requests run in background mode and we poll, because a pro generation can take
// many minutes and a held-open socket dies long before the answer arrives.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(key, pathname, init = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`https://api.openai.com/v1${pathname}`, {
        ...init,
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init.headers || {}) },
        signal: AbortSignal.timeout(120000),
      });
      return await res.json();
    } catch (e) {
      lastErr = e;
      if (attempt < 4) await sleep(2000 * attempt);
    }
  }
  throw new Error(`network: ${lastErr.message}`);
}

async function chat({ key, messages, jsonSchema, maxTokens = 40000 }) {
  let job = await api(key, "/responses", {
    method: "POST",
    body: JSON.stringify({
      model: opts.model,
      input: messages.map((m) => ({ role: m.role === "system" ? "developer" : m.role, content: m.content })),
      text: { format: { type: "json_schema", name: jsonSchema.name, strict: true, schema: jsonSchema.schema } },
      max_output_tokens: maxTokens,
      background: true,
      store: true,
    }),
  });
  if (job.error) throw new Error(`OpenAI: ${job.error.message || JSON.stringify(job.error)}`);

  const started = Date.now();
  const LIMIT_MS = 40 * 60 * 1000;
  while (job.status === "queued" || job.status === "in_progress") {
    if (Date.now() - started > LIMIT_MS) throw new Error(`response ${job.id} still ${job.status} after 40 minutes`);
    await sleep(5000);
    job = await api(key, `/responses/${job.id}`);
    if (job.error) throw new Error(`OpenAI: ${job.error.message || JSON.stringify(job.error)}`);
  }

  if (job.status === "incomplete") throw new Error(`model ran out of output budget (${job.incomplete_details?.reason}), raise max_output_tokens`);
  if (job.status !== "completed") throw new Error(`response ended as "${job.status}"`);

  let text = job.output_text;
  if (!text) {
    for (const item of job.output || []) {
      for (const c of item.content || []) if (c.type === "output_text") text = c.text;
    }
  }
  if (!text) throw new Error("completed response carried no output text");

  if (opts.verbose) {
    const u = job.usage || {};
    const secs = Math.round((Date.now() - started) / 1000);
    log(`    tokens: ${u.input_tokens}in + ${u.output_tokens}out (${u.output_tokens_details?.reasoning_tokens || 0} reasoning) in ${secs}s`);
  }
  return JSON.parse(text);
}

async function editLang(body, dish, lang, key) {
  const one = schema([lang]).schema.properties[lang];
  const persona = lang === "ru"
    ? "Ты русскоязычный редактор гастрономических текстов. Ты переписываешь чужие тексты так, чтобы они читались как изначально русские и как написанные человеком. Факты не трогаешь."
    : "You are an Indonesian food editor. You rewrite drafts so they read as native Bahasa Indonesia written by a person, never as translated or machine-generated text. You never change a fact.";
  return chat({
    key,
    messages: [{ role: "system", content: persona }, { role: "user", content: editorPrompt(body, dish, lang) }],
    jsonSchema: { name: `signa_story_${lang}`, strict: true, schema: one },
    maxTokens: 32000,
  });
}

async function generate({ dish, site, promos, usedAngles, date, key, langs = opts.langs, reference = null }) {
  const data = await chat({
    key,
    messages: [
      { role: "system", content: systemPrompt() },
      { role: "user", content: userPrompt({ dish, site, promos, langs, usedAngles, date, reference }) },
    ],
    jsonSchema: schema(langs),
  });

  // English is written first-language; the others get a register pass.
  for (const lang of langs.filter((l) => l !== "en")) {
    if (opts.noEdit || !data[lang]) continue;
    if (opts.verbose) log(`    ${lang} editor pass`);
    try { data[lang] = await editLang(data[lang], dish, lang, key); }
    catch (e) { warn(`${lang} editor pass failed, keeping first draft: ${e.message}`); }
  }
  return data;
}

// ---------- validation ----------
const wordsOf = (b) => [b.lead, ...b.blocks.flatMap((x) => [x.h, ...x.p])].join(" ").split(/\s+/).filter(Boolean).length;

function validate(post, langs = opts.langs) {
  const issues = [];
  for (const lang of langs) {
    const b = post[lang];
    const tag = lang.toUpperCase();
    if (!b) { issues.push(`${tag}: missing`); continue; }

    const blob = [b.lead, ...b.blocks.flatMap((x) => [x.h, ...x.p]), ...b.faq.flatMap((f) => [f.q, f.a])].join(" ");
    const low = blob.toLowerCase();

    const geoHits = GEO[lang].filter((g) => low.includes(g.toLowerCase()));
    if (geoHits.length < 3) issues.push(`${tag}: only ${geoHits.length} place names`);

    const posMiss = POSITIONING[lang].filter((t) => !low.includes(t.toLowerCase()));
    if (posMiss.length) issues.push(`${tag}: positioning terms missing: ${posMiss.join(", ")}`);

    const w = wordsOf(b);
    if (w < 450) issues.push(`${tag}: body only ${w} words`);
    if (b.description.length > 165) issues.push(`${tag}: description ${b.description.length} chars (max 165)`);
    if (b.seoTitle.length > 62) issues.push(`${tag}: seoTitle ${b.seoTitle.length} chars (max 62)`);
    if (/[—–]/.test(blob)) issues.push(`${tag}: long dash, house style is "-"`);
    if (/!/.test(blob)) issues.push(`${tag}: exclamation mark`);
    if (!b.faq.some((f) => GEO[lang].some((g) => f.q.toLowerCase().includes(g.toLowerCase())))) {
      issues.push(`${tag}: no FAQ question mentions a place`);
    }

    // Machine-written tells that survive the prompt often enough to check for.
    const heads = blob.split(/(?<=[.!?])\s+/).map((x) => (x.trim().split(/\s+/)[0] || "").toLowerCase());
    let run = 1;
    for (let i = 1; i < heads.length; i++) {
      run = heads[i] && heads[i] === heads[i - 1] ? run + 1 : 1;
      if (run >= 3) { issues.push(`${tag}: ${run} sentences in a row start with "${heads[i]}"`); break; }
    }
    const paraLens = b.blocks.flatMap((x) => x.p).map((p) => p.split(/\s+/).length);
    if (paraLens.length > 3 && Math.max(...paraLens) - Math.min(...paraLens) < 12) {
      issues.push(`${tag}: every paragraph is the same length (${Math.min(...paraLens)}-${Math.max(...paraLens)} words), reads machine-made`);
    }

    if (lang === "ru") {
      const LABELS = /^(breakfast|lunch|dinner|pizza|pasta|main|mains|drinks|dessert|popular|veg|vegan|chef|chef's|new|hot|special)$/i;
      const prose = blob.replace(/https?:\/\/\S+/g, " ").replace(/\S+@\S+/g, " ");
      const latin = [...new Set((prose.match(/[A-Za-z][A-Za-z'-]{2,}/g) || []).filter((w) => LABELS.test(w) || /^[a-z]/.test(w)))];
      if (latin.length) issues.push(`RU: english words in russian prose: ${latin.slice(0, 6).join(", ")}`);
      if (/\b\d+\s*k\b/i.test(blob)) issues.push('RU: menu-shorthand price ("93k"), spell it out');
      for (const dead of ["является", "представляет собой", "не что иное", "стоит отметить", "в чистом виде", "ясный ответ"]) {
        if (low.includes(dead)) issues.push(`RU: dead construction "${dead}"`);
      }
    }
  }

  for (const a of langs) for (const b of langs) {
    if (a < b && post[a] && post[b] && post[a].lead === post[b].lead) issues.push(`${a.toUpperCase()} lead identical to ${b.toUpperCase()}`);
  }
  return issues;
}

function writeStore(store) {
  store.posts.sort((a, b) => (a.date < b.date ? 1 : -1));
  store.version = new Date().toISOString().slice(0, 10).replace(/-/g, "") + "a";
  fs.writeFileSync(STORIES, JSON.stringify(store, null, 2) + "\n");
}

// ---------- main ----------
async function main() {
  const content = readJson(CONTENT);
  const store = readJson(STORIES);
  const key = apiKey();
  const site = content.site;
  const promos = content.promos || [];
  const cat = catalog();

  log(`model ${opts.model} | langs ${opts.langs.join("+")} | catalog ${cat.length} dishes (${cat[0]?.source})`);

  // --addlang: fill a language that existing posts do not have yet.
  if (opts.addlang) {
    const lang = opts.addlang;
    const targets = store.posts.filter((p) => !p[lang] && (!opts.slug || p.slug === opts.slug));
    if (!targets.length) { log(`every post already has "${lang}"`); return; }
    log(`adding "${lang}" to ${targets.length} post(s)`);

    for (const post of targets) {
      const dish = cat.find((d) => norm(d.title) === norm(post.dish.name))
        || { title: post.dish.name, price: post.dish.price, cat: post.en?.category || "Menu", desc: post.en?.lead || "" };
      log(`  ${post.date} ${post.slug}`);
      const data = await generate({
        dish, site, promos, usedAngles: [], date: post.date, key,
        langs: [lang], reference: post.en,
      });
      post[lang] = data[lang];
      const issues = validate(post, [lang]);
      issues.forEach((i) => warn(i));
      if (!opts.dryRun) writeStore(store);
    }
    log(opts.dryRun ? "--dry-run: nothing written" : `done, ${targets.length} post(s) updated`);
    return;
  }

  // --rewrite: regenerate one existing post, keeping its slot, dish and cover.
  if (opts.rewrite) {
    const idx = store.posts.findIndex((p) => p.slug === opts.rewrite);
    if (idx === -1) { console.error(`no post with slug "${opts.rewrite}"`); process.exit(1); }
    const old = store.posts[idx];
    const dish = cat.find((d) => norm(d.title) === norm(old.dish.name))
      || { title: old.dish.name, price: old.dish.price, cat: old.en?.category || "Menu", desc: old.en?.lead || "" };

    log(`rewriting ${old.slug} (${old.date}) - ${dish.title}`);
    const data = await generate({ dish, site, promos, usedAngles: [], date: old.date, key });
    const post = { ...old, tags: data.tags };
    for (const l of opts.langs) if (data[l]) post[l] = data[l];
    validate(post).forEach((i) => warn(i));
    if (!opts.dryRun) { store.posts[idx] = post; writeStore(store); log(`  written -> ${old.slug}`); }
    return;
  }

  // --- batch generation ---
  const results = [];
  for (let n = 0; n < opts.count; n++) {
    const used = usedKeys(store.posts);
    const pool = cat.filter((d) => !isUsed(d, used));
    if (!pool.length) {
      console.error("every dish already has a post - refresh data/syrve-menu.json or widen SKIP_CATEGORIES");
      process.exit(results.length ? 0 : 2);
    }

    let dish;
    if (opts.dish && n === 0) {
      dish = cat.find((d) => d.key === opts.dish || norm(d.title) === norm(opts.dish))
          || cat.find((d) => norm(d.title).includes(norm(opts.dish)));
      if (!dish) { console.error(`dish "${opts.dish}" not found`); process.exit(1); }
    } else {
      dish = pool[Math.floor(Math.random() * pool.length)];
    }

    let date;
    if (opts.date) date = n === 0 ? opts.date : shiftDays(results[n - 1].date, opts.back ? -7 : 7);
    else date = nextThursday(store.posts.map((p) => p.date).sort().pop() || iso(new Date()));

    log(`[${n + 1}/${opts.count}] ${date}  ${dish.title}  ${dish.price}  (${pool.length} dishes left)`);

    // A dry run answers "what would you write next" - it must not spend money
    // finding out. Everything above this line is free; everything below calls
    // the model. Push a stub so the dish registry and the date both advance and
    // --count 3 plans three different dishes on three different Thursdays; the
    // store is never written in this mode, so the stub costs nothing.
    if (opts.dryRun) {
      store.posts.unshift({ slug: slugify(dish.title), date, cover: dish.img || null,
                            dish: { name: dish.title, syrveId: dish.key }, en: { title: dish.title } });
      continue;
    }

    let data, issues;
    for (let attempt = 1; attempt <= 2; attempt++) {
      data = await generate({ dish, site, promos, usedAngles: anglesOf(store.posts), date, key });
      issues = validate({ ...data });
      if (!issues.length) break;
      if (attempt < 2) log(`    retry, ${issues.length} issue(s): ${issues[0]}`);
    }
    issues.forEach((i) => warn(i));

    let slug = data.slug && /^[a-z0-9-]+$/.test(data.slug) ? data.slug.replace(/-\d{4}-\d{2}-\d{2}$/, "") : slugify(dish.title);
    if (store.posts.some((p) => p.slug === slug)) slug = `${slug}-${date.slice(5).replace("-", "")}`;

    // Cover: pull the real photo out of Syrve, fall back to whatever the
    // catalog entry already points at.
    let cover = dish.img || null;
    if (!opts.noPhoto && dish.imageUrl) {
      try {
        const p = await fetchDishPhoto(dish.imageUrl, slug);
        cover = p.file;
        log(`    photo ${p.dims} ${p.kb}kb -> ${p.file}`);
      } catch (e) { warn(`photo download failed: ${e.message}`); }
    }
    if (!cover) { warn("no cover image, using the generic breakfast photo"); cover = "assets/photo-breakfast.webp"; }

    const post = {
      slug, date, cover,
      dish: {
        name: dish.title, price: dish.price, menuUrl: site.orderUrl,
        ...(dish.source === "syrve" ? { syrveId: dish.key, syrveCategory: dish.cat } : { menuId: Number(String(dish.key).replace("menu:", "")) }),
      },
      tags: data.tags,
    };
    for (const l of opts.langs) if (data[l]) post[l] = data[l];

    store.posts.push(post);
    results.push(post);
    log(`    ok  /stories/${slug}  (${opts.langs.filter((l) => post[l]).map((l) => `${wordsOf(post[l])}w ${l}`).join(" / ")})`);
    if (!opts.dryRun) writeStore(store);
  }

  if (opts.dryRun) { log("\n--dry-run: nothing written"); return; }
  log(`\nwritten ${results.length} post(s) -> data/stories.json (${store.posts.length} total)`);
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
