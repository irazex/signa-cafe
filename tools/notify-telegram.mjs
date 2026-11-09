#!/usr/bin/env node
// Tells the owner in Telegram that a new story went live, so he can read it
// and remember it exists. Chat: "SIGNA AI. Managers" (-1003008104766), the
// forum topic the owner picked. Token comes from the environment - it lives in
// the VPS env files next to every other inmyrest_report_bot consumer and is
// never written into this repo.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { ogPath } from "./og-images.mjs";
import { gbpPost } from "./gbp-post.mjs";
import "./story-network.mjs";
import { baliDate } from "./story-schedule.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHAT = process.env.SIGNA_TG_CHAT || "-1003008104766";
const THREAD = process.env.SIGNA_TG_THREAD || "12613";
const SITE = "https://signa.cafe";

function token() {
  const t = process.env.INMYREST_REPORT_BOT_TOKEN || process.env.SIGNA_TG_TOKEN;
  if (t) return t.trim();
  // fall back to the same env files the other reporters read
  for (const f of ["/home/razex/syrve-analytics/.env", "/home/razex/cashier-app/.env"]) {
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
    const form = new FormData();
    for (const [k, v] of Object.entries(common)) form.set(k, String(v));
    form.set("caption", text);
    form.set("photo", new Blob([fs.readFileSync(photo)], { type: "image/jpeg" }), path.basename(photo));
    res = await fetch(`${base}/sendPhoto`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(45000),
    });
    const j = await res.json();
    if (j.ok) return j;
    console.error(`sendPhoto failed (${j.description}), falling back to text`);
  }
  res = await fetch(`${base}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...common, text, link_preview_options: { is_disabled: photo ? true : false } }),
    signal: AbortSignal.timeout(30000),
  });
  const j = await res.json();
  if (!j.ok) throw new Error(`telegram: ${j.description}`);
  return j;
}

const args = process.argv.slice(2);
const arg = (n) => { const i = args.indexOf(`--${n}`); return i === -1 ? null : args[i + 1]; };

const slug = arg("slug");
const failure = arg("failure");
const data = failure ? null : JSON.parse(fs.readFileSync(path.join(ROOT, "data/stories.json"), "utf8"));
const post = failure ? null : slug ? data.posts.find((p) => p.slug === slug) : data.posts[0];
if (!post && !failure) { console.error(`no post${slug ? ` with slug "${slug}"` : ""}`); process.exit(1); }

const text = failure
  ? `⚠️ <b>Signa Cafe: сбой еженедельных историй</b>\nЭтап: ${esc(failure)}\n${esc((arg("details") || "Новый выпуск не подготовлен. Требуется проверка.").slice(0, 700))}`
  : build(post);
// Telegram rejects WebP in sendPhoto, so point at the JPEG twin
const ogRel = post?.cover ? ogPath(post.cover) : null;
const cover = ogRel && fs.existsSync(path.join(ROOT, ogRel)) ? path.join(ROOT, ogRel) : null;

if (args.includes("--dry-run")) {
  // Also prove the credential resolves and the bot still sees the chat - the
  // cron runs unattended, and "token missing" is worth learning now.
  if (args.includes("--check-auth")) try {
    const r = await fetch(`https://api.telegram.org/bot${token()}/getChat?chat_id=${CHAT}`, { signal: AbortSignal.timeout(30000) }).then((x) => x.json());
    console.log(r.ok ? `auth OK -> ${r.result.title}` : `auth FAILED: ${r.description}`);
  } catch (e) {
    console.log(`auth FAILED: ${e.message}`);
  }
  console.log(`chat ${CHAT} thread ${THREAD}`);
  console.log(cover ? `photo: ${cover}` : "no cover photo");
  console.log("---\n" + text.replace(/<[^>]+>/g, ""));
  process.exit(0);
}

async function main() {
  // Record an attempted announcement before sending. An interrupted or unknown
  // Telegram result is not automatically replayed on the next cron run.
  const stateKey = failure ? `failure-${baliDate()}-${crypto.createHash("sha256").update(failure).digest("hex").slice(0, 12)}`
    : args.includes("--once") && post ? `announced-${post.slug}` : null;
  const stateFile = stateKey ? path.join(ROOT, ".story-runtime", `${stateKey}.json`) : null;
  if (stateFile && fs.existsSync(stateFile)) {
    const state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    if (state.status === "sent") { console.log(`already sent ${stateKey}`); return; }
    throw new Error(`notification result unknown for ${stateKey}; check Telegram before resending`);
  }
  if (stateFile) {
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify({ status: "sending", at: new Date().toISOString() }), { flag: "wx", mode: 0o600 });
  }
  const j = await send(text, cover);
  if (stateFile) fs.writeFileSync(stateFile, JSON.stringify({ status: "sent", messageId: j.result.message_id, at: new Date().toISOString() }));
  console.log(`sent, message ${j.result.message_id}`);

  // Second message: the Google Business Profile post, ready to paste. Sent
  // apart from the announcement so it can be copied in one tap without the
  // surrounding chatter. Its failure never fails the run.
  if (post && !args.includes("--no-gbp")) {
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
