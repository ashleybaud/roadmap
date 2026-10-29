// Builds "The OneTrackMind Week" from the site's own data: events, results, Founder's fav's, routes.
// Usage: node scripts/newsletter.mjs [--from 2026-11-02] [--period weekly|fortnightly|monthly]
// Writes newsletter/<from>-<period>/index.html (email body, also the "view in browser" copy) and email.txt.
// {{UNSUB}} and {{PREFS}} are filled in per subscriber when it is sent.
import fs from "fs"; import path from "path";
const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const J = f => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8")); } catch (e) { return null; } };
const EV = J("data/events/events.json") || [], WATCH = J("data/events/watch.json") || {}, RES = J("data/events/results.json") || {};
const FAV = J("data/favourites/favourites.json") || [], PICKS = ((J("data/picks/picks.json") || {}).routes || []).filter(r => !r.draft);
const SITE = "https://onetrackmind.online";
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const monday = d => { const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x.toISOString().slice(0, 10); };
const add = (s, n) => { const d = new Date(s + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const period = arg("period", "weekly"), DAYS = { weekly: 7, fortnightly: 14, monthly: 28 }[period] || 7;
const from = arg("from", monday(add(new Date().toISOString().slice(0, 10), 7))), to = add(from, DAYS - 1), lastFrom = add(from, -DAYS);
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fd = (s, y) => { const d = new Date(s + "T12:00:00Z"); return `${d.getUTCDate()} ${M[d.getUTCMonth()]}${y ? " " + d.getUTCFullYear() : ""}`; };
const rng = e => e.start === e.end ? fd(e.start) : `${fd(e.start)} – ${fd(e.end)}`;
const hav = (a, b) => { const R = 6371, x = Math.sin((b.lat - a.lat) * Math.PI / 360) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin((b.lon - a.lon) * Math.PI / 360) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
const week = Math.floor(new Date(from + "T12:00:00Z") / 6048e5);

const on = EV.filter(e => e.start <= to && e.end >= from).sort((a, b) => a.start.localeCompare(b.start));
const last = EV.filter(e => e.end >= lastFrom && e.end < from).sort((a, b) => a.end.localeCompare(b.end));
const RANK = { f1: 0, endurance: 1, festival: 2, bikes: 3, rally: 4, us: 5, sa: 6, offroad: 7 };
// the names everyone knows go first, whatever their series
const BIG = /SEMA|EICMA|Goodwood|Le Mans|Daytona|Indianapolis 500|Indy 500|Pikes Peak|Isle of Man|TT Races|Dakar|Monaco|Pebble Beach|Car Week|Essen Motor|N(ü|u)rburgring 24|Bathurst|Macau|Spa 24|Rennsport|Luftgek|Sebring|Baja 1000|North West 200|Laguna Seca/i;
const rank = e => (BIG.test(e.name) ? -1 : (RANK[e.category] ?? 9));
const head = [...on].sort((a, b) => rank(a) - rank(b) || (b.confirmed - a.confirmed))[0];
const nearHead = head ? FAV.map(f => ({ f, d: hav(head, f) })).filter(x => x.d <= 200).sort((a, b) => a.d - b.d).slice(0, 3) : [];
const routeNear = head && PICKS.map(r => ({ r, d: r.trip && r.trip.start ? hav(head, r.trip.start) : 1e9 })).filter(x => x.d <= 400).sort((a, b) => a.d - b.d)[0];
const curve = routeNear ? routeNear.r : PICKS[week % PICKS.length];
const IDEAS = [
  ["Fly to the race, ride home the long way", "Book a one-way car or bike hire. The race is the excuse; the road back is the trip."],
  ["Bring the partner", "Every event page lists what else is nearby. Pick one thing for them each day and the weekend sells itself."],
  ["Turn a race weekend into four days", "Arrive Thursday, leave Monday. Put the venue in as your finish and let the planner find the roads."],
  ["Go a week early", "Race weeks fill every bed for 100 km. The week before is quiet, cheaper, and the museums are empty."],
  ["Follow your series", "Tap the star next to any series on the events page. The map and this email then put yours first."],
  ["Near me, on the road", "Stopped somewhere new? Near me with Petrolhead on shows every track, museum and car place around you."],
];
const idea = IDEAS[week % IDEAS.length];

// email-safe building blocks: tables and inline styles only
const C = { bg: "#0A4A63", panel: "#0F5874", ink: "#F4F8F9", muted: "#B5D3DE", gold: "#E8A317", dark: "#0B1D21" };
const H2 = t => `<tr><td style="padding:26px 24px 6px;font:700 20px/1.2 Arial,Helvetica,sans-serif;letter-spacing:.5px;text-transform:uppercase;color:${C.gold}">${t}</td></tr>`;
const P = (t, s = "") => `<tr><td style="padding:4px 24px;font:15px/1.5 Arial,Helvetica,sans-serif;color:${C.ink};${s}">${t}</td></tr>`;
const A = (u, t) => `<a href="${esc(u)}" style="color:${C.gold};font-weight:bold;text-decoration:none">${t}</a>`;
const BTN = (u, t) => `<a href="${esc(u)}" style="display:inline-block;background:${C.gold};color:${C.dark};font:bold 14px Arial,Helvetica,sans-serif;text-decoration:none;padding:10px 16px;border-radius:6px">${t}</a>`;
const evRow = e => { const w = (WATCH[e.series] || {}).watch || [];
  return `<tr><td style="padding:10px 24px;border-top:1px solid #2B7896;font:15px/1.45 Arial,Helvetica,sans-serif;color:${C.ink}"><b style="font-size:16px">${esc(e.name)}</b>${e.confirmed ? "" : ` <span style="color:${C.muted};font-size:12px">(dates unconfirmed)</span>`}<br><span style="color:${C.muted}">${rng(e)} · ${esc(e.venue || e.city || "")}${e.country ? ", " + esc(e.country) : ""}</span><br>${A(`${SITE}/events/${e.id}/`, "Plan the trip ›")}${w[0] ? ` &nbsp; ${A(w[0].url, "Watch: " + esc(w[0].label) + " ›")}` : ""}${e.tickets ? ` &nbsp; ${A(e.tickets, "Tickets ›")}` : ""}</td></tr>`; };
const resRow = e => { const r = RES[e.id], w = WATCH[e.series] || {};
  const body = r && r.podium ? `1. ${esc(r.podium[0])}${r.podium[1] ? ` · 2. ${esc(r.podium[1])}` : ""}${r.podium[2] ? ` · 3. ${esc(r.podium[2])}` : ""}` : (r && r.link) || w.results ? A((r && r.link) || w.results, r && r.fresh ? "Results are in ›" : "Official results ›") : `<span style="color:${C.muted}">Results on the ${A(e.url || e.source, "official site")}</span>`;
  return `<tr><td style="padding:8px 24px;border-top:1px solid #2B7896;font:15px/1.45 Arial,Helvetica,sans-serif;color:${C.ink}"><b>${esc(e.name)}</b> <span style="color:${C.muted}">· ${rng(e)}</span><br>${body}</td></tr>`; };

const title = `The OneTrackMind ${period === "weekly" ? "Week" : period === "fortnightly" ? "Fortnight" : "Month"}`;
const subject = head ? `${head.name}, and ${Math.max(0, on.length - 1)} more on ${period === "weekly" ? "this week" : "the calendar"}` : `${title}: what's on, ${fd(from)} – ${fd(to, 1)}`;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#06303F">
<div style="display:none;max-height:0;overflow:hidden">${esc(head ? `${head.name} ${rng(head)}. What's on, where to watch, and the road there.` : "What's on in motorsport and where to ride.")}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#06303F"><tr><td align="center" style="padding:16px 8px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${C.bg};border-radius:12px">
<tr><td style="padding:22px 24px 4px;font:bold 26px Arial,Helvetica,sans-serif;letter-spacing:1px;color:${C.ink}">ONETRACKMIND</td></tr>
<tr><td style="padding:0 24px 14px;font:13px Arial,Helvetica,sans-serif;color:${C.muted};border-bottom:3px solid ${C.gold}">${title} · ${fd(from)} – ${fd(to, 1)} · ${A(`${SITE}/newsletter/${from}-${period}/`, "View in browser")}</td></tr>
${H2(period === "weekly" ? "This week" : "Coming up")}
${on.length ? on.slice(0, 12).map(evRow).join("") : P("A quiet one on the calendar. Good week to ride instead.")}
${last.length ? H2(period === "weekly" ? "Last week" : "Since last time") + last.slice(0, 10).map(resRow).join("") : ""}
${head && nearHead.length ? H2(`Around ${esc(head.name)}`) + P(`If you're going, these are worth the detour:`) + nearHead.map(({ f, d }) => P(`${A(`${SITE}/favourites/${f.id}/`, esc(f.name))} · ${Math.round(d)} km · ${esc(f.short || "")}`)).join("") + P(`Turn on 🏁 Petrolhead and tap Near me in the planner for every museum and track around the venue.`, `color:${C.muted};font-size:13px`) : ""}
${curve ? H2(routeNear ? "The road there" : "Curves of the week") + P(`<b>${esc(curve.title)}</b><br><span style="color:${C.muted}">${esc(curve.region || "")}</span><br>${esc(curve.blurb || "")}`) + `<tr><td style="padding:10px 24px">${BTN(`${SITE}/routes/${curve.id}/`, "Show the route ›")}</td></tr>` : ""}
${head ? H2("Make a trip of it") + P(`${A(`https://www.booking.com/searchresults.html?latitude=${head.lat}&longitude=${head.lon}&radius=30&checkin=${add(head.start, -1)}&checkout=${add(head.end, 1)}`, `Beds near ${esc(head.venue || head.city)} ›`)}<br>${A(`https://www.google.com/travel/flights?q=${encodeURIComponent("Flights to " + (head.city || head.venue))}`, `Flights to ${esc(head.city || head.venue)} ›`)}<br>${A(`https://www.discovercars.com/?a_aid=onetrackmind`, "Hire a car there ›")}`) + P("Some of these links pay OneTrackMind a small fee, at no cost to you.", `color:${C.muted};font-size:12px`) : ""}
${H2("One idea")}${P(`<b>${esc(idea[0])}.</b> ${esc(idea[1])}`)}
<tr><td style="padding:24px 24px 6px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.panel};border-left:5px solid ${C.gold};border-radius:8px"><tr>
<td width="96" style="padding:10px"><img src="https://alterego.online/cdn/shop/files/3158941636033974733_2048.jpg?v=1792398701&width=240" width="84" height="84" alt="AlterEgo hoodie" style="display:block;border-radius:6px;background:#fff"></td>
<td style="padding:10px 12px 10px 0;font:14px/1.4 Arial,Helvetica,sans-serif;color:${C.ink}"><img src="${SITE}/img/alterego-logo-white.png" width="64" height="56" alt="AlterEgo" style="display:block;margin:0 0 6px"><span style="font-size:11px;color:${C.muted};letter-spacing:1px">AD</span><br><b style="color:${C.gold};font-size:18px">BUILD. RACE. REPEAT.</b><br>Made to order for petrolheads. ${A("https://alterego.online/?utm_source=onetrackmind&utm_medium=newsletter", "Shop ›")}</td></tr></table></td></tr>
<tr><td style="padding:18px 24px 6px"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="52"><img src="${SITE}/img/ashley.jpg" width="44" height="44" alt="" style="display:block;border-radius:22px;border:2px solid ${C.gold};object-fit:cover"></td>
<td style="font:14px/1.45 Arial,Helvetica,sans-serif;color:${C.ink}">Ride safe. Reply to this email if there's a race, road or place I should know about.<br><b>Ashley</b> · ${A(SITE, "onetrackmind.online")}</td></tr></table></td></tr>
<tr><td style="padding:16px 24px 22px;font:12px/1.5 Arial,Helvetica,sans-serif;color:${C.muted}">You get this because you signed up at onetrackmind.online. ${A("{{PREFS}}", "Change how often")} · ${A("{{UNSUB}}", "Unsubscribe")}</td></tr>
</table></td></tr></table></body></html>`;

const text = [`${title} · ${fd(from)} – ${fd(to, 1)}`, "", period === "weekly" ? "THIS WEEK" : "COMING UP",
  ...(on.length ? on.slice(0, 12).map(e => `- ${e.name}, ${rng(e)}, ${e.venue || e.city || ""}: ${SITE}/events/${e.id}/`) : ["A quiet one. Good week to ride instead."]),
  ...(last.length ? ["", "LAST WEEK", ...last.slice(0, 10).map(e => `- ${e.name}: ${(RES[e.id] && RES[e.id].podium) ? "1. " + RES[e.id].podium[0] : (WATCH[e.series] || {}).results || e.url || ""}`)] : []),
  ...(curve ? ["", routeNear ? "THE ROAD THERE" : "CURVES OF THE WEEK", `${curve.title}: ${SITE}/routes/${curve.id}/`] : []),
  "", "ONE IDEA", `${idea[0]}. ${idea[1]}`, "", "Change how often: {{PREFS}}", "Unsubscribe: {{UNSUB}}"].join("\n");

const dir = path.join(ROOT, "newsletter", `${from}-${period}`); fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "index.html"), html.replace(/\{\{(UNSUB|PREFS)\}\}/g, SITE + "/"));
fs.writeFileSync(path.join(dir, "email.html"), html);
fs.writeFileSync(path.join(dir, "email.txt"), text);
fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify({ subject, from, to, period, events: on.length, last: last.length }, null, 1));
// the list the admin panel reads: newest first, with what each issue is
const idx = fs.readdirSync(path.join(ROOT, "newsletter")).filter(d => /^\d{4}-\d\d-\d\d-(weekly|fortnightly|monthly)$/.test(d))
  .map(d => { try { return { id: d, ...JSON.parse(fs.readFileSync(path.join(ROOT, "newsletter", d, "meta.json"), "utf8")) }; } catch (e) { return null; } })
  .filter(Boolean).sort((a, b) => b.id.localeCompare(a.id)).slice(0, 30);
fs.writeFileSync(path.join(ROOT, "newsletter", "index.json"), JSON.stringify(idx, null, 1));
console.log(`${subject} | ${on.length} on, ${last.length} last | ${path.relative(ROOT, dir)}`);
