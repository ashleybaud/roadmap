// Builds the plain-text pages search engines and AI tools can read:
// /routes/<id>/ for every published pick, /routes/, /about/, sitemap.xml, robots.txt, llms.txt.
// Source: data/picks/picks.json (stats come from scripts/pick-stats, run in a browser).
// Run: node scripts/make-pages.mjs   (build.sh runs it)
import fs from "node:fs"; import path from "node:path";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SITE = "https://onetrackmind.online";
const BLOG = "https://onetrackmind.co.za";
// blog photos: served from media/blog/ once copied off the old site (scripts/fetch-blog-media.mjs); the old address until then
const STORIES = JSON.parse(fs.readFileSync(path.join(ROOT, "data/stories/stories.json"), "utf8").replace(/https?:\/\/(?:www\.)?onetrackmind\.co\.za\/wp-content\/uploads\/([^"\s\\]+)/g, (m, r) => { try { return fs.existsSync(path.join(ROOT, "media/blog", decodeURIComponent(r))) ? "/media/blog/" + r : m; } catch { return m; } }));
const FAV = JSON.parse(fs.readFileSync(path.join(ROOT, "data/favourites/favourites.json"), "utf8"));
const picks = JSON.parse(fs.readFileSync(path.join(ROOT, "data/picks/picks.json"), "utf8")).routes;
const live = picks.filter(r => !r.draft);
const LINES = fs.existsSync(path.join(ROOT, "data/picks/lines.json")) ? JSON.parse(fs.readFileSync(path.join(ROOT, "data/picks/lines.json"), "utf8")) : {};
const today = new Date().toISOString().slice(0, 10);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const VEH = { bike: "Motorbike", jeep: "4x4", car: "Car" };
const STYLE = { rough: "Road less travelled", mixed: "Mixed", tar: "Tar" };
const GR = ["Surface unknown", "Race", "Pre-jeep", "Jeep", "Pre-single", "Single"];
const GRTXT = ["", "tar and smooth roads", "graded gravel and good dirt roads", "rough tracks: corrugations, loose stones, ruts", "rocks, steep climbs, sand, river crossings", "bike-only single track or serious 4x4 terrain"];
const km = n => Math.round(n).toLocaleString("en-ZA").replace(/ /g, " ");

function stops(r) {
  const t = r.trip, out = [], first = t.start;
  let from = first;
  t.days.forEach((d, i) => {
    const to = d.to || (i === t.days.length - 1 ? (t.round ? first : t.end || first) : null);
    out.push({ n: i + 1, from: from.name, to: to ? to.name : "", via: (d.vias || []).map(v => v.name) });
    if (to) from = to;
  });
  return out;
}
const places = r => { const s = [r.trip.start, ...r.trip.days.flatMap(d => [...(d.vias || []), ...(d.to ? [d.to] : [])])]; if (r.trip.end) s.push(r.trip.end); const seen = new Set(); return s.filter(p => p && !seen.has(p.name) && seen.add(p.name)); };

const CSS = `:root{--bg:#EEF0EA;--panel:#fff;--ink:#18201C;--muted:#5C6660;--line:#D3D8CF;--accent:#0B6E4F;--chip:#E3E7DE;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#121614;--panel:#1A201D;--ink:#E7EBE5;--muted:#9AA39D;--line:#2E3631;--accent:#4CC08F;--chip:#232A26;color-scheme:dark}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:400 17px/1.6 "IBM Plex Sans",system-ui,-apple-system,"Segoe UI",sans-serif}
a{color:var(--accent)}.wrap{max-width:820px;margin:0 auto;padding:0 16px}
header{border-bottom:2px solid var(--ink);padding:14px 0 12px}
.logo{display:inline-block;font:700 2.7rem/1 "Barlow Condensed","Arial Narrow",sans-serif;text-transform:uppercase;letter-spacing:-.005em;color:var(--ink);text-decoration:none}
.motto{font:700 1.2rem "Barlow Condensed","Arial Narrow",sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--accent);margin:2px 0 0}
.hdrlinks{display:grid;grid-template-columns:repeat(4,auto);justify-content:start;gap:0;margin:10px 0 0;background:var(--ink);border-radius:6px;overflow:hidden;width:100%}.hdrlinks a{font:700 1.15rem "Barlow Condensed","Arial Narrow",sans-serif;text-transform:uppercase;letter-spacing:.06em;text-decoration:none;color:var(--bg);padding:9px 20px;border:0;border-bottom:4px solid transparent;background:none;border-radius:0;white-space:nowrap}.hdrlinks a:hover{background:color-mix(in srgb,var(--bg) 12%,transparent)}.hdrlinks a.on{border-bottom-color:#D9A441}@media (max-width:640px){.hdrlinks{grid-template-columns:repeat(2,minmax(0,1fr))}.hdrlinks a{font-size:.95rem;padding:8px 4px;text-align:center;letter-spacing:.03em}}
@media (max-width:640px){.logo{font-size:1.9rem}.motto{font-size:.95rem}}
h1,h2{font-family:"Barlow Condensed","Arial Narrow",sans-serif;line-height:1.1;text-transform:uppercase;letter-spacing:.01em}
h1{font-size:2.4rem;margin:28px 0 6px}h2{font-size:1.5rem;margin:30px 0 8px}
.meta{color:var(--muted);font-size:.95rem}.fdr{color:var(--accent);font-weight:600;margin:6px 0 0}
.cta{display:inline-block;background:var(--accent);color:#fff;font-weight:600;padding:12px 20px;border-radius:6px;text-decoration:none;margin:18px 0 6px}
.stats{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0}.stat{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:8px 14px}.stat b{display:block;font:700 1.4rem "Barlow Condensed",sans-serif}.stat span{font-size:.8rem;color:var(--muted)}
ol.days{padding-left:0;list-style:none}ol.days li{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:10px 14px;margin:8px 0}ol.days .d{font:600 .8rem "IBM Plex Mono",monospace;color:var(--muted)}
blockquote{margin:14px 0;padding:4px 16px;border-left:3px solid var(--accent);background:var(--chip)}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;margin:14px 0}.card{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:12px 14px;text-decoration:none;color:var(--ink)}.card b{display:block;color:var(--accent)}.card span{font-size:.85rem;color:var(--muted)}
footer{border-top:1px solid var(--line);margin:40px 0 0;padding:16px 0 30px;color:var(--muted);font-size:.9rem}
.note{font-size:.9rem;color:var(--muted)}
.spbox{margin:34px 0 0;padding:12px 14px;border:1px dashed var(--line);border-radius:6px;font-size:.92rem;color:var(--muted)}.spbox b{color:var(--ink)}
.intro{font-size:1.1rem}.cards.rides{grid-template-columns:repeat(auto-fill,minmax(260px,1fr))}.card.ride{display:flex;flex-direction:column;gap:4px}.card.ride .yr{font:700 1.6rem "Barlow Condensed",sans-serif;color:var(--accent);line-height:1}.card.ride .lead{color:var(--ink);font-size:.95rem}.card.ride .go{color:var(--accent);font-weight:600;margin-top:auto}
.gethere{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:12px 16px;margin:18px 0}.gethere h2{margin-top:6px}.gethere ul{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px}.gethere li a{display:block;padding:10px 12px;border:1px solid var(--line);border-radius:6px;text-decoration:none;font-weight:600}.gethere li span{display:block;font-weight:400;font-size:.85rem;color:var(--muted)}.card.fav span{display:block}.card.fav .area{font-size:.8rem;color:var(--muted);margin:2px 0 4px}.card.fav span:last-child{color:var(--ink);font-size:.9rem}.tag{display:inline-block;font:600 .72rem "IBM Plex Mono",monospace;background:var(--chip);border-radius:4px;padding:1px 6px;margin-left:4px;vertical-align:middle}
.story img{max-width:100%;height:auto;border-radius:6px;display:block;margin:12px 0}.story figure{margin:14px 0}.story figcaption{font-size:.85rem;color:var(--muted)}
.gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;margin:14px 0}.gallery img{width:100%;aspect-ratio:3/2;object-fit:cover;margin:0}
.cover{width:100%;max-height:420px;object-fit:cover;border-radius:8px;margin:14px 0}.tocome{background:var(--chip);border-radius:6px;padding:8px 12px;font-size:.9rem;color:var(--muted)}
.serieshead{display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap}.snav{display:flex;justify-content:space-between;gap:10px;margin:24px 0;flex-wrap:wrap}.snav a{max-width:48%}
.cards.trips{grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}.card.trip{display:flex;flex-direction:column;gap:4px}.card.trip>img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:4px;margin:-4px 0 6px}.card.trip .routemap{width:100%;height:auto;margin:-4px 0 6px}
.routemap{display:block;width:100%;height:auto;margin:14px 0}.tripmap{height:460px;margin:14px 0;border-radius:8px;border:1px solid var(--line,#d9ddd5)}@media(max-width:640px){.tripmap{height:320px}}.tmlab{background:rgba(255,255,255,.92);border:0;box-shadow:0 1px 3px rgba(0,0,0,.25);font:600 12px IBM Plex Sans,system-ui,sans-serif;padding:2px 6px}.tmlab:before{display:none}.cta.ghost{background:transparent;color:var(--accent);border:2px solid var(--accent);margin-left:8px}
.collage{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;margin:12px 0}.collage .tile{position:relative;display:block;aspect-ratio:4/3;border-radius:6px;overflow:hidden;background:var(--chip);text-decoration:none}.collage .tile img{width:100%;height:100%;object-fit:cover;margin:0;border-radius:0}.collage .tile span{position:absolute;left:0;right:0;bottom:0;padding:8px 10px;background:linear-gradient(transparent,rgba(0,0,0,.75));color:#fff;display:flex;flex-direction:column}.collage .tile small{opacity:.8}
.card.story img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:4px;margin:-4px 0 8px}
.photos{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;margin:18px 0}.photos img{width:100%;aspect-ratio:3/2;object-fit:cover;border-radius:6px}`;

function page({ url, title, desc, body, ld, image, active }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE}${url}">
<meta property="og:type" content="website"><meta property="og:site_name" content="OneTrackMind">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SITE}${url}"><meta property="og:image" content="${SITE}${image || "/img/og.png"}">
<meta name="twitter:card" content="summary_large_image">
<script type="text/javascript">
(function(i,m,p,a,c,t){c.ire_o=p;c[p]=c[p]||function(){(c[p].a=c[p].a||[]).push(arguments)};t=a.createElement(m);var z=a.getElementsByTagName(m)[0];t.async=1;t.src=i;z.parentNode.insertBefore(t,z)})('https://utt.impactcdn.com/P-A310026-5a50-4df7-84c1-b199250868651.js','script','impactStat',document,window);impactStat('trackImpression');
</script>
<link rel="icon" href="/img/icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=IBM+Plex+Sans:wght@400;600&family=IBM+Plex+Mono:wght@500&display=swap">
<style>${CSS}</style>
${(Array.isArray(ld) ? ld : [ld]).filter(Boolean).map(x => `<script type="application/ld+json">${JSON.stringify(x)}</script>`).join("\n")}
</head>
<body><div class="wrap">
<header><a class="logo" href="/">OneTrackMind</a><div class="motto">Recce. Ride. Report.</div><nav class="hdrlinks" aria-label="Site">${[["/","Plan a trip"],["/routes/","Routes"],["/favourites/","Founder's fav's"],["/about/","About"]].map(([h,t])=>`<a href="${h}"${active===h?' class="on" aria-current="page"':""}>${t}</a>`).join("")}</nav></header>
${body}
<aside class="spbox"><span>OneTrackMind is free thanks to</span> <a href="https://alterego.co.za" target="_blank" rel="noopener sponsored"><b>AlterEgo</b>, made-to-order wear for petrolheads</a> · <a href="/advertise/">Your brand here ›</a></aside>
<footer>OneTrackMind: plan road trips anywhere, on the roads less travelled, then ride them on your GPS or phone. Free for riders and drivers. · <a href="/advertise/">Advertise</a> · <a href="/terms.html">Terms and disclaimer</a> · <a href="/privacy.html">Privacy</a> · <a href="/rules.html">Rules</a> · <a href="mailto:hello@onetrackmind.online">hello@onetrackmind.online</a></footer>
</div></body></html>
`;
}

const ORG = { "@type": "Organization", "@id": SITE + "/#org", name: "OneTrackMind", url: SITE, logo: SITE + "/img/icon.svg", sameAs: [BLOG] };
const FOUNDER = { "@type": "Person", "@id": SITE + "/about/#founder", name: "Ashley", jobTitle: "Founder", url: SITE + "/about/", sameAs: [BLOG, BLOG + "/aboutme/"] };

function routePage(r) {
  const S = r.stats || null, st = stops(r), n = r.trip.days.length, f = r.founder;
  const desc = (f ? `Ridden by the founder${f.year ? " in " + f.year : ""}. ` : "") + r.blurb;
  const statBox = S ? `<div class="stats">
<div class="stat"><b>${km(S.km)} km</b><span>${n} day${n > 1 ? "s" : ""}</span></div>
${S.grade ? `<div class="stat"><b>${S.gravelPct}%</b><span>gravel or dirt</span></div>
<div class="stat"><b>${GR[S.grade]}</b><span>hardest grade</span></div>` : `<div class="stat"><b>Tar</b><span>mostly sealed roads</span></div>`}
${S.highM ? `<div class="stat"><b>${km(S.highM)} m</b><span>highest point</span></div>` : ""}
${S.fuelGapKm ? `<div class="stat"><b>${km(S.fuelGapKm)} km</b><span>longest gap without fuel</span></div>` : ""}</div>` : "";
  const dayList = `<ol class="days">${st.map((d, i) => { const s = S && S.days && S.days[i]; return `<li><span class="d">DAY ${d.n}${s ? ` · ${km(s.km)} km${s.gravelPct ? ` · ${s.gravelPct}% gravel` : ""}` : ""}</span><br><b>${esc(d.from)} → ${esc(d.to || "?")}</b>${d.via.length ? `<br><span class="note">Via ${d.via.map(esc).join(", ")}</span>` : ""}</li>`; }).join("")}</ol>`;
  const veh = r.vehicles.map(v => VEH[v]).join(", ");
  const body = `<main>
<h1>${esc(r.title)}</h1>
<div class="meta">${esc(r.region)} · ${n} day${n > 1 ? "s" : ""} · ${esc(veh)} · ${esc(STYLE[r.style] || "")}</div>
${f ? `<p class="fdr">Ridden by the founder${f.year ? " in " + f.year : ""} · ${esc(f.ride)}</p>` : ""}
<p>${esc(r.blurb)}</p>
<a class="cta" href="/?pick=${esc(r.id)}">Open in the planner</a>
<p class="note">Change the dates, stops and your vehicle. The planner works out fuel, night stops, sunset, weather and the grade of every road. Then ride it: GPX straight to your Garmin or bike app, or Google Maps and Waze on your phone.</p>
${statBox}${S ? `<p class="note">Distances and grades from the planner's route on OpenStreetMap roads. Your plan may differ.</p>` : ""}
${S && S.grade ? `<p>Hardest stretch: <b>${GR[S.grade]}</b>, ${GRTXT[S.grade] || ""}. The grade reads differently by vehicle: what's fun on an adventure bike can be slow and hard in a car.</p>` : ""}
<h2>Day by day</h2>${dayList}
${f && f.photos && f.photos.length ? `<div class="photos">${f.photos.map((u, i) => `<img src="${esc(u)}" alt="${esc(r.title)}, ${f.year || ""} photo ${i + 1}" loading="lazy">`).join("")}</div>` : ""}
${f ? `<h2>The story</h2><blockquote><p>${esc(f.story)}</p></blockquote>
${f.tips && f.tips.length ? `<h2>Good to know</h2><ul>${f.tips.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
${f.posts.length ? `<h2>Read the misadventures</h2><ul>${f.posts.map(p => `<li><a href="${esc(p.u)}">${esc(p.t)}</a></li>`).join("")}</ul>` : `<p><a href="${BLOG}">More misadventures on onetrackmind.co.za</a></p>`}` : ""}
<p class="note">Roads change. Check conditions before you go, and report what you find in the planner so the next rider knows.</p>
</main>`;
  const ld = [{
    "@context": "https://schema.org", "@type": "TouristTrip", name: r.title, description: r.blurb, url: `${SITE}/routes/${r.id}/`,
    touristType: r.vehicles.map(v => ({ bike: "Adventure motorcyclists", jeep: "4x4 overlanders", car: "Self-drive travellers" }[v])),
    provider: ORG, ...(f ? { author: FOUNDER } : {}),
    itinerary: { "@type": "ItemList", itemListElement: places(r).map((p, i) => ({ "@type": "ListItem", position: i + 1, item: { "@type": "Place", name: p.name, geo: { "@type": "GeoCoordinates", latitude: p.lat, longitude: p.lon } } })) },
  }, { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Routes", item: SITE + "/routes/" }, { "@type": "ListItem", position: 2, name: r.title, item: `${SITE}/routes/${r.id}/` }] }];
  return page({ active: "/routes/", url: `/routes/${r.id}/`, title: `${r.title} · ${n}-day route · OneTrackMind`, desc, body, ld });
}

function routesIndex() {
  const fdr = live.filter(r => r.founder), oth = live.filter(r => !r.founder);
  const card = r => `<a class="card" href="/routes/${r.id}/"><b>${esc(r.title)}</b><span>${esc(r.region)} · ${r.trip.days.length} day${r.trip.days.length > 1 ? "s" : ""}${r.founder && r.founder.year ? " · " + r.founder.year : ""}</span></a>`;
  const body = `<main><h1>Routes</h1><p>Multi-day rides and drives on real roads, each ready to open in the planner and change to suit you.</p>
<h2>Ridden by the founder</h2><div class="cards">${fdr.map(card).join("")}</div>
<h2>OneTrackMind picks</h2><div class="cards">${oth.map(card).join("")}</div>
<p>Got a road you love? <a href="/">Plan it, save it and share it</a>. We check every route before other riders see it.</p></main>`;
  const ld = { "@context": "https://schema.org", "@type": "CollectionPage", name: "OneTrackMind routes", url: SITE + "/routes/", hasPart: live.map(r => ({ "@type": "TouristTrip", name: r.title, url: `${SITE}/routes/${r.id}/` })) };
  return page({ active: "/routes/", url: "/routes/", title: "Routes: multi-day motorbike, 4x4 and self-drive trips · OneTrackMind", desc: "Multi-day motorbike, 4x4 and self-drive routes in South Africa, Namibia, Lesotho and Europe, with fuel, night stops and road grades. Free to plan.", body, ld });
}

/* the founder's rides: his trips as memories, where it all started; each opens its route in the planner */
const SA = ["South Africa", "Namibia", "Lesotho", "Northern Cape", "Western Cape", "Eastern Cape", "Kalahari", "Garden Route", "Karoo", "Cederberg", "Swartberg", "Tankwa"];
const isAfrica = r => SA.some(w => (r.region || "").includes(w)) || /namibia|lesotho|cape|karoo|kalahari/i.test(r.id);
function ridesIndex() {
  const fdr = live.filter(r => r.founder).sort((a, b) => (b.founder.year || 0) - (a.founder.year || 0));
  const af = fdr.filter(isAfrica), eu = fdr.filter(r => !isAfrica(r));
  const first = s => { const t = String(s || "").split(/(?<=[.!?])\s/)[0]; return t.length > 180 ? t.slice(0, 177) + "…" : t; };
  const card = r => `<a class="card ride" href="/routes/${r.id}/"><span class="yr">${r.founder.year || ""}</span><b>${esc(r.title)}</b><span>${esc(r.region)} · ${r.trip.days.length} day${r.trip.days.length > 1 ? "s" : ""} · ${esc(r.founder.ride)}</span>${r.founder.story ? `<span class="lead">${esc(first(r.founder.story))}</span>` : ""}<span class="go">Read it, then ride it ›</span></a>`;
  const body = `<main><h1>The founder's rides</h1>
<p class="intro">Where it all started. Twenty-odd years of trips through Southern Africa and Europe on bikes, in 4x4s and the odd hired Fiat: the good roads, the wrong turns and the nights we didn't plan. Every one of them opens in the planner, so you can take it, change it and ride it yourself.</p>
<p class="note">These are memories: roads change, places close. Check conditions before you go, and send a ride report so the next rider knows.</p>
<h2>Southern Africa</h2><div class="cards rides">${af.map(card).join("")}</div>
${eu.length ? `<h2>Europe</h2><p class="note">Proof the planner works anywhere: plan your own trip in any country the same way.</p><div class="cards rides">${eu.map(card).join("")}</div>` : ""}
<p>More stories on <a href="${BLOG}">the old blog</a> while they move here.</p>
<a class="cta" href="/">Plan your own</a></main>`;
  const ld = { "@context": "https://schema.org", "@type": "CollectionPage", name: "The founder's rides", url: SITE + "/rides/", hasPart: fdr.map(r => ({ "@type": "TouristTrip", name: r.title, url: `${SITE}/routes/${r.id}/` })) };
  return page({ active: "/rides/", url: "/rides/", title: "The founder's rides: Southern Africa and Europe road trips · OneTrackMind", desc: "Road trips through Namibia, South Africa and Europe by the founder of OneTrackMind, told honestly. Each one opens in the planner so you can ride it yourself.", body, ld });
}

/* founder's favourites: places to go (and petrolhead places), each with how to get there and a "plan a trip here" button */
const GROUPS = [["na", "Namibia"], ["za", "South Africa and Lesotho"], ["eu", "Europe"], ["petrol", "For petrolheads"]];
const pickById = id => live.find(r => r.id === id);
const enc = encodeURIComponent;
function getThere(x) {
  const q = enc(x.name.replace(/ and .*/, "") + " " + x.area.split(",").pop().trim());
  const links = [
    ["Flights to " + x.air[0], `https://www.skyscanner.net/transport/flights-to/${x.air[1].toLowerCase()}/`, "Compare fares into " + x.air[1]],
    ["Hire a car", "https://www.discovercars.com/", "Pick up at " + x.air[0] + " airport"],
    ["Places to stay nearby", `https://www.booking.com/searchresults.html?latitude=${x.lat}&longitude=${x.lon}&radius=40`, "Within about 40 km"],
  ];
  if (x.tours) links.push([x.petrol ? "Tickets, tours and experiences" : "Tours and tickets", `https://www.getyourguide.com/s/?q=${enc(x.tours)}`, x.tours]);
  return `<section class="gethere"><h2>Get there</h2><ul>${links.map(([t, u, d]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener sponsored">${esc(t)} ›<span>${esc(d)}</span></a></li>`).join("")}</ul>
<p class="note">Some of these links pay OneTrackMind a small fee if you book, at no cost to you. It's what keeps the planner free.</p></section>`;
}
function favPage(x) {
  const r = x.trip && pickById(x.trip);
  const body = `<main>
<p class="note"><a href="/favourites/">Founder's fav's</a> · ${esc(GROUPS.find(g => g[0] === x.group)[1])}</p>
<h1>${esc(x.name)}</h1>
<div class="meta">${esc(x.area)}${x.year ? ` · first went ${x.year}` : ""}</div>
<p class="intro">${esc(x.short)}</p>
${x.text.map(t => `<p>${esc(t)}</p>`).join("\n")}
<a class="cta" href="/?fav=${esc(x.id)}">Plan a trip here</a>
<p class="note">Opens the planner with ${esc(x.name)} as your finish. Set where you start and how many days, and it works out the route, fuel, night stops and weather.</p>
${getThere(x)}
${x.tips.length ? `<h2>Good to know</h2><ul>${x.tips.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
${r ? `<h2>The trip it's from</h2><div class="cards"><a class="card" href="/routes/${r.id}/"><b>${esc(r.title)}</b><span>${esc(r.region)} · ${r.trip.days.length} day${r.trip.days.length > 1 ? "s" : ""}. Open it, change it, ride it.</span></a></div>` : ""}
<p class="note">Places change. Check opening times and conditions before you go.</p>
</main>`;
  const ld = [{ "@context": "https://schema.org", "@type": "TouristAttraction", name: x.name, description: x.short, url: `${SITE}/favourites/${x.id}/`, geo: { "@type": "GeoCoordinates", latitude: x.lat, longitude: x.lon }, address: x.area },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Founder's fav's", item: SITE + "/favourites/" }, { "@type": "ListItem", position: 2, name: x.name, item: `${SITE}/favourites/${x.id}/` }] }];
  return page({ active: "/favourites/", url: `/favourites/${x.id}/`, title: `${x.name}, ${x.area.split(",").pop().trim()}: how to get there and plan a trip · OneTrackMind`, desc: `${x.short} How to get there, where to stay, and a road trip planned around it.`, body, ld });
}
function favIndex() {
  const card = x => `<a class="card fav" href="/favourites/${x.id}/"><b>${esc(x.name)}</b><span class="area">${esc(x.area)}</span><span>${esc(x.short)}</span></a>`;
  const fdr = live.filter(r => r.founder).sort((a, b) => (b.founder.year || 0) - (a.founder.year || 0));
  const first = s => { const t = String(s || "").split(/(?<=[.!?])\s/)[0]; return t.length > 180 ? t.slice(0, 177) + "…" : t; };
  const ride = r => `<a class="card ride" href="/routes/${r.id}/"><span class="yr">${r.founder.year || ""}</span><b>${esc(r.title)}</b><span>${esc(r.region)} · ${r.trip.days.length} day${r.trip.days.length > 1 ? "s" : ""} · ${esc(r.founder.ride)}</span>${r.founder.story ? `<span class="lead">${esc(first(r.founder.story))}</span>` : ""}<span class="go">Read it, then ride it ›</span></a>`;
  const body = `<main><h1>Founder's fav's</h1>
<p class="intro">The places I'd send you to. Twenty-odd years of riding and driving through Southern Africa and Europe, boiled down to the ones I still talk about. Some are roads, some are waterfalls, some are race tracks. Each one has how to get there, where to sleep, and a button that plans the trip for you.</p>
${GROUPS.map(([g, t]) => { const L = FAV.filter(x => x.group === g); return L.length ? `<h2 id="${g}">${t}</h2>${g === "petrol" ? `<p class="note">For people who travel for engines: race tracks, factories, museums and the roads you've seen on TV.</p>` : ""}<div class="cards">${L.map(card).join("")}</div>` : ""; }).join("\n")}
<h2 id="blog">Blog</h2><p>The old blog, moved home: <a href="/blog/">road trips, festivals, factories and museums, grouped by trip</a>.</p>
<h2 id="trips">The trips behind them</h2><p class="note">Where these came from. Every trip opens in the planner, so you can take it, change it and ride it yourself.</p>
<div class="cards rides">${fdr.map(ride).join("")}</div>
<a class="cta" href="/">Plan your own</a></main>`;
  const ld = { "@context": "https://schema.org", "@type": "CollectionPage", name: "Founder's fav's", url: SITE + "/favourites/", hasPart: FAV.map(x => ({ "@type": "TouristAttraction", name: x.name, url: `${SITE}/favourites/${x.id}/` })) };
  return page({ active: "/favourites/", url: "/favourites/", title: "Founder's fav's: road trip places in Namibia, South Africa and Europe · OneTrackMind", desc: "The places the founder of OneTrackMind would send you: Namibia, South Africa, Lesotho and Europe, plus race tracks and car museums for petrolheads. How to get there and a trip planned around each.", body, ld });
}
const redirectPage = to => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Moved</title><link rel="canonical" href="${SITE}${to}"><meta http-equiv="refresh" content="0;url=${to}"><meta name="robots" content="noindex"></head><body><a href="${to}">Founder's fav's</a></body></html>`;

/* stories: the old onetrackmind.co.za blog, grouped into trips and series; images still served from the old site until they move */
const seriesOf = () => { const m = new Map(); STORIES.forEach(x => { if (!m.has(x.series)) m.set(x.series, []); m.get(x.series).push(x); }); m.forEach(L => L.sort((a, b) => a.date.localeCompare(b.date))); return m; };
const fmtDate = d => new Date(d + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
/* blog trips: a multi-day tour is one card on the Blog, and its own page: the route as the featured image, an overview, then a collage of the days */
const TRIP_ROUTE = { "2020-01 Namibia (Tortoise)": "namibia-2020-tortoise", "Namibia 2017 (Epupa)": "namibia-2017-epupa", "2019-06 Wild Coast": "wild-coast-2019", "EU road trip 2018": "eu-road-trip-2018", "2019-09 EU road trip 2019 & KTM factory": "eu-road-trip-2019", "2017-11 Motor Valley & EICMA": "motor-valley-2017", "2020-02 Namibia 2": "namibia-2020-orange-river" };
const tripName = n => n.replace(/^\d{4}-\d{2} /, "");
const tripSlug = (n, L) => (tripName(n).replace(/&.*$/, "") + (/\b\d{4}\b/.test(tripName(n)) ? "" : " " + L[0].date.slice(0, 4))).toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").replace(/-(\d{4})-\1$/, "-$1");
// the route drawn from its stops (start, stops along the way, nights): a clean outline map, no map tiles needed
function routeSvg(r, w, h, big) {
  const t = r.trip, pts = [t.start, ...t.days.flatMap(d => [...(d.vias || []), ...(d.to ? [d.to] : [])]), ...(t.end && !t.round ? [t.end] : t.round ? [t.start] : [])].filter(p => p && p.lat != null);
  const nights = t.days.slice(0, -1).map(d => d.to).filter(Boolean);
  let la0 = Math.min(...pts.map(p => p.lat)), la1 = Math.max(...pts.map(p => p.lat)), lo0 = Math.min(...pts.map(p => p.lon)), lo1 = Math.max(...pts.map(p => p.lon));
  const k = Math.cos((la0 + la1) / 2 * Math.PI / 180), pad = big ? 34 : 14, sx = (w - 2 * pad) / Math.max(0.01, (lo1 - lo0) * k), sy = (h - 2 * pad) / Math.max(0.01, la1 - la0), sc = Math.min(sx, sy);
  const ox = (w - (lo1 - lo0) * k * sc) / 2, oy = (h - (la1 - la0) * sc) / 2;
  const xy = p => [(ox + (p.lon - lo0) * k * sc).toFixed(1), (oy + (la1 - p.lat) * sc).toFixed(1)];
  const line = pts.map(xy).map(a => a.join(",")).join(" ");
  const lab = (p, txt) => { const [x, y] = xy(p); return `<text x="${(+x + 8).toFixed(1)}" y="${(+y + 4).toFixed(1)}" font-size="${big ? 13 : 10}" font-family="IBM Plex Sans,system-ui,sans-serif" fill="#18201C" stroke="#EEF0EA" stroke-width="3" paint-order="stroke">${esc(txt)}</text>`; };
  return `<svg class="routemap" viewBox="0 0 ${w} ${h}" role="img" aria-label="Route: ${esc(pts.map(p => p.name).join(", "))}"><rect width="${w}" height="${h}" rx="8" fill="#E4E9DF"/>
<polyline points="${line}" fill="none" stroke="#0B6E4F" stroke-width="${big ? 4 : 3}" stroke-linejoin="round" stroke-linecap="round"/>
${nights.map((p, i) => { const [x, y] = xy(p); return `<circle cx="${x}" cy="${y}" r="${big ? 6 : 4}" fill="#18201C"/>${big ? lab(p, p.name.replace(/,.*$/, "")) : ""}`; }).join("")}
${(() => { const [x, y] = xy(t.start); return `<circle cx="${x}" cy="${y}" r="${big ? 8 : 5}" fill="#D9A441" stroke="#18201C" stroke-width="2"/>${lab(t.start, t.start.name)}`; })()}</svg>`;
}
const coverOf = L => (L.find(x => x.cover) || {}).cover;
// the trip on a real map (same map as the planner): the road line, the start and every night stop. The drawn outline only if there's no line yet
function tripMap(r) {
  const ln = LINES[r.id] && LINES[r.id].line; if (!ln || ln.length < 2) return routeSvg(r, 820, 460, true);
  const t = r.trip, nights = t.days.slice(0, -1).map(d => d.to).filter(Boolean).map(p => [p.lat, p.lon, p.name.replace(/,.*$/, "")]);
  const data = JSON.stringify({ line: ln, start: [t.start.lat, t.start.lon, t.start.name.replace(/,.*$/, "")], nights }).replace(/</g, "\\u003c");
  return `<div id="tripmap" class="tripmap" role="img" aria-label="Route map: ${esc(r.title)}"></div>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>(function(){var d=${data};var m=L.map("tripmap",{scrollWheelZoom:false,zoomSnap:0.25});
L.tileLayer("https://tiles.stadiamaps.com/tiles/outdoors/{z}/{x}/{y}{r}.png",{maxZoom:18,attribution:'&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(m);
L.polyline(d.line,{color:"#fff",weight:8,opacity:.9}).addTo(m);var pl=L.polyline(d.line,{color:"#0B6E4F",weight:4.5}).addTo(m);
d.nights.forEach(function(p){L.circleMarker([p[0],p[1]],{radius:6,color:"#fff",weight:2,fillColor:"#18201C",fillOpacity:1}).bindTooltip(p[2],{permanent:true,direction:"right",className:"tmlab"}).addTo(m);});
L.circleMarker([d.start[0],d.start[1]],{radius:8,color:"#18201C",weight:2,fillColor:"#D9A441",fillOpacity:1}).bindTooltip(d.start[2],{permanent:true,direction:"right",className:"tmlab"}).addTo(m);
m.fitBounds(pl.getBounds(),{padding:[28,28]});})();</script>`;
}
function tripFacts(n, L) { const r = live.find(x => x.id === TRIP_ROUTE[n]); return { r, line: [r ? `${r.trip.days.length} days` : "", r && r.stats ? `${km(r.stats.km)} km` : "", r ? r.region : "", `${L.length} posts`].filter(Boolean).join(" · ") }; }
function tripPage(n, L) {
  const { r, line } = tripFacts(n, L), slug = tripSlug(n, L);
  const body = `<main class="story">
<p class="note"><a href="/blog/">Blog</a> · trip</p>
<h1>${esc(tripName(n))}</h1>
<div class="meta">${fmtDate(L[0].date)} – ${fmtDate(L[L.length - 1].date)} · ${esc(line)}</div>
${r ? tripMap(r) : (coverOf(L) ? `<img class="cover" src="${esc(coverOf(L))}" alt="${esc(tripName(n))}">` : "")}
${r ? `<p class="intro">${esc(r.blurb)}</p><a class="cta" href="/?pick=${esc(r.id)}">Open this trip in the planner</a> <a class="cta ghost" href="/routes/${esc(r.id)}/">Day by day</a>` : ""}
<h2>The trip, day by day</h2>
<div class="collage">${L.map((x, i) => `<a href="/blog/${esc(x.slug)}/" class="tile">${x.cover ? `<img src="${esc(x.cover)}" alt="" loading="lazy">` : ""}<span><b>${i + 1}. ${esc(x.title.replace(/^(\d{4}\s+)?/, ""))}</b><small>${fmtDate(x.date)}</small></span></a>`).join("")}</div>
</main>`;
  const ld = { "@context": "https://schema.org", "@type": "CollectionPage", name: tripName(n), url: `${SITE}/blog/${slug}/`, author: FOUNDER, hasPart: L.map(x => ({ "@type": "BlogPosting", headline: x.title, url: `${SITE}/blog/${x.slug}/` })) };
  return page({ active: "/favourites/", url: `/blog/${slug}/`, title: `${tripName(n)}: the trip, day by day · OneTrackMind blog`, desc: `${tripName(n)}: ${line}. The whole trip on a map, then every day of it.`, body, ld });
}

function storyPage(x, L) {
  const i = L.indexOf(x), prev = L[i - 1], next = L[i + 1];
  const body = `<main class="story">
<p class="note"><a href="/blog/">Blog</a>${L.length > 1 ? ` · <a href="/blog/${tripSlug(x.series, L)}/">${esc(tripName(x.series))}</a> · part ${i + 1} of ${L.length}` : ""}</p>
<h1>${esc(x.title)}</h1>
<div class="meta">${fmtDate(x.date)}</div>
${x.cover && !x.html.includes(x.cover) ? `<img class="cover" src="${esc(x.cover)}" alt="${esc(x.title)}" loading="eager">` : ""}
${x.gallery ? `<p class="tocome">Photos first, story to come.</p>` : ""}
${x.html}
${L.length > 1 ? `<nav class="snav">${prev ? `<a href="/blog/${esc(prev.slug)}/">‹ ${esc(prev.title)}</a>` : "<span></span>"}${next ? `<a href="/blog/${esc(next.slug)}/">${esc(next.title)} ›</a>` : ""}</nav>` : ""}
<a class="cta" href="/">Plan a trip like this</a>
<p class="note">First published on onetrackmind.co.za. Places change: check before you go.</p>
</main>`;
  const ld = { "@context": "https://schema.org", "@type": "BlogPosting", headline: x.title, datePublished: x.date, author: FOUNDER, publisher: ORG, url: `${SITE}/blog/${x.slug}/`, ...(x.cover ? { image: x.cover } : {}) };
  return page({ active: "/favourites/", url: `/blog/${x.slug}/`, title: `${x.title} · OneTrackMind blog`, desc: (x.lead || x.title).slice(0, 155), body, ld });
}
function storiesIndex(M) {
  const groups = [...M.entries()].sort((a, b) => b[1][0].date.localeCompare(a[1][0].date));
  const card = x => `<a class="card story" href="/blog/${esc(x.slug)}/">${x.cover ? `<img src="${esc(x.cover)}" alt="" loading="lazy">` : ""}<b>${esc(x.title)}</b><span>${fmtDate(x.date)}${x.gallery ? " · photos" : ""}</span></a>`;
  const multi = groups.filter(([, L]) => L.length > 1), single = groups.filter(([, L]) => L.length === 1).map(([, L]) => L[0]);
  const body = `<main><h1>Blog</h1>
<p class="intro">Twenty years of road trips, festivals, factories and museums, mostly on two wheels and mostly not to plan. Trips first, newest first.</p>
<h2>Trips</h2><div class="cards trips">${multi.map(([name, L]) => { const { r, line } = tripFacts(name, L); return `<a class="card trip" href="/blog/${tripSlug(name, L)}/">${coverOf(L) ? `<img src="${esc(coverOf(L))}" alt="" loading="lazy">` : r ? routeSvg(r, 300, 170, false) : ""}<b>${esc(tripName(name))}</b><span>${fmtDate(L[0].date).replace(/^\d+ /, "")} · ${esc(line)}</span></a>`; }).join("")}</div>
<section><h2>More posts</h2><div class="cards">${single.map(card).join("")}</div></section>
<a class="cta" href="/">Plan your own</a></main>`;
  const ld = { "@context": "https://schema.org", "@type": "Blog", name: "OneTrackMind blog", url: SITE + "/blog/", author: FOUNDER };
  return page({ active: "/favourites/", url: "/blog/", title: "Blog: road trips, festivals and factories · OneTrackMind", desc: "Road trip stories from Southern Africa and Europe by the founder of OneTrackMind: Namibia, Lesotho, the Wild Coast, Motor Valley, EICMA and more.", body, ld });
}

function advertisePage() {
  const body = `<main><h1>Sponsor or advertise</h1>
<p class="intro">OneTrackMind is free for riders and drivers. Sponsors and advertisers pay for it, and in return reach people who are planning a road trip right now: where to sleep, what to ride, what to hire and where to stop.</p>
<h2>Who uses it</h2>
<p>Motorbike, 4x4 and car travellers planning multi-day trips, at home and abroad, with a strong following for Southern Africa: Namibia, the Cape and the Karoo, mostly off the tar.</p>
<h2>Ways to be seen</h2>
<div class="cards">
<div class="card"><b>Site sponsor</b><span>Your name on the planner, every route page, the trip PDF and the group ride pack.</span></div>
<div class="card"><b>Route or story sponsor</b><span>"This trip brought to you by…" on one route or one of the founder's rides that fits your business.</span></div>
<div class="card"><b>Stop on the map</b><span>Lodges, farm stalls, restaurants and workshops: be the place riders plan to stop at, with a link to book.</span></div>
<div class="card"><b>The monthly email</b><span>One spot in the monthly route email to riders who asked for it.</span></div>
<div class="card"><b>On the racecars</b><span>Your logo on the OneTrackMind racecars at hill climbs and track days, in every photo and post from the event.</span></div>
<div class="card"><b>Wild Goose Chase</b><span>Prizes and waypoints in the OneTrackMind riding challenge (coming).</span></div>
</div>
<h2>Talk to us</h2>
<p>Email <a href="mailto:hello@onetrackmind.online?subject=Advertising%20on%20OneTrackMind">hello@onetrackmind.online</a> with what you sell and who you'd like to reach. We only take brands riders would thank us for.</p>
</main>`;
  return page({ active: "/advertise/", url: "/advertise/", title: "Sponsor or advertise · OneTrackMind", desc: "Reach motorbike, 4x4 and car travellers while they plan their road trip. Site, route and story sponsorships, stops on the map, the monthly email and the OneTrackMind racecars.", body });
}

function aboutPage() {
  const fav = ["namibia-2020-orange-river", "eu-road-trip-2018", "namibia-2017-epupa", "wild-coast-2019"].map(id => live.find(r => r.id === id)).filter(Boolean);
  const body = `<main>
<h1>About OneTrackMind</h1>
<p class="intro">OneTrackMind plans road trips anywhere in the world, on the roads less travelled, for motorbikes, 4x4s and cars. Day by day on real roads: fuel gaps, night stops and places to stay, sunset, weather and a grade for every stretch, read for your vehicle. Then it sends the trip to your GPS, your bike's app or Google Maps and Waze on your phone.</p>
<p>It's free for riders and drivers. <a href="/advertise/">Sponsors and advertisers</a> pay for it, and booking links pay a small commission when you book a bed or a car through them, at no cost to you.</p>
<h2>Who's behind it</h2>
<p>I'm Ashley. I spent 25 years selling speed: Ducati Cape Town first, then KTM Cape Town. For most of those years I was the guy organising the trips, packing too little and trusting my mates to carry the tools.</p>
<p>I've been adventuring Namibia since 2003. The Fish River Canyon, Epupa Falls, the Skeleton Coast, and the Orange River road between Rosh Pinah and Noordoewer, which is still my favourite piece of riding anywhere. I've done Europe on a 790 Duke, the Nürburgring on a public Sunday, and a Wild Coast that tried to take me out with goats, taxis and potholes in equal measure. We ran adventure bootcamps because we'd learnt, the hard way, how quickly a small problem in the desert turns into a big one.</p>
<p>In 2021 I sold the business. These days I live on a farm in the Swartland, build and race old Alfa Romeos at the Simola Hill Climb (class champion in 2023), and write about the wins and the <s>s</s>cars on <a href="${BLOG}">onetrackmind.co.za</a>.</p>
<h2>Riding and the mind</h2>
<p>After too many years of unregulated stress management, something had to give. I'm an overthinker, and I learnt I'd been looking after my bikes better than I looked after myself. Getting back on a motorcycle showed me how much riding does for my head: a long road, a full tank and the noise in your head goes quiet. I'm not shy about saying it, because plenty of riders feel the same and don't. Look after the machine. Look after the rider too.</p>
<h2>Why this planner</h2>
<p>Every trip I've done started with a paper map, a mate who knew the way and a lot of guessing about fuel and where to sleep. OneTrackMind is the planner I wish I'd had: real roads graded for your vehicle, fuel gaps, night stops, sunset and the things that bite you in the middle of nowhere. Free for riders and drivers. Built by riders, who add their routes and mark the places worth stopping.</p>
<blockquote><p>Four wheels move the body, two wheels move the soul, road trips clear the mind.</p></blockquote>
<h2>Some of my trips</h2><div class="cards">${fav.map(r => `<a class="card" href="/routes/${r.id}/"><b>${esc(r.title)}</b><span>${r.founder.year} · ${esc(r.founder.ride)}</span></a>`).join("")}</div>
<p><a href="/routes/">All routes</a> · <a href="${BLOG}">More misadventures on onetrackmind.co.za</a></p>
<a class="cta" href="/">Plan your next trip</a>
</main>`;
  const ld = [{ "@context": "https://schema.org", "@type": "AboutPage", url: SITE + "/about/", mainEntity: FOUNDER }, { "@context": "https://schema.org", ...FOUNDER, description: "Founder of OneTrackMind. 25 years in motorcycle retail (Ducati Cape Town, KTM Cape Town), adventure rider, Simola Hill Climb racer and Alfa Romeo builder in the Swartland, South Africa.", knowsAbout: ["Adventure motorcycling", "Namibia overland travel", "Hill climb racing", "Alfa Romeo restoration"] }];
  return page({ active: "/about/", url: "/about/", title: "About OneTrackMind and its founder", desc: "OneTrackMind is a free road-trip planner for motorbikes, 4x4s and cars, built by Ashley, who spent 25 years selling speed at Ducati and KTM Cape Town, has ridden Namibia since 2003, and built OneTrackMind: the free multi-day trip planner he wished he'd had.", body, ld });
}

function write(rel, s) { const p = path.join(ROOT, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); }
fs.rmSync(path.join(ROOT, "routes"), { recursive: true, force: true });
live.forEach(r => write(`routes/${r.id}/index.html`, routePage(r)));
write("routes/index.html", routesIndex());
write("about/index.html", aboutPage());
fs.rmSync(path.join(ROOT, "favourites"), { recursive: true, force: true });
write("rides/index.html", redirectPage("/favourites/#trips"));
write("favourites/index.html", favIndex());
FAV.forEach(x => write(`favourites/${x.id}/index.html`, favPage(x)));
fs.rmSync(path.join(ROOT, "blog"), { recursive: true, force: true });
{ const M = seriesOf(); write("blog/index.html", storiesIndex(M)); M.forEach((L, n) => { L.forEach(x => write(`blog/${x.slug}/index.html`, storyPage(x, L))); if (L.length > 1) write(`blog/${tripSlug(n, L)}/index.html`, tripPage(n, L)); }); }
write("advertise/index.html", advertisePage());
const urls = ["/", "/routes/", "/favourites/", "/about/", "/advertise/", ...live.map(r => `/routes/${r.id}/`), ...FAV.map(x => `/favourites/${x.id}/`), "/blog/", ...STORIES.map(x => `/blog/${x.slug}/`), ...[...seriesOf().entries()].filter(([, L]) => L.length > 1).map(([n, L]) => `/blog/${tripSlug(n, L)}/`), "/terms.html", "/privacy.html", "/rules.html"];
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `<url><loc>${SITE}${u}</loc><lastmod>${today}</lastmod></url>`).join("\n")}\n</urlset>\n`);
write("robots.txt", `# Everyone welcome, search engines and AI assistants included.\nUser-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE}/sitemap.xml\n`);
write("llms.txt", `# OneTrackMind

> Free planner for multi-day motorbike, 4x4 and self-drive trips. Plans a trip day by day on real roads: fuel stops and gaps, night stops and places to stay (filter by camping, guesthouse, hotel, self-catering, backpackers), sunset and weather, height profile, and a road grade for every stretch read for your vehicle. Built by riders, free for riders. Based in South Africa; strongest in South Africa, Namibia and Lesotho, works worldwide.

Take it with you: GPX made for your device (Garmin Zumo/Montana/XT and BMW Navigator, BMW Motorrad Connected, Ducati Link, KTM/Husqvarna/GasGas, Harley Boom! Box, OsmAnd, Calimoto, Kurviger, Scenic), one tap to open each day in Google Maps or Waze on a phone, a group ride pack with every format, and a printable PDF.

Road grades (same road, read per vehicle): Race (tar, smooth), Pre-jeep (graded gravel), Jeep (rough tracks), Pre-single (rocks, sand, river crossings; 4x4 or adventure bike), Single (bike single track or serious 4x4 terrain).

Founder: Ashley, 25 years in motorcycle retail (Ducati Cape Town, KTM Cape Town), adventure rider since the early 2000s, Simola Hill Climb racer. Stories: ${BLOG}

## Pages
- [Plan a trip](${SITE}/): the planner
- [Routes](${SITE}/routes/): all published routes
- [Founder's fav's](${SITE}/favourites/): places to go in Namibia, South Africa, Lesotho and Europe, and petrolhead destinations, with how to get there
- [About the founder](${SITE}/about/)

## Routes
${live.map(r => `- [${r.title}](${SITE}/routes/${r.id}/): ${r.region}, ${r.trip.days.length} day${r.trip.days.length > 1 ? "s" : ""}. ${r.blurb}`).join("\n")}
`);
console.log(`pages: ${live.length} routes, about, sitemap (${urls.length} urls), robots, llms.txt`);
