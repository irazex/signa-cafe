#!/usr/bin/env node
// Rename a published story without breaking its URL.
//
// The old slug is not deleted - it moves into the post's `aliases` array, and
// story.php 301s from it to the new address (see st_find_alias in
// lib/stories.php). Anything already indexed by Google, cited by an AI crawler,
// pinged to IndexNow or pasted into a chat keeps working.
//
//   node tools/rename-story.mjs <old-slug> <new-slug>
//   node tools/rename-story.mjs --strip kampial      rename every slug containing it
//   node tools/rename-story.mjs --list               show slugs and their aliases
//
// Deploy afterwards: the sitemap, RSS and llms.txt regenerate from the file.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STORE = path.join(ROOT, "data/stories.json");

const args = process.argv.slice(2);
const has = (f) => args.includes(`--${f}`);
const flag = (f) => { const i = args.indexOf(`--${f}`); return i < 0 ? null : args[i + 1]; };

const store = JSON.parse(fs.readFileSync(STORE, "utf8"));
const posts = store.posts || [];
const write = () => {
  store.version = new Date().toISOString().slice(0, 10).replace(/-/g, "") + "r";
  fs.writeFileSync(STORE, JSON.stringify(store, null, 2) + "\n");
};

if (has("list")) {
  for (const p of posts) {
    console.log(`${p.date}  ${p.slug}${p.aliases?.length ? `\n            was: ${p.aliases.join(", ")}` : ""}`);
  }
  process.exit(0);
}

/** Returns false when nothing changed, so callers can report honestly. */
function rename(oldSlug, newSlug) {
  const post = posts.find((p) => p.slug === oldSlug);
  if (!post) { console.error(`no post at slug "${oldSlug}"`); return false; }
  if (oldSlug === newSlug) { console.error(`"${oldSlug}" is already that`); return false; }
  if (!/^[a-z0-9-]+$/.test(newSlug)) { console.error(`"${newSlug}" is not a valid slug (a-z 0-9 -)`); return false; }

  const clash = posts.find((p) => p.slug === newSlug || (p.aliases || []).includes(newSlug));
  if (clash) { console.error(`"${newSlug}" is already used by ${clash.slug}`); return false; }

  post.aliases = [...new Set([...(post.aliases || []), oldSlug])];
  post.slug = newSlug;
  console.log(`  ${oldSlug}\n    -> ${newSlug}   (old address 301s here)`);
  return true;
}

const strip = flag("strip");
let changed = 0;

if (strip) {
  // Drop the word and tidy the leftover hyphens.
  const targets = posts.filter((p) => p.slug.includes(strip));
  if (!targets.length) { console.log(`no slug contains "${strip}"`); process.exit(0); }
  for (const p of targets) {
    const next = p.slug.replace(new RegExp(`-?${strip}-?`, "g"), "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    if (rename(p.slug, next)) changed++;
  }
} else {
  const [oldSlug, newSlug] = args.filter((a) => !a.startsWith("--"));
  if (!oldSlug || !newSlug) {
    console.error("usage: node tools/rename-story.mjs <old-slug> <new-slug>\n       node tools/rename-story.mjs --strip <word>\n       node tools/rename-story.mjs --list");
    process.exit(1);
  }
  if (rename(oldSlug, newSlug)) changed++;
}

if (!changed) process.exit(1);
write();
console.log(`\n${changed} post(s) renamed -> data/stories.json`);
console.log("next: node tools/build-menu-schema.mjs && tools/deploy-stories.sh");
