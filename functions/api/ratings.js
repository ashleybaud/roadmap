// Ratings come only from riders who say they rode it, with the date. One per rider per route; a new one replaces the old.
// GET ?route=ID → {stars, grade, n, mine}. POST {route, stars 1-5, grade 1-5, rode_on YYYY-MM-DD, vehicle}.
// route is a saved route's id, or "pick:<id>" for a OneTrackMind pick.
import { handle, json, body, db, currentUser, requireUser, sameOrigin, now, HttpError } from "../../server/otm.js";

async function checkRoute(D, id, u) {
  if (/^pick:[a-z0-9-]{2,60}$/.test(id)) return;
  const r = await D.prepare(`SELECT user_id, visibility FROM routes WHERE id = ?`).bind(id).first();
  if (!r || (r.visibility === "private" && (!u || r.user_id !== u.id))) throw new HttpError(404, "Route not found.");
}
export const onRequestGet = handle(async ({ request, env }) => {
  const id = new URL(request.url).searchParams.get("route") || "", D = await db(env), u = await currentUser(env, request);
  const s = await D.prepare(`SELECT ROUND(AVG(stars),1) AS stars, ROUND(AVG(grade),1) AS grade, COUNT(*) AS n FROM route_ratings WHERE route_id = ?`).bind(id).first();
  const mine = u ? await D.prepare(`SELECT stars, grade, rode_on, vehicle FROM route_ratings WHERE route_id = ? AND user_id = ?`).bind(id, u.id).first() : null;
  return json({ ...(s || { n: 0 }), mine: mine || null });
});
export const onRequestPost = handle(async ({ request, env }) => {
  sameOrigin(request); const u = await requireUser(env, request), b = await body(request, 4000), D = await db(env);
  const id = String(b.route || ""); await checkRoute(D, id, u);
  const stars = Math.round(+b.stars), grade = Math.round(+b.grade);
  if (!(stars >= 1 && stars <= 5)) throw new HttpError(400, "Pick 1 to 5 stars.");
  if (!(grade >= 1 && grade <= 5)) throw new HttpError(400, "Pick the grade you found it.");
  const rode = String(b.rode_on || ""); if (!/^\d{4}-\d{2}-\d{2}$/.test(rode) || rode > new Date().toISOString().slice(0, 10)) throw new HttpError(400, "When did you ride it? Only riders who've ridden it can rate it.");
  await D.prepare(`INSERT INTO route_ratings (route_id, user_id, stars, grade, rode_on, vehicle, created) VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(route_id, user_id) DO UPDATE SET stars=excluded.stars, grade=excluded.grade, rode_on=excluded.rode_on, vehicle=excluded.vehicle, created=excluded.created`)
    .bind(id, u.id, stars, grade, rode, ["bike", "jeep", "car"].includes(b.vehicle) ? b.vehicle : null, now()).run();
  return json({ ok: true });
});
