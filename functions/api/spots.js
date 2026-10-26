// Places riders mark. GET ?s=&w=&n=&e= → approved places in the box (plus your own waiting ones), with "been here" counts.
// POST {kind, name, note, lat, lon} → waits for approval. POST {vote: id} → "been here". DELETE ?id= → remove your own.
import { handle, json, body, db, currentUser, requireUser, sameOrigin, clean, newId, now, HttpError, isAdmin, SPOT_KINDS, requireContributor, liveStatus } from "../../server/otm.js";

export const onRequestGet = handle(async ({ request, env }) => {
  const q = new URL(request.url).searchParams, n = k => +q.get(k), [s, w, nn, e] = [n("s"), n("w"), n("n"), n("e")];
  if (q.get("mine")) { // your own marks, newest first (for "My marks")
    const u = await requireUser(env, request), D = await db(env);
    const r = await D.prepare(`SELECT id, kind, name, note, lat, lon, status, created FROM spots WHERE user_id = ? ORDER BY created DESC LIMIT 300`).bind(u.id).all();
    return json({ kinds: SPOT_KINDS, spots: r.results || [] });
  }
  if (![s, w, nn, e].every(Number.isFinite) || nn - s > 25 || e - w > 25) throw new HttpError(400, "Give a smaller area.");
  const D = await db(env), u = await currentUser(env, request), uid = u ? u.id : "";
  const r = await D.prepare(`SELECT s.id, s.kind, s.name, s.note, s.lat, s.lon, s.status, s.user_id = ? AS mine, (SELECT name FROM users WHERE id = s.user_id) AS who,
      (SELECT COUNT(*) FROM spot_votes v WHERE v.spot_id = s.id) AS been, EXISTS(SELECT 1 FROM spot_votes v WHERE v.spot_id = s.id AND v.user_id = ?) AS beenme
    FROM spots s WHERE s.lat BETWEEN ? AND ? AND s.lon BETWEEN ? AND ? AND (s.status = 'ok' OR s.user_id = ?) LIMIT 500`).bind(uid, uid, s, nn, w, e, uid).all();
  return json({ kinds: SPOT_KINDS, spots: r.results || [] });
});
export const onRequestPost = handle(async ({ request, env }) => {
  sameOrigin(request); const u = await requireUser(env, request), b = await body(request, 4000), D = await db(env);
  if (b.vote) {
    const sp = await D.prepare(`SELECT id FROM spots WHERE id = ? AND status = 'ok'`).bind(String(b.vote)).first(); if (!sp) throw new HttpError(404, "Place not found.");
    if (b.undo) await D.prepare(`DELETE FROM spot_votes WHERE spot_id = ? AND user_id = ?`).bind(sp.id, u.id).run();
    else await D.prepare(`INSERT OR IGNORE INTO spot_votes (spot_id, user_id, created) VALUES (?,?,?)`).bind(sp.id, u.id, now()).run();
    return json({ ok: true });
  }
  if (b.edit) { // change the name or note of your own mark (it goes back for approval)
    const sp = await D.prepare(`SELECT id, kind FROM spots WHERE id = ? AND user_id = ?`).bind(String(b.edit), u.id).first(); if (!sp) throw new HttpError(404, "Place not found.");
    await D.prepare(`UPDATE spots SET name = ?, note = ?, status = ? WHERE id = ?`).bind(clean(b.name, 80) || SPOT_KINDS[sp.kind], clean(b.note, 400) || null, liveStatus(env, u), sp.id).run();
    return json({ ok: true });
  }
  requireContributor(env, u);
  if (!SPOT_KINDS[b.kind]) throw new HttpError(400, "What kind of place is it?");
  const name = clean(b.name, 80) || SPOT_KINDS[b.kind];
  const lat = +b.lat, lon = +b.lon; if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new HttpError(400, "Where is it?");
  const recent = await D.prepare(`SELECT COUNT(*) AS n FROM spots WHERE user_id = ? AND created > ?`).bind(u.id, now() - 3600e3).first();
  if (recent && recent.n >= 30) throw new HttpError(429, "That's a lot of places in an hour. Try again later.");
  const id = newId(8), status = liveStatus(env, u);
  await D.prepare(`INSERT INTO spots (id, user_id, kind, name, note, lat, lon, status, created) VALUES (?,?,?,?,?,?,?,?,?)`).bind(id, u.id, b.kind, name, clean(b.note, 400) || null, lat, lon, status, now()).run();
  return json({ ok: true, id, status });
});
export const onRequestDelete = handle(async ({ request, env }) => {
  sameOrigin(request); const u = await requireUser(env, request), id = new URL(request.url).searchParams.get("id") || "", D = await db(env);
  await D.batch([D.prepare(`DELETE FROM spots WHERE id = ? AND user_id = ?`).bind(id, u.id), D.prepare(`DELETE FROM spot_votes WHERE spot_id = ? AND NOT EXISTS (SELECT 1 FROM spots WHERE id = ?)`).bind(id, id)]);
  return json({ ok: true });
});
