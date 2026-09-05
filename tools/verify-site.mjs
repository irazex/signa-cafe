#!/usr/bin/env node
// Puts Search Console / Bing Webmaster ownership proofs on the site.
//
//   node tools/verify-site.mjs --google <token>            HTML-tag method
//   node tools/verify-site.mjs --google-file googleXXX.html   file method
//   node tools/verify-site.mjs --bing <token>              BingSiteAuth.xml
//   ... --deploy                                           also upload over FTP
//
// The meta tag goes into every HTML entry point AND into lib/stories.php, so
// the PHP-rendered /stories pages carry it too - Google checks whichever URL it
// happens to fetch, and a property verified on one page counts for the domain.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const arg = (n) => { const i = args.indexOf(`--${n}`); return i === -1 ? null : args[i + 1]; };

const PAGES = ["index.html", "menu.html", "about.html", "visit.html"];
const written = [];

function putMeta(name, content) {
  const tag = `<meta name="${name}" content="${content}" />`;
  const re = new RegExp(`<meta name="${name}"[^>]*/?>\\s*`, "g");

  for (const f of PAGES) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    let s = fs.readFileSync(p, "utf8").replace(re, "");
    // right after the canonical link, which every page has
    s = s.replace(/(<link rel="canonical"[^>]*>)/, `$1\n${tag}`);
    fs.writeFileSync(p, s);
    written.push(f);
  }

  const lib = path.join(ROOT, "lib/stories.php");
  let s = fs.readFileSync(lib, "utf8").replace(re, "");
  if (!s.includes(tag)) {
    s = s.replace(/(<meta name="robots"[^>]*>)/, `$1\n${tag}`);
    fs.writeFileSync(lib, s);
    written.push("lib/stories.php");
  }
}

const google = arg("google");
if (google) {
  putMeta("google-site-verification", google.replace(/^.*content=["']?|["'].*$/g, "").trim());
  console.log(`google-site-verification -> ${written.length} file(s)`);
}

const googleFile = arg("google-file");
if (googleFile) {
  const name = path.basename(googleFile);
  if (!/^google[a-z0-9]+\.html$/i.test(name)) { console.error(`"${name}" is not a googleXXXX.html filename`); process.exit(1); }
  fs.writeFileSync(path.join(ROOT, name), `google-site-verification: ${name}\n`);
  written.push(name);
  console.log(`wrote ${name}`);
}

const bing = arg("bing");
if (bing) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<users>\n  <user>${bing.trim()}</user>\n</users>\n`;
  fs.writeFileSync(path.join(ROOT, "BingSiteAuth.xml"), xml);
  written.push("BingSiteAuth.xml");
  console.log("wrote BingSiteAuth.xml");
}

if (!written.length) {
  console.error("nothing to do - pass --google, --google-file or --bing");
  process.exit(1);
}

if (args.includes("--deploy")) {
  const credFile = process.env.SIGNA_FTP_CRED_FILE || path.join(process.env.HOME, ".razex-creds/signa-ftp.txt");
  const cred = `aqq17894:${fs.readFileSync(credFile, "utf8").trim()}`;
  for (const f of [...new Set(written)]) {
    execFileSync("curl", ["-sS", "--ftp-create-dirs", "--max-time", "120", "-T", path.join(ROOT, f),
      `ftp://atlas.multihost.cloud/signa.cafe/${f}`, "--user", cred]);
    console.log(`  uploaded ${f}`);
  }
  console.log("\nNow press Verify in the console that gave you the token.");
} else {
  console.log(`\nfiles changed: ${[...new Set(written)].join(", ")}`);
  console.log("re-run with --deploy to upload, then press Verify.");
}
