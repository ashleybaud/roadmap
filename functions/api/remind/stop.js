// GET ?u=...: the "stop" link at the bottom of every reminder. Shows buttons, so a mail scanner opening the link doesn't stop anything.
// POST ?u=...: stops this reminder (&all=1: every reminder for that email). Also the mail app's one-click unsubscribe (List-Unsubscribe-Post).
import { handle, db, now, brandPage } from "../../../server/otm.js";
const ok = u => /^[0-9a-f]{20,64}$/.test(u);
const btn = "display:block;width:100%;padding:12px 16px;border-radius:10px;font:700 16px system-ui,sans-serif;cursor:pointer;margin:0 0 8px";
export const onRequestGet = handle(async ({ request }) => {
  const u = new URL(request.url).searchParams.get("u") || "";
  if (!ok(u)) return brandPage("That link isn't complete.");
  return brandPage("Stop this reminder?", `<form method="post" action="/api/remind/stop?u=${u}"><button style="${btn};border:0;background:#E8A317;color:#06303F">Stop this reminder</button></form>
<form method="post" action="/api/remind/stop?u=${u}&all=1"><button style="${btn};border:1px solid #2B7896;background:#13617E;color:#fff">Stop all my event reminders</button></form>`);
});
export const onRequestPost = handle(async ({ request, env }) => {
  const q = new URL(request.url).searchParams, u = q.get("u") || "";
  if (ok(u)) {
    const D = await db(env);
    if (q.get("all") === "1") { const r = await D.prepare(`SELECT email FROM reminders WHERE unsub = ?`).bind(u).first(); if (r) await D.prepare(`UPDATE reminders SET unsub_at = ? WHERE email = ? AND unsub_at IS NULL`).bind(now(), r.email).run(); }
    else await D.prepare(`UPDATE reminders SET unsub_at = ? WHERE unsub = ?`).bind(now(), u).run();
  }
  if ((request.headers.get("Content-Type") || "").includes("form") && !(await request.clone().text()).includes("One-Click"))
    return brandPage("Done. No more reminders.", `<p style="color:#B5D3DE">The OneTrackMind Week is separate: its own emails have their own unsubscribe link.</p>`);
  return new Response("ok");
});
