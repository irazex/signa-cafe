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
//   node tools/story-gen.mjs --edit-only id         re-run just the editor pass on a language
//   node tools/story-gen.mjs --fix-geo              re-anchor titles/descriptions on the searched districts
//   node tools/story-gen.mjs --dry-run              print, write nothing
//
// Exit codes: 0 ok, 1 hard failure, 2 nothing to do.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { systemPrompt, userPrompt, editorPrompt, schema, geoFixPrompt, geoFixSchema,
         LANGS, GEO, GEO_PRIMARY, GEO_SECONDARY, POSITIONING } from "./story-prompt.mjs";
import { fetchDishPhoto } from "./dish-photo.mjs";
import { record as recordCost, spentOn } from "./cost-ledger.mjs";

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
  editOnly: flag("edit-only"),
  fixGeo: has("fix-geo"),
  slug: flag("slug"),
  // MEASURED 05.09.2026 from the account's own usage export, not estimated:
  // gpt-5.5-pro ran 17 calls for $57.22 - $3.37 a call. gpt-5.5 ran 14 calls
  // for $1.64 - $0.12 a call. Pro is 6x the price per token AND spends 18 251
  // output tokens per call against 3 526, because half of what it bills is
  // reasoning that never reaches the article. Net: ~30x per call.
  // Owner's call 05.09.2026 - the cheap model is the default and pro needs
  // --allow-pro said out loud.
  model: flag("model", "gpt-5.5"),
  allowPro: has("allow-pro"),
  budget: Number(flag("budget", 5)),
  // A ceiling on the whole day, not just this run - three runs of $2 each is
  // the shape the 05.09 overspend actually had. Override per run with
  // --daily-cap, or for good with SIGNA_DAILY_CAP in the environment.
  dailyCap: Number(flag("daily-cap", process.env.SIGNA_DAILY_CAP || 3)),
  langs: (flag("langs") || LANGS.join(",")).split(","),
  noEdit: has("no-edit"),
  noPhoto: has("no-photo"),
  dryRun: has("dry-run"),
  verbose: has("verbose"),
};

let spentThisRun = 0;
const log = (...a) => console.log(...a);
const warn = (...a) => console.warn("  !", ...a);
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

