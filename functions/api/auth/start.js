// POST {email, back}: emails a one-time sign-in link (valid 20 minutes). No password anywhere.
import { handle, json, body, db, newId, sha256, now, sendEmail, validEmail, sameOrigin, HttpError, escHtml } from "../../../server/otm.js";

export const onRequestPost = handle(async ({ request, env }) => {
  sameOrigin(request);
  const b = await body(request, 2000), email = String(b.email || "").trim().toLowerCase();
  if (!validEmail(email)) throw new HttpError(400, "That email address doesn't look right.");
  const D = await db(env), t = now();
  const recent = await D.prepare(`SELECT COUNT(*) AS n FROM login_tokens WHERE email = ? AND created > ?`).bind(email, t - 3600e3).first();
  if (recent && recent.n >= 5) throw new HttpError(429, "Too many sign-in emails in the last hour. Use the newest one, or try again later.");
  const raw = newId(32), origin = new URL(request.url).origin;
  const back = typeof b.back === "string" && b.back.startsWith("/") && !b.back.startsWith("//") ? b.back.slice(0, 200) : "/";
  await D.prepare(`INSERT INTO login_tokens (id, email, created, expires, back) VALUES (?, ?, ?, ?, ?)`).bind(await sha256(raw), email, t, t + 20 * 60e3, back).run();
  const link = `${origin}/api/auth/verify?t=${raw}`;
  await sendEmail(env, {
    to: email,
    subject: "Your OneTrackMind sign-in link",
    text: `Tap this link to sign in to OneTrackMind:\n\n${link}\n\nIt works once and expires in 20 minutes. If you didn't ask for it, ignore this email.\n\nOneTrackMind · Recce. Ride. Report.`,
    html: `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;color:#18201C">
      <p>Tap the button to sign in to OneTrackMind.</p>
      <p><a href="${escHtml(link)}" style="display:inline-block;background:#0B6E4F;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:600">Sign in</a></p>
      <p style="color:#5C6660;font-size:14px">It works once and expires in 20 minutes. If you didn't ask for it, ignore this email.</p>
      <p style="color:#5C6660;font-size:13px">OneTrackMind · Recce. Ride. Report.</p></div>`,
  });
  return json({ ok: true });
});
