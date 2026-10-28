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
const HOWTO = JSON.parse(fs.readFileSync(path.join(ROOT, "data/howto/howto.json"), "utf8"));
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

const CSS = `:root{--bg:#EEF3F3;--panel:#fff;--ink:#11262B;--muted:#54666A;--line:#D0DBDC;--accent:#0F7B8A;--chip:#E0EBEC;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#121614;--panel:#1A201D;--ink:#E7EBE5;--muted:#9AA39D;--line:#2E3631;--accent:#4CC08F;--chip:#232A26;color-scheme:dark}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:400 17px/1.6 "IBM Plex Sans",system-ui,-apple-system,"Segoe UI",sans-serif}
a{color:var(--accent)}.wrap{max-width:1400px;margin:0 auto;padding:0 16px}@media(min-width:1440px){.wrap{padding:0}}main p,main ul,main ol,main blockquote,main h1,main h2,main h3,main .meta,main figure,main.story>img.cover,main .gallery,main .note,.spbox{max-width:860px}main .cards p,main .cards ul{max-width:none}
header{border-bottom:2px solid var(--ink);padding:14px 0 12px}
.logo{display:inline-block;font:700 2.7rem/1 "Barlow Condensed","Arial Narrow",sans-serif;text-transform:uppercase;letter-spacing:-.005em;color:var(--ink);text-decoration:none}
.motto{font:700 1.2rem "Barlow Condensed","Arial Narrow",sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--accent);margin:2px 0 0}
.hdrlinks{display:grid;grid-template-columns:repeat(3,auto);justify-content:start;gap:0;margin:10px 0 0;background:var(--ink);border-radius:6px;overflow:hidden;width:100%}.hdrlinks a{font:700 1.15rem "Barlow Condensed","Arial Narrow",sans-serif;text-transform:uppercase;letter-spacing:.06em;text-decoration:none;color:var(--bg);padding:9px 20px;border:0;border-bottom:4px solid transparent;background:none;border-radius:0;white-space:nowrap}.hdrlinks a:hover{background:color-mix(in srgb,var(--bg) 12%,transparent)}.hdrlinks a.on{border-bottom-color:var(--gold)}.hdrlinks{overflow:visible!important}.navdd{position:relative;display:flex}.navdd>summary{list-style:none;cursor:pointer;font:700 1.15rem var(--f-display,"Barlow Condensed","Arial Narrow",sans-serif);text-transform:uppercase;letter-spacing:.06em;color:var(--bg);padding:9px 20px;border-bottom:4px solid transparent;white-space:nowrap;width:100%}.navdd>summary::-webkit-details-marker{display:none}.navdd>summary::after{content:" ▾";font-size:.8em}.navdd>summary.on{border-bottom-color:#F2C500}.navdd>summary:hover{background:color-mix(in srgb,var(--bg) 12%,transparent)}.navdd .ddm{position:absolute;z-index:2000;top:100%;left:0;min-width:210px;background:var(--ink);border-radius:0 0 6px 6px;box-shadow:0 6px 16px rgba(0,0,0,.25);flex-direction:column;display:flex}.navdd:not([open]) .ddm{display:none}@media(hover:hover){.navdd:hover .ddm{display:flex}}.navdd .ddm a{text-align:left!important;padding:10px 18px!important}@media(max-width:700px){.hdrlinks{grid-template-columns:repeat(3,minmax(0,1fr))!important}.navdd>summary{font-size:.95rem;padding:8px 4px;text-align:center;letter-spacing:.03em}.navdd .ddm{left:auto;right:0}}@media (max-width:640px){.hdrlinks{grid-template-columns:repeat(2,minmax(0,1fr))}.hdrlinks a{font-size:.95rem;padding:8px 4px;text-align:center;letter-spacing:.03em}}
@media (max-width:640px){.logo{font-size:1.9rem}.motto{font-size:.95rem}}
h1,h2{font-family:"Barlow Condensed","Arial Narrow",sans-serif;line-height:1.1;text-transform:uppercase;letter-spacing:.01em}
h1{font-size:2.4rem;margin:28px 0 6px}h2{font-size:1.5rem;margin:30px 0 8px}
.meta{color:var(--muted);font-size:.95rem}.fdr{color:var(--accent);font-weight:600;margin:6px 0 0}
.cta{display:inline-block;background:var(--accent);color:#fff;font-weight:600;padding:12px 20px;border-radius:6px;text-decoration:none;margin:18px 0 6px}
.stats{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0}.stat{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:8px 14px}.stat b{display:block;font:700 1.4rem "Barlow Condensed",sans-serif}.stat span{font-size:.8rem;color:var(--muted)}
ol.days{padding-left:0;list-style:none}ol.days li{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:10px 14px;margin:8px 0}ol.days .d{font:600 .8rem "IBM Plex Mono",monospace;color:var(--muted)}
blockquote{margin:14px 0;padding:4px 16px;border-left:3px solid var(--accent);background:var(--chip)}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;margin:14px 0}.card{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:12px 14px;text-decoration:none;color:var(--ink)}.card b{display:block;color:var(--accent)}.cards.pcards{grid-template-columns:repeat(auto-fill,minmax(250px,1fr))}.card.pcard{display:flex;flex-direction:column;gap:4px;padding:10px}.card.pcard>img{width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:4px;margin:0 0 6px;background:var(--chip,#e4e9df)}.card.pcard .lead{color:var(--ink);font-size:.92rem}.card.pcard[hidden],.fsec[hidden]{display:none}.howlink{font-weight:600;margin:6px 0}.howto ul li{margin:4px 0}.sources{font-size:.85rem}.chips{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 4px}.chips button{font:600 .95rem "IBM Plex Sans",system-ui,sans-serif;padding:7px 14px;border-radius:999px;border:1px solid var(--line);background:var(--panel);color:var(--ink);cursor:pointer}.chips button.on{background:var(--ink);color:var(--bg);border-color:var(--ink)}.card span{font-size:.85rem;color:var(--muted)}
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
.routemap{display:block;width:100%;height:auto;margin:14px 0}.tripmap{height:380px;margin:14px 0;border-radius:8px;border:1px solid var(--line,#d9ddd5)}@media(max-width:700px){.tripmap{height:300px}}.days{display:grid;grid-template-columns:repeat(4,1fr);gap:16px 12px;margin:12px 0 24px}.days .day{display:flex;flex-direction:column;gap:3px;text-decoration:none;color:var(--ink,#11262B)}.days .day img,.days .noimg{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:6px;margin:0 0 4px;background:var(--chip,#e4e9df);display:block}.days .day b{font-size:15px;line-height:1.3}.days .day small{font-size:13px;opacity:.7}.days .day:hover b{text-decoration:underline}@media(max-width:700px){.days{grid-template-columns:1fr 1fr}}.tmlab{background:rgba(255,255,255,.92);border:0;box-shadow:0 1px 3px rgba(0,0,0,.25);font:600 12px IBM Plex Sans,system-ui,sans-serif;padding:2px 6px}.tmlab:before{display:none}.cta.ghost{background:transparent;color:var(--accent);border:2px solid var(--accent);margin-left:8px}
.collage{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;margin:12px 0}.collage .tile{position:relative;display:block;aspect-ratio:4/3;border-radius:6px;overflow:hidden;background:var(--chip);text-decoration:none}.collage .tile img{width:100%;height:100%;object-fit:cover;margin:0;border-radius:0}.collage .tile span{position:absolute;left:0;right:0;bottom:0;padding:8px 10px;background:linear-gradient(transparent,rgba(0,0,0,.75));color:#fff;display:flex;flex-direction:column}.collage .tile small{opacity:.8}
.card.story img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:4px;margin:-4px 0 8px}
.photos{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;margin:18px 0}.photos img{width:100%;aspect-ratio:3/2;object-fit:cover;border-radius:6px}
:root{--brand:#F2C500;--gold:#F2C500}
html[data-mode="motorsport"]{--bg:#06181C;--panel:#0E2A30;--ink:#F1F1EE;--muted:#9FB6BA;--line:#1D4048;--accent:#F2C500;--chip:#123740;--onfill:#0B1D21;--warn:#FF9A1A;--bad:#E5484D;--brand:#F2C500;--gold:#F2C500;--hero:#03141A;color-scheme:dark}
html[data-mode="motorsport"] .hero{background:#03141A;border-color:#F2C500}

html[data-mode="motorsport"] .btn.share,html[data-mode="motorsport"] .ib.on{color:#111}
.hdrlinks{grid-template-columns:repeat(4,auto) 1fr!important}
.modesw{justify-self:end;align-self:center;margin-right:8px;display:flex;border:1px solid color-mix(in srgb,var(--bg) 40%,transparent);border-radius:999px;overflow:hidden}
.modesw button{font:700 .95rem "Barlow Condensed","Arial Narrow",sans-serif;text-transform:uppercase;letter-spacing:.06em;background:none;border:0;color:var(--bg);padding:5px 12px;cursor:pointer;opacity:.7}
.modesw button.on{background:#F2C500;color:#11262B;opacity:1}
html[data-mode="motorsport"] .modesw button.on{background:#F2C500;color:#111}
@media(max-width:640px){.hdrlinks{grid-template-columns:repeat(4,auto)!important}.modesw{grid-column:1/-1;justify-self:start;margin:4px 0 6px 8px}}

.spstrip{display:none;align-items:center;gap:8px;margin:6px 0 0;padding:3px 10px 3px 3px;border:1px solid var(--line);border-left:4px solid var(--gold);border-radius:6px;background:var(--panel);color:var(--ink);text-decoration:none;font-size:.95rem;order:9}.spstrip img{width:26px;height:26px;object-fit:cover;border-radius:4px}.spstrip{font-size:.85rem}.spstrip em{font-style:normal;color:var(--muted);font-size:.6rem;border:1px solid var(--line);border-radius:3px;padding:0 3px;margin-left:4px;text-transform:uppercase}html[data-mode="motorsport"] .spstrip{display:flex}
.packbox{display:flex;align-items:center;gap:12px;margin:16px 0;padding:8px 12px 8px 8px;border:1px solid var(--line);border-radius:8px;background:var(--panel);color:var(--ink);text-decoration:none}.packbox img{width:72px;height:72px;object-fit:cover;border-radius:6px}.packbox span{display:block;color:var(--muted);font-size:.9rem}

.recbox{border:1px solid var(--line);border-radius:10px;padding:14px;background:var(--panel);margin:14px 0}.recstat{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;text-align:center}.recstat b{display:block;font:700 2rem var(--f-display,"Barlow Condensed",sans-serif)}.recstat span{color:var(--muted);font-size:.85rem}.recbtns{margin:12px 0 4px}.recbtns .cta{font-size:1.2rem;padding:14px 28px}.ride{display:flex;flex-direction:column;gap:6px;margin:8px 0;padding:10px}.ride .rname{font:700 1.1rem var(--f-display,"Barlow Condensed",sans-serif);background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:4px;padding:6px 8px}

[hidden]{display:none!important}

.evc{display:flex;flex-direction:column;gap:4px;padding:12px}.evd{font:700 1.2rem var(--f-display,"Barlow Condensed",sans-serif);color:var(--accent)}.unc{font:600 .75rem var(--f-body,sans-serif);font-style:normal;color:var(--warn);border:1px solid var(--warn);border-radius:3px;padding:0 4px;margin-left:6px}.evl{display:flex;gap:12px;flex-wrap:wrap;margin-top:4px}

.nlbox{margin:28px 0 0;padding:14px 16px;border:1px solid var(--line);border-left:4px solid var(--gold);border-radius:6px;background:var(--panel);display:flex;flex-direction:column;gap:6px;color:var(--ink)}.nlbox span{color:var(--muted);font-size:.92rem}.nlf{display:flex;gap:8px;flex-wrap:wrap;position:relative}.nlf input[type=email]{flex:1;min-width:200px;padding:9px 10px;border:1px solid var(--line);border-radius:4px;background:var(--bg);color:var(--ink);font:inherit}.nlf button{padding:9px 16px;border:0;border-radius:4px;background:var(--accent);color:var(--onfill,#fff);font-weight:700;cursor:pointer}

.me{float:right;width:min(38%,260px);height:auto;margin:0 0 14px 20px;border-radius:10px;border:3px solid var(--gold)}@media(max-width:640px){.me{float:none;display:block;width:70%;max-width:260px;margin:0 0 14px}}
`;

