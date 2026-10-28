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
  const raw = newId(32), unsub = newId(24), origin = new URL(request.url).origin, src = clean(b.source, 60) || "site";
  await D.prepare(`INSERT INTO subscribers (email, source, created, token_hash, unsub) VALUES (?,?,?,?,?)
    ON CONFLICT(email) DO UPDATE SET created = excluded.created, token_hash = excluded.token_hash, confirmed_at = NULL, unsub_at = NULL`).bind(email, src, t, await sha256(raw), unsub).run();
  const link = `${origin}/api/subscribe/confirm?t=${raw}`;
  await sendEmail(env, { to: email, subject: "Confirm your OneTrackMind newsletter sign-up",
    text: `Tap this link to confirm you want the OneTrackMind newsletter (new trips, events and how-to guides, about once a month):\n\n${link}\n\nIf you didn't ask for it, ignore this email and nothing will be sent.`,
    html: `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;color:#11262B"><p>Tap the button to confirm the OneTrackMind newsletter: new trips, events and how-to guides, about once a month.</p><p><a href="${escHtml(link)}" style="display:inline-block;background:#0F7B8A;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:600">Yes, send it</a></p><p style="color:#54666A;font-size:14px">If you didn't ask for it, ignore this email and nothing will be sent.</p></div>` });
  return json({ ok: true });
});
