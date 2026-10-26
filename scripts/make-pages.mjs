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
header{border-bottom:2px solid var(--ink);padding:14px 0 10px;display:flex;flex-wrap:wrap;gap:10px;align-items:baseline;justify-content:space-between}
.logo{font:700 1.7rem/1 "Barlow Condensed","Arial Narrow",sans-serif;text-transform:uppercase;letter-spacing:.02em;color:var(--ink);text-decoration:none}
.motto{font:500 .85rem "IBM Plex Mono",monospace;color:var(--muted)}nav a{margin-left:14px;font-weight:600;text-decoration:none}
h1,h2{font-family:"Barlow Condensed","Arial Narrow",sans-serif;line-height:1.1;text-transform:uppercase;letter-spacing:.01em}
h1{font-size:2.4rem;margin:28px 0 6px}h2{font-size:1.5rem;margin:30px 0 8px}
.meta{color:var(--muted);font-size:.95rem}.fdr{color:var(--accent);font-weight:600;margin:6px 0 0}
.cta{display:inline-block;background:var(--accent);color:#fff;font-weight:600;padding:12px 20px;border-radius:6px;text-decoration:none;margin:18px 0 6px}
.stats{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0}.stat{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:8px 14px}.stat b{display:block;font:700 1.4rem "Barlow Condensed",sans-serif}.stat span{font-size:.8rem;color:var(--muted)}
ol.days{padding-left:0;list-style:none}ol.days li{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:10px 14px;margin:8px 0}ol.days .d{font:600 .8rem "IBM Plex Mono",monospace;color:var(--muted)}
blockquote{margin:14px 0;padding:4px 16px;border-left:3px solid var(--accent);background:var(--chip)}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;margin:14px 0}.card{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:12px 14px;text-decoration:none;color:var(--ink)}.card b{display:block;color:var(--accent)}.card span{font-size:.85rem;color:var(--muted)}
footer{border-top:1px solid var(--line);margin:40px 0 0;padding:16px 0 30px;color:var(--muted);font-size:.9rem}
.note{font-size:.9rem;color:var(--muted)}`;

function page({ url, title, desc, body, ld, image }) {
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
<link rel="icon" href="/img/icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=IBM+Plex+Sans:wght@400;600&family=IBM+Plex+Mono:wght@500&display=swap">
<style>${CSS}</style>
${(Array.isArray(ld) ? ld : [ld]).filter(Boolean).map(x => `<script type="application/ld+json">${JSON.stringify(x)}</script>`).join("\n")}
</head>
<body><div class="wrap">
<header><div><a class="logo" href="/">OneTrackMind</a> <span class="motto">Recce. Ride. Report.</span></div><nav><a href="/">Plan a trip</a><a href="/routes/">Routes</a><a href="/about/">About</a></nav></header>
${body}
<footer>OneTrackMind is a free trip planner for multi-day rides and drives: motorbikes, 4x4s and cars. Built by riders. Stories and misadventures on <a href="${BLOG}">onetrackmind.co.za</a>. · <a href="/privacy.html">Privacy</a> · <a href="/rules.html">Rules</a></footer>
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
<div class="stat"><b>${S.gravelPct}%</b><span>gravel or dirt</span></div>
<div class="stat"><b>${GR[S.grade] || "?"}</b><span>hardest grade</span></div>
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
<p class="note">Change the dates, stops and your vehicle. The planner works out fuel, night stops, sunset, weather and the grade of every road.</p>
${statBox}
${S ? `<p>Hardest stretch: <b>${GR[S.grade]}</b>, ${GRTXT[S.grade] || ""}. The grade reads differently by vehicle: what's fun on an adventure bike can be slow and hard in a car.</p>` : ""}
<h2>Day by day</h2>${dayList}
${f ? `<h2>The story</h2><blockquote><p>${esc(f.story)}</p></blockquote>
${f.tips && f.tips.length ? `<h2>Good to know</h2><ul>${f.tips.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
<h2>Read the misadventures</h2><ul>${f.posts.map(p => `<li><a href="${esc(p.u)}">${esc(p.t)}</a></li>`).join("")}</ul>` : ""}
<p class="note">Roads change. Check conditions before you go, and report what you find in the planner so the next rider knows.</p>
</main>`;
  const ld = [{
    "@context": "https://schema.org", "@type": "TouristTrip", name: r.title, description: r.blurb, url: `${SITE}/routes/${r.id}/`,
    touristType: r.vehicles.map(v => ({ bike: "Adventure motorcyclists", jeep: "4x4 overlanders", car: "Self-drive travellers" }[v])),
    provider: ORG, ...(f ? { author: FOUNDER } : {}),
    itinerary: { "@type": "ItemList", itemListElement: places(r).map((p, i) => ({ "@type": "ListItem", position: i + 1, item: { "@type": "Place", name: p.name, geo: { "@type": "GeoCoordinates", latitude: p.lat, longitude: p.lon } } })) },
  }, { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Routes", item: SITE + "/routes/" }, { "@type": "ListItem", position: 2, name: r.title, item: `${SITE}/routes/${r.id}/` }] }];
  return page({ url: `/routes/${r.id}/`, title: `${r.title} · ${n}-day ${r.region.split(" · ")[0]} route · OneTrackMind`, desc, body, ld });
}

function routesIndex() {
  const fdr = live.filter(r => r.founder), oth = live.filter(r => !r.founder);
  const card = r => `<a class="card" href="/routes/${r.id}/"><b>${esc(r.title)}</b><span>${esc(r.region)} · ${r.trip.days.length} day${r.trip.days.length > 1 ? "s" : ""}${r.founder && r.founder.year ? " · " + r.founder.year : ""}</span></a>`;
  const body = `<main><h1>Routes</h1><p>Multi-day rides and drives on real roads, each ready to open in the planner and change to suit you.</p>
<h2>Ridden by the founder</h2><div class="cards">${fdr.map(card).join("")}</div>
<h2>OneTrackMind picks</h2><div class="cards">${oth.map(card).join("")}</div>
<p>Got a road you love? <a href="/">Plan it, save it and share it</a>. We check every route before other riders see it.</p></main>`;
  const ld = { "@context": "https://schema.org", "@type": "CollectionPage", name: "OneTrackMind routes", url: SITE + "/routes/", hasPart: live.map(r => ({ "@type": "TouristTrip", name: r.title, url: `${SITE}/routes/${r.id}/` })) };
  return page({ url: "/routes/", title: "Routes: multi-day motorbike, 4x4 and self-drive trips · OneTrackMind", desc: "Multi-day motorbike, 4x4 and self-drive routes in South Africa, Namibia, Lesotho and Europe, with fuel, night stops and road grades. Free to plan.", body, ld });
}

function aboutPage() {
  const fav = ["namibia-2020-orange-river", "eu-road-trip-2018", "namibia-2017-epupa", "wild-coast-2019"].map(id => live.find(r => r.id === id)).filter(Boolean);
  const body = `<main>
<h1>Who's behind OneTrackMind</h1>
<p>I'm Ashley. I spent 25 years selling speed: Ducati Cape Town first, then KTM Cape Town. For most of those years I was the guy organising the trips, packing too little and trusting my mates to carry the tools.</p>
<p>I've been adventuring Namibia since 2003. The Fish River Canyon, Epupa Falls, the Skeleton Coast, and the Orange River road between Rosh Pinah and Noordoewer, which is still my favourite piece of riding anywhere. I've done Europe on a 790 Duke, the Nürburgring on a public Sunday, and a Wild Coast that tried to take me out with goats, taxis and potholes in equal measure. We ran adventure bootcamps because we'd learnt, the hard way, how quickly a small problem in the desert turns into a big one.</p>
<p>In 2021 I sold the business. These days I live on a farm in the Swartland, build and race old Alfa Romeos at the Simola Hill Climb (class champion in 2023), and write about the wins and the scars on <a href="${BLOG}">onetrackmind.co.za</a>.</p>
<h2>Riding and the mind</h2>
<p>A few years ago life gave me a proper panel beating. I'm an overthinker, and I learnt I'd been looking after my bikes better than I looked after myself. Getting back on a motorcycle showed me how much riding does for my head: a long road, a full tank and the noise in your head goes quiet. I'm not shy about saying it, because plenty of riders feel the same and don't. Look after the machine. Look after the rider too.</p>
<h2>Why this planner</h2>
<p>Every trip I've done started with a paper map, a mate who knew the way and a lot of guessing about fuel and where to sleep. OneTrackMind is the planner I wish I'd had: real roads graded for your vehicle, fuel gaps, night stops, sunset and the things that bite you in the middle of nowhere. Free for riders and drivers. Built by riders, who add their routes and mark the places worth stopping.</p>
<blockquote><p>Four wheels move the body, two wheels move the soul, road trips clear the mind.</p></blockquote>
<h2>Some of my trips</h2><div class="cards">${fav.map(r => `<a class="card" href="/routes/${r.id}/"><b>${esc(r.title)}</b><span>${r.founder.year} · ${esc(r.founder.ride)}</span></a>`).join("")}</div>
<p><a href="/routes/">All routes</a> · <a href="${BLOG}">More misadventures on onetrackmind.co.za</a></p>
<a class="cta" href="/">Plan your next trip</a>
</main>`;
  const ld = [{ "@context": "https://schema.org", "@type": "AboutPage", url: SITE + "/about/", mainEntity: FOUNDER }, { "@context": "https://schema.org", ...FOUNDER, description: "Founder of OneTrackMind. 25 years in motorcycle retail (Ducati Cape Town, KTM Cape Town), adventure rider, Simola Hill Climb racer and Alfa Romeo builder in the Swartland, South Africa.", knowsAbout: ["Adventure motorcycling", "Namibia overland travel", "Hill climb racing", "Alfa Romeo restoration"] }];
  return page({ url: "/about/", title: "About the founder · OneTrackMind", desc: "Ashley spent 25 years selling speed at Ducati and KTM Cape Town, has ridden Namibia since 2003, and built OneTrackMind: the free multi-day trip planner he wished he'd had.", body, ld });
}

function write(rel, s) { const p = path.join(ROOT, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); }
fs.rmSync(path.join(ROOT, "routes"), { recursive: true, force: true });
live.forEach(r => write(`routes/${r.id}/index.html`, routePage(r)));
write("routes/index.html", routesIndex());
write("about/index.html", aboutPage());
const urls = ["/", "/routes/", "/about/", ...live.map(r => `/routes/${r.id}/`), "/privacy.html", "/rules.html"];
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `<url><loc>${SITE}${u}</loc><lastmod>${today}</lastmod></url>`).join("\n")}\n</urlset>\n`);
write("robots.txt", `# Everyone welcome, search engines and AI assistants included.\nUser-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE}/sitemap.xml\n`);
write("llms.txt", `# OneTrackMind

> Free planner for multi-day motorbike, 4x4 and self-drive trips. Plans a trip day by day on real roads: fuel stops and gaps, night stops and places to stay (filter by camping, guesthouse, hotel, self-catering, backpackers), sunset and weather, height profile, and a road grade for every stretch read for your vehicle. Built by riders, free for riders. Based in South Africa; strongest in South Africa, Namibia and Lesotho, works worldwide.

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
