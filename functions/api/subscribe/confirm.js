// GET ?t=...: the link in the confirmation email. Confirms, then offers "how often".
import { handle, db, sha256, now, brandPage, FREQS } from "../../../server/otm.js";
export const freqButtons = (u, cur) => `<p style="margin:14px 0 8px;color:#B5D3DE">How often would you like it?</p><div style="display:flex;flex-direction:column;gap:8px">${Object.entries(FREQS).map(([k, t]) =>
  `<a href="/api/subscribe/prefs?u=${u}&f=${k}" style="display:block;padding:12px 16px;border-radius:10px;text-decoration:none;font-weight:700;${k === cur ? "background:#E8A317;color:#06303F" : "background:#13617E;color:#fff;border:1px solid #2B7896"}">${t}${k === cur ? " ✓" : ""}</a>`).join("")}</div>`;
export const onRequestGet = handle(async ({ request, env }) => {
  const raw = new URL(request.url).searchParams.get("t") || "";
  if (!/^[0-9a-f]{64}$/.test(raw)) return brandPage("That link isn't complete.", `<p>Copy the whole link from the email.</p>`);
  const D = await db(env), h = await sha256(raw);
  const row = await D.prepare(`SELECT unsub, freq FROM subscribers WHERE token_hash = ?`).bind(h).first();
  if (!row) return brandPage("That link has already been used or has expired.", `<p>Sign up again from the site.</p>`);
  await D.prepare(`UPDATE subscribers SET confirmed_at = ?, token_hash = NULL WHERE token_hash = ?`).bind(now(), h).run();
  return brandPage("You're on the list. Thanks!", `<p>The OneTrackMind Week lands on Monday mornings: what's on, last week's results and a road worth riding.</p>${freqButtons(row.unsub, row.freq || "weekly")}`);
});
