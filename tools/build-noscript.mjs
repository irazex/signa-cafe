#!/usr/bin/env node
/**
 * tools/build-noscript.mjs
 *
 * THE PROBLEM
 * index/menu/about/visit are React + Babel transpiled in the browser. Fetch any
 * of them without JavaScript and the body contains ~280 characters: a stub
 * <noscript> line and an empty <div id="root">. Googlebot renders JS and copes.
 * AI crawlers — GPTBot, ClaudeBot, PerplexityBot, CCBot, Amazonbot — do not.
 * They index the empty shell.
 *
 * THE FIX
 * Write the real page content into <noscript> as a genuine no-JS fallback:
 * headings, prices, hours, address, FAQ answers, internal links. Crawlers read
 * it; JS users never see it. It is generated from content.json so the prices in
 * the fallback can never drift away from the prices in the app.
 *
 * Re-run after editing content.json:   node tools/build-noscript.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const c = JSON.parse(readFileSync(join(ROOT, "content.json"), "utf8"));
const s = c.site;

const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const li = (arr) => arr.map((x) => `    <li>${x}</li>`).join("\n");

const NAV = `  <nav aria-label="Site">
    <a href="/index.html">Home</a> ·
    <a href="/menu.html">Menu</a> ·
    <a href="/stories">Stories — one dish, one story, every week</a> ·
    <a href="/about.html">The place</a> ·
    <a href="/visit.html">Visit &amp; contact</a> ·
    <a href="${s.orderUrl}">Order online</a>
  </nav>`;

const CONTACT = `  <h2>Find us</h2>
  <p>
    <b>Signa Cafe</b>, ${esc(s.addressFull)}.
    Open ${s.hoursOpen}–${s.hoursClose} every day; kitchen closes ${s.lastOrder}; pizza from ${s.pizzaFrom}.
    Phone and WhatsApp <a href="tel:${s.phone.replace(/\s/g, "")}">${esc(s.phone)}</a>,
    email <a href="mailto:${s.email}">${esc(s.email)}</a>,
    Instagram <a href="${s.instagramUrl}">${esc(s.instagram)}</a>.
    Google rating ${s.rating} from ${s.reviewCount}+ reviews. Free parking, free WiFi, pet-friendly terrace.
    Ten minutes from Ungasan, fifteen from Jimbaran, on the Bukit peninsula in Benoa.
  </p>`;

const menuItems = c.menu.map(
  (m) => `<b>${esc(m.title)}</b> — ${esc(m.price)} IDR. ${esc(m.desc || "")}`
);
const promoItems = c.promos.map((p) => `<b>${esc(p.title)}</b> (${esc(p.tag)}) — ${esc(p.body)}`);
const faqItems = c.faq.map((f) => `<b>${esc(f.q)}</b> ${esc(f.a)}`);

const PAGES = {
  "index.html": `  <h1>Signa Cafe — a neighbourhood all-day cafe in Nusa Dua, Bali</h1>
  <p>
    Family-run since ${s.since}. Specialty coffee, pizza, fresh pasta, all-day breakfast
    and an in-house bakery on Jl. Raya Kampial in Benoa, Nusa Dua — the Bukit peninsula,
    minutes from Ungasan, Jimbaran and Tanjung Benoa. Work-friendly tables, free fast WiFi,
    free parking. Eat. Meet. Create.
  </p>
${CONTACT}
  <h2>On the menu</h2>
  <ul>
${li(menuItems)}
  </ul>
  <h2>Regular offers</h2>
  <ul>
${li(promoItems)}
  </ul>
  <h2>Questions people ask</h2>
  <ul>
${li(faqItems)}
  </ul>
${NAV}`,

  "menu.html": `  <h1>Signa Cafe menu — Nusa Dua, Bali</h1>
  <p>
    All-day kitchen: specialty coffee and breakfast from ${s.hoursOpen}, pizza from ${s.pizzaFrom},
    fresh pasta, salads, bowls and shared plates until ${s.lastOrder}. Prices in IDR.
    The full live menu — 180+ items with photos and current availability — is at
    <a href="${s.orderUrl}">${esc(s.orderUrl)}</a>. Delivery via GoFood and GrabFood
    across Nusa Dua, Benoa, Ungasan and Jimbaran.
  </p>
  <h2>Selected dishes and prices</h2>
  <ul>
${li(menuItems)}
  </ul>
  <h2>Regular offers</h2>
  <ul>
${li(promoItems)}
  </ul>
${CONTACT}
${NAV}`,

  "about.html": `  <h1>The place — Signa Cafe, Nusa Dua, Bali</h1>
  <p>
    Signa opened in ${s.since} with one idea: a single room that works from the first morning
    coffee to the last evening plate. A place for laptop mornings and slow lunches, for friends
    catching up, and for anyone who wants good coffee and a reliable table in Nusa Dua.
  </p>
  <p>
    The coffee is specialty-grade. The kitchen is full and runs all day — breakfast that does not
    stop at noon, pizza from the afternoon, pasta and shared plates into the evening. It is a
    neighbourhood cafe on the Bukit, not a destination restaurant.
  </p>
  <p>
    Free fast WiFi and outlets at most tables make Signa a favourite for remote work, especially
    on weekday mornings. By evening the same room turns into a relaxed spot for dinner and drinks.
    Free on-site parking for bikes and cars. Outdoor seating is pet-friendly.
  </p>
${CONTACT}
${NAV}`,

  "visit.html": `  <h1>Visit Signa Cafe — map, hours and contact, Nusa Dua, Bali</h1>
${CONTACT}
  <h2>Questions people ask</h2>
  <ul>
${li(faqItems)}
  </ul>
  <h2>Ordering and delivery</h2>
  <p>
    Order online at <a href="${s.orderUrl}">${esc(s.orderUrl)}</a>, or through GoFood and GrabFood.
    Walk-ins are always welcome; for groups of four or more, WhatsApp the manager.
  </p>
${NAV}`,
};

const BEGIN = "<!-- NOSCRIPT-SEO:BEGIN (generated by tools/build-noscript.mjs — edit content.json, not this) -->";
const END = "<!-- NOSCRIPT-SEO:END -->";

let changed = 0;
for (const [file, inner] of Object.entries(PAGES)) {
  const path = join(ROOT, file);
  const html = readFileSync(path, "utf8");
  const block = `${BEGIN}\n<noscript>\n${inner}\n</noscript>\n${END}`;

  let next;
  const marked = new RegExp(`${BEGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${END}`);
  if (marked.test(html)) {
    next = html.replace(marked, block);
  } else if (/<noscript>[\s\S]*?<\/noscript>/.test(html)) {
    next = html.replace(/<noscript>[\s\S]*?<\/noscript>/, block);
  } else {
    next = html.replace(/<div id="root">/, `${block}\n\n<div id="root">`);
  }

  if (next !== html) {
    writeFileSync(path, next);
    changed++;
    console.log(`  ${file.padEnd(12)} noscript → ${inner.length} chars`);
  } else {
    console.log(`  ${file.padEnd(12)} unchanged`);
  }
}
console.log(`\n${changed} file(s) updated.`);
