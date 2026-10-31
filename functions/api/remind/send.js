// POST, from the daily job (scripts/send-reminders.mjs) only: Authorization: Bearer <REMIND_SECRET>.
// Sends every reminder that is due today and not sent yet, then marks it sent. Safe to run more than once a day: nobody gets one twice.
import { handle, json, db, HttpError, sendBatch, siteEvents, remindLive, REMIND_KINDS, escHtml } from "../../../server/otm.js";
const M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"], DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const day = s => { const d = new Date(s + "T12:00:00Z"); return `${DOW[d.getUTCDay()]} ${d.getUTCDate()} ${M[d.getUTCMonth()]}`; };
const when = e => e.start === e.end ? day(e.start) : `${day(e.start)} – ${day(e.end)} ${e.end.slice(0, 4)}`;
const SAY = { "4m": "is four months away. Good time to sort leave, beds and the road there.", book: "opens for booking. The good beds go first.", week: "is next week. Last call for beds and the route." };
const same = (a, b) => { if (a.length !== b.length) return false; let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i); return x === 0; };
export const onRequestPost = handle(async ({ request, env }) => {
  const key = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!env.REMIND_SECRET || !key || !same(key, env.REMIND_SECRET)) throw new HttpError(403, "Not allowed.");
  const D = await db(env), origin = new URL(request.url).origin, today = new Date().toISOString().slice(0, 10);
  const EV = new Map((await siteEvents(env, request)).map(e => [e.id, e]));
  const rows = (await D.prepare(`SELECT id, email, event_id, kinds, sent, unsub FROM reminders WHERE confirmed_at IS NOT NULL AND unsub_at IS NULL LIMIT 5000`).all()).results;
  const out = [], marks = [];
  for (const r of rows) {
    const e = EV.get(r.event_id); if (!e) continue;
    const sent = String(r.sent).split(",").filter(Boolean), due = String(r.kinds).split(",").filter(k => REMIND_KINDS[k] && !sent.includes(k) && remindLive(e, k, today));
    if (!due.length) continue;
    const k = due[due.length - 1]; // more than one due at once (a late sign-up): send the nearest one only, mark the rest
    const stop = `${origin}/api/remind/stop?u=${r.unsub}`, page = `${origin}/events/${e.id}/`, go = `${origin}/plan/?ev=${e.id}&go=1`;
    const line = `${e.name} ${SAY[k]}`, where = [e.venue, e.city, e.country].filter(Boolean).join(", ");
    out.push({ to: r.email, subject: k === "week" ? `Next week: ${e.name}` : k === "book" ? `Booking opens: ${e.name}` : `Four months to go: ${e.name}`,
      text: `${line}\n\n${when(e)} · ${where}\n\nThe event: ${page}\nTake me there: ${go}\nOrganiser: ${e.url || e.source}\n\nOur best effort to get the dates right. Always check with the organiser before you book.\n\nStop this reminder: ${stop}`,
      html: `<div style="background:#06303F;padding:24px 12px"><div style="max-width:520px;margin:0 auto;background:#0F5874;border-radius:12px;border-top:4px solid #E8A317;padding:26px 24px;font:16px/1.5 Arial,Helvetica,sans-serif;color:#fff">
<div style="font-weight:800;letter-spacing:.06em;color:#E8A317;font-size:13px;margin-bottom:10px">ONETRACKMIND</div>
<p style="margin:0 0 6px;font-size:18px"><b>${escHtml(e.name)}</b></p><p style="margin:0 0 14px;color:#B5D3DE">${escHtml(when(e))} · ${escHtml(where)}</p>
<p style="margin:0 0 16px">${escHtml(line)}</p>
<p style="margin:0 0 16px"><a href="${escHtml(go)}" style="display:inline-block;background:#E8A317;color:#06303F;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700">Take me there</a> &nbsp;<a href="${escHtml(page)}" style="color:#E8A317;font-weight:700;text-decoration:none">The event ›</a></p>
<p style="margin:0 0 6px;color:#B5D3DE;font-size:14px">Our best effort to get the dates right. Always check with the <a href="${escHtml(e.url || e.source)}" style="color:#E8A317">organiser</a> before you book.</p>
<p style="margin:0;color:#B5D3DE;font-size:13px"><a href="${escHtml(stop)}" style="color:#B5D3DE">Stop this reminder</a></p></div></div>`,
      headers: { "List-Unsubscribe": `<${stop}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } });
    marks.push(D.prepare(`UPDATE reminders SET sent = ? WHERE id = ?`).bind([...sent, ...due].join(","), r.id));
    if (out.length >= 500) break;
  }
  const n = out.length ? await sendBatch(env, out) : 0;
  for (let i = 0; i < marks.length; i += 50) await D.batch(marks.slice(i, i + 50));
  return json({ ok: true, sent: n });
});
