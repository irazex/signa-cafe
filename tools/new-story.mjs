#!/usr/bin/env node
/**
 * tools/new-story.mjs — scaffold next week's post, or check the ones you have.
 *
 *   node tools/new-story.mjs "Napoleon cake with Nutella"
 *   node tools/new-story.mjs "Salmon poke bowl" --date 2026-09-18 --cover assets/menu-07-big-salmon-poke-bowl.webp
 *   node tools/new-story.mjs --check          # validate every post, no changes
 *
 * Writes a skeleton into data/stories.json with the date set to the next free
 * Thursday, then you (or Claude) fill in the prose. Publishing is just
 * uploading data/stories.json — story.php renders it, and sitemap.xml,
 * feed.xml and llms.txt pick it up on their own.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = join(ROOT, "data/stories.json");
const argv = process.argv.slice(2);
const flag = (name, def = null) => {
  const i = argv.indexOf("--" + name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : def;
};

const data = JSON.parse(readFileSync(FILE, "utf8"));
const posts = data.posts || [];

// ---------- --check ----------
if (argv.includes("--check")) {
  let bad = 0;
  const seen = new Set();
  for (const p of posts) {
    const err = [];
    if (!/^[a-z0-9-]+$/.test(p.slug || "")) err.push("slug must be a-z, digits and dashes");
    if (seen.has(p.slug)) err.push("duplicate slug");
    seen.add(p.slug);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date || "")) err.push("date must be YYYY-MM-DD");
    for (const l of ["en", "ru"]) {
      const b = p[l];
      if (!b || !b.title) { if (l === "en") err.push("missing English version"); continue; }
      if (!b.description) err.push(`${l}: no meta description (Google shows this)`);
      else if (b.description.length > 165) err.push(`${l}: description ${b.description.length} chars — Google truncates past ~160`);
      if (!b.keywords) err.push(`${l}: no keywords`);
      if (!(b.blocks || []).length) err.push(`${l}: no body text`);
      if (!(b.faq || []).length) err.push(`${l}: no FAQ — you lose the rich-snippet slot`);
      if (!b.coverAlt) err.push(`${l}: no image alt text`);
      const words = (b.blocks || []).flatMap((x) => x.p || []).join(" ").split(/\s+/).length;
      if (words < 300) err.push(`${l}: only ~${words} words — thin for ranking, aim for 600+`);
      const local = /nusa dua|ungasan|bukit|benoa|jimbaran|kampial|pecatu|нуса дуа|унгасан|букит|беноа|джимбаран|кампиал/i;
      if (!local.test(JSON.stringify(b))) err.push(`${l}: no local place name — the whole point is local SEO`);
    }
    if (err.length) { bad++; console.log(`\n✗ ${p.slug} (${p.date})`); err.forEach((e) => console.log(`    - ${e}`)); }
    else console.log(`✓ ${p.slug} (${p.date})`);
  }
  console.log(`\n${posts.length} post(s), ${bad} with warnings.`);
  process.exit(0);
}

// ---------- scaffold ----------
const name = argv.find((a) => !a.startsWith("--"));
if (!name) {
  console.error('Usage: node tools/new-story.mjs "Dish name" [--date YYYY-MM-DD] [--cover assets/x.webp]\n       node tools/new-story.mjs --check');
  process.exit(1);
}

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-");

// Next Thursday that is not already taken.
function nextSlot() {
  const taken = new Set(posts.map((p) => p.date));
  const d = new Date();
  d.setDate(d.getDate() + ((4 - d.getDay() + 7) % 7 || 7));
  for (let i = 0; i < 52; i++) {
    const iso = d.toISOString().slice(0, 10);
    if (!taken.has(iso)) return iso;
    d.setDate(d.getDate() + 7);
  }
  return new Date().toISOString().slice(0, 10);
}

let slug = slugify(name);
if (posts.some((p) => p.slug === slug)) slug += "-" + Date.now().toString(36).slice(-4);

const post = {
  slug,
  date: flag("date", nextSlot()),
  cover: flag("cover", "assets/photo-breakfast.webp"),
  dish: { name, price: "", menuUrl: "https://signa.dishi.rest/" },
  tags: ["nusa dua"],
  en: {
    title: `${name}: TODO — the hook`,
    seoTitle: `${name} in Nusa Dua — the story behind Signa Cafe's version`,
    description: "TODO — one sentence, under 160 characters, mentioning Nusa Dua or the Bukit.",
    keywords: `${name.toLowerCase()} Bali, ${name.toLowerCase()} Nusa Dua, Signa Cafe, Ungasan, Benoa, Jimbaran, Bukit Bali`,
    category: "TODO",
    coverAlt: `${name} at Signa Cafe, Nusa Dua, Bali`,
    lead: "TODO — the one line that makes someone keep reading.",
    blocks: [
      { h: "Where it comes from", p: ["TODO"] },
      { h: "How it is actually made", p: ["TODO"] },
      { h: "Why it is on a Bali menu", p: ["TODO — the local paragraph. Nusa Dua, Ungasan, the Bukit."] },
    ],
    facts: [["Dish", name], ["Price", "TODO"], ["Served", "08:00 – 23:00, every day"],
            ["Where", "Signa Cafe, Jl. Raya Kampial, Benoa, Nusa Dua"]],
    faq: [{ q: `Where can I eat ${name.toLowerCase()} in Nusa Dua?`, a: "TODO" }],
  },
  ru: { title: "", seoTitle: "", description: "", keywords: "", category: "", coverAlt: "", lead: "", blocks: [], facts: [], faq: [] },
};

data.posts = [post, ...posts];
data.version = new Date().toISOString().slice(0, 10).replace(/-/g, "") + "a";
writeFileSync(FILE, JSON.stringify(data, null, 2) + "\n");

console.log(`Added "${slug}" for ${post.date} to data/stories.json.

Next:
  1. Fill in the TODOs (en, then ru).
  2. node tools/new-story.mjs --check
  3. Preview:  php -S 127.0.0.1:8099 -t . tools/dev-router.php  →  http://127.0.0.1:8099/stories/${slug}
  4. Upload data/stories.json — sitemap.xml, feed.xml and llms.txt update themselves.`);
