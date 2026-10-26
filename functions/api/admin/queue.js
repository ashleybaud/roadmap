// OneTrackMind only (ADMIN_EMAILS). GET: everything waiting for a decision. POST {type, id, action}: approve / reject / done.
import { handle, json, body, db, requireUser, sameOrigin, now, HttpError, isAdmin, REPORT_KINDS, SPOT_KINDS } from "../../../server/otm.js";

async function admin(env, request) { const u = await requireUser(env, request); if (!isAdmin(env, u)) throw new HttpError(403, "OneTrackMind only."); return u; }
export const onRequestGet = handle(async ({ request, env }) => {
  await admin(env, request); const D = await db(env);
  const [routes, spots, reports, feedback] = await D.batch([
    D.prepare(`SELECT r.id, r.title, r.summary, r.km, r.days, r.vehicle, r.updated, u.email, u.name AS who, u.id AS uid FROM routes r JOIN users u ON u.id = r.user_id WHERE r.visibility = 'review' ORDER BY r.updated LIMIT 100`),
    D.prepare(`SELECT s.id, s.kind, s.name, s.note, s.lat, s.lon, s.created, u.email, u.name AS who, u.id AS uid FROM spots s JOIN users u ON u.id = s.user_id WHERE s.status = 'pending' ORDER BY s.created LIMIT 200`),
    D.prepare(`SELECT r.id, r.kind, r.text, r.lat, r.lon, r.seen_on, r.created, u.email, u.name AS who, u.id AS uid FROM reports r JOIN users u ON u.id = r.user_id WHERE r.status = 'pending' AND r.expires > ? ORDER BY r.created LIMIT 200`).bind(now()),
    D.prepare(`SELECT id, kind, text, email, page, lat, lon, created FROM feedback WHERE status = 'new' ORDER BY created DESC LIMIT 200`),
  ]);
  return json({ routes: routes.results, spots: spots.results.map(s => ({ ...s, label: SPOT_KINDS[s.kind] || s.kind })),
    reports: reports.results.map(r => ({ ...r, label: (REPORT_KINDS[r.kind] || {}).label || r.kind })), feedback: feedback.results });
});
export const onRequestPost = handle(async ({ request, env }) => {
  sameOrigin(request); await admin(env, request); const b = await body(request, 2000), D = await db(env), ok = b.action === "approve", id = String(b.id || "");
  if (b.type === "route") await D.prepare(`UPDATE routes SET visibility = ? WHERE id = ? AND visibility = 'review'`).bind(ok ? "public" : "private", id).run();
  else if (b.type === "spot") await D.prepare(`UPDATE spots SET status = ?, reviewed = ? WHERE id = ?`).bind(ok ? "ok" : "rejected", now(), id).run();
  else if (b.type === "report") await D.prepare(`UPDATE reports SET status = ? WHERE id = ?`).bind(ok ? "ok" : "rejected", id).run();
  else if (b.type === "feedback") await D.prepare(`UPDATE feedback SET status = 'done' WHERE id = ?`).bind(id).run();
  else if (b.type === "user" && b.action === "block") await D.batch([
    D.prepare(`UPDATE users SET blocked = 1, trusted = 0 WHERE id = ?`).bind(id),
    D.prepare(`UPDATE spots SET status = 'rejected' WHERE user_id = ? AND status = 'pending'`).bind(id),
    D.prepare(`UPDATE reports SET status = 'rejected' WHERE user_id = ? AND status = 'pending'`).bind(id),
    D.prepare(`UPDATE routes SET visibility = 'private' WHERE user_id = ? AND visibility = 'review'`).bind(id)]);
  else if (b.type === "user" && b.action === "trust") await D.prepare(`UPDATE users SET trusted = 1 WHERE id = ? AND blocked = 0`).bind(id).run();
  else throw new HttpError(400, "Unknown item.");
  return json({ ok: true });
});
