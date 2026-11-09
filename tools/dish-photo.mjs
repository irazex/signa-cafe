// Downloads a dish photo from the Syrve CDN and stores it as a webp in
// assets/stories/. Pillow does the conversion because it is the one image
// library present on both the laptop and the VPS.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import "./story-network.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const PHOTO_DIR = path.join(ROOT, "assets", "stories");

const PY = `
import sys
from PIL import Image, ImageOps
src, dst, max_w = sys.argv[1], sys.argv[2], int(sys.argv[3])
im = Image.open(src)
im = ImageOps.exif_transpose(im)
if im.mode in ("RGBA", "LA", "P"):
    im = im.convert("RGB")
if im.width > max_w:
    im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
im.save(dst, "WEBP", quality=80, method=6)
print(f"{im.width}x{im.height}")
`;

// Returns the dish's own verified cover. A failure must never select a generic
// breakfast picture. Only transient network/429/5xx failures get bounded retries.
export async function fetchDishPhoto(imageUrl, slug, { maxWidth = 1600 } = {}) {
  if (!imageUrl) return null;
  fs.mkdirSync(PHOTO_DIR, { recursive: true });

  let buf;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(imageUrl, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) {
        await res.body?.cancel();
        const e = new Error(`HTTP ${res.status}`);
        e.permanent = res.status !== 429 && res.status < 500;
        throw e;
      }
      buf = Buffer.from(await res.arrayBuffer());
      break;
    } catch (e) {
      if (e.permanent || attempt === 3) {
        throw new Error(`dish photo from ${new URL(imageUrl).hostname} failed: ${e.message} (${e.cause?.code || "no network detail"}); no paid generation started`);
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
  if (buf.length < 1024) throw new Error(`photo ${imageUrl} is only ${buf.length} bytes`);

  const tmp = path.join(os.tmpdir(), `signa-${slug}-${Date.now()}${path.extname(new URL(imageUrl).pathname) || ".img"}`);
  fs.writeFileSync(tmp, buf);
  const dest = path.join(PHOTO_DIR, `${slug}.webp`);
  try {
    const dims = execFileSync("python3", ["-c", PY, tmp, dest, String(maxWidth)], { encoding: "utf8" }).trim();
    const kb = Math.round(fs.statSync(dest).size / 1024);
    return { file: path.relative(ROOT, dest), dims, kb };
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}
