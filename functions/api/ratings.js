// Ride reports (ratings grown up). Only from riders who say they rode it, with the date. One per rider per route; a new one replaces the old.
// GET ?route=ID → {stars, grade, n, mine, reports[]}. POST {route, stars, grade, rode_on, vehicle, model, again, ticks[], fuel, line, photos[], turnstile}.
// route is a saved route's id, or "pick:<id>" for a OneTrackMind pick. New riders' reports wait for approval; trusted riders and admins go live.
import { handle, json, body, db, currentUser, requireUser, sameOrigin, now, clean, HttpError, liveStatus, humanCheck, REPORT_TICKS } from "../../server/otm.js";

async function checkRoute(D, id, u) {
  if (/^pick:[a-z0-9-]{2,60}$/.test(id)) return;
  const r = await D.prepare(`SELECT user_id, visibility FROM routes WHERE id = ?`).bind(id).first();
  if (!r || (r.visibility === "private" && (!u || r.user_id !== u.id))) throw new HttpError(404, "Route not found.");
}
const parse = s => { try { return JSON.parse(s || "[]"); } catch (e) { return []; } };
export const onRequestGet = handle(async ({ request, env }) => {
  const id = new URL(request.url).searchParams.get("route") || "", D = await db(env), u = await currentUser(env, request);
  const [s, list] = await D.batch([
    D.prepare(`SELECT ROUND(AVG(stars),1) AS stars, ROUND(AVG(grade),1) AS grade, COUNT(*) AS n FROM route_ratings WHERE route_id = ? AND status = 'ok'`).bind(id),
    D.prepare(`SELECT r.stars, r.grade, r.rode_on, r.vehicle, r.model, r.again, r.ticks, r.fuel, r.line, r.photos, u.name FROM route_ratings r JOIN users u ON u.id = r.user_id
       WHERE r.route_id = ? AND r.status = 'ok' AND (r.line IS NOT NULL OR r.ticks IS NOT NULL OR r.photos IS NOT NULL) ORDER BY r.rode_on DESC LIMIT 10`).bind(id),
  ]);
  const mine = u ? await D.prepare(`SELECT stars, grade, rode_on, vehicle, model, again, ticks, fuel, line, photos, status FROM route_ratings WHERE route_id = ? AND user_id = ?`).bind(id, u.id).first() : null;
  const out = x => x && ({ ...x, ticks: parse(x.ticks), photos: parse(x.photos), name: x.name || undefined });
  return json({ ...(s.results[0] || { n: 0 }), mine: out(mine) || null, reports: list.results.map(out) });
});
export const onRequestPost = handle(async ({ request, env }) => {
  sameOrigin(request); const u = await requireUser(env, request), b = await body(request, 8000), D = await db(env);
  if (u.blocked) throw new HttpError(403, "This account can't post reports.");
  await humanCheck(env, request, b.turnstile);
  const id = String(b.route || ""); await checkRoute(D, id, u);
  const stars = Math.round(+b.stars), grade = Math.round(+b.grade);
  if (!(stars >= 1 && stars <= 5)) throw new HttpError(400, "Pick 1 to 5 stars.");
  if (!(grade >= 1 && grade <= 5)) throw new HttpError(400, "Pick the grade you found it.");
  const rode = String(b.rode_on || ""); if (!/^\d{4}-\d{2}-\d{2}$/.test(rode) || rode > new Date().toISOString().slice(0, 10)) throw new HttpError(400, "When did you ride it? Only riders who've ridden it can report on it.");
  const today = await D.prepare(`SELECT COUNT(*) AS n FROM route_ratings WHERE user_id = ? AND created > ? AND route_id <> ?`).bind(u.id, now() - 864e5, id).first();
  if (today && today.n >= 3) throw new HttpError(429, "Three reports a day is the limit. Thanks, come back tomorrow.");
  const ticks = (Array.isArray(b.ticks) ? b.ticks : []).filter(t => REPORT_TICKS[t]).slice(0, 11);
  const photos = (Array.isArray(b.photos) ? b.photos : []).map(String).filter(k => k.startsWith(`r/${u.id}/`)).slice(0, 5);
  if (photos.length) { const own = await D.prepare(`SELECT COUNT(*) AS n FROM photos WHERE user_id = ? AND key IN (${photos.map(() => "?").join(",")})`).bind(u.id, ...photos).first(); if (!own || own.n !== photos.length) throw new HttpError(400, "A photo didn't upload. Try adding it again."); }
  const line = clean(b.line, 200) || null, fuel = ["ok", "missing"].includes(b.fuel) ? b.fuel : null;
  const rich = !!(line || photos.length), status = rich ? liveStatus(env, u) : "ok";
  await D.prepare(`INSERT INTO route_ratings (route_id, user_id, stars, grade, rode_on, vehicle, model, again, ticks, fuel, line, photos, status, created) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(route_id, user_id) DO UPDATE SET stars=excluded.stars, grade=excluded.grade, rode_on=excluded.rode_on, vehicle=excluded.vehicle, model=excluded.model, again=excluded.again,
      ticks=excluded.ticks, fuel=excluded.fuel, line=excluded.line, photos=excluded.photos, status=excluded.status, created=excluded.created`)
    .bind(id, u.id, stars, grade, rode, ["bike", "jeep", "car"].includes(b.vehicle) ? b.vehicle : null, clean(b.model, 40) || null,
      b.again === true ? 1 : b.again === false ? 0 : null, ticks.length ? JSON.stringify(ticks) : null, fuel, line, photos.length ? JSON.stringify(photos) : null, status, now()).run();
  return json({ ok: true, status });
});
