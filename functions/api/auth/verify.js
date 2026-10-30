// GET ?t=...: the link from the email. Shows "Sign in?" with where the request came from; only the button (a POST) signs in,
// so a mail scanner opening the link, or a link someone else asked for, signs nobody in.
import { handle, db, sha256, now, startSession, userFor, sameOrigin, escHtml } from "../../../server/otm.js";

const shell = (inner, status = 200) => new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Sign in · OneTrackMind</title>
<body style="margin:0;background:#121A1E;font:16px/1.5 Arial,Helvetica,sans-serif;color:#fff"><div style="max-width:480px;margin:12vh auto;padding:26px 24px;background:#0F5874;border-radius:12px;border-top:4px solid #E8A317">
<div style="font-weight:800;letter-spacing:.06em;color:#E8A317;font-size:13px;margin-bottom:10px">ONETRACKMIND</div>${inner}</div></body>`,
  { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Frame-Options": "DENY", "Referrer-Policy": "no-referrer" } });
const page = (msg) => shell(`<h1 style="font-size:1.3rem;margin:0 0 12px">${msg}</h1><p style="margin:0"><a href="/" style="color:#E8A317">Back to OneTrackMind</a></p>`, 400);
async function token(D, raw) {
  if (!/^[0-9a-f]{64}$/.test(raw)) return [null, "That sign-in link isn't complete. Copy the whole link from the email."];
  const tok = await D.prepare(`SELECT * FROM login_tokens WHERE id = ?`).bind(await sha256(raw)).first();
  if (!tok) return [null, "That sign-in link isn't valid. Ask for a new one."];
  if (tok.used) return [null, "That sign-in link has already been used. Ask for a new one."];
  if (tok.expires < now()) return [null, "That sign-in link has expired. Ask for a new one."];
  return [tok, null];
}
export const onRequestGet = handle(async ({ request, env }) => {
  const raw = new URL(request.url).searchParams.get("t") || "", D = await db(env), [tok, err] = await token(D, raw);
  if (err) return page(err);
  const mins = Math.max(1, Math.round((now() - tok.created) / 60e3));
  return shell(`<h1 style="font-size:1.3rem;margin:0 0 10px">Sign in to OneTrackMind?</h1>
<p style="margin:0 0 6px">As <b>${escHtml(tok.email)}</b>.</p>
<p style="margin:0 0 16px;color:#B5D3DE">Asked for ${mins} minute${mins === 1 ? "" : "s"} ago${tok.req_where ? ` from around <b style="color:#fff">${escHtml(tok.req_where)}</b>` : ""}. The device that asked will be signed in too.</p>
<form method="post"><input type="hidden" name="t" value="${raw}"><button type="submit" style="background:#E8A317;color:#0B1D21;border:0;border-radius:10px;padding:12px 22px;font-weight:700;font-size:16px;cursor:pointer">Yes, sign me in</button></form>
<p style="margin:16px 0 0;font-size:14px;color:#B5D3DE">Didn't ask for this? Close this page and nothing happens.</p>`);
});
export const onRequestPost = handle(async ({ request, env }) => {
  sameOrigin(request);
  const f = await request.formData().catch(() => null), raw = String((f && f.get("t")) || ""), D = await db(env), [tok, err] = await token(D, raw);
  if (err) return page(err);
  const user = await userFor(D, tok.email);
  const r = await D.prepare(`UPDATE login_tokens SET used = 1, approved_user = ? WHERE id = ? AND used = 0`).bind(user.id, tok.id).run(); // the waiting device can now pick up its own sign-in
  if (!r.meta || !r.meta.changes) return page("That sign-in link has already been used. Ask for a new one.");
  const cookie = await startSession(env, user.id), back = tok.back && tok.back.startsWith("/") && !/^\/[\\/]/.test(tok.back) ? tok.back : "/";
  return new Response(null, { status: 303, headers: { "Location": back + (back.includes("?") ? "&" : "?") + "signedin=1", "Set-Cookie": cookie, "Cache-Control": "no-store" } });
});