function page({ url, title, desc, body, ld, image, active }) {
  return `<!doctype html>
<html lang="en">
<head>
<script>(function(){var m="safari";try{var q=/[?&]mode=(safari|motorsport)/.exec(location.search);if(q){m=q[1];localStorage.setItem("otm-mode",m)}else m=localStorage.getItem("otm-mode")||"safari"}catch(e){}if(m!=="motorsport")m="safari";document.documentElement.setAttribute("data-mode",m)})();</script>
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
<header><a class="logo" href="/">OneTrackMind</a><div class="motto">Recce. Ride. Report.</div><nav class="hdrlinks" aria-label="Site">${[["/","Plan a trip"],["/routes/","Routes"],["/events/","Events"]].map(([h,t])=>`<a href="${h}"${active===h?' class="on" aria-current="page"':""}>${t}</a>`).join("")}<details class="navdd"><summary${["/about/","/favourites/","/how-to/","/record/"].includes(active)?' class="on"':""}>About</summary><div class="ddm"><a href="/about/">About OneTrackMind</a><a href="/favourites/">Founder's fav's</a><a href="/how-to/">How to</a><a href="/record/">Record a ride</a></div></details><div class="modesw" role="group" aria-label="Mode"><button type="button" data-mode="safari" title="Safari: off-road and adventure. Light page. Back roads and gravel first. Starts with the Road less travelled route style.">Safari</button><button type="button" data-mode="motorsport" title="Motorsport: tracks, races and festivals. Dark page. Main roads first. Starts with the Tar route style. Your own route style in Settings always wins.">Motorsport</button></div></nav><a class="spstrip" href="https://alterego.online/products/build-race-repeat-hoodie?utm_source=onetrackmind&utm_medium=sponsor" target="_blank" rel="noopener sponsored"><img src="https://alterego.online/cdn/shop/files/3158941636033974733_2048.jpg?v=1792398701&width=240" alt="" loading="lazy"><span><b>AlterEgo</b> Build Race Repeat hoodie, from $65 › <em>Ad</em></span></a></header><script>(function(){var h=document.documentElement,b=document.querySelectorAll(".modesw button");function s(m,u){h.setAttribute("data-mode",m);b.forEach(function(x){x.classList.toggle("on",x.dataset.mode===m)});if(u){try{localStorage.setItem("otm-mode",m)}catch(e){}document.dispatchEvent(new CustomEvent("otm-mode",{detail:m}))}}b.forEach(function(x){x.onclick=function(){s(x.dataset.mode,1)}});s(h.getAttribute("data-mode")||"safari",0)})();</script><script>document.addEventListener("click",function(e){document.querySelectorAll(".navdd[open]").forEach(function(d){if(!d.contains(e.target))d.open=false;});});</script>
${body}
<aside class="nlbox"><b>Get the newsletter</b><span>New trips, events and how-to guides, about once a month. No spam.</span><form class="nlf" novalidate><input type="email" name="email" placeholder="Your email" autocomplete="email" aria-label="Your email" required><input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px"><button type="submit">Sign me up</button></form><span class="nlm" aria-live="polite"></span></aside>
<aside class="spbox"><span>OneTrackMind is free thanks to</span> <a href="https://alterego.online/?utm_source=onetrackmind&utm_medium=sponsor" target="_blank" rel="noopener sponsored"><b>AlterEgo</b>, made-to-order wear for petrolheads</a> · <a href="/advertise/">Your brand here ›</a></aside>
<script>(function(){document.querySelectorAll(".nlf").forEach(function(f){f.addEventListener("submit",function(e){e.preventDefault();var m=f.parentNode.querySelector(".nlm"),em=f.email.value.trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)){m.textContent="That email doesn't look right.";return}m.textContent="Sending…";fetch("/api/subscribe",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:em,website:f.website.value,source:location.pathname})}).then(function(r){return r.json().then(function(j){return[r.ok,j]})}).then(function(x){if(x[0]){f.hidden=true;m.textContent=x[1].already?"You're already on the list.":"Almost done: tap the link in the email we just sent."}else m.textContent=x[1].error||"Something went wrong. Try again."}).catch(function(){m.textContent="No connection. Try again."})})})})();</script>
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
<a class="packbox" href="https://alterego.online/products/build-race-repeat-hoodie?utm_source=onetrackmind&utm_medium=sponsor" target="_blank" rel="noopener sponsored"><img src="https://alterego.online/cdn/shop/files/3158941636033974733_2048.jpg?v=1792398701&width=240" alt="" loading="lazy"><div><b>Pack for it</b><span>AlterEgo, our sponsor: made-to-order wear for petrolheads. Hoodie from $65.</span></div></a>
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
${HOWTO.some(g => g.fav === x.id) ? `<p class="howlink"><a href="/how-to/${HOWTO.find(g => g.fav === x.id).id}/">How to do it: cost, dates, booking ›</a></p>` : ""}
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
// a photo for each fav: from the blog post that tells its story (the picture nearest where it's mentioned), else a map of the spot
const FAV_POST = { "grootberg-lodge": "namibia-2017-day-5", "stuttgart-museums": "2018-porsche-museum-gallery", "maranello": "ferrari", "motor-valley": "lamborghini", "franschhoek-motor-museum": "franschoek-motor-museum-gallery", "killarney": "wpmc-killarney", monaco: null, sutherland: null };
const favKey = n => n.replace(/^(The|Lake) /, "").split(/,| and | to | from | \(|: /)[0].replace(/ (road|pass|Pass|loop|Loop|route)$/, "").trim();
function favStory(x) {
  if (x.id in FAV_POST) { const p = STORIES.find(q => q.slug === FAV_POST[x.id]); return p ? { p, img: p.cover } : null; }
  const k = favKey(x.name), rx = new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"); let best = null;
  STORIES.forEach(p => { const n = (p.title.match(rx) ? 100 : 0) + (p.html.replace(/<[^>]+>/g, " ").match(new RegExp(rx.source, "gi")) || []).length; if (n && (!best || n > best.n)) best = { p, n }; });
  if (!best) return null;
  const h = best.p.html, at = h.search(rx), imgs = [...h.matchAll(/<img[^>]+src="([^"]+)"/g)].filter(m => /\/media\/blog\/|wp-content\/uploads/.test(m[1]) && !/emoji/i.test(m[1]));
  const near = imgs.find(m => m.index >= at) || imgs[imgs.length - 1];
  return { p: best.p, img: (best.p.title.match(rx) ? best.p.cover : near && near[1]) || best.p.cover };
}
const tileOf = (lat, lon, z) => { const n = 2 ** z, x = Math.floor((lon + 180) / 360 * n), r = lat * Math.PI / 180, y = Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n); return `https://tiles.stadiamaps.com/tiles/outdoors/${z}/${x}/${y}@2x.png`; };
// blog posts sorted by what they're about, for the filter buttons
const MOTOR_RX = /museum|hill ?climb|simola|motogp|eicma|goodwood|factory|ferrari|lamborghini|porsche|pagani|ducati|alfa|killarney|wpmc|speedweek|hakskeen|enduro|race|dainese|nicolis|brooklands|aston|mv agusta|world ducati week|kyalami|motoranch/i;
const BIKE_RX = /ktm|duke|1190|690|790|390|cafe racer|flat tracker|carbon rims/i;
const storyCat = x => MOTOR_RX.test(x.title) ? "motor" : BIKE_RX.test(x.title) ? "bikes" : "trips";
function favIndex() {
  const pic = (src, alt) => src ? `<img src="${esc(src)}" alt="${esc(alt || "")}" loading="lazy">` : "";
  const card = x => { const st = favStory(x); return `<a class="card pcard" href="/favourites/${x.id}/" data-cat="${x.group === "petrol" ? "motor" : x.group}">${st && st.img ? pic(st.img, x.name) : `<img class="maptile" src="${tileOf(x.lat, x.lon, 9)}" alt="" loading="lazy">`}<b>${esc(x.name)}</b><span class="area">${esc(x.area)}</span><span class="lead">${esc(x.short)}</span></a>`; };
  const M = seriesOf(), groups = [...M.entries()].sort((a, b) => b[1][0].date.localeCompare(a[1][0].date));
  const multi = groups.filter(([, L]) => L.length > 1), single = groups.filter(([, L]) => L.length === 1).map(([, L]) => L[0]);
  const tripCard = ([name, L]) => { const { line } = tripFacts(name, L), c = MOTOR_RX.test(name) ? "motor" : BIKE_RX.test(name) ? "bikes" : "trips"; return `<a class="card pcard" href="/blog/${tripSlug(name, L)}/" data-cat="${c}">${pic(coverOf(L), tripName(name))}<b>${esc(tripName(name))}</b><span class="area">${fmtDate(L[0].date).replace(/^\d+ /, "")} · ${esc(line)}</span></a>`; };
  const postCard = x => `<a class="card pcard" href="/blog/${esc(x.slug)}/" data-cat="${storyCat(x)}">${pic(x.cover, x.title)}<b>${esc(x.title)}</b><span class="area">${fmtDate(x.date)}${x.gallery ? " · photos" : ""}</span></a>`;
  const CH = [["all", "All"], ["na", "Namibia"], ["za", "South Africa"], ["eu", "Europe"], ["motor", "Motorsport"], ["trips", "Road trips"], ["bikes", "Bikes"]];
  const sec = (id, title, note, html) => `<section class="fsec" id="${id}"><h2>${title}</h2>${note ? `<p class="note">${note}</p>` : ""}<div class="cards pcards">${html}</div></section>`;
  const body = `<main><h1>Founder's fav's</h1>
<p class="intro">The places I'd send you to, and the trips and races behind them. Twenty-odd years of riding and driving through Southern Africa and Europe. Every place has how to get there, where to sleep, and a button that plans the trip for you.</p>
<p class="howlink">New: <a href="/how-to/nurburgring/">how to drive a lap of the Nürburgring</a> · <a href="/how-to/">all How-to guides ›</a></p>
<nav class="chips" aria-label="Show">${CH.map(([k, t], i) => `<button type="button" data-f="${k}"${i ? "" : ' class="on"'}>${t}</button>`).join("")}</nav>
${GROUPS.map(([g, t]) => { const L = FAV.filter(x => x.group === g); return L.length ? sec(g, g === "petrol" ? "Motorsport: tracks, museums, factories" : t, "", L.map(card).join("")) : ""; }).join("\n")}
${sec("btrips", "The trips", "Day by day, as they happened.", multi.map(tripCard).join(""))}
${sec("bposts", "More stories", "", single.map(postCard).join(""))}
<p class="note"><a href="/blog/">Every blog post</a> · <a href="/routes/">All routes</a></p>
<a class="cta" href="/">Plan your own</a></main>
<script>(function(){var b=document.querySelectorAll(".chips button");b.forEach(function(x){x.onclick=function(){var f=x.dataset.f;b.forEach(function(y){y.classList.toggle("on",y===x)});document.querySelectorAll(".pcard").forEach(function(c){c.hidden=f!=="all"&&c.dataset.cat!==f});document.querySelectorAll(".fsec").forEach(function(s){s.hidden=!s.querySelector(".pcard:not([hidden])")});try{history.replaceState(null,"",f==="all"?location.pathname:"#"+f)}catch(e){}}});var h=location.hash.slice(1);var t=[].find.call(b,function(x){return x.dataset.f===h});if(t)t.click();else if(!h&&document.documentElement.getAttribute('data-mode')==='motorsport'){var mm=[].find.call(b,function(x){return x.dataset.f==='motor'});if(mm)mm.click()}})();</script>`;
  const ld = { "@context": "https://schema.org", "@type": "CollectionPage", name: "Founder's fav's", url: SITE + "/favourites/", hasPart: FAV.map(x => ({ "@type": "TouristAttraction", name: x.name, url: `${SITE}/favourites/${x.id}/` })) };
  return page({ active: "/favourites/", url: "/favourites/", title: "Founder's fav's: places, road trips and motorsport · OneTrackMind", desc: "The places the founder of OneTrackMind would send you in Namibia, South Africa, Lesotho and Europe, the road trips behind them, and the race tracks, museums and factories worth travelling for.", body, ld });
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
  const lab = (p, txt) => { const [x, y] = xy(p); return `<text x="${(+x + 8).toFixed(1)}" y="${(+y + 4).toFixed(1)}" font-size="${big ? 13 : 10}" font-family="IBM Plex Sans,system-ui,sans-serif" fill="#11262B" stroke="#EEF3F3" stroke-width="3" paint-order="stroke">${esc(txt)}</text>`; };
  return `<svg class="routemap" viewBox="0 0 ${w} ${h}" role="img" aria-label="Route: ${esc(pts.map(p => p.name).join(", "))}"><rect width="${w}" height="${h}" rx="8" fill="#E4E9DF"/>
<polyline points="${line}" fill="none" stroke="#0F7B8A" stroke-width="${big ? 4 : 3}" stroke-linejoin="round" stroke-linecap="round"/>
${nights.map((p, i) => { const [x, y] = xy(p); return `<circle cx="${x}" cy="${y}" r="${big ? 6 : 4}" fill="#11262B"/>${big ? lab(p, p.name.replace(/,.*$/, "")) : ""}`; }).join("")}
${(() => { const [x, y] = xy(t.start); return `<circle cx="${x}" cy="${y}" r="${big ? 8 : 5}" fill="#F2C500" stroke="#11262B" stroke-width="2"/>${lab(t.start, t.start.name)}`; })()}</svg>`;
}
// a post's title inside its trip: no year, no repeated trip tag ("EURoadTrip2019 - ", "Namibia 2017, ")
const shortTitle = t => t.replace(/^\d{4}\s+/, "").replace(/^EURoadTrip\d{4}\s*-?\s*/i, "").replace(/^Namibia(?: 2| \d{4})?[,:]?\s+(?=\S)/, "");
const coverOf = L => (L.find(x => x.cover) || {}).cover;
// the trip on a real map (same map as the planner): the road line, the start and every night stop. The drawn outline only if there's no line yet
function tripMap(r) {
  const raw = LINES[r.id] && LINES[r.id].line, k = raw ? Math.ceil(raw.length / 1500) : 1, ln = raw && raw.filter((p, i) => i % k === 0 || i === raw.length - 1); if (!ln || ln.length < 2) return routeSvg(r, 820, 460, true);
  const t = r.trip, nights = t.days.slice(0, -1).map(d => d.to).filter(Boolean).map(p => [p.lat, p.lon, p.name.replace(/,.*$/, "")]);
  const data = JSON.stringify({ line: ln, start: [t.start.lat, t.start.lon, t.start.name.replace(/,.*$/, "")], nights }).replace(/</g, "\\u003c");
  return `<div id="tripmap" class="tripmap" role="img" aria-label="Route map: ${esc(r.title)}"></div>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>(function(){var d=${data};var m=L.map("tripmap",{scrollWheelZoom:false,zoomSnap:0.25});
L.tileLayer("https://tiles.stadiamaps.com/tiles/outdoors/{z}/{x}/{y}{r}.png",{maxZoom:18,attribution:'&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(m);
L.polyline(d.line,{color:"#fff",weight:8,opacity:.9}).addTo(m);var pl=L.polyline(d.line,{color:"#0F7B8A",weight:4.5}).addTo(m);
d.nights.forEach(function(p){L.circleMarker([p[0],p[1]],{radius:6,color:"#fff",weight:2,fillColor:"#11262B",fillOpacity:1}).bindTooltip(p[2],{permanent:true,direction:"right",className:"tmlab"}).addTo(m);});
L.circleMarker([d.start[0],d.start[1]],{radius:8,color:"#11262B",weight:2,fillColor:"#F2C500",fillOpacity:1}).bindTooltip(d.start[2],{permanent:true,direction:"right",className:"tmlab"}).addTo(m);
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
<div class="days">${L.map((x, i) => `<a href="/blog/${esc(x.slug)}/" class="day">${x.cover ? `<img src="${esc(x.cover)}" alt="" loading="lazy">` : `<span class="noimg"></span>`}<b>${i + 1}. ${esc(shortTitle(x.title))}</b><small>${fmtDate(x.date)}</small></a>`).join("")}</div>
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
<a class="packbox" href="https://alterego.online/products/build-race-repeat-hoodie?utm_source=onetrackmind&utm_medium=sponsor" target="_blank" rel="noopener sponsored"><img src="https://alterego.online/cdn/shop/files/3158941636033974733_2048.jpg?v=1792398701&width=240" alt="" loading="lazy"><div><b>Pack for it</b><span>AlterEgo, our sponsor: made-to-order wear for petrolheads. Hoodie from $65.</span></div></a>
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
<div class="card"><b>Site sponsor</b><span>Founding sponsor: AlterEgo. Your name on the planner, every route page, the trip PDF and the group ride pack.</span></div>
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
<img class="me" src="/img/ashley.jpg" width="352" height="469" alt="Ashley in his garage, leaning on a white Alfa Romeo">
<p class="intro">OneTrackMind plans road trips anywhere in the world, on the roads less travelled, for motorbikes, 4x4s and cars. Day by day on real roads: fuel gaps, night stops and places to stay, sunset, weather and a grade for every stretch, read for your vehicle. Then it sends the trip to your GPS, your bike's app or Google Maps and Waze on your phone.</p>
<p>It's free for riders and drivers. <a href="/advertise/">Sponsors and advertisers</a> pay for it, and booking links pay a small commission when you book a bed or a car through them, at no cost to you.</p>
<h2>Who's behind it</h2>
<p>I'm Ashley. I spent 25 years selling speed: Ducati Cape Town first, then KTM Cape Town. For most of those years I was the guy organising the trips, packing too little and trusting my mates to carry the tools.</p>
<p>I've been adventuring Namibia since 2003. The Fish River Canyon, Epupa Falls, the Skeleton Coast, and the Orange River road between Rosh Pinah and Noordoewer, which is still my favourite piece of riding anywhere. I've done Europe on a 790 Duke, the Nürburgring on a public Sunday, and a Wild Coast that tried to take me out with goats, taxis and potholes in equal measure. We ran adventure bootcamps because we'd learnt, the hard way, how quickly a small problem in the desert turns into a big one.</p>
<p>In 2021 I sold the business. These days I live on a farm in the Swartland, build and race old Alfa Romeos at the Simola Hill Climb (class champion in 2023), and write about the wins and the <s>s</s>cars on <a href="${BLOG}">onetrackmind.co.za</a>. It all started with a Stepnose I commissioned. Then I built a Bedford CF 4x4 myself, then the widebody.</p>
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

/* how to do it: the guides. Plant the seed, then show exactly how: cost, dates, booking, rules, and what nobody tells you */
function howtoPage(g) {
  const f = FAV.find(x => x.id === g.fav), r = f && f.trip && pickById(f.trip), st = f && favStory(f);
  const body = `<main class="story howto">
<p class="note"><a href="/how-to/">How to</a></p>
<h1>${esc(g.title)}</h1>
<div class="meta">Checked ${fmtDate(g.checked)} · prices and dates change, check before you book</div>
${st && st.img ? `<img class="cover" src="${esc(st.img)}" alt="${esc(g.title)}">` : ""}
<p class="intro">${esc(g.short)}</p>
${g.hook.map(t => `<p>${esc(t)}</p>`).join("\n")}
${g.sections.map(x => `<h2>${esc(x.h)}</h2><ul>${x.items.map(t => `<li>${t}</li>`).join("")}</ul>`).join("\n")}
<a class="packbox" href="https://alterego.online/products/build-race-repeat-hoodie?utm_source=onetrackmind&utm_medium=sponsor" target="_blank" rel="noopener sponsored"><img src="https://alterego.online/cdn/shop/files/3158941636033974733_2048.jpg?v=1792398701&width=240" alt="" loading="lazy"><div><b>Wear it on the day</b><span>AlterEgo, our sponsor: made-to-order wear for petrolheads. Hoodie from $65.</span></div></a>
<section class="gethere"><h2>Book it</h2><ul>${g.links.map(([t, u, d]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener sponsored">${esc(t)} ›<span>${esc(d)}</span></a></li>`).join("")}<li><a href="${esc(g.official[1])}" target="_blank" rel="noopener">${esc(g.official[0])} ›<span>Check the day before you go</span></a></li></ul>
<p class="note">Some of these links pay OneTrackMind a small fee if you book, at no cost to you. It's what keeps the planner free.</p></section>
${f ? `<a class="cta" href="/?fav=${esc(f.id)}">Plan the road trip there</a> <a class="cta ghost" href="/favourites/${esc(f.id)}/">More about the place</a>` : ""}
${r ? `<p class="note">Or take the trip I did: <a href="/routes/${esc(r.id)}/">${esc(r.title)}</a>.</p>` : ""}
<h2>Where this comes from</h2><ul class="sources">${g.sources.map(([t, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a></li>`).join("")}</ul>
</main>`;
  const ld = { "@context": "https://schema.org", "@type": "HowTo", name: g.title, description: g.short, url: `${SITE}/how-to/${g.id}/`, author: FOUNDER, dateModified: g.checked, step: g.sections.map(x => ({ "@type": "HowToSection", name: x.h, itemListElement: x.items.map(t => ({ "@type": "HowToStep", text: t.replace(/<[^>]+>/g, "") })) })) };
  return page({ active: "/favourites/", url: `/how-to/${g.id}/`, title: `${g.title}: cost, dates, booking and rules · OneTrackMind`, desc: g.short, body, ld });
}

function recordPage() {
  const body = `<main class="rec"><h1>Record a ride</h1>
<p class="intro">Tap Start, put the phone in your tank bag or pocket, ride. Tap Stop when you're done. The ride saves on this phone and you can send it to your computer, or load it into the planner, whenever you like.</p>
<p class="note"><b>Keep the screen on and this page open.</b> Phones, iPhones especially, stop tracking when the screen locks or you switch app. Plug it in on a long day. Works with no signal: the GPS doesn't need data.</p>
<section class="recbox"><div class="recstat"><div><b id="rDist">0.0</b><span>km</span></div><div><b id="rTime">0:00</b><span>time</span></div><div><b id="rSpd">0</b><span>km/h</span></div><div><b id="rPts">0</b><span>points</span></div></div>
<div class="recbtns"><button class="cta" id="rStart" type="button">Start</button><button class="cta ghost" id="rStop" type="button" hidden>Stop and save</button></div>
<p class="note" id="rMsg" aria-live="polite"></p></section>
<section id="rResume" hidden><p>A ride was still recording when this page closed (<span id="rResInfo"></span>).</p><button class="cta" id="rResSave" type="button">Save it</button> <button class="cta ghost" id="rResDrop" type="button">Throw it away</button></section>
<h2>Saved on this phone</h2><div id="rList"><p class="note">No rides yet.</p></div>
<p class="note">Load a saved ride into the <a href="/">planner</a> with its GPX button, or share the file to your computer, Garmin or Strava.</p></main>
<script>(function(){
var K="otm-rec",R="otm-rides",$=function(i){return document.getElementById(i)},cur=null,wid=null,tm=null,lock=null;
function ld(k,d){try{return JSON.parse(localStorage.getItem(k))||d}catch(e){return d}}
function sv(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){$("rMsg").textContent="This phone is out of space for saved rides. Download one and delete it.";return false}}
function hav(a,b){var r=Math.PI/180,x=(b[1]-a[1])*r*Math.cos((a[0]+b[0])/2*r),y=(b[0]-a[0])*r;return Math.sqrt(x*x+y*y)*6371008.8}
function dist(p){var d=0;for(var i=1;i<p.length;i++)d+=hav(p[i-1],p[i]);return d}
function hm(s){s=Math.round(s);var h=Math.floor(s/3600),m=Math.floor(s%3600/60),c=s%60;return h?h+":"+(m<10?"0":"")+m+":"+(c<10?"0":"")+c:m+":"+(c<10?"0":"")+c}
function show(){if(!cur)return;var p=cur.pts,l=p[p.length-1];$("rDist").textContent=(cur.d/1000).toFixed(1);$("rTime").textContent=hm((Date.now()-cur.t0)/1000);$("rPts").textContent=p.length;$("rSpd").textContent=l&&l[4]!=null?Math.round(l[4]*3.6):0}
function onPos(g){var c=g.coords;if(c.accuracy>50)return;var p=cur.pts,l=p[p.length-1],pt=[+c.latitude.toFixed(6),+c.longitude.toFixed(6),c.altitude!=null?Math.round(c.altitude):null,Math.round(g.timestamp/1000),c.speed!=null?+c.speed.toFixed(1):null];
 if(l){var d=hav(l,pt);if(d<8&&pt[3]-l[3]<10)return;if(d>5000&&pt[3]-l[3]<20)return;cur.d+=d}p.push(pt);sv(K,cur);show()}
function onErr(e){$("rMsg").textContent=e.code===1?"Location is blocked. Allow location for this site in your browser settings, then tap Start again.":"Can't get a GPS fix yet. Keep going, it finds you in a minute out in the open."}
function wl(){try{if(navigator.wakeLock)navigator.wakeLock.request("screen").then(function(x){lock=x}).catch(function(){})}catch(e){}}
document.addEventListener("visibilitychange",function(){if(cur&&document.visibilityState==="visible")wl()});
function begin(){if(!navigator.geolocation){$("rMsg").textContent="This browser can't do GPS.";return}
 if(!cur)cur={t0:Date.now(),d:0,pts:[]};$("rStart").hidden=true;$("rStop").hidden=false;$("rMsg").textContent="Recording. Waiting for GPS…";
 wid=navigator.geolocation.watchPosition(function(g){$("rMsg").textContent="Recording. Keep this page open.";onPos(g)},onErr,{enableHighAccuracy:true,maximumAge:0,timeout:30000});tm=setInterval(show,1000);wl();sv(K,cur)}
function end(){if(wid!=null)navigator.geolocation.clearWatch(wid);wid=null;clearInterval(tm);try{if(lock)lock.release()}catch(e){}lock=null;$("rStart").hidden=false;$("rStop").hidden=true}
function keep(c){if(c.pts.length<2){$("rMsg").textContent="Too short to save: no movement recorded.";try{localStorage.removeItem(K)}catch(e){}return}
 var s=new Date(c.t0),n=s.toLocaleDateString("en-ZA",{day:"numeric",month:"short",year:"numeric"})+" ride",a=ld(R,[]);a.unshift({id:String(c.t0),name:n,t0:c.t0,d:c.d||dist(c.pts),secs:c.pts[c.pts.length-1][3]-c.pts[0][3],pts:c.pts});
 if(sv(R,a)){try{localStorage.removeItem(K)}catch(e){}$("rMsg").textContent="Saved: "+(c.d/1000).toFixed(1)+" km."}list()}
function gpx(r){var x='<?xml version="1.0" encoding="UTF-8"?>\\n<gpx version="1.1" creator="OneTrackMind" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>'+r.name.replace(/[<&>]/g,"")+'</name><trkseg>';
 r.pts.forEach(function(p){x+='<trkpt lat="'+p[0]+'" lon="'+p[1]+'">'+(p[2]!=null?'<ele>'+p[2]+'</ele>':'')+'<time>'+new Date(p[3]*1000).toISOString()+'</time></trkpt>'});return x+'</trkseg></trk></gpx>'}
function file(r){return new File([gpx(r)],r.name.replace(/[^\\w\\- ]+/g,"").trim().replace(/ +/g,"-")+".gpx",{type:"application/gpx+xml"})}
function list(){var a=ld(R,[]),b=$("rList");if(!a.length){b.innerHTML='<p class="note">No rides yet.</p>';return}
 b.innerHTML=a.map(function(r){return '<div class="card ride" data-id="'+r.id+'"><input class="rname" value="'+r.name.replace(/"/g,"&quot;")+'" aria-label="Ride name"><span>'+(r.d/1000).toFixed(1)+' km · '+hm(r.secs)+' · '+r.pts.length+' points</span><div><button class="cta" data-a="dl" type="button">Download GPX</button> '+(navigator.canShare?'<button class="cta ghost" data-a="sh" type="button">Share</button> ':'')+'<button class="cta ghost" data-a="rm" type="button">Delete</button></div></div>'}).join("")}
$("rList").addEventListener("change",function(e){if(!e.target.classList.contains("rname"))return;var a=ld(R,[]),r=a.find(function(x){return x.id===e.target.closest(".ride").dataset.id});if(r){r.name=e.target.value||r.name;sv(R,a)}});
$("rList").addEventListener("click",function(e){var b=e.target.closest("[data-a]");if(!b)return;var a=ld(R,[]),id=b.closest(".ride").dataset.id,r=a.find(function(x){return x.id===id});if(!r)return;
 var nm=b.closest(".ride").querySelector(".rname").value;if(nm)r.name=nm;
 if(b.dataset.a==="dl"){var f=file(r),u=URL.createObjectURL(f),l=document.createElement("a");l.href=u;l.download=f.name;document.body.appendChild(l);l.click();l.remove();setTimeout(function(){URL.revokeObjectURL(u)},4000)}
 else if(b.dataset.a==="sh"){var f2=file(r);if(navigator.canShare({files:[f2]}))navigator.share({files:[f2],title:r.name}).catch(function(){});else $("rMsg").textContent="Sharing isn't available here. Use Download."}
 else if(b.dataset.a==="rm"){b.dataset.a="rm2";b.textContent="Tap again to delete";return}
 else if(b.dataset.a==="rm2"){sv(R,a.filter(function(x){return x.id!==id}));list()}});
$("rStart").onclick=begin;$("rStop").onclick=function(){end();var c=cur;cur=null;if(c)keep(c);show()};
var old=ld(K,null);if(old&&old.pts&&old.pts.length){cur=null;$("rResume").hidden=false;$("rResInfo").textContent=(old.d/1000).toFixed(1)+" km";$("rResSave").onclick=function(){$("rResume").hidden=true;keep(old)};$("rResDrop").onclick=function(){$("rResume").hidden=true;try{localStorage.removeItem(K)}catch(e){}}}
list();})();</script>`;
  return page({ active: "/record/", url: "/record/", title: "Record a ride: GPS track saved on your phone · OneTrackMind", desc: "Record your ride on your phone, save it, and download it as a GPX file afterwards. Works with no signal.", body });
}

const EVENTS = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, "data/events/events.json"), "utf8")); } catch (e) { return []; } })();
function eventsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const L = EVENTS.filter(e => e.end >= today);
  const CAT = [["all", "All"], ["f1", "F1"], ["bikes", "Bikes"], ["us", "NASCAR, IndyCar, AMA"], ["endurance", "Endurance and 24 hours"], ["rally", "Rally and Dakar"], ["festival", "Festivals and classics"], ["sa", "South Africa"], ["offroad", "Off-road"]].filter(([k]) => k === "all" || L.some(e => e.category === k));
  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const rng = e => { const a = new Date(e.start + "T12:00:00Z"), b = new Date(e.end + "T12:00:00Z"); const f = (d, y) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()].slice(0, 3)}${y ? " " + d.getUTCFullYear() : ""}`; return e.start === e.end ? f(a, 1) : a.getUTCMonth() === b.getUTCMonth() ? `${a.getUTCDate()}–${f(b, 1)}` : `${f(a)} – ${f(b, 1)}`; };
  const card = e => `<div class="card evc" data-cat="${esc(e.category)}"><b>${esc(e.name)}</b><span class="evd">${rng(e)}${e.confirmed ? "" : ' <em class="unc">dates unconfirmed</em>'}</span><span class="area">${esc(e.venue || "")}${e.city ? ", " + esc(e.city) : ""}${e.country ? " · " + esc(e.country) : ""}</span><span class="evl"><a href="${esc(e.url || e.source)}" target="_blank" rel="noopener">Official site ›</a>${e.tickets ? ` <a href="${esc(e.tickets)}" target="_blank" rel="noopener sponsored">Tickets ›</a>` : ""} <a href="/?ev=${esc(e.id)}">Plan the road trip ›</a></span></div>`;
  const months = [...new Set(L.map(e => e.start.slice(0, 7)))];
  const sec = ym => { const [y, mo] = ym.split("-"); return `<section class="fsec evm"><h2>${MONTHS[+mo - 1]} ${y}</h2><div class="cards pcards">${L.filter(e => e.start.slice(0, 7) === ym).map(card).join("")}</div></section>`; };
  const body = `<main><h1>Motorsport and motoring events</h1>
<p class="intro">Races, rallies, festivals and classics worth travelling for. Every date comes from the organiser's own page and is checked every week. Tap Plan the road trip and the planner sets the venue as your finish.</p>
<nav class="chips" aria-label="Show">${CAT.map(([k, t], i) => `<button type="button" data-f="${k}"${i ? "" : ' class="on"'}>${t}</button>`).join("")}</nav>
${months.length ? months.map(sec).join("\n") : "<p class=\"note\">Events are being added.</p>"}
<p class="note">Dates change. Always check the organiser's page before you book flights and beds. Ticket links may pay OneTrackMind a small fee, at no cost to you. Missing an event? <a href="mailto:hello@onetrackmind.online?subject=Event%20for%20OneTrackMind">Tell us</a>.</p></main>
<script>(function(){var b=document.querySelectorAll(".chips button");b.forEach(function(x){x.onclick=function(){var f=x.dataset.f;b.forEach(function(y){y.classList.toggle("on",y===x)});document.querySelectorAll(".evc").forEach(function(c){c.hidden=f!=="all"&&c.dataset.cat!==f});document.querySelectorAll(".evm").forEach(function(s){s.hidden=!s.querySelector(".evc:not([hidden])")})}})})();</script>`;
  const ld = { "@context": "https://schema.org", "@graph": L.slice(0, 80).map(e => ({ "@type": "SportsEvent", name: e.name, startDate: e.start, endDate: e.end, url: e.url || e.source, location: { "@type": "Place", name: e.venue || e.city, address: { "@type": "PostalAddress", addressLocality: e.city, addressCountry: e.country } } })) };
  return page({ active: "/events/", url: "/events/", title: "Motorsport events and festivals: dates, tickets and road trips · OneTrackMind", desc: "F1, MotoGP, WorldSBK, NASCAR, WEC, the 24 hour races, Dakar and the big festivals: confirmed dates, tickets and a road trip planner for each.", body, ld });
}
function howtoIndex() {
  const body = `<main><h1>How to</h1>
<p class="intro">Things you didn't know you could do, and exactly how to do them. Drive the Nürburgring, take your own car on a track, see the factories where your heroes were built. What it costs, when, how to book, and what nobody tells you.</p>
<div class="cards pcards">${HOWTO.map(g => { const f = FAV.find(x => x.id === g.fav), st = f && favStory(f); return `<a class="card pcard" href="/how-to/${g.id}/">${st && st.img ? `<img src="${esc(st.img)}" alt="" loading="lazy">` : f ? `<img class="maptile" src="${tileOf(f.lat, f.lon, 9)}" alt="" loading="lazy">` : ""}<b>${esc(g.title)}</b><span class="lead">${esc(g.short)}</span></a>`; }).join("")}</div>
<p class="note">More coming: a track day in South Africa, Spa-Francorchamps, Motor Valley in four days, the Isle of Man TT.</p>
<a class="cta" href="/">Plan your own</a></main>`;
  return page({ active: "/favourites/", url: "/how-to/", title: "How to: drive the Nürburgring, do a track day, visit the factories · OneTrackMind", desc: "Practical guides from a petrolhead who's done it: what it costs, when it's open, how to book and what nobody tells you.", body, ld: { "@context": "https://schema.org", "@type": "CollectionPage", name: "How to", url: SITE + "/how-to/" } });
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
fs.rmSync(path.join(ROOT, "how-to"), { recursive: true, force: true });
write("how-to/index.html", howtoIndex());
write("record/index.html", recordPage());
write("events/index.html", eventsPage());
HOWTO.forEach(g => write(`how-to/${g.id}/index.html`, howtoPage(g)));
const urls = ["/", "/routes/", "/favourites/", "/about/", "/advertise/", "/how-to/", "/record/", "/events/", ...HOWTO.map(g => `/how-to/${g.id}/`), ...live.map(r => `/routes/${r.id}/`), ...FAV.map(x => `/favourites/${x.id}/`), "/blog/", ...STORIES.map(x => `/blog/${x.slug}/`), ...[...seriesOf().entries()].filter(([, L]) => L.length > 1).map(([n, L]) => `/blog/${tripSlug(n, L)}/`), "/terms.html", "/privacy.html", "/rules.html"];
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