/** Minimal KEY=value reader - no dependency for one variable. */
function readDotEnv(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

function apiKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY.trim();

  // House rule: secrets live in .env. Checked first so a repo that has one
  // never silently falls through to an older copy of the key.
  const fromEnv = readDotEnv(path.join(ROOT, ".env")).OPENAI_API_KEY;
  if (fromEnv) return fromEnv;

  // Legacy sources, kept because removing them without a .env in place breaks
  // the Thursday cron on the VPS, which reads ~/.razex-creds/openai.txt.
  // Both are gitignored and chmod 600; .openai_key is also blocked in .htaccess.
  for (const f of [path.join(ROOT, ".openai_key"), path.join(os.homedir(), ".razex-creds", "openai.txt")]) {
    if (fs.existsSync(f)) return fs.readFileSync(f, "utf8").trim();
  }
  throw new Error("no OpenAI key: put OPENAI_API_KEY in .env, or set it in the environment");
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

async function chat({ key, messages, jsonSchema, maxTokens = 12000, stage = "write", slug = null, date = null }) {
  // Checked before the request, not after it: a ceiling that only notices the
  // overspend once the money is gone is not a ceiling.
  const today = spentOn();
  if (today >= opts.dailyCap) {
    throw new Error(`daily cap reached: $${today.toFixed(2)} spent today, cap is $${opts.dailyCap.toFixed(2)}.`
      + ` Everything already written is saved. Raise it for one run with --daily-cap <usd>,`
      + ` or permanently with SIGNA_DAILY_CAP.`);
  }

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

  const secs = (Date.now() - started) / 1000;
  const u = job.usage || {};
  let entry = null;
  try {
    entry = recordCost({ slug, date, model: opts.model, stage, usage: u, seconds: secs });
  } catch (e) {
    warn(`cost not recorded: ${e.message}`);
  }

  // Nothing stopped the expensive run on 05.09 until the money was gone. A run
  // now carries a ceiling and stops itself at it. Raise it with --budget <usd>.
  spentThisRun += entry?.usd || 0;
  if (spentThisRun > opts.budget) {
    throw new Error(`budget stop: this run has spent $${spentThisRun.toFixed(2)}, over the $${opts.budget.toFixed(2)} ceiling.`
      + ` Work already written is saved. Continue with --budget <higher>.`);
  }
  if (opts.verbose) {
    log(`    tokens: ${u.input_tokens}in + ${u.output_tokens}out (${u.output_tokens_details?.reasoning_tokens || 0} reasoning)`
      + ` in ${Math.round(secs)}s${entry?.usd ? ` = $${entry.usd.toFixed(2)}` : ""}`);
  }
  return JSON.parse(text);
}

async function editLang(body, dish, lang, key, bill = {}) {
  const one = schema([lang]).schema.properties[lang];
  const persona = lang === "ru"
    ? "Ты русскоязычный редактор гастрономических текстов. Ты переписываешь чужие тексты так, чтобы они читались как изначально русские и как написанные человеком. Факты не трогаешь."
    : "You are an Indonesian food editor. You rewrite drafts so they read as native Bahasa Indonesia written by a person, never as translated or machine-generated text. You never change a fact.";
  return chat({
    key,
    messages: [{ role: "system", content: persona }, { role: "user", content: editorPrompt(body, dish, lang) }],
    jsonSchema: { name: `signa_story_${lang}`, strict: true, schema: one },
    maxTokens: 12000,
    stage: `edit:${lang}`, slug: bill.slug ?? null, date: bill.date ?? null,
  });
}

async function generate({ dish, site, promos, usedAngles, date, key, langs = opts.langs, reference = null, slug = null }) {
  const data = await chat({
    key,
    messages: [
      { role: "system", content: systemPrompt() },
      { role: "user", content: userPrompt({ dish, site, promos, langs, usedAngles, date, reference }) },
    ],
    jsonSchema: schema(langs),
    stage: langs.length === 1 ? `write:${langs[0]}` : "write", slug, date,
  });

  // English is written first-language; the others get a register pass.
  for (const lang of langs.filter((l) => l !== "en")) {
    if (opts.noEdit || !data[lang]) continue;
    if (opts.verbose) log(`    ${lang} editor pass`);
    try { data[lang] = await editLang(data[lang], dish, lang, key, { slug, date }); }
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

    // The names people actually search for must all be present...
    const primeMiss = GEO_PRIMARY[lang].filter((g) => !low.includes(g.toLowerCase()));
    if (primeMiss.length) issues.push(`${tag}: primary places missing: ${primeMiss.join(", ")}`);

    // ...and the address must not crowd them out. Kampial has almost no search
    // volume, so a title or description spent on it is a wasted slot.
    const headline = `${b.title} ${b.seoTitle || ""} ${b.description}`.toLowerCase();
    const inHead = GEO_SECONDARY[lang].filter((g) => headline.includes(g.toLowerCase()) && !/bali/i.test(g));
    if (inHead.length) issues.push(`${tag}: "${inHead.join(", ")}" in the title or description - use ${GEO_PRIMARY[lang][0]} there`);

    const secondaryCount = GEO_SECONDARY[lang]
      .filter((g) => !/bali/i.test(g))
      .reduce((n, g) => n + (low.match(new RegExp(g.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length, 0);
    if (secondaryCount > 3) issues.push(`${tag}: ${secondaryCount} mentions of the side districts, cap is 3`);

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
  // 05.09.2026: a 40-minute run on gpt-5.5-pro cost $57.22 - 28% of the whole
  // account's monthly OpenAI bill, spent before anyone could look at it. The
  // model is a foot-gun, so it now has a safety on it.
  if (/-pro\b/.test(opts.model) && !opts.allowPro) {
    console.error(`refusing to run on "${opts.model}".

  measured 05.09.2026, from the account's own usage export:
    gpt-5.5-pro   17 calls   $57.22    $3.37 a call   18 251 output tokens a call
    gpt-5.5       14 calls    $1.64    $0.12 a call    3 526 output tokens a call

  Pro is 6x the token price and writes 5x the tokens, half of them reasoning
  that never reaches the article. A 52-post year costs ~$1300 on pro, ~$39 on
  gpt-5.5. If a single post is genuinely worth $3.37, say so:

    node tools/story-gen.mjs --model ${opts.model} --allow-pro
`);
    process.exit(1);
  }

  const content = readJson(CONTENT);
  const store = readJson(STORIES);
  const key = apiKey();
  const site = content.site;
  const promos = content.promos || [];
  const cat = catalog();

  log(`model ${opts.model} | langs ${opts.langs.join("+")} | catalog ${cat.length} dishes (${cat[0]?.source})`);

  // --fix-geo: move the title, seoTitle, description and lead off the street
  // address and onto the districts people search for. Only those four short
  // fields are touched, so this costs a few hundred output tokens per post
  // instead of regenerating text nobody complained about.
  if (opts.fixGeo) {
    const targets = store.posts.filter((p) => !opts.slug || p.slug === opts.slug);
    if (!targets.length) { console.error(`no post at slug "${opts.slug}"`); process.exit(1); }

    for (const post of targets) {
      const langs = LANGS.filter((l) => post[l]);
      const off = langs.filter((l) => {
        const head = `${post[l].title} ${post[l].seoTitle || ""} ${post[l].description} ${post[l].lead}`.toLowerCase();
        return GEO_SECONDARY[l].some((g) => !/bali/i.test(g) && head.includes(g.toLowerCase()));
      });
      if (!off.length) { log(`  ${post.slug} - already anchored correctly`); continue; }

      log(`  ${post.slug} (${off.join("+")})`);
      if (opts.dryRun) continue;
      try {
        const fixed = await chat({
          key,
          messages: [
            { role: "system", content: systemPrompt() },
            { role: "user", content: geoFixPrompt(post, off) },
          ],
          jsonSchema: { ...geoFixSchema(off), strict: true },
          // A pro model burns 8-13k tokens on reasoning before it writes a word,
          // and an "incomplete" response is billed in full. The cap costs nothing
          // when unused, so keep it well clear of that floor.
          maxTokens: 8000,
          stage: "fix-geo", slug: post.slug, date: post.date,
        });
        for (const l of off) Object.assign(post[l], fixed[l]);
        writeStore(store);
        for (const l of off) log(`    ${l}: ${post[l].title}`);
      } catch (e) {
        warn(`${post.slug}: ${e.message}`);
      }
    }
    log(opts.dryRun ? "--dry-run: nothing written" : "done");
    return;
  }

  // --edit-only: re-run the editor pass over text that already exists. The
  // editor is a separate request, so it can fail on its own (a dead network, an
  // empty account) and leave the writer's raw draft in place. This puts the
  // polish back without paying to regenerate the whole post.
  if (opts.editOnly) {
    const lang = opts.editOnly;
    const targets = store.posts.filter((p) => p[lang] && (!opts.slug || p.slug === opts.slug));
    if (!targets.length) { console.error(`no post has "${lang}"${opts.slug ? ` at slug "${opts.slug}"` : ""}`); process.exit(1); }
    log(`re-editing "${lang}" on ${targets.length} post(s)`);

    for (const post of targets) {
      const dish = cat.find((d) => norm(d.title) === norm(post.dish.name))
        || { title: post.dish.name, price: post.dish.price, cat: post.en?.category || "Menu", desc: post.en?.lead || "" };
      log(`  ${post.date} ${post.slug}`);
      if (opts.dryRun) continue;
      try {
        post[lang] = await editLang(post[lang], dish, lang, key, { slug: post.slug, date: post.date });
      } catch (e) {
        warn(`editor pass failed, draft kept: ${e.message}`);
        continue;
      }
      validate(post, [lang]).forEach((i) => warn(i));
      if (!opts.dryRun) writeStore(store);
    }
    log(opts.dryRun ? "--dry-run: nothing written" : `done, ${targets.length} post(s) re-edited`);
    return;
  }

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
      if (opts.dryRun) continue;
      const data = await generate({
        dish, site, promos, usedAngles: [], date: post.date, key,
        langs: [lang], reference: post.en, slug: post.slug,
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
    const data = await generate({ dish, site, promos, usedAngles: [], date: old.date, key, slug: old.slug });
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
