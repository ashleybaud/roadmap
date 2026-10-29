// GET ?u=...: the unsubscribe link at the bottom of every newsletter. Shows one button, so a mail scanner opening the link doesn't unsubscribe anyone.
// POST ?u=...: the button, and the mail app's own one-click unsubscribe (List-Unsubscribe-Post).
import { handle, db, now, brandPage } from "../../server/otm.js";
const ok = u => /^[0-9a-f]{20,64}$/.test(u);
export const onRequestGet = handle(async ({ request }) => {
  const u = new URL(request.url).searchParams.get("u") || "";
  if (!ok(u)) return brandPage("That unsubscribe link isn't complete.");
  return brandPage("Stop The OneTrackMind Week?", `<form method="post" action="/api/unsubscribe?u=${u}"><button style="display:block;width:100%;padding:12px 16px;border-radius:10px;border:0;background:#E8A317;color:#06303F;font:700 16px system-ui,sans-serif;cursor:pointer">Yes, unsubscribe me</button></form>
<p style="color:#B5D3DE;margin:14px 0 0">Too many? <a href="/api/subscribe/prefs?u=${u}" style="color:#E8A317;font-weight:700">Get it less often instead</a>.</p>`);
});
export const onRequestPost = handle(async ({ request, env }) => {
  const u = new URL(request.url).searchParams.get("u") || "";
  if (ok(u)) { const D = await db(env); await D.prepare(`UPDATE subscribers SET unsub_at = ? WHERE unsub = ?`).bind(now(), u).run(); }
  if ((request.headers.get("Content-Type") || "").includes("form") && !(await request.clone().text()).includes("One-Click"))
    return brandPage("You're unsubscribed. No more emails.", `<p style="color:#B5D3DE">Changed your mind? <a href="/api/subscribe/prefs?u=${u}" style="color:#E8A317;font-weight:700">Come back</a>.</p>`);
  return new Response("ok");
});
