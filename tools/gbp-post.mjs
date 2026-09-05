#!/usr/bin/env node
// Turns a story into a Google Business Profile "What's new" post.
//
// Why this is not an API call yet: the Business Profile APIs are gated - you
// apply for access with a Google Cloud project and wait for approval, and the
// quota only arrives afterwards. Until that lands, this prints a post that is
// already inside every GBP limit (1500 chars, one photo, one CTA) so publishing
// it is a paste and a tap on the phone. When access is granted, the same text
// goes straight into localPosts.create - only send() below has to change.
//
//   node tools/gbp-post.mjs [--slug <slug>] [--lang en|ru|id]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://signa.cafe";
const LIMIT = 1500;

export function gbpPost(post, lang = "en") {
  const b = post[lang] || post.en;
  if (!b) return null;

  const paras = (b.blocks || []).flatMap((x) => x.p);
  const url = `${SITE}/stories${lang === "en" ? "" : "/" + lang}/${post.slug}`;

  // Google truncates hard at ~250 chars in the feed, so the hook has to land
  // first. Take the description, then as many whole paragraphs as fit.
  const parts = [b.description?.trim()].filter(Boolean);
  for (const p of paras) {
    const candidate = [...parts, p.trim()].join("\n\n");
    if (candidate.length + url.length + 2 > LIMIT) break;
    parts.push(p.trim());
  }

  const tail = { en: "Full story:", ru: "Читать целиком:", id: "Cerita lengkap:" }[lang] || "Full story:";
  let text = `${parts.join("\n\n")}\n\n${tail} ${url}`;
  if (text.length > LIMIT) text = text.slice(0, LIMIT - url.length - tail.length - 6).trimEnd() + `…\n\n${tail} ${url}`;

  return {
    summary: text,
    photo: post.cover ? `${SITE}/assets/og/${path.basename(post.cover).replace(/\.[a-z0-9]+$/i, ".jpg")}` : null,
    cta: { actionType: "LEARN_MORE", url },
    language: lang,
    chars: text.length,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const arg = (n) => { const i = args.indexOf(`--${n}`); return i === -1 ? null : args[i + 1]; };
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, "data/stories.json"), "utf8"));
  const slug = arg("slug");
  const post = slug ? data.posts.find((p) => p.slug === slug) : data.posts[0];
  if (!post) { console.error("no such post"); process.exit(1); }

  for (const lang of arg("lang") ? [arg("lang")] : ["en"]) {
    const g = gbpPost(post, lang);
    if (!g) { console.error(`no ${lang} version`); continue; }
    console.log(`--- ${lang.toUpperCase()} (${g.chars}/${LIMIT} chars) ---`);
    console.log(g.summary);
    console.log(`\nphoto: ${g.photo}\nbutton: Learn more -> ${g.cta.url}\n`);
  }
}
