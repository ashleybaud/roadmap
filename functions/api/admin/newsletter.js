// OneTrackMind only (ADMIN_EMAILS). Nothing goes out unless the founder presses Send.
// GET: the built issues (newsletter/index.json), whether each was sent, and how many subscribers it would reach.
// POST {issue, test:true}: sends the issue to the founder only, marked [Test].
// POST {issue}: sends it to every confirmed subscriber who chose that frequency. Each issue can only go out once.
import { handle, json, body, db, requireUser, HttpError, isAdmin, now, sendBatch } from "../../../server/otm.js";
const DAYS = { weekly: 7, fortnightly: 14, monthly: 28 };
const dueSql = `FROM subscribers WHERE confirmed_at IS NOT NULL AND unsub_at IS NULL AND freq = ? AND (last_sent IS NULL OR last_sent < ?)`;
async function asset(env, origin, p) {
  const r = env.ASSETS ? await env.ASSETS.fetch(new Request(origin + p)) : await fetch(origin + p);
  if (!r.ok) throw new HttpError(404, `Couldn't find ${p} on the site. Is the issue built and published?`);
  return r;
}
export const onRequestGet = handle(async ({ request, env }) => {
  const u = await requireUser(env, request); if (!isAdmin(env, u)) throw new HttpError(403, "OneTrackMind only.");
  const D = await db(env), origin = new URL(request.url).origin, t = now();
  let list = []; try { list = await (await asset(env, origin, "/newsletter/index.json")).json(); } catch (e) {}
  const sent = Object.fromEntries((await D.prepare(`SELECT issue, sent_at, count FROM newsletter_sends`).all()).results.map(r => [r.issue, r]));
  for (const i of list.slice(0, 8)) {
    i.sent = sent[i.id] || null;
    if (!i.sent) { const c = await D.prepare(`SELECT COUNT(*) AS n ${dueSql}`).bind(i.period, t - ((DAYS[i.period] || 7) - 2) * 864e5).first(); i.reach = (c && c.n) || 0; }
  }
  return json({ issues: list.slice(0, 8) });
});
export const onRequestPost = handle(async ({ request, env }) => {
  const u = await requireUser(env, request); if (!isAdmin(env, u)) throw new HttpError(403, "OneTrackMind only.");
  const b = await body(request, 500), id = String(b.issue || "");
  if (!/^\d{4}-\d\d-\d\d-(weekly|fortnightly|monthly)$/.test(id)) throw new HttpError(400, "Which issue?");
  const origin = new URL(request.url).origin, D = await db(env), t = now();
  const meta = await (await asset(env, origin, `/newsletter/${id}/meta.json`)).json();
  const html = await (await asset(env, origin, `/newsletter/${id}/email.html`)).text();
  const text = await (await asset(env, origin, `/newsletter/${id}/email.txt`)).text();
  const fill = (s, key, name) => s.replace(/\{\{NAME\}\}/g, (String(name || "").trim().split(/\s+/)[0] || "there").replace(/[<>&"]/g, "")).replace(/\{\{UNSUB\}\}/g, `${origin}/api/unsubscribe?u=${key}`).replace(/\{\{PREFS\}\}/g, `${origin}/api/subscribe/prefs?u=${key}`);
  const mail = (to, key, subject, name) => ({ to, subject, html: fill(html, key, name), text: fill(text, key, name),
    headers: key ? { "List-Unsubscribe": `<${origin}/api/unsubscribe?u=${key}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } : undefined });
  if (b.test) {
    const me = await D.prepare(`SELECT unsub, name FROM subscribers WHERE email = ?`).bind(u.email).first();
    await sendBatch(env, [mail(u.email, (me && me.unsub) || "", "[Test] " + meta.subject, (me && me.name) || u.name)]);
    return json({ ok: true, sent: 1, test: true });
  }
  // claim the issue first, so two taps can't send it twice
  const claim = await D.prepare(`INSERT OR IGNORE INTO newsletter_sends (issue, sent_at, sent_by, count) VALUES (?,?,?,0)`).bind(id, t, u.email).run();
  const subs = (await D.prepare(`SELECT email, unsub, name ${dueSql} ORDER BY created`).bind(meta.period, t - ((DAYS[meta.period] || 7) - 2) * 864e5).all()).results;
  // already claimed: only carries on if an earlier send stopped half way (those who got it are skipped)
  if (!subs.length) {
    if (claim.meta && claim.meta.changes) { await D.prepare(`DELETE FROM newsletter_sends WHERE issue = ?`).bind(id).run(); throw new HttpError(400, "Nobody is waiting for this one."); }
    throw new HttpError(409, "That issue has already gone out.");
  }
  let sent = 0;
  try { sent = await sendBatch(env, subs.map(s => mail(s.email, s.unsub, meta.subject, s.name))); }
  finally {
    await D.prepare(`UPDATE newsletter_sends SET count = count + ? WHERE issue = ?`).bind(sent, id).run();
    const done = subs.slice(0, sent).map(s => s.email);
    for (let i = 0; i < done.length; i += 50) { const part = done.slice(i, i + 50);
      await D.prepare(`UPDATE subscribers SET last_sent = ? WHERE email IN (${part.map(() => "?").join(",")})`).bind(t, ...part).run(); }
  }
  return json({ ok: true, sent });
});
