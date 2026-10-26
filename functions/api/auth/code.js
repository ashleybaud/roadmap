// POST {poll, code}: the 6-digit code from the email, typed on the device that asked for it. Five tries.
import { handle, json, body, db, sha256, now, startSession, sameOrigin, HttpError, userFor } from "../../../server/otm.js";
export const onRequestPost = handle(async ({ request, env }) => {
  sameOrigin(request);
  const b = await body(request, 1000), code = String(b.code || "").replace(/\D/g, "");
  if (!/^[0-9a-f]{48}$/.test(String(b.poll || "")) || code.length !== 6) throw new HttpError(400, "Type the 6-digit code from the email.");
  const D = await db(env), tok = await D.prepare(`SELECT * FROM login_tokens WHERE poll = ?`).bind(await sha256(b.poll)).first();
  if (!tok || tok.expires < now() || tok.poll_used) throw new HttpError(400, "That code has expired. Ask for a new email.");
  if (tok.attempts >= 5) throw new HttpError(429, "Too many tries. Ask for a new email.");
  if (tok.code !== await sha256(code)) { await D.prepare(`UPDATE login_tokens SET attempts = attempts + 1 WHERE id = ?`).bind(tok.id).run(); throw new HttpError(400, "That code isn't right. Check the email and try again."); }
  const user = await userFor(D, tok.email);
  await D.prepare(`UPDATE login_tokens SET used = 1, poll_used = 1, approved_user = ? WHERE id = ?`).bind(user.id, tok.id).run();
  return json({ ok: true }, 200, { "Set-Cookie": await startSession(env, user.id) });
});
