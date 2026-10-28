// GET ?t=...: the link in the confirmation email.
import { handle, db, sha256, now } from "../../../server/otm.js";
const page = (msg) => new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OneTrackMind</title>
<body style="font-family:system-ui,sans-serif;max-width:480px;margin:15vh auto;padding:0 16px;color:#11262B;background:#EEF3F3"><h1 style="font-size:1.4rem">${msg}</h1><p><a href="/" style="color:#0F7B8A">Back to OneTrackMind</a></p></body>`,
  { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
export const onRequestGet = handle(async ({ request, env }) => {
  const raw = new URL(request.url).searchParams.get("t") || "";
  if (!/^[0-9a-f]{64}$/.test(raw)) return page("That link isn't complete. Copy the whole link from the email.");
  const D = await db(env), r = await D.prepare(`UPDATE subscribers SET confirmed_at = ?, token_hash = NULL WHERE token_hash = ?`).bind(now(), await sha256(raw)).run();
  return page(r.meta && r.meta.changes ? "You're on the list. Thanks!" : "That link has already been used or has expired. Sign up again from the site.");
});
