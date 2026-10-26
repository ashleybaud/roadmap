// Rider reports from a fixed list, each with a place and the day it was seen; old ones drop off by themselves.
// GET ?s=&w=&n=&e= → recent reports in that box. POST {kind, text, lat, lon, seen_on, route}. DELETE ?id= (your own).
import { handle, json, body, db, currentUser, requireUser, sameOrigin, clean, newId, now, HttpError, REPORT_KINDS, isAdmin, requireContributor, liveStatus } from "../../server/otm.js";

export const onRequestGet = handle(async ({ request, env }) => {
  const q = new URL(request.url).searchParams, n = k => +q.get(k);
  const [s, w, nn, e] = [n("s"), n("w"), n("n"), n("e")];
  if (![s, w, nn, e].every(Number.isFinite) || nn - s > 25 || e - w > 25) throw new HttpError(400, "Give a smaller area.");
  const D = await db(env), u = await currentUser(env, request);
  const r = await D.prepare(`SELECT id, kind, text, lat, lon, seen_on, created, user_id, status FROM reports WHERE lat BETWEEN ? AND ? AND lon BETWEEN ? AND ? AND expires > ? AND (status = 'ok' OR user_id = ?) ORDER BY created DESC LIMIT 300`)
    .bind(s, nn, w, e, now(), u ? u.id : "").all();
  return json({ kinds: Object.fromEntries(Object.entries(REPORT_KINDS).map(([k, v]) => [k, v.label])),
    reports: (r.results || []).map(({ user_id, ...x }) => ({ ...x, label: (REPORT_KINDS[x.kind] || {}).label || x.kind, mine: !!(u && user_id === u.id) })) });
});
export const onRequestPost = handle(async ({ request, env }) => {
  sameOrigin(request); const u = await requireUser(env, request), b = await body(request, 4000), D = await db(env);
  requireContributor(env, u);
  const k = REPORT_KINDS[b.kind]; if (!k) throw new HttpError(400, "Pick what you saw.");
  const lat = +b.lat, lon = +b.lon; if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new HttpError(400, "Where was it?");
  const today = new Date().toISOString().slice(0, 10), seen = /^\d{4}-\d{2}-\d{2}$/.test(b.seen_on || "") && b.seen_on <= today ? b.seen_on : today;
  const recent = await D.prepare(`SELECT COUNT(*) AS n FROM reports WHERE user_id = ? AND created > ?`).bind(u.id, now() - 3600e3).first();
  if (recent && recent.n >= 30) throw new HttpError(429, "That's a lot of reports in an hour. Try again later.");
  const id = newId(8), from = Date.parse(seen + "T12:00:00Z");
  const status = liveStatus(env, u);
  await D.prepare(`INSERT INTO reports (id, route_id, user_id, kind, text, lat, lon, seen_on, expires, created, status) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id, clean(b.route, 80) || null, u.id, b.kind, clean(b.text, 500) || null, lat, lon, seen, from + k.days * 864e5, now(), status).run();
  return json({ ok: true, id, status });
});
export const onRequestDelete = handle(async ({ request, env }) => {
  sameOrigin(request); const u = await requireUser(env, request), id = new URL(request.url).searchParams.get("id") || "";
  await (await db(env)).prepare(`DELETE FROM reports WHERE id = ? AND user_id = ?`).bind(id, u.id).run();
  return json({ ok: true });
});
