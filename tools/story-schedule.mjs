export function baliDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Makassar", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

export function nextThursday(after) {
  const d = new Date(`${after}T00:00:00Z`);
  if (!Number.isFinite(d.getTime())) throw new Error(`invalid story date: ${after}`);
  do { d.setUTCDate(d.getUTCDate() + 1); } while (d.getUTCDay() !== 4);
  return d.toISOString().slice(0, 10);
}

// Missed weeks stay missed. Start from today, then skip occupied future slots.
export function nextStoryDate(posts, now = new Date()) {
  const taken = new Set(posts.map((p) => p.date));
  let date = nextThursday(baliDate(now));
  while (taken.has(date)) date = nextThursday(date);
  return date;
}
