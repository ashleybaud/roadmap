// POST {email, event, kinds:["4m","book","week"], news, website}: "Remind me" on an event.
// Double opt-in like the newsletter: nothing is sent until they tap the link in the email. "news" also signs them up to the newsletter, only if they ticked it.
// "website" is a hidden field only bots fill in.
import { handle, json, body, db, newId, sha256, now, sendEmail, validEmail, sameOrigin, HttpError, escHtml, limitIp, siteEvents, REMIND_KINDS, remindDue } from "../../server/otm.js";
const range = e => { const M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"], a = new Date(e.start + "T12:00:00Z"), b = new Date(e.end + "T12:00:00Z");
  return e.start === e.end ? `${a.getUTCDate()} ${M[a.getUTCMonth()]} ${a.getUTCFullYear()}` : `${a.getUTCDate()} ${M[a.getUTCMonth()]} – ${b.getUTCDate()} ${M[b.getUTCMonth()]} ${b.getUTCFullYear()}`; };
export const onRequestPost = handle(async ({ request, env }) => {
  sameOrigin(request);
  const b = await body(request, 2000), email = String(b.email || "").trim().toLowerCase();
  if (b.website) return json({ ok: true });
  if (!validEmail(email)) throw new HttpError(400, "That email address doesn't look right.");
  await limitIp(env, request, "remind", 10, 3600e3, "Lots of reminders from here. Try again in an hour.");
  const id = String(b.event || ""); if (!/^[\w-]{2,120}$/.test(id)) throw new HttpError(400, "Which event?");
  const e = (await siteEvents(env, request)).find(x => x.id === id); if (!e) throw new HttpError(404, "That event isn't on the list any more.");
  const today = new Date().toISOString().slice(0, 10);
  if (e.start <= today) throw new HttpError(400, "That one has already started.");
  const kinds = [...new Set((Array.isArray(b.kinds) ? b.kinds : []).map(String))].filter(k => REMIND_KINDS[k] && remindDue(e, k) && (k === "week" || remindDue(e, k) >= today));
  if (!kinds.length) throw new HttpError(400, "Pick at least one reminder that's still to come.");
  const D = await db(env), t = now(), news = b.news ? 1 : 0;
  const row = await D.prepare(`SELECT confirmed_at, unsub_at, created, kinds FROM reminders WHERE email = ? AND event_id = ?`).bind(email, id).first();
  // already confirmed: add the new choices, no second email (same answer for everyone, so nobody can test who's signed up)
  if (row && row.confirmed_at && !row.unsub_at) {
    const all = [...new Set([...String(row.kinds).split(",").filter(Boolean), ...kinds])].join(",");
    await D.prepare(`UPDATE reminders SET kinds = ? WHERE email = ? AND event_id = ?`).bind(all, email, id).run();
    return json({ ok: true });
  }
  if (row && !row.confirmed_at && t - row.created < 600e3) return json({ ok: true }); // a link was sent in the last 10 minutes
  const raw = newId(32), origin = new URL(request.url).origin;
  await D.prepare(`INSERT INTO reminders (id, email, event_id, kinds, news, token_hash, unsub, created) VALUES (?,?,?,?,?,?,?,?)
    ON CONFLICT(email, event_id) DO UPDATE SET kinds = excluded.kinds, news = excluded.news, token_hash = excluded.token_hash, created = excluded.created, confirmed_at = NULL, unsub_at = NULL, sent = ''`)
    .bind(newId(12), email, id, kinds.join(","), news, await sha256(raw), newId(24), t).run();
  const link = `${origin}/api/remind/confirm?t=${raw}`, what = kinds.map(k => REMIND_KINDS[k].toLowerCase()).join(", ");
  await sendEmail(env, { to: email, subject: `Confirm your reminder: ${e.name}`,
    text: `Tap this link to get reminders for ${e.name} (${range(e)}): ${what}.${news ? " You also asked for The OneTrackMind Week." : ""}\n\n${link}\n\nIf you didn't ask for it, ignore this email and nothing will be sent.`,
    html: `<div style="background:#06303F;padding:24px 12px"><div style="max-width:520px;margin:0 auto;background:#0F5874;border-radius:12px;border-top:4px solid #E8A317;padding:26px 24px;font:16px/1.5 Arial,Helvetica,sans-serif;color:#fff">
<div style="font-weight:800;letter-spacing:.06em;color:#E8A317;font-size:13px;margin-bottom:10px">ONETRACKMIND</div>
<p style="margin:0 0 14px">One tap and we'll remind you about <b>${escHtml(e.name)}</b> (${escHtml(range(e))}): ${escHtml(what)}.${news ? " You also asked for <b>The OneTrackMind Week</b>, every Monday." : ""}</p>
<p style="margin:0 0 16px"><a href="${escHtml(link)}" style="display:inline-block;background:#E8A317;color:#06303F;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700">Yes, remind me</a></p>
<p style="margin:0;color:#B5D3DE;font-size:14px">If you didn't ask for it, ignore this email and nothing will be sent.</p></div></div>` });
  return json({ ok: true });
});
