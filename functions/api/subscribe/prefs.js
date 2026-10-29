// GET ?u=<unsubscribe key>[&f=weekly|fortnightly|monthly]: the "Change how often" link in every newsletter.
import { handle, db, brandPage, FREQS } from "../../../server/otm.js";
import { freqButtons } from "./confirm.js";
export const onRequestGet = handle(async ({ request, env }) => {
  const q = new URL(request.url).searchParams, u = q.get("u") || "", f = q.get("f") || "";
  if (!/^[0-9a-f]{20,64}$/.test(u)) return brandPage("That link isn't complete.", `<p>Use the link at the bottom of any newsletter.</p>`);
  const D = await db(env), row = await D.prepare(`SELECT freq, unsub_at, confirmed_at FROM subscribers WHERE unsub = ?`).bind(u).first();
  if (!row || !row.confirmed_at) return brandPage("We couldn't find that sign-up.", `<p>Sign up again from the site.</p>`);
  let cur = row.freq || "weekly", title = "How often?";
  if (FREQS[f]) { await D.prepare(`UPDATE subscribers SET freq = ?, unsub_at = NULL WHERE unsub = ?`).bind(f, u).run(); cur = f; title = `Done. ${FREQS[f]} it is.`; }
  else if (row.unsub_at) title = "You're unsubscribed. Pick one to come back.";
  return brandPage(title, `${freqButtons(u, cur)}<p style="margin:16px 0 0;font-size:.9rem"><a href="/api/unsubscribe?u=${u}" style="color:#B5D3DE">Unsubscribe instead</a></p>`);
});
