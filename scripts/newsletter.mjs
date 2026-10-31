// Builds "The OneTrackMind Week" from the site's own data: events, results, POI, routes.
// Usage: node scripts/newsletter.mjs [--from 2026-11-02] [--period weekly|fortnightly|monthly]
// Writes newsletter/<from>-<period>/index.html (email body, also the "view in browser" copy) and email.txt.
// {{UNSUB}} and {{PREFS}} are filled in per subscriber when it is sent.
import fs from "fs"; import path from "path";
const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const J = f => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8")); } catch (e) { return null; } };
const EV = J("data/events/events.json") || [], WATCH = J("data/events/watch.json") || {}, RES = J("data/events/results.json") || {};
const FAV = J("data/favourites/favourites.json") || [], PICKS = ((J("data/picks/picks.json") || {}).routes || []).filter(r => !r.draft);
const SITE = "https://onetrackmind.online";
// seasonal campaigns live during this issue (Christmas, Father's Day, long weekends, next year's calendar)
const CAMP = (J("data/campaigns.json") || {}).campaigns || [];
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const monday = d => { const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x.toISOString().slice(0, 10); };
const add = (s, n) => { const d = new Date(s + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const period = arg("period", "weekly"), DAYS = { weekly: 7, fortnightly: 14, monthly: 28 }[period] || 7;
const from = arg("from", monday(add(new Date().toISOString().slice(0, 10), 7))), to = add(from, DAYS - 1), lastFrom = add(from, -DAYS);
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fd = (s, y) => { const d = new Date(s + "T12:00:00Z"); return `${d.getUTCDate()} ${M[d.getUTCMonth()]}${y ? " " + d.getUTCFullYear() : ""}`; };
const HOUSE = (await import("module")).createRequire(import.meta.url)(path.join(ROOT, "src/js/02-house.js"));
const rng = e => HOUSE.range(e.start, e.end, false);
const TRIP = (await import("module")).createRequire(import.meta.url)(path.join(ROOT, "src/js/03-trip.js"));
TRIP.setAirports(J("data/airports.json") || []);
const hav = (a, b) => { const R = 6371, x = Math.sin((b.lat - a.lat) * Math.PI / 360) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin((b.lon - a.lon) * Math.PI / 360) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
const week = Math.floor(new Date(from + "T12:00:00Z") / 6048e5);
// the sign-off: one of the founder's "event / cars" pairs, word for word, a new one each week (ISO week number of the issue's Monday)
const JUX = J("data/juxtapositions.json") || { pairs: [] };
const isoWeek = d => { const t = new Date(d + "T12:00:00Z"), y = new Date(Date.UTC(t.getUTCFullYear(), 0, 4, 12)); t.setUTCDate(t.getUTCDate() + 3 - (t.getUTCDay() + 6) % 7); return 1 + Math.round(((t - y) / 864e5 - 3 + (y.getUTCDay() + 6) % 7) / 7); };
const pair = JUX.pairs.length ? JUX.pairs[(isoWeek(from) - 1) % JUX.pairs.length] : null;
// "My pick" at the top (data/founder.json): only when the founder has filled it in and the event hasn't finished
const FD = J("data/founder.json") || {}, PK = FD.myPick || {}, pickEv = PK.event && (PK.line || "").trim() ? EV.find(e => e.id === PK.event && e.end >= from) : null;

const on = EV.filter(e => e.start <= to && e.end >= from).sort((a, b) => a.start.localeCompare(b.start));
const last = EV.filter(e => e.end >= lastFrom && e.end < from).sort((a, b) => a.end.localeCompare(b.end));
const RANK = { f1: 0, endurance: 1, festival: 2, bikes: 3, rally: 4, us: 5, sa: 6, offroad: 7 };
// the names everyone knows go first, whatever their series
const BIG = /SEMA|EICMA|Goodwood|Le Mans|Daytona|Indianapolis 500|Indy 500|Pikes Peak|Isle of Man|TT Races|Dakar|Monaco|Pebble Beach|Car Week|Essen Motor|N(ü|u)rburgring 24|Bathurst|Macau|Spa 24|Rennsport|Luftgek|Sebring|Baja 1000|North West 200|Laguna Seca/i;
// the size of the event first (tier), home races a step up for our South African readers, then the kind of racing
const rank = e => ((e.tier || (BIG.test(e.name) ? 1 : 2)) - 1) * 10 + (e.country === "South Africa" ? -5 : 0) + (RANK[e.category] ?? 9);
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
  ["Near me, on the road", "Stopped somewhere new? Near me with High Octane on shows every track, museum and car place around you."],
];
const idea = IDEAS[week % IDEAS.length];

// The opening: "Hi {{NAME}}," then the week in one breath, in plain words, from the data. {{NAME}} is filled in per subscriber when it is sent.
const DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const dow = s => DAY[new Date(s + "T12:00:00Z").getUTCDay()];
const SER = { f1: "F1", motogp: "MotoGP", superbike: "WorldSBK" };
const short = e => { let n = e.name.replace(/\s*\(.*?\)/g, "").replace(/\s+20\d\d$/, "").replace(/^[A-Z0-9 ]+:\s*/, "").replace(/^([A-Z]{3,}) Show$/, "$1").replace(/^[A-Z][a-z]+'s (?=\S+ \S+)/, "");
  const c = (e.city || "").split(",")[0], m = c && n.match(new RegExp("^([A-Z]{3,}) " + c + "$")); return m ? m[1] : n; };
const racing = e => !/shows|classics|bikefest/.test(e.genre);
const label = e => { const s = SER[e.genre]; if (!s) return short(e); const v = e.venue || "";
  return v && !/\s/.test(v) ? `${s} at ${v}` : `${s} in ${(e.city || e.country || "").split(",")[0]}`; };
const lead = [...on].sort((a, b) => rank(a) - rank(b)).filter(e => (e.tier || 2) <= 2);
const shows = lead.filter(e => !racing(e)).slice(0, 2).sort((a, b) => a.start.localeCompare(b.start)), races = lead.filter(racing).slice(0, 3);
const bits = shows.map(e => e.start < from ? `${short(e)} is on in ${(e.city || "").split(",")[0]} all week` : `${short(e)} opens in ${(e.city || e.venue || "").split(",")[0]} on ${dow(e.start)}`);
const byDay = {}; races.forEach(e => (byDay[e.end] = byDay[e.end] || []).push(e));
Object.keys(byDay).sort().forEach(d => { const L = byDay[d]; bits.push(L.length > 1 ? `${dow(d)} is a ${L.length === 2 ? "double" : "triple"}: ${L.slice(0, -1).map(label).join(", ")} and ${label(L[L.length - 1])}` : `${label(L[0])} on ${dow(d)}`); });
const and = L => L.length > 1 ? L.slice(0, -1).join(", ") + (L.length > 2 ? "," : "") + " and " + L[L.length - 1] : L[0] || "";
const pastBits = last.filter(e => (e.tier || 2) <= 2 || e.country === "South Africa").sort((a, b) => rank(a) - rank(b)).slice(0, 3)
  .map(e => { const r = RES[e.id], w = r && r.podium && r.podium[0]; return w ? `${w.split(" ").slice(-1)[0]} won ${label(e)}` : label(e); });
const lastLine = pastBits.length ? `Last week: ${and(pastBits)}.` : "";
const opener0 = !on.length ? "Quiet one on the calendar. Good week to ride instead." : `${on.length >= 5 ? "Big week. " : on.length >= 3 ? "Good week. " : ""}${and(bits) || short(on[0]) + " is on"}.`;
const opener = lastLine ? `${lastLine} This week${on.length ? ": " + opener0.replace(/^(Big|Good) week\. /, "") : " is quiet. Good week to ride instead."}` : opener0;



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


// what's hot this month, for the featured route when no route goes near the week's big event
const HOT0 = { "namaqua-coast": [8, 9], "west-coast-gravel": [8, 9, 10], "cederberg-traverse": [3, 4, 5, 9, 10], "tankwa-gannaga": [4, 5, 6, 7, 8], "die-hel": [3, 4, 5, 9, 10, 11], "swartberg-loop": [3, 4, 5, 9, 10, 11], "seweweekspoort-ouberg": [3, 4, 5, 9, 10], "baviaanskloof": [3, 4, 5, 9, 10, 11], "seven-passes-prince-alfred": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], "sani-pass": [10, 11, 12, 1, 2, 3, 4], "wild-coast-2019": [3, 4, 5, 9, 10], "speedweek-hakskeenpan": [9, 10], "namib-sesriem": [5, 6, 7, 8, 9], "namibia-2020-tortoise": [5, 6, 7, 8, 9], "namibia-2017-epupa": [5, 6, 7, 8, 9], "namibia-2020-orange-river": [4, 5, 6, 7, 8, 9], "namibia-2004-orange-river-mouth": [4, 5, 6, 7, 8, 9], "eu-road-trip-2018": [5, 6, 7, 8, 9], "eu-road-trip-2019": [5, 6, 7, 8, 9], "motor-valley-2017": [5, 6, 7, 8, 9, 10] };
const HOT = Object.assign({}, HOT0, Object.fromEntries(PICKS.filter(r => r.season && r.season.months).map(r => [r.id, r.season.months]))); // the routes' own seasons win
const mon = new Date(from + "T12:00:00Z").getUTCMonth() + 1, hotNow = PICKS.filter(r => (HOT[r.id] || []).includes(mon));
const route = routeNear ? routeNear.r : (hotNow.length ? hotNow : PICKS)[week % Math.max(1, (hotNow.length ? hotNow : PICKS).length)];
// featured place: one near the week's big event, otherwise the next one in turn
const poi = nearHead.length ? nearHead[0].f : FAV[week % Math.max(1, FAV.length)];
// Local is lekker: the latest Saturday run, or the campaign itself until the first one is up
const LIL = (J("data/local-is-lekker.json") || []).slice(-1)[0];
const lil = LIL ? { img: /^https?:/.test(LIL.photo || "") ? LIL.photo : SITE + (LIL.photo || ""), title: `${LIL.place}, ${LIL.town}`, line: LIL.line || LIL.vehicle || "", url: LIL.lat != null ? `${SITE}/plan/?poi=${LIL.lat},${LIL.lon}&n=${encodeURIComponent(LIL.place)}&go=1` : `${SITE}/local-is-lekker/`, cta: "Take me there" }
  : { img: `${SITE}/media/founder/porsche-cayman-portimao-pitlane.jpg`, title: "Saturday breakfast runs", line: "One of my cars or bikes, somewhere new for breakfast, and the road there.", url: `${SITE}/local-is-lekker/`, cta: "Check it out" };

// every event this week. Each row is marked with its kind of racing, so the send can leave out what a subscriber has switched off.
const KIND = e => { const g = e.genre; return g === "adventure" ? "adventure" : g === "f1" ? "f1" : /motogp|superbike|mx|roadrace|bikefest/.test(g) ? "bikes" : /endurance|rally|offroad|hillclimb|timeattack/.test(g) ? "endurance" : /nascar|indycar/.test(g) ? "us" : "shows"; };
const BTN2 = (u, t) => `<a href="${esc(u)}" style="display:inline-block;border:2px solid ${C.gold};color:${C.gold};font:bold 13px Arial,Helvetica,sans-serif;text-decoration:none;padding:7px 12px;border-radius:6px">${t}</a>`;
const evCard = e => { const w = (WATCH[e.series] || {}).watch || [], d = new Date(e.start + "T12:00:00Z");
  return `<!--k:${KIND(e)}--><tr><td style="padding:12px 24px;border-top:1px solid #2B7896"><table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
<td width="54" valign="top" style="padding:8px 0;border-radius:8px;background:${e.country === "South Africa" ? "#E8A317" : HOUSE.colour(e.genre)};font:bold 22px/1 Arial,Helvetica,sans-serif;color:#121A1E;text-align:center">${d.getUTCDate()}<br><span style="font-size:12px;text-transform:uppercase">${M[d.getUTCMonth()]}</span></td>
<td style="padding-left:10px;font:15px/1.45 Arial,Helvetica,sans-serif;color:${C.ink}"><b style="font-size:16px">${esc(short(e))}</b><br><span style="color:${C.muted}">${rng(e)} · ${esc((e.city || e.venue || "").split(",")[0])}, ${esc(e.country || "")}${e.confirmed ? "" : " · date to confirm"}</span><br>
<span style="display:inline-block;margin-top:8px">${BTN(`${SITE}/plan/?ev=${e.id}&go=1`, "Take me there ›")}</span>${e.tickets ? ` <span style="display:inline-block;margin-top:8px">${BTN2(e.tickets, "Tickets")}</span>` : ""}${w[0] ? ` <span style="display:inline-block;margin-top:8px">${BTN2(w[0].url, "Watch")}</span>` : ""}</td></tr></table></td></tr><!--/k-->`; };

const title = `The OneTrackMind ${period === "weekly" ? "Week" : period === "fortnightly" ? "Fortnight" : "Month"}`;
const tops = [...shows, ...races].sort((a, b) => rank(a) - rank(b)).slice(0, 3).map(e => SER[e.genre] ? label(e) : short(e));
const subject = tops.length ? `${and(tops)} ${period === "weekly" ? "this week" : "coming up"}` : `${title}: what's on, ${fd(from)} – ${fd(to, 1)}`;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#06303F">
<div style="display:none;max-height:0;overflow:hidden">${esc(opener)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#06303F"><tr><td align="center" style="padding:16px 8px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${C.bg};border-radius:12px">
<tr><td style="padding:22px 24px 4px;font:bold 26px Arial,Helvetica,sans-serif;letter-spacing:1px;color:${C.ink}">ONETRACKMIND</td></tr>
<tr><td style="padding:0 24px 14px;font:13px Arial,Helvetica,sans-serif;color:${C.muted};border-bottom:3px solid ${C.gold}">${title} · ${fd(from)} – ${fd(to, 1)} · ${A(`${SITE}/newsletter/${from}-${period}/`, "View in browser")}</td></tr>
${P(`Hi {{NAME}},`, "padding-top:20px;font-size:16px")}
${P(esc(opener), "font-size:16px")}
${pickEv ? `<tr><td style="padding:16px 24px 4px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.panel};border-left:5px solid ${C.gold};border-radius:8px"><tr><td style="padding:12px 14px;font:15px/1.45 Arial,Helvetica,sans-serif;color:${C.ink}">${PK.photo ? `<img src="${esc(/^https?:/.test(PK.photo) ? PK.photo : SITE + PK.photo)}" width="520" alt="" style="display:block;width:100%;height:auto;max-height:280px;object-fit:cover;border-radius:6px;margin:0 0 10px">` : ""}<span style="font-size:11px;letter-spacing:1px;color:${C.gold}">MY PICK</span><br><b style="font-size:17px">${esc(pickEv.name)}</b><br><span style="color:${C.muted}">${rng(pickEv)} · ${esc((pickEv.city || pickEv.venue || "").split(",")[0])}, ${esc(pickEv.country || "")}</span><br>${esc(PK.line.trim())}<br><span style="display:inline-block;margin-top:8px">${BTN(`${SITE}/plan/?ev=${pickEv.id}&go=1`, "Take me there ›")}</span>${PK.video ? ` <span style="display:inline-block;margin-top:8px">${BTN2(PK.video, "Watch")}</span>` : ""} <span style="display:inline-block;margin-top:8px">${BTN2(`${SITE}/events/${pickEv.id}/`, "Remind me")}</span></td></tr></table></td></tr>` : ""}
<tr><td style="padding:16px 24px 4px"><a href="${esc(lil.url)}" style="text-decoration:none;display:block;background:${C.panel};border-radius:10px;overflow:hidden"><img src="${esc(lil.img)}" width="552" alt="" style="display:block;width:100%;height:auto;max-height:300px;object-fit:cover;border:0">
<span style="display:block;padding:12px 14px;font:15px/1.45 Arial,Helvetica,sans-serif;color:${C.ink}"><span style="font-size:11px;letter-spacing:1px;color:${C.gold}">LOCAL IS LEKKER</span><br><b style="font-size:17px">${esc(lil.title)}</b><br>${esc(lil.line)}<br><b style="color:${C.gold}">${lil.cta} ›</b></span></a></td></tr>
${H2(period === "weekly" ? "This week" : "Coming up")}
${on.length ? on.map(evCard).join("\n") : P("Nothing on the calendar. Good week to ride instead.")}
${head ? `<tr><td style="padding:12px 24px 4px;font:14px/1.6 Arial,Helvetica,sans-serif;color:${C.muted}">Make a trip of ${esc(short(head))}: ${TRIP.tiles({ place: head.venue || head.city, town: (head.city || "").split(",")[0], country: head.country, lat: head.lat, lon: head.lon, from: head.confirmed && head.start > from ? add(head.start, -1) : "", to: head.confirmed && head.start > from ? add(head.end, 1) : "", tickets: head.tickets }).map(t => A(t.u, t.t)).join(" · ")}</td></tr>` : ""}
<!--none-->${P(`Nothing in your kinds of racing this week. ${A("{{PREFS}}", "Change what you get ›")}`, `color:${C.muted}`)}<!--/none-->
${route ? H2(routeNear ? "The road there" : "Route of the week") + P(`<b style="font-size:16px">${esc(route.title)}</b><br><span style="color:${C.muted}">${esc(route.region || "")}</span><br>${esc(route.blurb || "")}`) + `<tr><td style="padding:10px 24px">${BTN(`${SITE}/routes/${route.id}/`, "Ride it ›")}</td></tr>` : ""}
${poi ? H2("POI") + P(`<b style="font-size:16px">${esc(poi.name)}</b><br><span style="color:${C.muted}">${esc(poi.area || "")}</span><br>${esc(poi.short || "")}`) + `<tr><td style="padding:10px 24px;font:15px Arial,Helvetica,sans-serif">${BTN(`${SITE}/plan/?poi=${poi.lat},${poi.lon}&n=${encodeURIComponent(poi.name)}&go=1`, "Take me there ›")} &nbsp;${A(`${SITE}/favourites/${poi.id}/`, "Read about it")}</td></tr>` : ""}
<tr><td style="padding:24px 24px 6px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.panel};border-left:5px solid ${C.gold};border-radius:8px"><tr>
<td width="96" style="padding:10px"><img src="https://alterego.online/cdn/shop/files/3158941636033974733_2048.jpg?v=1792398701&width=240" width="84" height="84" alt="AlterEgo hoodie" style="display:block;border-radius:6px;background:#fff"></td>
<td style="padding:10px 12px 10px 0;font:14px/1.4 Arial,Helvetica,sans-serif;color:${C.ink}"><img src="${SITE}/img/alterego-logo-white.png" width="64" height="56" alt="AlterEgo" style="display:block;margin:0 0 6px"><span style="font-size:11px;color:${C.muted};letter-spacing:1px">AD</span><br><b style="color:${C.gold};font-size:18px">BUILD. RACE. REPEAT.</b><br>Made to order for petrolheads. ${A("https://alterego.online/?utm_source=onetrackmind&utm_medium=newsletter", "Shop ›")}</td></tr></table></td></tr>
<tr><td style="padding:18px 24px 6px"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="52"><img src="${SITE}/img/ashley.jpg" width="44" height="44" alt="" style="display:block;border-radius:22px;border:2px solid ${C.gold};object-fit:cover"></td>
<td style="font:14px/1.45 Arial,Helvetica,sans-serif;color:${C.ink}">${pair ? `<span style="display:block;margin:0 0 8px;font-size:15px"><b>${esc(pair[0])}</b><br>${esc(pair[1])}</span>` : ""}<b style="text-transform:uppercase;letter-spacing:.5px">Racing is life. <span style="color:${C.gold}">Everything else is preparation.</span></b><br>Ride safe. Reply if there's a race, road or place I should know about.<br><b>Ashley</b> · ${A(SITE, "onetrackmind.online")}</td></tr></table></td></tr>
<tr><td style="padding:6px 24px 0;font:11px/1 Arial,Helvetica,sans-serif;color:${C.muted};letter-spacing:1px">FUELLED BY <a href="https://alterego.online/?utm_source=onetrackmind&utm_medium=newsletter&utm_content=powered" style="text-decoration:none"><img src="${SITE}/img/alterego-logo-white.png" width="40" height="35" alt="AlterEgo" style="vertical-align:middle;margin-left:6px;border:0"></a></td></tr>
<tr><td style="padding:16px 24px 22px;font:12px/1.5 Arial,Helvetica,sans-serif;color:${C.muted}">The Members Club is a collaboration between OneTrackMind and AlterEgo. OneTrackMind's founder is one of AlterEgo's partners, and AlterEgo ads are marked "Ad". Your email address stays with OneTrackMind and is never shared.<br>You get this because you signed up at onetrackmind.online. ${A("{{PREFS}}", "Choose what you get")} · ${A("{{UNSUB}}", "Unsubscribe")}</td></tr>
</table></td></tr></table></body></html>`;

const text = [`${title} · ${fd(from)} – ${fd(to, 1)}`, "", "Hi {{NAME}},", "", opener, "", ...(pickEv ? [`MY PICK: ${pickEv.name}, ${rng(pickEv)}. ${PK.line.trim()} Take me there: ${SITE}/plan/?ev=${pickEv.id}&go=1`, ""] : []), `LOCAL IS LEKKER: ${lil.title}. ${lil.line} ${lil.url}`, "", period === "weekly" ? "THIS WEEK" : "COMING UP",
  ...(on.length ? on.map(e => `<!--k:${KIND(e)}-->- ${short(e)}, ${rng(e)}, ${(e.city || e.venue || "").split(",")[0]}. Take me there: ${SITE}/plan/?ev=${e.id}&go=1<!--/k-->`) : ["Nothing on the calendar. Good week to ride instead."]),
  ...(route ? ["", routeNear ? "THE ROAD THERE" : "ROUTE OF THE WEEK", `${route.title}: ${SITE}/routes/${route.id}/`] : []),
  ...(poi ? ["", "POI", `${poi.name}, ${poi.area || ""}: ${SITE}/favourites/${poi.id}/`] : []), "", ...(pair ? [pair[0], pair[1], ""] : []), "Racing is life. Everything else is preparation.", "Ashley", "", "Fuelled by AlterEgo: https://alterego.online", "The Members Club is a collaboration between OneTrackMind and AlterEgo. OneTrackMind's founder is one of AlterEgo's partners, and AlterEgo ads are marked \"Ad\". Your email address stays with OneTrackMind and is never shared.", "", "Choose what you get: {{PREFS}}", "Unsubscribe: {{UNSUB}}"].join("\n");

const dir = path.join(ROOT, "newsletter", `${from}-${period}`); fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "index.html"), html.replace(/\{\{(UNSUB|PREFS)\}\}/g, SITE + "/").replace(/\{\{NAME\}\}/g, "there").replace(/<!--none-->[\s\S]*?<!--\/none-->/g, ""));
fs.writeFileSync(path.join(dir, "email.html"), html);
fs.writeFileSync(path.join(dir, "email.txt"), text);
fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify({ subject, from, to, period, events: on.length, last: last.length }, null, 1));
// the list the admin panel reads: newest first, with what each issue is
const idx = fs.readdirSync(path.join(ROOT, "newsletter")).filter(d => /^\d{4}-\d\d-\d\d-(weekly|fortnightly|monthly)$/.test(d))
  .map(d => { try { return { id: d, ...JSON.parse(fs.readFileSync(path.join(ROOT, "newsletter", d, "meta.json"), "utf8")) }; } catch (e) { return null; } })
  .filter(Boolean).sort((a, b) => b.id.localeCompare(a.id)).slice(0, 30);
fs.writeFileSync(path.join(ROOT, "newsletter", "index.json"), JSON.stringify(idx, null, 1));
console.log(`${subject} | ${on.length} on, ${last.length} last | ${path.relative(ROOT, dir)}`);
