// POST (body = a JPEG already shrunk on the phone, ≤ 700 KB): stores it in R2 (binding MEDIA) and returns {key, url}.
// Signed-in riders only; 15 photos a day. Photos are served by /api/media/<key> (or the media domain once connected).
import { handle, json, db, requireUser, sameOrigin, newId, now, HttpError } from "../../server/otm.js";
export const onRequestPost = handle(async ({ request, env }) => {
  sameOrigin(request); const u = await requireUser(env, request);
  if (u.blocked) throw new HttpError(403, "This account can't upload photos.");
  if (!env.MEDIA) throw new HttpError(503, "Photo storage isn't switched on yet. Your report can go without photos for now.");
  if ((request.headers.get("Content-Type") || "") !== "image/jpeg") throw new HttpError(415, "Photos must be JPEG.");
  const buf = await request.arrayBuffer();
  if (buf.byteLength < 5000) throw new HttpError(400, "That photo is too small.");
  if (buf.byteLength > 700000) throw new HttpError(413, "That photo is too big. Try again; the app shrinks it first.");
  const b = new Uint8Array(buf); if (!(b[0] === 0xff && b[1] === 0xd8)) throw new HttpError(415, "That isn't a JPEG photo.");
  const D = await db(env);
  const today = await D.prepare(`SELECT COUNT(*) AS n FROM photos WHERE user_id = ? AND created > ?`).bind(u.id, now() - 864e5).first();
  if (today && today.n >= 15) throw new HttpError(429, "15 photos a day is the limit. Come back tomorrow.");
  const key = `r/${u.id}/${newId(10)}.jpg`;
  await env.MEDIA.put(key, buf, { httpMetadata: { contentType: "image/jpeg", cacheControl: "public, max-age=31536000, immutable" } });
  await D.prepare(`INSERT INTO photos (key, user_id, bytes, created) VALUES (?, ?, ?, ?)`).bind(key, u.id, buf.byteLength, now()).run();
  return json({ key, url: "/api/media/" + key });
});
