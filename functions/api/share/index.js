// POST {title, trip, settings}: keep a planned trip and return a short id for a link like /?s=<id>.
// No account needed. Limit: 40 links a day from one connection (only a hash of the address and day is kept).
import { handle, json, db, HttpError, body, sameOrigin, now, sha256, clean } from "../../../server/otm.js";
const ID = "abcdefghijkmnpqrstuvwxyz23456789";
const shortId = () => { const a = new Uint8Array(8); crypto.getRandomValues(a); return [...a].map(b => ID[b % ID.length]).join(""); };
export const onRequestPost = handle(async ({ request, env }) => {
  sameOrigin(request);
  const b = await body(request, 300000);
  if (!b.trip || !Array.isArray(b.trip.days) || !b.trip.start || b.trip.start.lat == null) throw new HttpError(400, "Plan the trip first.");
  const D = await db(env), day = new Date().toISOString().slice(0, 10);
  const ipDay = (await sha256((request.headers.get("CF-Connecting-IP") || "") + "|" + day + "|otm-share")).slice(0, 24);
  const c = await D.prepare(`SELECT COUNT(*) AS n FROM shares WHERE ip_day = ?`).bind(ipDay).first();
  if (c && c.n >= 40) throw new HttpError(429, "That's a lot of links today. Try again tomorrow.");
  const keep = {};
  ["vehicle", "style", "range", "maxHours", "leave", "pace", "breakMin"].forEach(k => { if (b.settings && b.settings[k] != null) keep[k] = b.settings[k]; });
  const id = shortId(), title = clean(b.title, 120) || "A trip";
  await D.prepare(`INSERT INTO shares (id, title, data, ip_day, created) VALUES (?, ?, ?, ?, ?)`)
    .bind(id, title, JSON.stringify({ trip: b.trip, settings: keep }), ipDay, now()).run();
  return json({ id });
});
