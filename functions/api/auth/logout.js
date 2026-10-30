import { handle, json, body, db, endSession, sameOrigin, currentUser } from "../../../server/otm.js";
// POST {all:true}: sign out on every device
export const onRequestPost = handle(async ({ request, env }) => {
  sameOrigin(request);
  const b = await body(request, 200).catch(() => ({}));
  if (b && b.all) { const u = await currentUser(env, request).catch(() => null); if (u) await (await db(env)).prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(u.id).run(); }
  return json({ ok: true }, 200, { "Set-Cookie": await endSession(env, request) });
});
