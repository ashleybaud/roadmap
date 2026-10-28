// POST {email, back}: emails a one-time sign-in link and a 6-digit code (valid 20 minutes). No password anywhere.
// Returns {poll}: a secret only the asking device holds. It waits with /api/auth/poll, so opening the link on a phone signs this device in too.
import { handle, json, body, db, newId, sha256, now, sendEmail, validEmail, sameOrigin, HttpError, escHtml, humanCheck } from "../../../server/otm.js";

export const onRequestPost = handle(async ({ request, env }) => {
  sameOrigin(request);
  const b = await body(request, 2000), email = String(b.email || "").trim().toLowerCase();
  if (!validEmail(email)) throw new HttpError(400, "That email address doesn't look right.");
  await humanCheck(env, request, b.turnstile);
  const D = await db(env), t = now();
  const recent = await D.prepare(`SELECT COUNT(*) AS n FROM login_tokens WHERE email = ? AND created > ?`).bind(email, t - 3600e3).first();
  if (recent && recent.n >= 5) throw new HttpError(429, "Too many sign-in emails in the last hour. Use the newest one, or try again later.");
  const raw = newId(32), origin = new URL(request.url).origin;
  const back = typeof b.back === "string" && b.back.startsWith("/") && !b.back.startsWith("//") ? b.back.slice(0, 200) : "/";
  const poll = newId(24), code = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
  await D.prepare(`INSERT INTO login_tokens (id, email, created, expires, back, poll, code) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(await sha256(raw), email, t, t + 20 * 60e3, back, await sha256(poll), await sha256(code)).run();
  const link = `${origin}/api/auth/verify?t=${raw}`;
  await sendEmail(env, {
    to: email,
    subject: "Your OneTrackMind sign-in link",
    text: `Tap this link to sign in to OneTrackMind:\n\n${link}\n\nOr type this code on the screen that's waiting: ${code}\n\nOpening the link on your phone also signs in the computer you asked from. It works once and expires in 20 minutes. If you didn't ask for it, ignore this email.\n\nOneTrackMind · Recce. Ride. Report.`,
    html: `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;color:#18201C">
      <p>Tap the button to sign in to OneTrackMind.</p>
      <p><a href="${escHtml(link)}" style="display:inline-block;background:#0B6E4F;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:600">Sign in</a></p>
      <p>Or type this code on the screen that's waiting:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:6px;font-family:monospace">${code}</p>
      <p style="color:#5C6660;font-size:14px">Opening the link on your phone also signs in the computer you asked from. It works once and expires in 20 minutes. If you didn't ask for it, ignore this email.</p>
      <p style="color:#5C6660;font-size:13px">OneTrackMind · Recce. Ride. Report.</p></div>`,
  });
  return json({ ok: true, poll });
});
