// GET ?u=<unsubscribe key>[&f=weekly|fortnightly|monthly][&k=<kind to switch on or off>]: the "Choose what you get" link in every newsletter.
import { handle, db, brandPage, FREQS, KINDS } from "../../../server/otm.js";
import { freqButtons } from "./confirm.js";
const kindButtons = (u, want) => `<p style="margin:22px 0 8px;color:#B5D3DE">What do you want in it? Tap to switch on or off.</p><div style="display:flex;flex-direction:column;gap:8px">${Object.entries(KINDS).map(([k, t]) => { const on = !want.length || want.includes(k);
  return `<a href="/api/subscribe/prefs?u=${u}&k=${k}" style="display:block;padding:12px 16px;border-radius:10px;text-decoration:none;font-weight:700;${on ? "background:#E8A317;color:#06303F" : "background:#13617E;color:#B5D3DE;border:1px solid #2B7896"}">${on ? "✓ " : ""}${t}</a>`; }).join("")}</div>`;
export const onRequestGet = handle(async ({ request, env }) => {
  const q = new URL(request.url).searchParams, u = q.get("u") || "", f = q.get("f") || "", k = q.get("k") || "";
  if (!/^[0-9a-f]{20,64}$/.test(u)) return brandPage("That link isn't complete.", `<p>Use the link at the bottom of any newsletter.</p>`);
  const D = await db(env), row = await D.prepare(`SELECT freq, kinds, unsub_at, confirmed_at FROM subscribers WHERE unsub = ?`).bind(u).first();
  if (!row || !row.confirmed_at) return brandPage("We couldn't find that sign-up.", `<p>Sign up again from the site.</p>`);
  let cur = row.freq || "weekly", title = "Choose what you get";
  let want = String(row.kinds || "").split(",").filter(x => KINDS[x]); if (!want.length) want = Object.keys(KINDS);
  if (FREQS[f]) { await D.prepare(`UPDATE subscribers SET freq = ?, unsub_at = NULL WHERE unsub = ?`).bind(f, u).run(); cur = f; title = `Done. ${FREQS[f]} it is.`; }
  else if (KINDS[k]) {
    want = want.includes(k) ? want.filter(x => x !== k) : [...want, k];
    if (!want.length) title = "Keep at least one switched on.", want = [k];
    else { title = want.includes(k) ? `${KINDS[k].split(":")[0]} is in.` : `${KINDS[k].split(":")[0]} is out.`; }
    await D.prepare(`UPDATE subscribers SET kinds = ? WHERE unsub = ?`).bind(want.length === Object.keys(KINDS).length ? null : want.join(","), u).run();
  }
  else if (row.unsub_at) title = "You're unsubscribed. Pick one to come back.";
  return brandPage(title, `${freqButtons(u, cur)}${kindButtons(u, want)}<p style="margin:16px 0 0;font-size:.9rem"><a href="/api/unsubscribe?u=${u}" style="color:#B5D3DE">Unsubscribe instead</a></p>`);
});
