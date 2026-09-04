#!/usr/bin/env node
// Fills the Menu JSON-LD in menu.html with the real dishes from content.json.
// The block used to list five empty MenuSections, which tells Google and the AI
// crawlers nothing. Now every dish carries a price, an image and a diet flag.
//
//   node tools/build-menu-schema.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://signa.cafe";

const content = JSON.parse(fs.readFileSync(path.join(ROOT, "content.json"), "utf8"));
const stories = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "stories.json"), "utf8"));

// "93k" on a tile means 93000 IDR in an offer.
const toAmount = (price) => {
  const m = String(price).match(/^(\d+(?:[.,]\d+)?)\s*k$/i);
  return m ? String(Math.round(parseFloat(m[1].replace(",", ".")) * 1000)) : String(price).replace(/[^\d]/g, "");
};

const CAT = { breakfast: "Breakfast", pizza: "Pizza", pasta: "Pasta", main: "Mains", drinks: "Drinks", dessert: "Dessert" };

// A dish that has a story gets linked to it - internal links are what tie the
// menu and the archive into one topic cluster.
const storyFor = (dish) => stories.posts.find((p) => p.cover === dish.img || p.dish?.menuId === dish.id);

const sections = new Map();
for (const d of content.menu || []) {
  const name = CAT[d.cat] || (d.cat ? d.cat[0].toUpperCase() + d.cat.slice(1) : "Menu");
  if (!sections.has(name)) sections.set(name, []);

  const item = {
    "@type": "MenuItem",
    name: d.title,
    ...(d.desc ? { description: d.desc } : {}),
    ...(d.img ? { image: `${BASE}/${d.img}` } : {}),
    offers: { "@type": "Offer", price: toAmount(d.price), priceCurrency: "IDR", availability: "https://schema.org/InStock" },
  };
  if (d.tags?.includes("veg")) item.suitableForDiet = "https://schema.org/VegetarianDiet";

  const st = storyFor(d);
  if (st) item.subjectOf = { "@type": "BlogPosting", "@id": `${BASE}/stories/${st.slug}`, url: `${BASE}/stories/${st.slug}` };

  sections.get(name).push(item);
}

const menu = {
  "@context": "https://schema.org",
  "@type": "Menu",
  name: "Signa Cafe Menu",
  url: `${BASE}/menu.html`,
  inLanguage: "en",
  hasMenuSection: [...sections].map(([name, items]) => ({ "@type": "MenuSection", name, hasMenuItem: items })),
};

const file = path.join(ROOT, "menu.html");
let html = fs.readFileSync(file, "utf8");
const re = /<script type="application\/ld\+json">\s*(\{[^]*?"@type":\s*"Menu"[^]*?\})\s*<\/script>/;
if (!re.test(html)) { console.error('no Menu JSON-LD block found in menu.html'); process.exit(1); }

html = html.replace(re, `<script type="application/ld+json">\n${JSON.stringify(menu, null, 2)}\n</script>`);
fs.writeFileSync(file, html);

const count = [...sections.values()].reduce((n, a) => n + a.length, 0);
console.log(`menu.html: ${sections.size} sections, ${count} dishes, ${[...sections.values()].flat().filter((i) => i.subjectOf).length} linked to stories`);
