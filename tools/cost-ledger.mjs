#!/usr/bin/env node
// Every model call that writes a story is recorded here, so the work can be
// counted and billed.
//
// The API reports tokens, never money, so the rate card lives in
// data/model-pricing.json and is editable from the admin panel. Token counts
// are ground truth; the cost is that truth multiplied by a rate somebody has
// to keep current.
//
//   node tools/cost-ledger.mjs             summary by month
//   node tools/cost-ledger.mjs --by-post   one line per post
//   node tools/cost-ledger.mjs --json      machine-readable
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LEDGER = path.join(ROOT, "data/story-costs.json");
const PRICING = path.join(ROOT, "data/model-pricing.json");

// USD per 1M tokens, used only when data/model-pricing.json is missing.
//
// These were invented placeholders until 05.09.2026, and understated
// gpt-5.5-pro by half ($15/$120 against the real $30/$180). A neighbouring
// session read them as fact and built a cost analysis on them. Numbers that
// look like facts get used like facts - so these are now the confirmed rates,
// checked against developers.openai.com, and carry the date they were checked.
const FALLBACK = {
  updated: "2026-09-05",
  source: "https://developers.openai.com/api/docs/pricing - Standard tier",
  note: "USD per 1M tokens. Re-check before billing; prices move.",
  models: {
    "gpt-5.5-pro": { input: 30, cachedInput: 30, output: 180 },
    "gpt-5.5": { input: 5, cachedInput: 0.5, output: 30 },
    "gpt-5.4": { input: 2.5, cachedInput: 0.25, output: 15 },
    "gpt-5.4-mini": { input: 0.75, cachedInput: 0.075, output: 4.5 },
  },
};

export function pricing() {
  if (!fs.existsSync(PRICING)) {
    fs.mkdirSync(path.dirname(PRICING), { recursive: true });
    fs.writeFileSync(PRICING, JSON.stringify(FALLBACK, null, 2) + "\n");
  }
  return JSON.parse(fs.readFileSync(PRICING, "utf8"));
}

export function load() {
  if (!fs.existsSync(LEDGER)) return { runs: [] };
  try { return JSON.parse(fs.readFileSync(LEDGER, "utf8")); } catch { return { runs: [] }; }
}

export function costOf(model, u, rates = pricing()) {
  const r = rates.models?.[model];
  if (!r) return null;
  const cached = u.cachedInput || 0;
  const fresh = Math.max(0, (u.input || 0) - cached);
  return (fresh * r.input + cached * (r.cachedInput ?? r.input) + (u.output || 0) * r.output) / 1e6;
}

/** One model call. `stage` is what it was for: "write", "edit:ru", "edit:id". */
export function record({ slug, date, model, stage, usage, seconds }) {
  const led = load();
  const rates = pricing();
  const u = {
    input: usage.input_tokens || 0,
    cachedInput: usage.input_tokens_details?.cached_tokens || 0,
    output: usage.output_tokens || 0,
    reasoning: usage.output_tokens_details?.reasoning_tokens || 0,
  };
  led.runs.push({
    at: new Date().toISOString(),
    slug: slug || null, postDate: date || null,
    model, stage, seconds: Math.round(seconds || 0),
    tokens: u,
    usd: Number((costOf(model, u, rates) ?? 0).toFixed(4)),
  });
  fs.mkdirSync(path.dirname(LEDGER), { recursive: true });
  fs.writeFileSync(LEDGER, JSON.stringify(led, null, 2) + "\n");
  return led.runs[led.runs.length - 1];
}

/** Re-price the whole ledger after the rate card changes. */
export function reprice() {
  const led = load();
  const rates = pricing();
  for (const r of led.runs) r.usd = Number((costOf(r.model, r.tokens, rates) ?? 0).toFixed(4));
  fs.writeFileSync(LEDGER, JSON.stringify(led, null, 2) + "\n");
  return led.runs.length;
}

