// POST {poll}: the device that asked for the email waits here. Once the link was opened anywhere, it gets its own session.
import { handle, json, body, db, sha256, now, startSession, sameOrigin, HttpError } from "../../../server/otm.js";
export const onRequestPost = handle(async ({ request, env }) => {
  sameOrigin(request);
  const b = await body(request, 1000); if (!/^[0-9a-f]{48}$/.test(String(b.poll || ""))) throw new HttpError(400, "Bad request.");
  const D = await db(env), tok = await D.prepare(`SELECT id, approved_user, poll_used, created FROM login_tokens WHERE poll = ?`).bind(await sha256(b.poll)).first();
  if (!tok || tok.created < now() - 30 * 60e3) return json({ expired: true });
  if (tok.poll_used) return json({ expired: true });
  if (!tok.approved_user) return json({ pending: true });
  await D.prepare(`UPDATE login_tokens SET poll_used = 1 WHERE id = ?`).bind(tok.id).run();
  return json({ ok: true }, 200, { "Set-Cookie": await startSession(env, tok.approved_user) });
});
