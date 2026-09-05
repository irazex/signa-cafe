#!/usr/bin/env node
// Tells the owner in Telegram that a new story went live, so he can read it
// and remember it exists. Chat: "SIGNA AI. Managers" (-1003008104766), the
// forum topic the owner picked. Token comes from the environment - it lives in
// the VPS env files next to every other inmyrest_report_bot consumer and is
// never written into this repo.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ogPath } from "./og-images.mjs";
import { gbpPost } from "./gbp-post.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHAT = process.env.SIGNA_TG_CHAT || "-1003008104766";
const THREAD = process.env.SIGNA_TG_THREAD || "12613";
const SITE = "https://signa.cafe";

function token() {
  const t = process.env.INMYREST_REPORT_BOT_TOKEN || process.env.SIGNA_TG_TOKEN;
  if (t) return t.trim();
  // fall back to the same env files the other reporters read
  for (const f of ["/home/razex/ai-cashier-report/.env", "/home/razex/syrve-analytics/.env"]) {
    if (!fs.existsSync(f)) continue;
    const m = fs.readFileSync(f, "utf8").match(/^INMYREST_REPORT_BOT_TOKEN=(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  throw new Error("no bot token: set INMYREST_REPORT_BOT_TOKEN");
}

const esc = (s) => String(s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]);
const url = (slug, lang) => `${SITE}/stories${lang === "en" ? "" : "/" + lang}/${slug}`;

function build(post) {
  const en = post.en || {};
  const langs = ["en", "ru", "id"].filter((l) => post[l]);
  const ru = post.ru || en;
  const words = (b) => (b.blocks || []).flatMap((x) => x.p).join(" ").split(/\s+/).length;

  const lines = [
    "🍳 <b>Новый пост на signa.cafe</b>",
    "",
    `<b>${esc(ru.title || en.title)}</b>`,
    ru.description ? esc(ru.description) : "",
    "",
    `<a href="${url(post.slug, "ru")}">Читать по-русски</a>`,
    langs.filter((l) => l !== "ru").map((l) => `<a href="${url(post.slug, l)}">${l.toUpperCase()}</a>`).join(" · "),
    "",
    `<i>${post.date} · ${langs.length} яз. · ~${words(ru)} слов</i>`,
  ];
  return lines.filter((l) => l !== "").join("\n");
}

async function send(text, photo) {
  const t = token();
  const base = `https://api.telegram.org/bot${t}`;
  const common = { chat_id: CHAT, message_thread_id: Number(THREAD), parse_mode: "HTML" };

  let res;
  if (photo) {
    res = await fetch(`${base}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...common, photo, caption: text }),
    });
    const j = await res.json();
    if (j.ok) return j;
    console.error(`sendPhoto failed (${j.description}), falling back to text`);
  }
  res = await fetch(`${base}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...common, text, link_preview_options: { is_disabled: photo ? true : false } }),
  });
  const j = await res.json();
  if (!j.ok) throw new Error(`telegram: ${j.description}`);
  return j;
}

const args = process.argv.slice(2);
const arg = (n) => { const i = args.indexOf(`--${n}`); return i === -1 ? null : args[i + 1]; };

const data = JSON.parse(fs.readFileSync(path.join(ROOT, "data/stories.json"), "utf8"));
const slug = arg("slug");
const post = slug ? data.posts.find((p) => p.slug === slug) : data.posts[0];
if (!post) { console.error(`no post${slug ? ` with slug "${slug}"` : ""}`); process.exit(1); }

const text = build(post);
// Telegram rejects WebP in sendPhoto, so point at the JPEG twin
const ogRel = post.cover ? ogPath(post.cover) : null;
const cover = ogRel && fs.existsSync(path.join(ROOT, ogRel)) ? `${SITE}/${ogRel}` : null;

if (args.includes("--dry-run")) {
  console.log(`chat ${CHAT} thread ${THREAD}`);
  console.log(cover ? `photo: ${cover}` : "no cover photo");
  console.log("---\n" + text.replace(/<[^>]+>/g, ""));
  process.exit(0);
}

async function main() {
  const j = await send(text, cover);
  console.log(`sent, message ${j.result.message_id}`);

  // Second message: the Google Business Profile post, ready to paste. Sent
  // apart from the announcement so it can be copied in one tap without the
  // surrounding chatter. Its failure never fails the run.
  if (!args.includes("--no-gbp")) {
    const g = gbpPost(post, "en");
    if (g) {
      const body =
        "📍 <b>Пост для Google Business Profile</b> - скопировать и опубликовать\n" +
        `<i>фото: ${esc(g.photo || "-")} · кнопка Learn more -> ${esc(g.cta.url)}</i>\n\n` +
        `<pre>${esc(g.summary)}</pre>`;
      try {
        const k = await send(body, null);
        console.log(`gbp draft sent, message ${k.result.message_id}`);
      } catch (e) {
        console.error(`gbp draft not sent: ${e.message}`);
      }
    }
  }
}

main().catch((e) => { console.error(`FAILED: ${e.message}`); process.exit(1); });