/**
 * Reconcile the ledger against OpenAI's own usage export (Usage -> Export CSV).
 *
 * The ledger only knows about calls made after it existed. On 05.09.2026 that
 * meant it showed $14.29 of a real $57.22 - a billing record understating the
 * work by four times. This reads the export, and for every (day, model) where
 * the account spent more than the ledger recorded, inserts one adjustment row
 * for the difference so the total tells the truth.
 */
export function reconcile(csvPath) {
  const rates = pricing();
  const led = load();
  const text = fs.readFileSync(csvPath, "utf8").trim().split("\n");
  const head = text[0].split(",");
  const col = (r, n) => r[head.indexOf(n)];

  // what the account actually used, per day and model
  const actual = new Map();
  for (const line of text.slice(1)) {
    const r = line.split(",");
    const model = (col(r, "model") || "").replace(/-\d{4}-\d{2}-\d{2}$/, "");
    if (!rates.models[model]) continue;
    const day = (col(r, "start_time_iso") || "").slice(0, 10);
    // Tokens spent on a non-default service tier are not billed. The
    // incentivized tier trades prompt sharing for free usage, and on
    // 05.09.2026 that was 72 of the day's 98 requests at exactly $0 - the
    // whole $96.69 was the one model running on "default". Charging them at
    // card rates would invent about a dollar a day that nobody was billed.
    const tier = (col(r, "service_tier") || "default").trim() || "default";
    const k = `${day}|${model}|${tier}`;
    const a = actual.get(k) || { day, model, tier, calls: 0, input: 0, cached: 0, output: 0 };
    a.calls += Number(col(r, "num_model_requests") || 0);
    a.input += Number(col(r, "input_tokens") || 0);
    a.cached += Number(col(r, "input_cached_tokens") || 0);
    a.output += Number(col(r, "output_tokens") || 0);
    actual.set(k, a);
  }

  // An adjustment row from an earlier, shorter export is stale the moment a
  // longer one arrives: on 05.09.2026 a partial export produced a $57.22 row
  // for a day that actually cost $96.69. Drop the old adjustments for every day
  // this export covers and recompute them, so re-running with fresh numbers
  // corrects the ledger instead of silently keeping the smaller figure.
  const covered = new Set([...actual.values()].map((a) => a.day));
  led.runs = led.runs.filter(
    (r) => !(r.stage === "untracked" && covered.has((r.at || "").slice(0, 10)))
  );

  // what the ledger already knows from real, recorded calls
  const known = new Map();
  for (const r of led.runs) {
    const k = `${(r.at || "").slice(0, 10)}|${r.model}|${r.tier || "default"}`;
    const a = known.get(k) || { calls: 0, input: 0, cached: 0, output: 0 };
    a.calls++; a.input += r.tokens.input; a.cached += r.tokens.cachedInput || 0; a.output += r.tokens.output;
    known.set(k, a);
  }

  const added = [];
  for (const [k, a] of actual) {
    const seen = known.get(k) || { calls: 0, input: 0, cached: 0, output: 0 };
    const gap = {
      input: a.input - seen.input,
      cachedInput: Math.max(0, a.cached - seen.cached),
      output: a.output - seen.output,
      reasoning: 0,
    };
    if (gap.output <= 0 && gap.input <= 0) continue;
    const row = {
      at: `${a.day}T23:59:59.000Z`,
      slug: null, postDate: null,
      model: a.model, stage: "untracked", tier: a.tier,
      calls: a.calls - seen.calls, seconds: 0,
      tokens: gap,
      usd: a.tier === "default" ? Number((costOf(a.model, gap, rates) ?? 0).toFixed(4)) : 0,
      note: `reconciled against ${path.basename(csvPath)} - calls the ledger did not record`
        + (a.tier === "default" ? "" : ` (${a.tier}: not billed)`),
    };
    led.runs.push(row);
    added.push(row);
  }
  led.runs.sort((x, y) => (x.at < y.at ? -1 : 1));
  fs.writeFileSync(LEDGER, JSON.stringify(led, null, 2) + "\n");
  return added;
}

