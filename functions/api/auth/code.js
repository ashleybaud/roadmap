// POST {poll, code}: the 6-digit code from the email, typed on the device that asked for it. Five tries.
import { handle, json, body, db, sha256, now, startSession, sameOrigin, HttpError, userFor } from "../../../server/otm.js";
export const onRequestPost = handle(async ({ request, env }) => {
  sameOrigin(request);
  const b = await body(request, 1000), code = String(b.code || "").replace(/\D/g, "");
  if (!/^[0-9a-f]{48}$/.test(String(b.poll || "")) || code.length !== 6) throw new HttpError(400, "Type the 6-digit code from the email.");
  const D = await db(env), tok = await D.prepare(`SELECT * FROM login_tokens WHERE poll = ?`).bind(await sha256(b.poll)).first();
  if (!tok || tok.expires < now() || tok.poll_used) throw new HttpError(400, "That code has expired. Ask for a new email.");
  // count the try before checking, so tries sent all at once still count; and no more than 15 wrong codes a day per email
  const day = await D.prepare(`SELECT COALESCE(SUM(attempts), 0) AS n FROM login_tokens WHERE email = ? AND created > ?`).bind(tok.email, now() - 864e5).first();
  if (day && day.n >= 15) throw new HttpError(429, "Too many tries today. Use the link in the email instead.");
  const tick = await D.prepare(`UPDATE login_tokens SET attempts = attempts + 1 WHERE id = ? AND attempts < 5`).bind(tok.id).run();
  if (!tick.meta || tick.meta.changes !== 1) throw new HttpError(429, "Too many tries. Ask for a new email.");
  if (tok.code !== await sha256(code)) throw new HttpError(400, "That code isn't right. Check the email and try again.");
  const user = await userFor(D, tok.email);
  const ok = await D.prepare(`UPDATE login_tokens SET used = 1, poll_used = 1, approved_user = ? WHERE id = ? AND poll_used = 0`).bind(user.id, tok.id).run();
  if (!ok.meta || !ok.meta.changes) throw new HttpError(400, "That code has already been used.");
  return json({ ok: true }, 200, { "Set-Cookie": await startSession(env, user.id) });
});
