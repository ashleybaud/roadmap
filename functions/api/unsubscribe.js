// GET ?u=...: one-tap unsubscribe link at the bottom of every newsletter.
import { handle, db, now } from "../../server/otm.js";
const page = (msg) => new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OneTrackMind</title>
<body style="font-family:system-ui,sans-serif;max-width:480px;margin:15vh auto;padding:0 16px;color:#11262B;background:#EEF3F3"><h1 style="font-size:1.4rem">${msg}</h1><p><a href="/" style="color:#0F7B8A">Back to OneTrackMind</a></p></body>`,
  { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
export const onRequestGet = handle(async ({ request, env }) => {
  const u = new URL(request.url).searchParams.get("u") || "";
  if (!/^[0-9a-f]{20,64}$/.test(u)) return page("That unsubscribe link isn't complete.");
  const D = await db(env); await D.prepare(`UPDATE subscribers SET unsub_at = ? WHERE unsub = ?`).bind(now(), u).run();
  return page("You're unsubscribed. No more emails.");
});
