// POST {name, contributor, news}: news true/false = opt in or out of the monthly email (date kept as the consent record). change your display name; contributor:true agrees to the contributor rules. DELETE: remove your account, your saved routes, ratings, reports and sessions.
import { handle, json, body, db, requireUser, sameOrigin, clean, endSession } from "../../../server/otm.js";
export const onRequestPost = handle(async ({ request, env }) => {
  sameOrigin(request); const u = await requireUser(env, request), b = await body(request, 2000);
  const D = await db(env);
  if (b.name !== undefined) await D.prepare(`UPDATE users SET name = ? WHERE id = ?`).bind(clean(b.name, 40) || null, u.id).run();
  if (typeof b.news === "boolean") await D.prepare(`UPDATE users SET news = ?, news_at = ? WHERE id = ?`).bind(b.news ? 1 : 0, Date.now(), u.id).run();
  if (b.contributor === true) await D.prepare(`UPDATE users SET contributor = 1 WHERE id = ?`).bind(u.id).run();
  return json({ ok: true });
});
export const onRequestDelete = handle(async ({ request, env }) => {
  sameOrigin(request); const u = await requireUser(env, request), D = await db(env);
  const cookie = await endSession(env, request);
  await D.batch([
    D.prepare(`DELETE FROM routes WHERE user_id = ?`).bind(u.id),
    D.prepare(`DELETE FROM route_ratings WHERE user_id = ?`).bind(u.id),
    D.prepare(`DELETE FROM reports WHERE user_id = ?`).bind(u.id),
    D.prepare(`DELETE FROM spots WHERE user_id = ?`).bind(u.id),
    D.prepare(`DELETE FROM spot_votes WHERE user_id = ?`).bind(u.id),
    D.prepare(`UPDATE feedback SET user_id = NULL, email = NULL WHERE user_id = ?`).bind(u.id),
    D.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(u.id),
    D.prepare(`DELETE FROM login_tokens WHERE email = ?`).bind(u.email),
    D.prepare(`DELETE FROM users WHERE id = ?`).bind(u.id),
  ]);
  return json({ ok: true }, 200, { "Set-Cookie": cookie });
});