/** What the account has spent through this ledger on a given UTC day. */
export function spentOn(day = new Date().toISOString().slice(0, 10)) {
  return load().runs
    .filter((r) => (r.at || "").slice(0, 10) === day)
    .reduce((n, r) => n + (r.usd || 0), 0);
}

export function summary() {
  const led = load();
  const byPost = new Map();
  const byMonth = new Map();

  for (const r of led.runs) {
    const key = r.slug || "(no post)";
    const p = byPost.get(key) || { slug: key, postDate: r.postDate, calls: 0, input: 0, output: 0, seconds: 0, usd: 0, stages: [] };
    p.calls++; p.input += r.tokens.input; p.output += r.tokens.output;
    p.seconds += r.seconds || 0; p.usd += r.usd; p.stages.push(r.stage);
    byPost.set(key, p);

    const m = (r.at || "").slice(0, 7);
    const mm = byMonth.get(m) || { month: m, posts: new Set(), calls: 0, usd: 0, input: 0, output: 0 };
    mm.calls++; mm.usd += r.usd; mm.input += r.tokens.input; mm.output += r.tokens.output;
    if (r.slug) mm.posts.add(r.slug);
    byMonth.set(m, mm);
  }

  return {
    totalUsd: Number([...byPost.values()].reduce((n, p) => n + p.usd, 0).toFixed(4)),
    totalCalls: led.runs.length,
    posts: [...byPost.values()].map((p) => ({ ...p, usd: Number(p.usd.toFixed(4)) }))
      .sort((a, b) => (a.postDate < b.postDate ? 1 : -1)),
    months: [...byMonth.values()].map((m) => ({ ...m, posts: m.posts.size, usd: Number(m.usd.toFixed(4)) }))
      .sort((a, b) => (a.month < b.month ? 1 : -1)),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rec = process.argv.indexOf("--reconcile");
  if (rec !== -1) {
    const csv = process.argv[rec + 1];
    if (!csv) { console.error("usage: node tools/cost-ledger.mjs --reconcile <openai-usage-export.csv>"); process.exit(1); }
    const added = reconcile(csv);
    if (!added.length) { console.log("ledger already matches the export - nothing to add"); process.exit(0); }
    for (const r of added) console.log(`+ ${r.at.slice(0, 10)}  ${r.model}  ${r.calls} untracked call(s)  ${r.tokens.output.toLocaleString()} out  $${r.usd.toFixed(2)}`);
    console.log(`\n${added.length} adjustment row(s) added`);
    process.exit(0);
  }

  const s = summary();
  if (process.argv.includes("--json")) { console.log(JSON.stringify(s, null, 2)); process.exit(0); }
  if (!s.totalCalls) { console.log("ledger is empty - nothing generated since cost tracking was added"); process.exit(0); }

  const usd = (n) => "$" + n.toFixed(2);
  if (process.argv.includes("--by-post")) {
    console.log("date        post                                       calls    in       out     min    cost");
    for (const p of s.posts) {
      console.log(`${(p.postDate || "-").padEnd(11)} ${p.slug.slice(0, 41).padEnd(41)} ${String(p.calls).padStart(5)} ${String(p.input).padStart(7)} ${String(p.output).padStart(9)} ${String(Math.round(p.seconds / 60)).padStart(5)} ${usd(p.usd).padStart(8)}`);
    }
  } else {
    console.log("month     posts  calls        in         out      cost   per post");
    for (const m of s.months) {
      console.log(`${m.month}  ${String(m.posts).padStart(5)} ${String(m.calls).padStart(6)} ${String(m.input).padStart(9)} ${String(m.output).padStart(11)} ${usd(m.usd).padStart(9)} ${usd(m.posts ? m.usd / m.posts : 0).padStart(10)}`);
    }
  }
  console.log(`\ntotal ${usd(s.totalUsd)} over ${s.totalCalls} model call(s)`);
  const r = pricing();
  if (!r.updated) console.log(`\n! rate card in data/model-pricing.json has never been confirmed - costs are estimates`);
}
