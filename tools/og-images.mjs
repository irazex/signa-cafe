#!/usr/bin/env node
// Social cards must be JPEG. Telegram's Bot API refuses WebP outright
// ("failed to get HTTP URL content") and several scrapers still skip it, so
// every story cover gets a 1200x630 JPEG twin under assets/og/ that og:image
// and the Telegram notification point at. Source of truth stays the WebP.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const ogPath = (cover) => "assets/og/" + path.basename(cover).replace(/\.[a-z0-9]+$/i, ".jpg");

export function makeOg(cover, { force = false } = {}) {
  const src = path.join(ROOT, cover);
  const rel = ogPath(cover);
  const out = path.join(ROOT, rel);
  if (!fs.existsSync(src)) return null;
  if (fs.existsSync(out) && !force) return rel;
  fs.mkdirSync(path.dirname(out), { recursive: true });

  execFileSync("python3", ["-c", `
import sys
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
W, H = 1200, 630
im = Image.open(src).convert("RGB")
# cover-crop to the social aspect ratio, centred, so nothing is letterboxed
scale = max(W / im.width, H / im.height)
im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
left, top = (im.width - W) // 2, (im.height - H) // 2
im.crop((left, top, left + W, top + H)).save(out, "JPEG", quality=82, optimize=True, progressive=True)
`, src, out]);
  return rel;
}

// argv[1] has literal spaces, import.meta.url percent-encodes them
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const force = process.argv.includes("--force");
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, "data/stories.json"), "utf8"));
  const covers = new Set(data.posts.map((p) => p.cover).filter(Boolean));
  for (const d of ["assets/photo-breakfast.webp", "assets/hero-interior.webp"]) covers.add(d);
  for (const c of covers) {
    const rel = makeOg(c, { force });
    if (!rel) { console.log(`skip  ${c} (missing)`); continue; }
    const kb = Math.round(fs.statSync(path.join(ROOT, rel)).size / 1024);
    console.log(`ok    ${rel}  ${kb}kb`);
  }
}
