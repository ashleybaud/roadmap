// GET ?t=...: the link in the "Remind me" email. Confirms the reminder; reminders already past are marked as skipped so nothing arrives late.
// If they ticked the newsletter too, they're added to it, confirmed by the same tap.
import { handle, db, sha256, now, newId, brandPage, siteEvents, remindDue, REMIND_KINDS, escHtml } from "../../../server/otm.js";
export const onRequestGet = handle(async ({ request, env }) => {
  const raw = new URL(request.url).searchParams.get("t") || "";
  if (!/^[0-9a-f]{64}$/.test(raw)) return brandPage("That link isn't complete.", `<p>Copy the whole link from the email.</p>`);
  const D = await db(env), h = await sha256(raw), t = now();
  const row = await D.prepare(`SELECT email, event_id, kinds, news, unsub FROM reminders WHERE token_hash = ?`).bind(h).first();
  if (!row) return brandPage("That link has already been used or has expired.", `<p>Tap Remind me on the event again.</p>`);
  const e = (await siteEvents(env, request)).find(x => x.id === row.event_id) || null, today = new Date().toISOString().slice(0, 10);
  const kinds = String(row.kinds).split(",").filter(Boolean);
  // already past: skip, so the first email isn't a late one. "The week before" inside the last week still goes out once.
  const skip = e ? kinds.filter(k => k !== "week" && (!remindDue(e, k) || remindDue(e, k) < today)) : [];
  await D.prepare(`UPDATE reminders SET confirmed_at = ?, token_hash = NULL, sent = ? WHERE token_hash = ?`).bind(t, skip.join(","), h).run();
  if (row.news) await D.prepare(`INSERT INTO subscribers (email, source, created, unsub, confirmed_at) VALUES (?, 'remind', ?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET confirmed_at = COALESCE(subscribers.confirmed_at, excluded.confirmed_at), unsub_at = NULL, token_hash = NULL`).bind(row.email, t, newId(24), t).run();
  const left = kinds.filter(k => !skip.includes(k)).map(k => REMIND_KINDS[k].toLowerCase());
  return brandPage("Reminder set.", `<p>${e ? `<b>${escHtml(e.name)}</b>: ` : ""}${left.length ? `we'll email you ${escHtml(left.join(" and "))}.` : "the dates for these reminders have passed, so nothing more will be sent."}${row.news ? " The OneTrackMind Week starts on Monday." : ""}</p>
<p style="color:#B5D3DE">Our best effort to get the dates right. Always check with the organiser before you book.</p>`);
});
