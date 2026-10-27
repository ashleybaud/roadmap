// OneTrackMind only (ADMIN_EMAILS). GET: who has signed up (counts + the latest riders).
// GET ?csv=1: the mailing list, only riders who ticked "send me new routes and trip ideas", as a CSV for a mailing tool.
import { handle, json, db, requireUser, HttpError, isAdmin, now } from "../../../server/otm.js";

const csvCell = v => { const t = v == null ? "" : String(v); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
const day = t => (t ? new Date(t).toISOString().slice(0, 10) : "");

export const onRequestGet = handle(async ({ request, env }) => {
  const u = await requireUser(env, request); if (!isAdmin(env, u)) throw new HttpError(403, "OneTrackMind only.");
  const D = await db(env), url = new URL(request.url);
  if (url.searchParams.get("csv")) {
    const r = await D.prepare(`SELECT email, name, created, news_at FROM users WHERE news = 1 AND blocked = 0 ORDER BY created`).all();
    const rows = [["email", "name", "signed_up", "agreed_on"], ...r.results.map(x => [x.email, x.name, day(x.created), day(x.news_at)])];
    return new Response(rows.map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n", { headers: {
      "Content-Type": "text/csv; charset=utf-8", "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename="onetrackmind-mailing-list-${day(now())}.csv"` } });
  }
  const week = now() - 7 * 864e5;
  const since = new Date(now() - 30 * 864e5).toISOString().slice(0, 10), since7 = new Date(now() - 7 * 864e5).toISOString().slice(0, 10);
  const [c, latest, ev] = await D.batch([
    D.prepare(`SELECT COUNT(*) AS total, SUM(news) AS news, SUM(contributor) AS contributors, SUM(CASE WHEN created > ? THEN 1 ELSE 0 END) AS week FROM users`).bind(week),
    D.prepare(`SELECT email, name, created, last_seen, news, contributor FROM users ORDER BY created DESC LIMIT 50`),
    D.prepare(`SELECT name, SUM(n) AS d30, SUM(CASE WHEN day >= ? THEN n ELSE 0 END) AS d7 FROM events WHERE day >= ? GROUP BY name`).bind(since7, since),
  ]);
  const events = {}; ev.results.forEach(r => { events[r.name] = { d30: r.d30, d7: r.d7 }; });
  const k = c.results[0] || {};
  return json({ total: k.total || 0, news: k.news || 0, contributors: k.contributors || 0, week: k.week || 0, riders: latest.results, events });
});
