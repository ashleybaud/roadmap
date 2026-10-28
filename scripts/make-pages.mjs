// Builds the plain-text pages search engines and AI tools can read:
// /routes/<id>/ for every published pick, /routes/, /about/, sitemap.xml, robots.txt, llms.txt.
// Source: data/picks/picks.json (stats come from scripts/pick-stats, run in a browser).
// Run: node scripts/make-pages.mjs   (build.sh runs it)
import fs from "node:fs"; import path from "node:path";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SITE = "https://onetrackmind.online";
const BLOG = "https://onetrackmind.co.za";
const picks = JSON.parse(fs.readFileSync(path.join(ROOT, "data/picks/picks.json"), "utf8")).routes;
const live = picks.filter(r => !r.draft);
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
<header><a class="logo" href="/">OneTrackMind</a><div class="motto">Recce. Ride. Report.</div><nav class="hdrlinks" aria-label="Site">${[["/","Plan a trip"],["/routes/","Routes"],["/rides/","The founder's rides"],["/about/","About"]].map(([h,t])=>`<a href="${h}"${active===h?' class="on" aria-current="page"':""}>${t}</a>`).join("")}</nav></header>
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
write("rides/index.html", ridesIndex());
write("advertise/index.html", advertisePage());
const urls = ["/", "/routes/", "/rides/", "/about/", "/advertise/", ...live.map(r => `/routes/${r.id}/`), "/terms.html", "/privacy.html", "/rules.html"];
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
- [About the founder](${SITE}/about/)

## Routes
${live.map(r => `- [${r.title}](${SITE}/routes/${r.id}/): ${r.region}, ${r.trip.days.length} day${r.trip.days.length > 1 ? "s" : ""}. ${r.blurb}`).join("\n")}
`);
console.log(`pages: ${live.length} routes, about, sitemap (${urls.length} urls), robots, llms.txt`);
