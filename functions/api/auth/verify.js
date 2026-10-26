// GET ?t=...: the link from the email. Signs in (creating the account the first time) and goes back to the planner.
import { handle, db, sha256, now, startSession, userFor } from "../../../server/otm.js";

const page = (msg) => new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OneTrackMind</title>
<body style="font-family:system-ui,sans-serif;max-width:480px;margin:15vh auto;padding:0 16px;color:#18201C;background:#EEF0EA"><h1 style="font-size:1.4rem">${msg}</h1><p><a href="/">Back to the planner</a></p></body>`,
  { status: 400, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });

export const onRequestGet = handle(async ({ request, env }) => {
  const raw = new URL(request.url).searchParams.get("t") || "";
  if (!/^[0-9a-f]{64}$/.test(raw)) return page("That sign-in link isn't complete. Copy the whole link from the email.");
  const D = await db(env), id = await sha256(raw), t = now();
  const tok = await D.prepare(`SELECT * FROM login_tokens WHERE id = ?`).bind(id).first();
  if (!tok) return page("That sign-in link isn't valid. Ask for a new one.");
  if (tok.used) return page("That sign-in link has already been used. Ask for a new one.");
  if (tok.expires < t) return page("That sign-in link has expired. Ask for a new one.");
  const user = await userFor(D, tok.email);
  await D.prepare(`UPDATE login_tokens SET used = 1, approved_user = ? WHERE id = ?`).bind(user.id, id).run(); // the waiting device can now pick up its own sign-in
  const cookie = await startSession(env, user.id), back = tok.back || "/";
  return new Response(null, { status: 302, headers: { "Location": back + (back.includes("?") ? "&" : "?") + "signedin=1", "Set-Cookie": cookie, "Cache-Control": "no-store" } });
});
