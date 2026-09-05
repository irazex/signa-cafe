#!/usr/bin/env node
// Pulls the real Signa menu out of Syrve and caches it as data/syrve-menu.json.
//
// Three calls, joined on the product id:
//   external-menu/online-content-map  -> photo URL + the guest-facing description
//   external-menu/menu/<id>/items     -> which menu section a dish sits in
//   nomenclature/products             -> price
//
// Why this matters: content.json holds 12 dishes, Syrve holds 231 with photos.
// That is the difference between three months of weekly posts and four years.
//
//   node tools/syrve-menu.mjs                 refresh the cache
//   node tools/syrve-menu.mjs --stats         show what is in the cache
//
// Credentials come from ~/.razex-creds/signa-syrve.json, never from the command
// line. The RPC adapter listens on the VPS only, so set SYRVE_RPC_URL to a
// tunnel when running from a laptop.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "data", "syrve-menu.json");
const RPC = process.env.SYRVE_RPC_URL || "http://127.0.0.1:8300";
const HALL_MENU_ID = process.env.SIGNA_MENU_ID || "5352";

if (process.argv.includes("--stats")) {
  const c = JSON.parse(fs.readFileSync(OUT, "utf8"));
  console.log(`${c.dishes.length} dishes, fetched ${c.fetchedAt}`);
  const byCat = {};
  for (const d of c.dishes) byCat[d.category] = (byCat[d.category] || 0) + 1;
  for (const [k, v] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`);
  process.exit(0);
}

function creds() {
  const f = process.env.SIGNA_SYRVE_CREDS || path.join(os.homedir(), ".razex-creds", "signa-syrve.json");
  if (!fs.existsSync(f)) throw new Error(`missing Syrve credentials file: ${f}`);
  const c = JSON.parse(fs.readFileSync(f, "utf8"));
  for (const k of ["serverUrl", "login", "password"]) if (!c[k]) throw new Error(`${f} is missing "${k}"`);
  return c;
}

async function rpc(pathname, c) {
  const res = await fetch(`${RPC}${pathname}`, {
    headers: {
      "X-Syrve-Server-Url": c.serverUrl,
      "X-Syrve-Login": c.login,
      "X-Syrve-Password": c.password,
    },
    signal: AbortSignal.timeout(300000),
  });
  if (!res.ok) throw new Error(`${pathname} -> HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

// Syrve names are shouted ("CHICKEN HOT PLATE"), which reads badly in prose.
function titleCase(s) {
  const KEEP = /^(BBQ|CBD|VIP|XL|XXL|USA|UK|NY|PCS|ML|GR|KG)$/;
  return String(s).trim().toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\s(]+/g, (w) => (KEEP.test(w.toUpperCase()) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)));
}

const main = async () => {
  const c = creds();
  console.log(`syrve: ${c.serverUrl} via ${RPC}`);

  const [content, items, products] = await Promise.all([
    rpc("/rpc/external-menu/online-content-map", c),
    rpc(`/rpc/external-menu/menu/${HALL_MENU_ID}/items`, c),
    rpc("/rpc/nomenclature/products", c),
  ]);

  const contentMap = content.data || {};
  const sectionOf = new Map((items.data || []).filter((i) => !i.isHidden).map((i) => [i.iikoItemId, i.category]));
  const productOf = new Map((products.data || products || []).map((p) => [p.id, p]));

  const dishes = [];
  for (const [id, info] of Object.entries(contentMap)) {
    const p = productOf.get(id);
    const price = Number(p?.defaultSalePrice || 0);
    // A dish with no photo, no description or no price cannot carry a post.
    if (!info.imageUrl || !info.description || !price) continue;
    if (p?.isDeleted) continue;

    dishes.push({
      id,
      name: titleCase(info.name || p?.name || ""),
      rawName: info.name,
      price,
      priceLabel: `${price.toLocaleString("en-US").replace(/,/g, " ")} IDR`,
      category: sectionOf.get(id) || p?.categoryName || "Menu",
      desc: String(info.description).trim(),
      imageUrl: info.imageUrl,
      code: p?.code || null,
    });
  }

  dishes.sort((a, b) => a.name.localeCompare(b.name));
  fs.writeFileSync(OUT, JSON.stringify({ fetchedAt: new Date().toISOString(), source: c.serverUrl, dishes }, null, 2) + "\n");
  console.log(`${dishes.length} dishes with photo, description and price -> data/syrve-menu.json`);
};

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
