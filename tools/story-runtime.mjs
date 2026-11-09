import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.story-runtime");
const LOCK = path.join(DIR, "generator.lock");
const PENDING = path.join(DIR, "response.json");

export function lockGenerator() {
  fs.mkdirSync(DIR, { recursive: true });
  if (fs.existsSync(LOCK)) {
    const old = JSON.parse(fs.readFileSync(LOCK, "utf8"));
    if (old.host !== os.hostname()) throw new Error("story generator is locked on another host");
    let alive = true;
    try { process.kill(old.pid, 0); } catch (e) { if (e.code === "ESRCH") alive = false; }
    if (alive) throw new Error(`story generator already running (PID ${old.pid})`);
    fs.unlinkSync(LOCK);
  }
  const token = crypto.randomUUID();
  fs.writeFileSync(LOCK, JSON.stringify({ pid: process.pid, host: os.hostname(), token }), { flag: "wx", mode: 0o600 });
  const release = () => {
    if (fs.existsSync(LOCK) && JSON.parse(fs.readFileSync(LOCK, "utf8")).token === token) fs.unlinkSync(LOCK);
  };
  process.once("exit", release);
  return release;
}

export const pendingResponse = () => fs.existsSync(PENDING) ? JSON.parse(fs.readFileSync(PENDING, "utf8")) : null;
export function savePending(value) {
  fs.mkdirSync(DIR, { recursive: true });
  const temp = `${PENDING}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value), { mode: 0o600 });
  fs.renameSync(temp, PENDING);
}
export function assertNoPending() {
  if (pendingResponse()) throw new Error("unresolved paid request; further paid calls blocked until accounted");
}
export function clearPending(requestId) {
  if (pendingResponse()?.requestId === requestId) fs.rmSync(PENDING, { force: true });
}
