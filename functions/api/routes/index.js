// GET: your saved routes (newest first). POST {title, trip, settings, summary...}: save a new one.
import { handle, json, body, db, requireUser, sameOrigin, clean, newId, now, HttpError } from "../../../server/otm.js";

export function routeCols(b) {
  const trip = b.trip;
  if (!trip || typeof trip !== "object" || !Array.isArray(trip.days) || !trip.start) throw new HttpError(400, "There's no trip to save.");
  const s = b.settings || {};
  return {
    title: clean(b.title, 120) || "Untitled route",
    summary: clean(b.summary, 300),
    data: JSON.stringify({ v: 1, trip, settings: { vehicle: s.vehicle, style: s.style, range: s.range, maxHours: s.maxHours, leave: s.leave, pace: s.pace, breakMin: s.breakMin } }),
    km: Number.isFinite(+b.km) ? Math.round(+b.km) : null,
    days: trip.days.length,
    vehicle: clean(s.vehicle, 10) || null,
    style: clean(s.style, 10) || null,
    region: clean(b.region, 10) || null,
    start_lat: Number.isFinite(+trip.start.lat) ? +trip.start.lat : null,
    start_lon: Number.isFinite(+trip.start.lon) ? +trip.start.lon : null,
  };
}
export const LIST_COLS = `id, title, summary, km, days, vehicle, style, visibility, pick, created, updated`;

export const onRequestGet = handle(async ({ request, env }) => {
  const u = await requireUser(env, request);
  const r = await (await db(env)).prepare(`SELECT ${LIST_COLS} FROM routes WHERE user_id = ? ORDER BY updated DESC LIMIT 200`).bind(u.id).all();
  return json({ routes: r.results || [] });
});
export const onRequestPost = handle(async ({ request, env }) => {
  sameOrigin(request); const u = await requireUser(env, request), b = await body(request), c = routeCols(b), D = await db(env), t = now();
  const n = await D.prepare(`SELECT COUNT(*) AS n FROM routes WHERE user_id = ?`).bind(u.id).first();
  if (n && n.n >= 500) throw new HttpError(400, "You've reached 500 saved routes. Delete some first.");
  const id = newId(8);
  await D.prepare(`INSERT INTO routes (id, user_id, title, summary, data, km, days, vehicle, style, region, start_lat, start_lon, created, updated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id, u.id, c.title, c.summary, c.data, c.km, c.days, c.vehicle, c.style, c.region, c.start_lat, c.start_lon, t, t).run();
  return json({ id, title: c.title });
});
