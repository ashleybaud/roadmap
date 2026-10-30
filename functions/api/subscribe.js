// POST {email, source, website}: newsletter sign-up. Sends a confirmation link (double opt-in); nothing is sent until they tap it.
// "website" is a hidden field only bots fill in.
import { handle, json, body, db, newId, sha256, now, sendEmail, validEmail, sameOrigin, HttpError, escHtml, clean } from "../../server/otm.js";

export const onRequestPost = handle(async ({ request, env }) => {
  sameOrigin(request);
  const b = await body(request, 2000), email = String(b.email || "").trim().toLowerCase();
  if (b.website) return json({ ok: true });
  if (!validEmail(email)) throw new HttpError(400, "That email address doesn't look right.");
  const D = await db(env), t = now();
  const recent = await D.prepare(`SELECT COUNT(*) AS n FROM subscribers WHERE created > ?`).bind(t - 3600e3).first();
  if (recent && recent.n >= 60) throw new HttpError(429, "Lots of sign-ups right now. Try again in an hour.");
  const row = await D.prepare(`SELECT confirmed_at, unsub_at, created FROM subscribers WHERE email = ?`).bind(email).first();
  if (row && row.confirmed_at && !row.unsub_at) return json({ ok: true, already: true });
  if (row && !row.confirmed_at && t - row.created < 600e3) return json({ ok: true }); // a link was sent in the last 10 minutes
  const name = clean(b.name, 40).replace(/[<>"{}]/g, "");
  const raw = newId(32), unsub = newId(24), origin = new URL(request.url).origin, src = clean(b.source, 60) || "site";
  await D.prepare(`INSERT INTO subscribers (email, source, created, token_hash, unsub, name) VALUES (?,?,?,?,?,?)
    ON CONFLICT(email) DO UPDATE SET name = COALESCE(NULLIF(excluded.name, ''), subscribers.name), created = excluded.created, token_hash = excluded.token_hash, confirmed_at = NULL, unsub_at = NULL`).bind(email, src, t, await sha256(raw), unsub, name).run();
  const link = `${origin}/api/subscribe/confirm?t=${raw}`;
  await sendEmail(env, { to: email, subject: "Confirm: The OneTrackMind Week",
    text: `Tap this link to confirm you want The OneTrackMind Week (what's on, last week's results and a road worth riding, Monday mornings; change it to every two weeks or monthly any time):\n\n${link}\n\nIf you didn't ask for it, ignore this email and nothing will be sent.`,
    html: `<div style="background:#06303F;padding:24px 12px"><div style="max-width:520px;margin:0 auto;background:#0F5874;border-radius:14px;border-top:4px solid #E8A317;padding:26px 24px;font:16px/1.5 Arial,Helvetica,sans-serif;color:#fff">
<div style="font-weight:800;letter-spacing:.06em;color:#E8A317;font-size:13px;margin-bottom:10px">ONETRACKMIND</div>
<p style="margin:0 0 14px">One tap and you're on the list for <b>The OneTrackMind Week</b>: what's on, last week's results and a road worth riding, every Monday morning. You can change it to every two weeks or monthly from any email.</p>
<p style="margin:0 0 16px"><a href="${escHtml(link)}" style="display:inline-block;background:#E8A317;color:#06303F;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700">Yes, send it</a></p>
<p style="margin:0;color:#B5D3DE;font-size:14px">If you didn't ask for it, ignore this email and nothing will be sent.</p></div></div>` });
  return json({ ok: true });
});
