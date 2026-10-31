// Builds the plain-text pages search engines and AI tools can read:
// /routes/<id>/ for every published pick, /routes/, /about/, sitemap.xml, robots.txt, llms.txt.
// Source: data/picks/picks.json (stats come from scripts/pick-stats, run in a browser).
// Run: node scripts/make-pages.mjs   (build.sh runs it)
import fs from "node:fs"; import path from "node:path"; import crypto from "node:crypto"; import { createRequire } from "node:module";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SITE = "https://onetrackmind.online";
const BLOG = "https://onetrackmind.co.za";
// blog photos: served from media/blog/ once copied off the old site (scripts/fetch-blog-media.mjs); the old address until then
const STORIES = JSON.parse(fs.readFileSync(path.join(ROOT, "data/stories/stories.json"), "utf8").replace(/https?:\/\/(?:www\.)?onetrackmind\.co\.za\/wp-content\/uploads\/([^"\s\\]+)/g, (m, r) => { try { return fs.existsSync(path.join(ROOT, "media/blog", decodeURIComponent(r))) ? "/media/blog/" + r : m; } catch { return m; } }));
const HOWTO = JSON.parse(fs.readFileSync(path.join(ROOT, "data/howto/howto.json"), "utf8"));
const FAV = JSON.parse(fs.readFileSync(path.join(ROOT, "data/favourites/favourites.json"), "utf8"));
// "Make a trip of it": the same tiles as the planner and the newsletter (src/js/03-trip.js)
// cache-busting: a short hash of the file, so phones never run an old script against new pages
const V = f => crypto.createHash("md5").update(fs.readFileSync(path.join(ROOT, f))).digest("hex").slice(0, 8);
const HUB_SRC = `/js/hub.js?v=${V("js/hub.js")}`, REMIND_SRC = `/js/remind.js?v=${V("js/remind.js")}`;
const TRIP = createRequire(import.meta.url)(path.join(ROOT, "src/js/03-trip.js"));
const HOUSE = createRequire(import.meta.url)(path.join(ROOT, "src/js/02-house.js"));
const MATES_HIDE = () => { if (!MATES_ON && !HOUSE.HIDE.includes("/about/mates/")) HOUSE.HIDE.push("/about/mates/"); };
// Mates (data/founder.json "mates"): hidden until there are 5 entries in total
const MATE_GROUPS = [["places", "Places", "restaurants, farm stalls, museums and venues"], ["people", "People", "builders, racers, riders and photographers"], ["media", "Media and contributors", ""], ["clubs", "Clubs and organisers", ""], ["workshops", "Workshops and suppliers", ""]];
const MATES_RAW = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, "data/founder.json"), "utf8")).mates || {}; } catch (e) { return {}; } })();
const MATES = Object.fromEntries(MATE_GROUPS.map(([k]) => [k, (MATES_RAW[k] || []).filter(x => x && x.name && /^https?:\/\//.test(x.url || ""))]));
const MATES_ALL = MATE_GROUPS.flatMap(([k]) => MATES[k]), MATES_ON = MATES_ALL.length >= 5;
// a group in page order: its top 5 (ranked), then the rest A to Z
MATES_HIDE();
const matesOrder = L => [...L.filter(x => x.top >= 1 && x.top <= 5).sort((a, b) => a.top - b.top).slice(0, 5), ...L.filter(x => !(x.top >= 1 && x.top <= 5)).sort((a, b) => a.name.localeCompare(b.name))];
const mateRel = x => `noopener${x.sponsored ? " sponsored" : ""}`;
const HOUSE_CSS = fs.readFileSync(path.join(ROOT, "src/house.css"), "utf8");
TRIP.setAirports(JSON.parse(fs.readFileSync(path.join(ROOT, "data/airports.json"), "utf8")));
const favCountry = x => /Lesotho/.test(x.area) ? "Lesotho" : x.group === "na" || /Namib/.test(x.area) ? "Namibia" : x.group === "za" ? "South Africa" : ({ England: "United Kingdom", "Isle of Man": "Isle of Man", "Monaco and the French Riviera": "France" }[x.area.split(",").pop().trim()] || (/Germany|Belgium|Austria|Italy|France/.test(x.area) ? x.area.split(",").pop().trim() : "South Africa"));
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

const CSS = `:root{--bg:#EEF3F3;--panel:#fff;--ink:#11262B;--muted:#54666A;--line:#D0DBDC;--accent:#1E8EB4;--chip:#E0EBEC;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#121614;--panel:#1A201D;--ink:#E7EBE5;--muted:#9AA39D;--line:#2E3631;--accent:#4CC08F;--chip:#232A26;color-scheme:dark}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:400 17px/1.6 "IBM Plex Sans",system-ui,-apple-system,"Segoe UI",sans-serif}
a{color:var(--accent)}.wrap{max-width:1400px;margin:0 auto;padding:0 16px}@media(min-width:1440px){.wrap{padding:0}}main p,main ul,main ol,main blockquote,main h1,main h2,main h3,main .meta,main figure,main.story>img.cover,main .gallery,main .note,.spbox{max-width:860px}main .cards p,main .cards ul{max-width:none}
header{border-bottom:2px solid var(--ink);padding:14px 0 12px}
.logo{display:inline-block;font:700 2.7rem/1 "Saira Condensed","Arial Narrow",sans-serif;text-transform:uppercase;letter-spacing:-.005em;color:var(--ink);text-decoration:none}
.motto{font:700 1.2rem "Saira Condensed","Arial Narrow",sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--accent);margin:2px 0 0}
.hdrlinks{display:grid;grid-template-columns:repeat(3,auto);justify-content:start;gap:0;margin:10px 0 0;background:var(--ink);border-radius:6px;overflow:hidden;width:100%}.hdrlinks a{font:700 1.15rem "Saira Condensed","Arial Narrow",sans-serif;text-transform:uppercase;letter-spacing:.06em;text-decoration:none;color:var(--bg);padding:9px 20px;border:0;border-bottom:4px solid transparent;background:none;border-radius:0;white-space:nowrap}.hdrlinks a:hover{background:color-mix(in srgb,var(--bg) 12%,transparent)}.hdrlinks a.on{border-bottom-color:var(--gold)}.hdrlinks{overflow:visible!important}.navdd{position:relative;display:flex}.navdd>summary{list-style:none;cursor:pointer;font:700 1.15rem var(--f-display,"Saira Condensed","Arial Narrow",sans-serif);text-transform:uppercase;letter-spacing:.06em;color:var(--bg);padding:9px 20px;border-bottom:4px solid transparent;white-space:nowrap;width:100%}.prep .lilk{display:block;margin-bottom:4px}.about .lilwide{grid-template-columns:1fr}.about .juxend{text-align:center;margin:28px auto}.about .juxend span{display:block}.lastmore{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-top:10px}.lastmore img,.lastmore video{width:100%;height:340px;object-fit:cover;border-radius:6px;background:#000}.archall{margin:18px 0}.archall>summary{cursor:pointer;list-style:none;display:inline-block;font:700 1.05rem var(--f-display,"Saira Condensed",sans-serif);text-transform:uppercase;letter-spacing:.05em;color:var(--gold,#E8A317);border:2px solid currentColor;border-radius:6px;padding:8px 16px}.archall>summary::-webkit-details-marker{display:none}.prepup{list-style:none;padding:0;margin:12px 0 0;display:grid;gap:10px}.prepup li{display:flex;gap:12px;align-items:flex-start}.prepup img{width:96px;height:72px;object-fit:cover;border-radius:4px}.navdd>summary::-webkit-details-marker{display:none}.navdd>summary>a.ddh{all:unset;cursor:pointer}.navdd>summary>a.ddh:hover{text-decoration:underline;text-underline-offset:4px}.navdd>summary .chev{padding:6px;margin:-6px -6px -6px 0;box-sizing:content-box}.navdd>summary::after{content:" ▾";font-size:.8em}.navdd>summary.on{border-bottom-color:#E8A317}.navdd>summary:hover{background:color-mix(in srgb,var(--bg) 12%,transparent)}.navdd .ddm{position:absolute;z-index:2000;top:100%;left:0;min-width:210px;background:var(--ink);border-radius:0 0 6px 6px;box-shadow:0 6px 16px rgba(0,0,0,.25);flex-direction:column;display:flex}.navdd:not([open]) .ddm{display:none}@media(hover:hover){.navdd:hover .ddm{display:flex}}.navdd .ddm a{text-align:left!important;padding:10px 18px!important}@media(max-width:700px){.hdrlinks{grid-template-columns:repeat(3,minmax(0,1fr))!important}.navdd>summary{font-size:.95rem;padding:8px 4px;text-align:center;letter-spacing:.03em}.navdd .ddm{left:auto;right:0}}@media (max-width:640px){.hdrlinks{grid-template-columns:repeat(2,minmax(0,1fr))}.hdrlinks a{font-size:.95rem;padding:8px 4px;text-align:center;letter-spacing:.03em}}
@media (max-width:640px){.logo{font-size:1.9rem}.motto{font-size:.95rem}}
h1,h2{font-family:"Saira Condensed","Arial Narrow",sans-serif;line-height:1.1;text-transform:uppercase;letter-spacing:.01em}
h1{font-size:2.4rem;margin:28px 0 6px}h2{font-size:1.5rem;margin:30px 0 8px}
.meta{color:var(--muted);font-size:.95rem}.fdr{color:var(--accent);font-weight:600;margin:6px 0 0}
.cta{display:inline-block;background:var(--accent);color:#fff;font-weight:600;padding:12px 20px;border-radius:6px;text-decoration:none;margin:18px 0 6px}
.stats{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0}.stat{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:8px 14px}.stat b{display:block;font:700 1.4rem "Saira Condensed",sans-serif}.stat span{font-size:.8rem;color:var(--muted)}
ol.days{padding-left:0;list-style:none}ol.days li{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:10px 14px;margin:8px 0}ol.days .d{font:600 .8rem "IBM Plex Mono",monospace;color:var(--muted)}
blockquote{margin:14px 0;padding:4px 16px;border-left:3px solid var(--accent);background:var(--chip)}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;margin:14px 0}.card{background:var(--panel);border:1px solid var(--line);border-radius:6px;padding:12px 14px;text-decoration:none;color:var(--ink)}.card b{display:block;color:var(--accent)}.cards.pcards{grid-template-columns:repeat(auto-fill,minmax(250px,1fr))}.card.pcard{display:flex;flex-direction:column;gap:4px;padding:10px}.card.pcard>img{width:100%;aspect-ratio:16/10;object-fit:cover;border-radius:4px;margin:0 0 6px;background:var(--chip,#e4e9df)}.card.pcard .lead{color:var(--ink);font-size:.92rem}.card.pcard[hidden],.fsec[hidden]{display:none}.howlink{font-weight:600;margin:6px 0}.howto ul li{margin:4px 0}.sources{font-size:.85rem}.chips{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 4px}.chips button{font:600 .95rem "IBM Plex Sans",system-ui,sans-serif;padding:7px 14px;border-radius:999px;border:1px solid var(--line);background:var(--panel);color:var(--ink);cursor:pointer}.chips button.on{background:var(--ink);color:var(--bg);border-color:var(--ink)}.card span{font-size:.85rem;color:var(--muted)}
footer{border-top:1px solid var(--line);margin:40px 0 0;padding:16px 0 30px;color:var(--muted);font-size:.9rem}
.note{font-size:.9rem;color:var(--muted)}
.splogo{display:inline-flex;align-items:center;gap:10px;vertical-align:middle;text-decoration:none;color:var(--muted);margin:0 6px}.splogo img{height:56px;width:auto}.evalert{margin-top:16px;padding-top:14px;border-top:1px dashed var(--line)}.evalert b{display:block;font:700 1.05rem var(--f-display);text-transform:uppercase;letter-spacing:.03em}.evalert>span{display:block;font-size:.88rem;color:var(--muted);margin:2px 0 8px}.evalert .nlf{display:flex;gap:6px}.evalert input[type=email]{flex:1;min-width:0;padding:9px 10px;border-radius:8px;border:1px solid var(--line);background:var(--hero);color:var(--ink)}.evalert button{background:var(--gold);color:#06303F;border:0;border-radius:8px;padding:9px 12px;font-weight:700;cursor:pointer;white-space:nowrap}.evalert .nlm{display:block;font-size:.85rem;margin-top:6px;color:var(--gold)}.evalert-page{max-width:560px;border-top:0;padding:14px 16px;background:var(--panel);border:1px solid var(--line);border-left:5px solid var(--gold);border-radius:10px}.fx.evc{display:grid;flex-direction:initial;padding:12px 2px;gap:12px}.evalert-page{background:var(--panel)!important;border:1px solid var(--line)!important;border-left:5px solid var(--gold)!important}.evalert-page b{font-family:"Saira Condensed","Arial Narrow",sans-serif;color:var(--gold);font-size:1.25rem}.evalert-page>span{color:#B5D3DE!important}.evalert-page input[type=email]{background:#0A4A63!important;border-color:var(--line)!important}.evalert-page button{background:transparent!important;color:var(--gold)!important;border:2px solid var(--gold)!important}.fx .eg{font:700 .68rem/1.2 var(--f-body,sans-serif);text-transform:uppercase;letter-spacing:.08em;color:#8FD3EA}.fix{grid-auto-flow:row dense}.fx.t1{grid-column:span 2;border-bottom:2px solid var(--gold)}.fx.t1 .fxb>b{font:800 1.45rem/1.1 "Saira Condensed","Arial Narrow",sans-serif;text-transform:uppercase}.fx.t1 .fxd b{font-size:1.9rem}.fx.t3 .fxb>b{font-size:.92rem;font-weight:600}.ev27{padding:10px 14px;border-radius:8px;background:rgba(232,163,23,.14);border-left:4px solid var(--gold)}.ev27 b{color:var(--gold)}.ev27 a{color:var(--gold);font-weight:700}@media(max-width:700px){.fx.t1{grid-column:1/-1}}.prog{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:16px 18px 10px 34px;position:relative;margin:16px 0;overflow:hidden;color:#fff}.prog::before{content:"";position:absolute;left:0;top:0;bottom:0;width:14px;background:repeating-conic-gradient(#111 0 25%,#fff 0 50%) 0 0/14px 14px}.prog h2{color:var(--gold);margin:0 0 6px}.prog[hidden],.fx[hidden]{display:none!important}.fix{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:0 26px}.fx{display:grid;grid-template-columns:58px 1fr;gap:12px;padding:12px 2px;border-bottom:1px solid rgba(255,255,255,.14);color:#fff;text-decoration:none;align-items:start}a.fx:hover,.fx:hover{background:rgba(232,163,23,.07)}.fxd{background:var(--gold);border-radius:6px;text-align:center;padding:6px 0 5px;line-height:1.05}.fxd b{display:block;font:800 1.55rem "Saira Condensed","Arial Narrow",sans-serif;color:#121A1E}.fxd i{font-style:normal;font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#121A1E}.fxb{display:flex;flex-direction:column;gap:3px;min-width:0}.fxb>b{font-size:1.02rem;line-height:1.25;color:#fff}.fxb>b a{color:#fff}.fxb .area,.fxb .evd,.fxb .fxs{color:#B5D3DE;font-size:.86rem;font:inherit;font-size:.86rem}.fxb .evd{color:#D5DEE2;font-weight:600}.fx .evl a{color:var(--gold);font-size:.85rem}.fx .follow{border-color:var(--line);color:#B5D3DE}.spbox{margin:34px 0 0;padding:12px 14px;border:1px dashed var(--line);border-radius:6px;font-size:.92rem;color:var(--muted)}.spbox b{color:var(--ink)}
.intro{font-size:1.1rem}.cards.rides{grid-template-columns:repeat(auto-fill,minmax(260px,1fr))}.card.ride{display:flex;flex-direction:column;gap:4px}.card.ride .yr{font:700 1.6rem "Saira Condensed",sans-serif;color:var(--accent);line-height:1}.card.ride .lead{color:var(--ink);font-size:.95rem}.card.ride .go{color:var(--accent);font-weight:600;margin-top:auto}
.trip{margin:22px 0}.triplab{font-size:.8rem;letter-spacing:.08em;color:var(--muted);text-transform:uppercase}.trip h2{margin:4px 0 2px}.tripsub{color:var(--muted);margin:0 0 12px}.trip .tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}.tt{background:#0F5874;color:#F4F8F9;border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:6px;border-top:3px solid #E8A317}.tt .ic{font-size:22px}.tt b{font:800 1.25rem/1 var(--f-display,"Saira Condensed",sans-serif);text-transform:uppercase}.tt .d{color:#D6E7EE;font-size:.9rem;flex:1}.tt .p{font-size:.7rem;color:#9FC3D1;letter-spacing:.05em;text-transform:uppercase}.tt a{display:block;text-align:center;background:#E8A317;color:#0B1D21;font-weight:700;text-decoration:none;padding:9px;border-radius:6px;font-size:.9rem}.tt a.t2,.tt.alt a{background:transparent;color:#E8A317;border:2px solid #E8A317;padding:7px}.tt.alt{border-top-color:#2B7896}.tripwarn{color:#E8A317!important;font-weight:600}.tripf{font-size:.8rem;color:var(--muted);margin-top:8px}.triphow{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;background:#0B1D21;border:1px solid #2B7896;border-radius:10px;padding:12px 14px;margin:12px 0 6px;color:#D6E7EE;font-size:.85rem}.triphow b{display:block;color:#E8A317;font:800 1rem var(--f-display,"Saira Condensed",sans-serif);text-transform:uppercase}.tripf b{color:var(--ink)}@media(max-width:700px){.triphow{grid-template-columns:1fr}}@media(max-width:560px){.trip .tiles{grid-template-columns:1fr 1fr}.tt:last-child:nth-child(odd){grid-column:span 2}}
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
:root{--brand:#E8A317;--gold:#E8A317}
html[data-mode="motorsport"]{--bg:#121A1E;--panel:#0F5874;--ink:#F4F8F9;--muted:#B5D3DE;--line:#2B7896;--accent:#E8A317;--chip:#13617E;--onfill:#0B1D21;--warn:#FF9A1A;--bad:#E5484D;--brand:#E8A317;--gold:#E8A317;--hero:#0A4A63;color-scheme:dark}
html[data-mode="motorsport"] .hero{background:#03141A;border-color:#E8A317}

html[data-mode="motorsport"] .btn.share,html[data-mode="motorsport"] .ib.on{color:#111}
.hdrlinks{grid-template-columns:repeat(4,auto) 1fr!important}
.modesw{justify-self:end;align-self:center;margin-right:8px;display:flex;border:1px solid color-mix(in srgb,var(--bg) 40%,transparent);border-radius:999px;overflow:hidden}
.modesw button{font:700 .95rem "Saira Condensed","Arial Narrow",sans-serif;text-transform:uppercase;letter-spacing:.06em;background:none;border:0;color:var(--bg);padding:5px 12px;cursor:pointer;opacity:.7}
.modesw button.on{background:#E8A317;color:#11262B;opacity:1}
html[data-mode="motorsport"] .modesw button.on{background:#E8A317;color:#111}
@media(max-width:640px){.hdrlinks{grid-template-columns:repeat(4,auto)!important}.modesw{grid-column:1/-1;justify-self:start;margin:4px 0 6px 8px}}

.spstrip{display:flex;align-items:center;gap:8px;margin:6px 0 0;padding:3px 10px 3px 3px;border:1px solid var(--line);border-left:4px solid var(--gold);border-radius:6px;background:var(--panel);color:var(--ink);text-decoration:none;font-size:.95rem;order:9}.spstrip img{width:26px;height:26px;object-fit:cover;border-radius:4px}.spstrip{font-size:.85rem}.spstrip em{font-style:normal;color:var(--muted);font-size:.6rem;border:1px solid var(--line);border-radius:3px;padding:0 3px;margin-left:4px;text-transform:uppercase}
.packbox{display:flex;align-items:center;gap:12px;margin:16px 0;padding:8px 12px 8px 8px;border:1px solid var(--line);border-radius:8px;background:var(--panel);color:var(--ink);text-decoration:none}.packbox img{width:72px;height:72px;object-fit:cover;border-radius:6px}.packbox span{display:block;color:var(--muted);font-size:.9rem}

.recbox{border:1px solid var(--line);border-radius:10px;padding:14px;background:var(--panel);margin:14px 0}.recstat{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;text-align:center}.recstat b{display:block;font:700 2rem var(--f-display,"Saira Condensed",sans-serif)}.recstat span{color:var(--muted);font-size:.85rem}.recbtns{margin:12px 0 4px}.recbtns .cta{font-size:1.2rem;padding:14px 28px}.ride{display:flex;flex-direction:column;gap:6px;margin:8px 0;padding:10px}.ride .rname{font:700 1.1rem var(--f-display,"Saira Condensed",sans-serif);background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:4px;padding:6px 8px}

[hidden]{display:none!important}

.evc{display:flex;flex-direction:column;gap:4px;padding:12px}.evd{font:700 1.2rem var(--f-display,"Saira Condensed",sans-serif);color:var(--accent)}.unc{font:600 .75rem var(--f-body,sans-serif);font-style:normal;color:var(--warn);border:1px solid var(--warn);border-radius:3px;padding:0 4px;margin-left:6px}.evl{display:flex;gap:12px;flex-wrap:wrap;margin-top:4px}

.nlbox{margin:28px 0 0;padding:14px 16px;border:1px solid var(--line);border-left:4px solid var(--gold);border-radius:6px;background:var(--panel);display:flex;flex-direction:column;gap:6px;color:var(--ink)}.nlbox span{color:var(--muted);font-size:.92rem}.nlf{display:flex;gap:8px;flex-wrap:wrap;position:relative}.nlf input[name=fname]{flex:0 1 140px;min-width:110px;padding:9px 10px;border:1px solid var(--line);border-radius:4px;background:var(--bg);color:var(--ink);font:inherit}.nlf input[type=email]{flex:1;min-width:200px;padding:9px 10px;border:1px solid var(--line);border-radius:4px;background:var(--bg);color:var(--ink);font:inherit}.nlf button{padding:9px 16px;border:0;border-radius:4px;background:var(--accent);color:var(--onfill,#fff);font-weight:700;cursor:pointer}

.me{float:right;width:min(38%,260px);height:auto;margin:0 0 14px 20px;border-radius:10px;border:3px solid var(--gold)}@media(max-width:640px){.me{float:none;display:block;width:70%;max-width:260px;margin:0 0 14px}}

.hdrlinks{display:flex!important;flex-wrap:wrap;align-items:center}.hdrlinks a.navplan{margin-left:auto;background:var(--gold)!important;color:#121A1E!important;border-radius:8px;border-bottom:0!important;padding:7px 16px}.hdrlinks .modesw{margin-left:auto}.navtoggle{display:none}
@media(max-width:640px){.navtoggle{display:block;font:700 1.15rem "Saira Condensed","Arial Narrow",sans-serif;text-transform:uppercase;letter-spacing:.06em;background:none;border:0;color:var(--bg);padding:9px 14px;cursor:pointer}.hdrlinks{justify-content:space-between}.hdrlinks>a{display:none!important;width:100%}.hdrlinks.open>a{display:block!important}.hdrlinks .modesw{margin:4px 8px}}

.blog .bpick{display:grid;grid-template-columns:.6fr 1fr 1fr;gap:10px;margin:14px 0 16px}.bbox{min-height:90px;border:3px solid transparent;border-radius:10px;padding:12px;text-align:left;cursor:pointer;color:#fff;font:inherit;display:flex;flex-direction:column;justify-content:flex-end;background:linear-gradient(180deg,rgba(3,20,26,.1),rgba(3,20,26,.88)),var(--img,linear-gradient(135deg,#1E8EB4,#0B4A60)) center/cover}.bbox b{font:700 1.4rem var(--f-display,"Saira Condensed",sans-serif);text-transform:uppercase}.bbox span{color:var(--gold);font-size:.85rem;font-weight:600}.bbox.on{border-color:var(--gold)}
.collage{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));grid-auto-rows:200px;grid-auto-flow:dense;gap:8px}.ctile{position:relative;border-radius:8px;overflow:hidden;background:var(--panel)}.ctile.big{grid-column:span 2;grid-row:span 2}.ctile .cimg{position:absolute;inset:0;display:block;color:#fff;text-decoration:none}.ctile img{position:absolute;inset:0;display:block;width:100%!important;height:100%!important;max-height:none!important;max-width:none!important;aspect-ratio:auto!important;object-fit:cover;margin:0!important;border:0!important;border-radius:0!important;transition:transform .3s}.cmeta{z-index:1}.ctile:hover img{transform:scale(1.04)}.cmeta{position:absolute;left:0;right:0;bottom:0;padding:30px 12px 10px;background:linear-gradient(180deg,transparent,rgba(3,20,26,.92));display:flex;flex-direction:column}.cmeta b{font:700 1.15rem/1.1 var(--f-display,"Saira Condensed",sans-serif);text-transform:uppercase}.ctile.big .cmeta b{font-size:1.7rem}.cmeta span{font-size:.8rem;color:#C9D6D8}.plot{position:absolute;top:8px;right:8px;background:var(--gold);color:#0B1D21;font-weight:700;font-size:.8rem;padding:4px 8px;border-radius:4px;text-decoration:none;z-index:2}
@media(max-width:640px){.blog .bpick{grid-template-columns:1fr 1fr}.blog .bpick .bbox[data-f=all]{grid-column:1/-1;min-height:44px}.collage{grid-template-columns:1fr 1fr;grid-auto-rows:150px}.ctile.big{grid-column:span 2;grid-row:span 2}}


.tex-gravel{background:linear-gradient(90deg,rgba(20,14,8,.78),rgba(20,14,8,.35)),url(/img/tex-gravel.jpg) center/cover!important}
.tex-tar{background:linear-gradient(90deg,rgba(0,0,0,.55),rgba(0,0,0,.15)),url(/img/tex-tar2.jpg) center bottom/cover!important}

.cabout{grid-column:-3/-1;grid-row:1/span 2;background:var(--panel);border:2px solid var(--gold);border-radius:10px;padding:14px;display:flex;gap:14px;align-items:flex-start;overflow:hidden}.cabout img{width:110px;height:146px;object-fit:cover;object-position:50% 15%;border-radius:8px;flex:none}.cabout b{font:700 1.5rem var(--f-display,"Saira Condensed",sans-serif);text-transform:uppercase;color:var(--gold)}.cabout p{margin:6px 0 10px;font-size:.95rem;line-height:1.45}.cabout a{font-weight:700}
@media(max-width:640px){.cabout{grid-column:1/-1;grid-row:auto}}

.tagchips{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px}.tagchips button{border:1px solid var(--line);background:var(--chip);color:var(--ink);border-radius:999px;padding:6px 14px;font:600 .9rem var(--f-body,sans-serif);cursor:pointer}.tagchips button.on{background:var(--gold);border-color:var(--gold);color:#0B1D21}

.spstrip{display:none!important}
.adrow{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:10px 0 4px;order:9;flex-basis:100%;width:100%}.adcard{display:flex;gap:14px;align-items:center;background:var(--panel);border:1px solid var(--line);border-left:5px solid var(--gold);border-radius:10px;padding:10px 14px 10px 10px;color:var(--ink);text-decoration:none;transition:border-color .15s}.adcard:hover{border-color:var(--gold)}.adcard img{width:92px;height:92px;object-fit:cover;border-radius:8px;flex:none;background:#fff}.adt{display:flex;flex-direction:column;gap:2px}.adt em{font:600 .7rem var(--f-body,sans-serif);font-style:normal;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}.adt b{font:700 1.45rem/1.05 var(--f-display,"Saira Condensed",sans-serif);text-transform:uppercase;color:var(--gold)}.adt span{font-size:.92rem}.adt i{font-style:normal;font-weight:700;margin-top:2px}
@media(max-width:640px){.adrow{grid-template-columns:1fr}.adcard img{width:72px;height:72px}.adt b{font-size:1.2rem}}

.gocta{margin:6px 0 14px}

.srcb{background:#fff;color:#0B1D21;font:700 .7rem var(--f-body,sans-serif);font-style:normal;text-transform:uppercase;padding:2px 6px;border-radius:3px}.ctile.soc .cmeta b{font-family:var(--f-body,sans-serif);text-transform:none;font-size:.95rem;font-weight:600}

.badges{position:absolute;top:8px;left:8px;z-index:2;display:flex;gap:4px}.kind,.srcb{font:700 .7rem var(--f-body,sans-serif);font-style:normal;text-transform:uppercase;letter-spacing:.04em;padding:2px 7px;border-radius:3px;color:#0B1D21}.k-story{background:#fff}.k-route,.k-place{background:var(--gold)}.chipsep{width:1px;background:var(--line);margin:0 4px}.tagchips .kchip{font-weight:700}

.hdrlinks{background:none!important;border-bottom:1px solid var(--line);border-radius:0!important}.hdrlinks>a{color:var(--ink)!important;text-transform:none!important;letter-spacing:.01em!important;font-size:1.3rem!important;padding:8px 16px 6px!important}.hdrlinks>a:hover{background:none!important;color:var(--gold)!important}.hdrlinks>a.on{border-bottom-color:var(--gold)!important}.navtoggle{color:var(--ink)!important;text-transform:none!important}
.aboutlink{display:inline-flex;align-items:center;gap:6px;margin-left:auto;font-weight:700;text-decoration:none;color:var(--gold)}.aboutlink img{width:28px;height:28px;border-radius:50%;object-fit:cover;object-position:50% 12%;border:2px solid var(--gold)}

body.blogdark{--bg:#0E1417;--panel:#0F5874;--line:#2B7896;--chip:#13617E;background:#0E1417}

.evc b a{color:inherit;text-decoration:none}.evc b a:hover{color:var(--gold)}.follow{align-self:flex-start;background:none;border:1px solid var(--line);border-radius:999px;color:var(--muted);font-size:.75rem;padding:1px 8px;cursor:pointer}.follow.on{border-color:var(--gold);color:var(--gold)}.chips .mine{border-color:var(--gold)}.evpage .evwhen{font-size:1.1rem}.evpage .evcta{margin:10px 0 14px;gap:8px;display:flex;flex-wrap:wrap}.evsec{margin:22px 0}.evsec h3{font:700 1.05rem var(--f-display,"Saira Condensed",sans-serif);text-transform:uppercase;margin:12px 0 4px}

/* buttons: gold fill = the main action; outline = everything else (no lost text links) */
.btn{display:inline-block;background:var(--gold);color:#121A1E;border:2px solid var(--gold);border-radius:8px;padding:10px 18px;font-weight:700;text-decoration:none;cursor:pointer}
.btnline{display:inline-block;background:transparent;color:var(--gold);border:2px solid var(--gold);border-radius:8px;padding:7px 14px;font-weight:700;text-decoration:none;white-space:nowrap}.btnline:hover{background:rgba(232,163,23,.12)}
.evnews .nw{padding:10px 0;border-bottom:1px solid var(--line)}.evnews .nw b{display:block;font-size:1.05rem}.evnews .nw p{margin:4px 0 8px;color:var(--muted)}.btnrow{display:flex;flex-wrap:wrap;gap:10px;margin:12px 0 0}
.tex-gravel{background:linear-gradient(90deg,rgba(20,14,8,.8),rgba(20,14,8,.35)),url(/img/tex-gravel.jpg) center/cover}
.tex-tar{background:linear-gradient(90deg,rgba(0,0,0,.6),rgba(0,0,0,.2)),url(/img/tex-tar2.jpg) center bottom/cover}
.pk{display:inline-block;background:var(--gold);color:#121A1E;font:700 .78rem/1 "Saira Condensed","Arial Narrow",sans-serif;text-transform:uppercase;letter-spacing:.1em;padding:6px 10px;border-radius:4px}
/* home */
.hero3{display:grid;grid-template-columns:1fr minmax(0,560px) 1fr;gap:24px;align-items:center;margin:18px 0 14px}.wherebar .wbf{position:relative}.wbsug{position:absolute;left:0;right:0;top:100%;z-index:3000;list-style:none;margin:4px 0 0;padding:6px 0;background:#fff;color:#11262B;border-radius:10px;box-shadow:0 10px 28px rgba(0,0,0,.35);text-align:left}.wbsug li{padding:8px 14px;cursor:pointer;display:flex;flex-direction:column;line-height:1.3}.wbsug li:hover{background:#EEF3F3}.wbsug li span{font-size:.85rem;color:#54666A}.wbsug[hidden]{display:none}
.lilwide{grid-template-columns:minmax(0,1.2fr) 1fr}.lilwide .lilpics{display:grid;grid-template-columns:2fr 1fr;gap:8px}.lilwide .lilpics img{width:100%;height:260px;object-fit:cover;border-radius:10px}.lilwide .lilpics img:only-child{grid-column:1/-1}.lilwide .lilk{display:inline-flex;gap:6px;align-items:center;color:#E8A317;font-size:.8rem;letter-spacing:.06em;text-transform:uppercase}.lilwide b{display:block;font:800 1.6rem var(--f-display,"Saira Condensed",sans-serif);text-transform:uppercase;margin:4px 0}@media(max-width:760px){.lilwide{grid-template-columns:1fr}.lilwide .lilpics img{height:200px}}
.homeril{position:relative}.homeril{display:block;width:fit-content;max-width:100%;margin-inline:auto!important}.hostamp{position:absolute;right:-9%;top:-10%;width:26%;max-width:230px;height:auto;color:#EF3B2F;transform:rotate(14deg);filter:drop-shadow(0 2px 6px rgba(0,0,0,.6));pointer-events:none}@media(max-width:760px){.hostamp{width:25%;right:-3%;top:-14%}}.homeril{margin:0;text-align:center;line-height:0}.homeril img{width:100%;height:auto}.h3l{display:flex;flex-direction:column;gap:10px;color:var(--ink);text-decoration:none;font-size:1.05rem;line-height:1.45}.h3l img{border-radius:50%;border:2px solid var(--gold);object-fit:cover}.h3l b{color:var(--gold)}.h3r{margin:0;font:800 clamp(1.5rem,2.4vw,2.1rem)/1.1 var(--f-display,"Saira Condensed",sans-serif);text-transform:uppercase;color:var(--ink)}.h3r b{color:var(--gold)}@media(max-width:860px){.hero3{grid-template-columns:1fr;gap:14px;text-align:center}.homeril{order:-1}.homeril img{width:min(520px,94%)}.h3l{align-items:center}.h3r{font-size:1.5rem}}
.home .oneliner{display:flex;align-items:center;justify-content:center;gap:14px;margin:18px auto 16px;max-width:820px;color:var(--ink);text-decoration:none;font-size:1.08rem}.home .oneliner img{border-radius:50%;border:2px solid var(--gold);object-fit:cover}.home .oneliner b{color:var(--gold)}
.doors{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:8px 0 18px}.door{position:relative;display:flex;flex-direction:column;gap:10px;align-items:flex-start;padding:26px 24px;border-radius:12px;min-height:240px;color:#fff;text-decoration:none;border:2px solid transparent}.door:hover{border-color:var(--gold)}.door>b{font:800 2rem/1.05 "Saira Condensed","Arial Narrow",sans-serif;text-transform:uppercase}.door>span:not(.pk):not(.btn){max-width:460px;font-size:1rem;line-height:1.45}.door .btn{margin-top:auto}
.cd{display:grid;grid-template-columns:1fr auto auto;gap:18px;align-items:center;background:var(--panel);border:1px solid var(--line);border-left:6px solid var(--gold);border-radius:12px;padding:16px 20px;margin:0 0 12px}.cd[hidden]{display:none}.cdk{display:block;font:700 .75rem/1 var(--f-body,sans-serif);text-transform:uppercase;letter-spacing:.1em;color:#8FD3EA;margin-bottom:4px}.cdl b{display:block;font:800 1.7rem/1.05 "Saira Condensed","Arial Narrow",sans-serif;text-transform:uppercase}.cdw{color:var(--muted)}.cdn{text-align:center}.cdn b{display:block;font:800 3rem/1 "Saira Condensed","Arial Narrow",sans-serif;color:var(--gold)}.cdn span{color:var(--muted);font-size:.85rem}.cdb{display:flex;gap:8px;flex-wrap:wrap}.cdnews{grid-column:1/-1;margin:0;font-size:.92rem;border-top:1px solid var(--line);padding-top:10px}.cdnews span{color:var(--muted)}.cdnews a{color:var(--ink)}
.camps{display:flex;flex-direction:column;gap:6px;margin:0 0 14px}.camps:empty{display:none}.camp{padding:10px 14px;border-radius:8px;background:rgba(232,163,23,.14);border-left:4px solid var(--gold)}.camp b{color:var(--gold)}.camp a{color:var(--gold);font-weight:700;white-space:nowrap}
.hub .lede{max-width:860px}.hub{margin:26px 0}.hubh{display:flex;flex-wrap:wrap;gap:10px;align-items:baseline;justify-content:space-between;margin-bottom:8px}.hubh h2{margin:0}.hubsub{color:var(--muted)}.lede{font-size:1.05rem}
.hub .pcards{display:grid;grid-template-columns:repeat(4,1fr)!important;gap:12px}@media(max-width:1000px){.hub .pcards{grid-template-columns:repeat(2,1fr)!important}}@media(max-width:520px){.hub .pcards{grid-template-columns:1fr!important}}.fuel span span.btnline{display:inline-block;margin:0}.pcards[style*="--n:1"] .hubcard{display:grid;grid-template-columns:minmax(0,2fr) 3fr;gap:4px 18px;align-items:start}.pcards[style*="--n:1"] .hubcard img{grid-row:span 4;aspect-ratio:16/9!important;margin:0}.pcards[style*="--n:1"] .hubcard b{font-size:1.3rem}@media(max-width:700px){.pcards[style*="--n:1"] .hubcard{grid-template-columns:1fr}}.hubcard img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:6px;margin-bottom:6px}.hubcard .go{color:var(--gold);font-weight:700;margin-top:4px}
.lilpanel{display:grid;grid-template-columns:minmax(0,1fr) 2fr;gap:18px;align-items:center;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px}.lilpanel img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:8px}.lilpanel b{font:800 1.4rem "Saira Condensed","Arial Narrow",sans-serif;text-transform:uppercase;color:var(--gold)}@media(max-width:700px){.lilpanel{grid-template-columns:1fr}}.sqgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.sq{background:var(--panel);border:1px solid var(--line);border-top:5px solid var(--c);border-radius:12px;padding:12px 14px 8px;display:flex;flex-direction:column;min-height:300px}.sqh{font:800 1.05rem "Saira Condensed","Arial Narrow",sans-serif;text-transform:uppercase;letter-spacing:.06em;color:var(--c);margin-bottom:8px}.sqtop{display:grid;grid-template-columns:64px 1fr;gap:12px;color:#fff;text-decoration:none;padding:10px;margin:0 -4px 6px;border-radius:8px;background:rgba(0,0,0,.18);min-height:118px;align-items:start}.sqtop:hover{background:rgba(232,163,23,.12)}.sqtop .evdate{background:var(--c);padding:8px 0}.sqtop .evdate b{font-size:2rem}.sqtop b{display:block;font:800 1.35rem/1.08 "Saira Condensed","Arial Narrow",sans-serif;text-transform:uppercase}.sqtop .ew{margin-top:4px}.sqtop .ef{font-size:.9rem;margin-top:6px}.sqrow{display:grid;grid-template-columns:62px 1fr;gap:8px;padding:8px 2px;border-top:1px solid rgba(255,255,255,.12);color:#fff;text-decoration:none;font-size:.92rem}.sqrow b{color:var(--c);font:700 .95rem "Saira Condensed","Arial Narrow",sans-serif;text-transform:uppercase}.sqrow:hover span{color:var(--gold)}.sqhome{border:2px solid var(--gold);border-top:5px solid var(--gold);background:linear-gradient(180deg,rgba(232,163,23,.12),var(--panel) 60%)}@media(max-width:1000px){.sqgrid{grid-template-columns:repeat(2,1fr)}}@media(max-width:600px){.sqgrid{grid-template-columns:1fr}.sq{min-height:0}}.blog .collage{display:grid!important;grid-template-columns:repeat(3,1fr)!important;grid-auto-rows:auto!important;grid-auto-flow:row!important;gap:22px!important}.blog .ctile{display:flex;flex-direction:column;background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden;grid-column:auto!important;grid-row:auto!important}.blog .ctile[hidden]{display:none}.blog .ctile .cimg{position:relative;display:block;height:220px!important}.blog .ctile .cimg img{position:absolute!important;inset:0;width:100%!important;height:100%!important;object-fit:cover}.cbody{display:flex;flex-direction:column;gap:6px;padding:12px 16px 16px;flex:1}.cy{color:var(--muted);font-size:.78rem;text-transform:uppercase;letter-spacing:.06em}.ct{color:#fff;text-decoration:none;font:800 1.3rem/1.15 "Saira Condensed","Arial Narrow",sans-serif;text-transform:uppercase}.ct:hover{color:var(--gold)}.cbody p{margin:0;color:#D5DEE2;font-size:.95rem;line-height:1.45}.cr{margin-top:auto;padding-top:6px;color:var(--gold);font-weight:700;text-decoration:none}@media(max-width:1000px){.blog .collage{grid-template-columns:repeat(2,1fr)!important}}@media(max-width:600px){.blog .collage{grid-template-columns:1fr!important}.blog .ctile .cimg{height:200px!important}}.wherebar{display:grid;grid-template-columns:auto 1fr 1.4fr auto;gap:10px;align-items:center;background:var(--gold);border-radius:12px;padding:12px 14px;margin:0 0 16px;box-shadow:0 6px 18px rgba(0,0,0,.35)}.wbq{grid-column:1/-1;font:800 1rem "Saira Condensed","Arial Narrow",sans-serif;text-transform:uppercase;letter-spacing:.06em;color:#121A1E;opacity:.75;text-align:right;margin-top:-2px}.wbl{font:800 1.5rem "Saira Condensed","Arial Narrow",sans-serif;text-transform:uppercase;color:#121A1E;padding:0 6px}.wbf{display:flex;flex-direction:column;background:#fff;border-radius:8px;padding:6px 12px}.wbf i{font-style:normal;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#0A4A63}.wbf input{border:0;outline:0;font-size:1.05rem;color:#121A1E;background:transparent;padding:2px 0;width:100%}.wherebar .btn{background:#121A1E;color:var(--gold);border-color:#121A1E;font-size:1.1rem;padding:14px 22px}@media(max-width:700px){.wherebar{grid-template-columns:1fr}.wbl{font-size:1.2rem}}.rilfoot{text-align:center;margin:26px 0 6px}.rilfoot img{width:min(320px,70%);height:auto}.planown{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:20px 22px}
/* hub pages */
.hostick{position:absolute;right:22px;top:18px;width:118px;height:auto;transform:rotate(6deg);box-shadow:0 6px 18px rgba(0,0,0,.55);border-radius:3px}.hostick.big{width:170px;right:34px;top:24px}.hohero{position:relative;padding-right:240px!important}@media(max-width:760px){.hostick{width:84px;right:12px;top:12px}.door:has(.hostick){padding-top:128px}.hostick.big{width:110px}.hohero{padding-right:26px!important;padding-top:150px!important}}.hubhero{border-radius:12px;padding:30px 26px;margin:16px 0 18px;color:#fff;display:flex;flex-direction:column;gap:10px;align-items:flex-start}.hubhero h1{margin:0;font-size:2.4rem}.hubhero p{max-width:640px;font-size:1.05rem;margin:0}
.prog .btnline{margin:12px 0 4px}
/* FOMO list (home, Petrolhead) */
.fomo .evhead{display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between;margin-bottom:8px}.evview{display:flex;border:1px solid var(--line);border-radius:8px;overflow:hidden}.evview button{background:transparent;border:0;color:var(--ink);padding:7px 14px;font:700 .9rem "Saira Condensed","Arial Narrow",sans-serif;text-transform:uppercase;letter-spacing:.04em;cursor:pointer}.evview button.on{background:var(--gold);color:#121A1E}
.evregs{display:flex;flex-wrap:wrap;gap:6px}.evregs button{border:1px solid var(--line);background:transparent;color:var(--ink);border-radius:999px;padding:4px 11px;font-weight:600;font-size:.82rem;cursor:pointer}.evregs button.on{background:var(--gold);border-color:var(--gold);color:#121A1E}
.fomo .evgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:0 22px;grid-auto-flow:row dense;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:6px 16px 10px}
.evcard{display:grid;grid-template-columns:54px 1fr;gap:12px;padding:12px 2px;border-bottom:1px solid rgba(255,255,255,.14);color:#fff;text-decoration:none}.evcard:hover{background:rgba(232,163,23,.08)}.evdate{background:var(--gold);border-radius:6px;text-align:center;padding:6px 0 5px;line-height:1.05;align-self:start}.evdate b{display:block;font:800 1.5rem "Saira Condensed","Arial Narrow",sans-serif;color:#121A1E}.evdate i{font-style:normal;font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#121A1E}
.eg{display:block;font:700 .66rem/1.2 var(--f-body,sans-serif);text-transform:uppercase;letter-spacing:.08em;color:#8FD3EA;margin-bottom:2px}.en{display:block;font-weight:700;line-height:1.25}.ew{display:block;color:var(--muted);font-size:.84rem;margin-top:2px}.ef{display:block;color:#FFD23F;font-size:.82rem;font-weight:700;margin-top:3px}
@media(max-width:1000px){.fomo .evgrid{grid-template-columns:repeat(2,1fr)}}@media(max-width:560px){.fomo .evgrid{grid-template-columns:1fr}}.evcard.t1{grid-column:span 2;border-bottom:2px solid var(--gold)}.evcard.t1 .en{font:800 1.35rem/1.1 "Saira Condensed","Arial Narrow",sans-serif;text-transform:uppercase}.evcard.t1 .evdate b{font-size:1.75rem}.evcard.t3 .en{font-weight:600;font-size:.88rem}
/* Fuelled by AlterEgo, with room for the next sponsor beside it */
.fuelrow{display:grid;grid-template-columns:2fr 1fr;gap:14px;margin:30px 0 8px}.fuel{display:flex;gap:18px;align-items:center;background:var(--panel);border:1px solid var(--line);border-left:6px solid var(--gold);border-radius:12px;padding:16px 20px;color:var(--ink);text-decoration:none}.fuel img{height:84px;width:auto;flex:none}.fuel b{display:block;font:800 1.5rem/1.1 "Saira Condensed","Arial Narrow",sans-serif;text-transform:uppercase;color:var(--gold)}.fuel span span{display:block;margin:4px 0 10px;color:var(--muted)}
.fuelyou{display:flex;flex-direction:column;justify-content:center;gap:4px;border:2px dashed var(--line);border-radius:12px;padding:16px 20px;color:var(--ink);text-decoration:none}.fuelyou b{font:800 1.3rem "Saira Condensed","Arial Narrow",sans-serif;text-transform:uppercase;color:var(--gold)}.fuelyou span{color:var(--muted)}
@media(max-width:760px){.doors,.fuelrow{grid-template-columns:1fr}.door{min-height:0}.cd{grid-template-columns:1fr auto}.cdb{grid-column:1/-1}.evcard.t1{grid-column:1/-1}.home .oneliner{font-size:.98rem}}
@media(max-width:640px){.hdrlinks>a.navplan{display:inline-block!important;width:auto!important;margin-left:auto;order:-1}.hdrlinks .navtoggle{order:-2}.hdrlinks.open>a.navplan{display:inline-block!important}}.hdrlinks a.navplan{display:flex!important;flex-direction:column;align-items:center;gap:3px;line-height:1;padding:8px 20px!important;font-size:1.2rem!important}.pinic{display:block}`;

// AlterEgo product ads: one shop, a different product per page (picked by the page address, so it doesn't flicker or change on reload)
const AE = JSON.parse(fs.readFileSync(path.join(ROOT, "data/alterego-products.json"), "utf8"));
const aeHash = s => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
function aePick(seed, n = 1, ctx = "") {
  const fit = /killarney/i.test(ctx) ? AE.filter(x => x.t === "killarney") : [], rest = AE.filter(x => x.t !== "killarney"), out = [];
  if (fit.length) out.push(fit[aeHash(seed) % fit.length]);
  for (let i = 0; out.length < n && i < rest.length; i++) { const x = rest[(aeHash(seed) + i * 3) % rest.length]; if (!out.includes(x)) out.push(x); }
  return out.slice(0, n);
}
const aeUrl = (x, where) => `https://alterego.online/products/${x.h}?utm_source=onetrackmind&utm_medium=${where}&utm_content=${x.h}`;
const aeCard = (x, where) => `<a class="adcard" href="${aeUrl(x, where)}" target="_blank" rel="noopener sponsored"><img src="${x.i}&width=360" alt="AlterEgo ${esc(x.b.replace(/\.$/, ""))} ${x.c.split(" ").pop()}" loading="lazy"><span class="adt"><em>AlterEgo · Ad</em><b>${esc(x.b)}</b><span>${esc(x.s)} $${x.p}.</span><i>${esc(x.c)} ›</i></span></a>`;
const aeSide = (x) => `<aside class="aeside"><a class="aecol" href="${aeUrl(x, "sidebar")}" target="_blank" rel="noopener sponsored"><em>AlterEgo · Ad</em><img src="${x.i}&width=600" alt="AlterEgo ${esc(x.b.replace(/\.$/, ""))} ${x.c.split(" ").pop()}" loading="lazy"><b>${esc(x.b)}</b><span>${esc(x.s)}</span><span class="aep">$${x.p} · made to order</span><i>${esc(x.c)} ›</i></a></aside>`;
function page({ url, title, desc, body, ld, image, active, ads = true, dark = false, side = false, cls = "" }) {
  const aeP = aePick(url, 3, title);
  return `<!doctype html>
<html lang="en">
<head>
<script>document.documentElement.setAttribute("data-mode","motorsport")</script>
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
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@600;700;800&family=IBM+Plex+Sans:wght@400;600&family=IBM+Plex+Mono:wght@500&display=swap">
<style>${CSS}
${HOUSE_CSS}</style>
${(Array.isArray(ld) ? ld : [ld]).filter(Boolean).map(x => `<script type="application/ld+json">${JSON.stringify(x)}</script>`).join("\n")}
<!-- Booking partners (Travelpayouts, Stay22): their scripts load only after the visitor says OK -->
<script>(function(){var K="otm-consent",v=null;try{v=localStorage.getItem(K)}catch(e){}
function go(){var d=document,s=d.createElement("script");s.async=1;s.src="https://emrld.ltd/NTkzMzMz.js?t=593333";d.head.appendChild(s);window.Stay22={params:{lmaID:"6ae476c5a34dc56ee430ba25"}};var z=d.createElement("script");z.async=1;z.src="https://lma.stay22.com/letmeallez.js";d.head.appendChild(z);try{document.dispatchEvent(new Event("otm-consent"))}catch(e){}}
function set(x){try{localStorage.setItem(K,x)}catch(e){}var b=document.getElementById("otmck");if(b)b.remove();if(x==="yes")go();}
window.otmConsentYes=function(){set("yes")};if(v==="yes"){go();return}if(v==="no")return;
document.addEventListener("DOMContentLoaded",function(){var b=document.createElement("div");b.id="otmck";b.setAttribute("role","dialog");b.setAttribute("aria-label","Cookies");
b.style.cssText="position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;max-width:760px;margin:0 auto;background:#0B1D21;color:#D6E7EE;border:1px solid #2B7896;border-top:3px solid #E8A317;border-radius:10px;padding:12px 14px;font:14px/1.45 Arial,Helvetica,sans-serif;display:flex;gap:12px;align-items:center;flex-wrap:wrap;box-shadow:0 6px 24px rgba(0,0,0,.4)";
b.innerHTML='<span style="flex:1 1 320px">Our booking partners use cookies so they can pay us if you book a bed, car, flight or tour. Same price to you, and nothing else tracks you. <a href="/partners/" style="color:#E8A317">How we earn</a></span><button type="button" data-ck="yes" style="background:#E8A317;color:#0B1D21;border:0;border-radius:6px;padding:9px 16px;font-weight:700;cursor:pointer">OK</button><button type="button" data-ck="no" style="background:transparent;color:#D6E7EE;border:1px solid #2B7896;border-radius:6px;padding:8px 12px;cursor:pointer">No thanks</button>';
b.addEventListener("click",function(e){var t=e.target.closest("[data-ck]");if(t)set(t.dataset.ck)});document.body.appendChild(b);});})();</script>

</head>
<body${dark || cls ? ` class="${[dark ? "blogdark" : "", cls].filter(Boolean).join(" ")}"` : ""}><div class="wrap">
<header><a class="logo" href="/">OneTrackMind</a>${HOUSE.nav(active)}</header><script>document.addEventListener("click",function(e){var b=e.target.closest&&e.target.closest(".navtoggle");if(!b)return;var n=b.closest(".hdrlinks"),o=n.classList.toggle("open");b.setAttribute("aria-expanded",String(o))});document.addEventListener("click",function(e){document.querySelectorAll(".navdd[open]").forEach(function(d){if(!d.contains(e.target))d.open=false;});});</script>
${side ? `<div class="withad">${body}${aeSide(aeP[0])}</div>` : body}
${ads ? `<div class="adrow">${aeCard(aeP[side ? 1 : 0], "sponsor")}${aeCard(aeP[side ? 2 : 1], "sponsor")}</div>` : ""}
<aside class="nlbox" id="newsletter"><b>Get The OneTrackMind Week</b><span>What's on this week, last week's results and a road worth riding. Every Monday, or less often if you like.</span><form class="nlf" novalidate><input type="text" name="fname" placeholder="First name" autocomplete="given-name" aria-label="First name" maxlength="40"><input type="email" name="email" placeholder="Your email" autocomplete="email" aria-label="Your email" required><input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px"><button type="submit">Sign me up</button></form><span class="nlm" aria-live="polite"></span></aside>
<section class="fuelrow"><a class="fuel" href="https://alterego.online/?utm_source=onetrackmind&utm_medium=sponsor&utm_content=fuelled" target="_blank" rel="noopener sponsored"><img src="/img/alterego-logo-white.png" width="96" height="84" alt="AlterEgo"><span><b>Fuelled by AlterEgo</b><span>OneTrackMind is free to use. AlterEgo keeps it that way.</span><span class="btnline">Shop AlterEgo ›</span></span></a><a class="fuelyou" href="/advertise/"><b>Your brand here</b><span>Sponsor a route, the diary or the whole site ›</span></a></section>
<script>(function(){document.querySelectorAll(".nlf").forEach(function(f){f.addEventListener("submit",function(e){e.preventDefault();var m=f.parentNode.querySelector(".nlm"),em=f.email.value.trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)){m.textContent="That email doesn't look right.";return}m.textContent="Sending…";fetch("/api/subscribe",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:em,name:f.fname?f.fname.value.trim():"",website:f.website.value,source:f.dataset.source||location.pathname})}).then(function(r){return r.json().then(function(j){return[r.ok,j]})}).then(function(x){if(x[0]){f.hidden=true;m.textContent=x[1].already?"You're already on the list.":"Almost done: tap the link in the email we just sent."}else m.textContent=x[1].error||"Something went wrong. Try again."}).catch(function(){m.textContent="No connection. Try again."})})})})();</script>
<footer><p class="bestfx">Our best effort to get the dates right. Always check with the organiser before you book.</p>${MATES_ON ? `<p class="matesfoot">Mates: ${matesOrder(MATES_ALL).slice(0, 6).map(x => `<a href="${esc(x.url)}" target="_blank" rel="${mateRel(x)}">${esc(x.name)}</a>`).join(" · ")} · <a href="/about/mates/">All my mates ›</a></p>` : ""}OneTrackMind: plan road trips anywhere, on the roads less travelled, then ride them on your GPS or phone. Free for riders and drivers. · <a href="/how-to/">How to</a> · <a href="/record/">Record a ride</a> · <a href="/list-your-event/">List your event</a> · <a href="/advertise/">Advertise</a> · <a href="/partners/">How we earn</a> · <a href="/terms.html">Terms and disclaimer</a> · <a href="/privacy.html">Privacy</a> · <a href="#" onclick="try{localStorage.removeItem('otm-consent')}catch(e){}location.reload();return false">Cookie choices</a> · <a href="/rules.html">Rules</a> · <a href="mailto:hello@onetrackmind.online">hello@onetrackmind.online</a></footer>
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
<a class="cta" href="/plan/?pick=${esc(r.id)}">Open in the planner</a>
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
  return page({ side: true, active: "/routes/", url: `/routes/${r.id}/`, title: `${r.title} · ${n}-day route · OneTrackMind`, desc, body, ld });
}

function routesIndex() {
  const fdr = live.filter(r => r.founder), oth = live.filter(r => !r.founder);
  const card = r => { const n = r.trip.days.length, km = r.stats && r.stats.km, gp = r.stats && r.stats.gravelPct;
    return `<a class="fx" href="/routes/${r.id}/"><span class="fxd"><b>${n}</b><i>day${n > 1 ? "s" : ""}</i></span><span class="fxb"><b>${esc(r.title)}</b><span class="fxs">${esc(r.region)}</span><span class="fxs">${[km && `${km.toLocaleString("en-ZA")} km`, gp != null && (gp ? `${gp}% gravel` : "all tar"), r.founder && r.founder.year && `ridden ${r.founder.year}`].filter(Boolean).join(" · ")}</span></span></a>`; };
  const body = `<main><h1>Routes</h1><p>Multi-day rides and drives on real roads, each ready to open in the planner and change to suit you.</p>
<section class="prog"><h2>Ridden by the founder</h2><div class="fix">${fdr.map(card).join("")}</div></section>
<section class="prog"><h2>OneTrackMind picks</h2><div class="fix">${oth.map(card).join("")}</div></section>
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
  return TRIP.html({ place: x.name, town: x.name, country: favCountry(x), lat: x.lat, lon: x.lon, air: x.air, tours: x.tours }, x.name);
}
function favPage(x) {
  const r = x.trip && pickById(x.trip), ve = venueEvents(x), vp = ve.find(e => e.photo);
  const body = `<main>
<p class="note"><a href="/favourites/">POI</a> · ${esc(GROUPS.find(g => g[0] === x.group)[1])}</p>
${ve.length ? `${evPic(x.photo || (vp ? vp.photo : evPhoto(ve[0])), x.photo || vp ? x.name : "")}<p class="venuev">${HOUSE.icon("event", 16)}Next here: ${ve.slice(0, 3).map(e => `<a href="/events/${esc(e.id)}/">${esc(e.name)}</a>, ${dRange(e)}`).join(" · ")}</p>` : ""}
<h1>${esc(x.name)}</h1>
<div class="meta">${esc(x.area)}${x.year ? ` · first went ${x.year}` : ""}</div>
<p class="intro">${esc(x.short)}</p>
${x.text.map(t => `<p>${esc(t)}</p>`).join("\n")}
${HOWTO.some(g => g.fav === x.id) ? `<p class="howlink"><a href="/how-to/${HOWTO.find(g => g.fav === x.id).id}/">How to do it: cost, dates, booking ›</a></p>` : ""}
<a class="cta" href="/plan/?fav=${esc(x.id)}&go=1">${HOUSE.icon("go", 18)}Take me there</a>
<p class="note">Opens the planner with ${esc(x.name)} as your finish and routes you there from where you are: fuel, night stops, weather and every POI on the way.</p>
${getThere(x)}
${x.tips.length ? `<h2>Good to know</h2><ul>${x.tips.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
${r ? `<h2>The trip it's from</h2><div class="cards"><a class="card" href="/routes/${r.id}/"><b>${esc(r.title)}</b><span>${esc(r.region)} · ${r.trip.days.length} day${r.trip.days.length > 1 ? "s" : ""}. Open it, change it, ride it.</span></a></div>` : ""}
<p class="note">Places change. Check opening times and conditions before you go.</p>
</main>`;
  const ld = [{ "@context": "https://schema.org", "@type": "TouristAttraction", name: x.name, description: x.short, url: `${SITE}/favourites/${x.id}/`, geo: { "@type": "GeoCoordinates", latitude: x.lat, longitude: x.lon }, address: x.area },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "POI", item: SITE + "/favourites/" }, { "@type": "ListItem", position: 2, name: x.name, item: `${SITE}/favourites/${x.id}/` }] }];
  return page({ side: true, active: "/favourites/", url: `/favourites/${x.id}/`, title: `${x.name}, ${x.area.split(",").pop().trim()}: how to get there and plan a trip · OneTrackMind`, desc: `${x.short} How to get there, where to stay, and a road trip planned around it.`, body, ld });
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
  const sec = (id, title, note, html) => `<section class="fsec" id="${id}"><h2>${title}</h2>${note ? `<p class="note">${note}</p>` : ""}${cardGrid(`${html}`)}</section>`;
  const body = `<main><h1>POI: points of interest</h1>
<p class="intro">The places I'd send you to, and the trips and races behind them. Twenty-odd years of riding and driving through Southern Africa and Europe. Every place has how to get there, where to sleep, and a button that plans the trip for you.</p>
<p class="howlink">New: <a href="/how-to/nurburgring/">how to drive a lap of the Nürburgring</a> · <a href="/how-to/">all How-to guides ›</a></p>
<nav class="chips" aria-label="Show">${CH.map(([k, t], i) => `<button type="button" data-f="${k}"${i ? "" : ' class="on"'}>${t}</button>`).join("")}</nav>
${GROUPS.map(([g, t]) => { const L = FAV.filter(x => x.group === g); return L.length ? sec(g, g === "petrol" ? "Motorsport: tracks, museums, factories" : t, "", L.map(card).join("")) : ""; }).join("\n")}
${sec("btrips", "The trips", "Day by day, as they happened.", multi.map(tripCard).join(""))}
${sec("bposts", "More stories", "", single.map(postCard).join(""))}
<p class="note"><a href="/blog/">Every blog post</a> · <a href="/routes/">All routes</a></p>
<a class="cta" href="/">Plan your own</a></main>
<script>(function(){var t=new Date();t.setHours(12,0,0,0);document.querySelectorAll(".evc[data-start]").forEach(function(c){var d=Math.round((new Date(c.dataset.start+"T12:00:00")-t)/864e5);c.classList.add(d<=7?"t1":d<=45?"t2":"t3");});})();</script>
<script>(function(){var b=document.querySelectorAll(".chips button");b.forEach(function(x){x.onclick=function(){var f=x.dataset.f;b.forEach(function(y){y.classList.toggle("on",y===x)});document.querySelectorAll(".pcard").forEach(function(c){c.hidden=f!=="all"&&c.dataset.cat!==f});document.querySelectorAll(".fsec").forEach(function(s){s.hidden=!s.querySelector(".pcard:not([hidden])")});try{history.replaceState(null,"",f==="all"?location.pathname:"#"+f)}catch(e){}}});var h=location.hash.slice(1);var t=[].find.call(b,function(x){return x.dataset.f===h});if(t)t.click();else if(!h&&document.documentElement.getAttribute('data-mode')==='motorsport'){var mm=[].find.call(b,function(x){return x.dataset.f==='motor'});if(mm)mm.click()}})();</script>`;
  const ld = { "@context": "https://schema.org", "@type": "CollectionPage", name: "POI: points of interest", url: SITE + "/favourites/", hasPart: FAV.map(x => ({ "@type": "TouristAttraction", name: x.name, url: `${SITE}/favourites/${x.id}/` })) };
  return page({ active: "/favourites/", url: "/favourites/", title: "POI: places worth the trip, road trips and motorsport · OneTrackMind", desc: "The places the founder of OneTrackMind would send you in Namibia, South Africa, Lesotho and Europe, the road trips behind them, and the race tracks, museums and factories worth travelling for.", body, ld });
}
const redirectPage = to => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Moved</title><link rel="canonical" href="${SITE}${to}"><meta http-equiv="refresh" content="0;url=${to}"><meta name="robots" content="noindex"></head><body><a href="${to}">Founder's fav's</a></body></html>`;

/* stories: the old onetrackmind.co.za blog, grouped into trips and series; images still served from the old site until they move */
const seriesOf = () => { const m = new Map(); STORIES.forEach(x => { if (!m.has(x.series)) m.set(x.series, []); m.get(x.series).push(x); }); m.forEach(L => L.sort((a, b) => a.date.localeCompare(b.date))); return m; };
const fmtDate = d => HOUSE.range(d);
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
<polyline points="${line}" fill="none" stroke="#1E8EB4" stroke-width="${big ? 4 : 3}" stroke-linejoin="round" stroke-linecap="round"/>
${nights.map((p, i) => { const [x, y] = xy(p); return `<circle cx="${x}" cy="${y}" r="${big ? 6 : 4}" fill="#11262B"/>${big ? lab(p, p.name.replace(/,.*$/, "")) : ""}`; }).join("")}
${(() => { const [x, y] = xy(t.start); return `<circle cx="${x}" cy="${y}" r="${big ? 8 : 5}" fill="#E8A317" stroke="#11262B" stroke-width="2"/>${lab(t.start, t.start.name)}`; })()}</svg>`;
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
L.polyline(d.line,{color:"#fff",weight:8,opacity:.9}).addTo(m);var pl=L.polyline(d.line,{color:"#1E8EB4",weight:4.5}).addTo(m);
d.nights.forEach(function(p){L.circleMarker([p[0],p[1]],{radius:6,color:"#fff",weight:2,fillColor:"#11262B",fillOpacity:1}).bindTooltip(p[2],{permanent:true,direction:"right",className:"tmlab"}).addTo(m);});
L.circleMarker([d.start[0],d.start[1]],{radius:8,color:"#11262B",weight:2,fillColor:"#E8A317",fillOpacity:1}).bindTooltip(d.start[2],{permanent:true,direction:"right",className:"tmlab"}).addTo(m);
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
${r ? `<p class="intro">${esc(r.blurb)}</p><a class="cta" href="/plan/?pick=${esc(r.id)}">Open this trip in the planner</a> <a class="cta ghost" href="/routes/${esc(r.id)}/">Day by day</a>` : ""}
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
${(g => g ? `<a class="cta gocta" href="${esc(g.href)}">${esc(g.label)}</a>` : "")(goLink(x.series))}
${x.cover && !x.html.includes(x.cover) ? `<img class="cover" src="${esc(x.cover)}" alt="${esc(x.title)}" loading="eager">` : ""}
${x.gallery ? `<p class="tocome">Photos first, story to come.</p>` : ""}
${x.html}
${L.length > 1 ? `<nav class="snav">${prev ? `<a href="/blog/${esc(prev.slug)}/">‹ ${esc(prev.title)}</a>` : "<span></span>"}${next ? `<a href="/blog/${esc(next.slug)}/">${esc(next.title)} ›</a>` : ""}</nav>` : ""}
${(g => g ? `<a class="cta" href="${esc(g.href)}">${esc(g.label)}</a>` : `<a class="cta" href="/">Plan a trip like this</a>`)(goLink(x.series))}
<p class="note">First published on onetrackmind.co.za. Places change: check before you go.</p>
</main>`;
  const ld = { "@context": "https://schema.org", "@type": "BlogPosting", headline: x.title, datePublished: x.date, author: FOUNDER, publisher: ORG, url: `${SITE}/blog/${x.slug}/`, ...(x.cover ? { image: x.cover } : {}) };
  return page({ dark: true, active: "/blog/", url: `/blog/${x.slug}/`, title: `${x.title} · OneTrackMind blog`, desc: (x.lead || x.title).slice(0, 155), body, ld });
}
const TAGS = [["namibia", "Namibia", /namibia|tortoise|epupa/i], ["southafrica", "South Africa", /wild coast|cdba|killarney|simola|kalahari|speedweek|franschoek|wijnland|port elizabeth|redbull cape town|cape town/i], ["lesotho", "Lesotho", /lesotho/i], ["europe", "Europe", /eu road trip|motor valley|eicma|goodwood|nurburg|porsche museum/i], ["racing", "Racing", /simola|hill ?climb|killarney|wpmc|motogp|speedweek|race|redbull/i], ["museums", "Museums & factories", /museum|factory|motor valley|eicma|webb/i], ["bikes", "Bikes", /ktm|duke|gsxr|africa twin|bmw|scalpel|cafe racer|enduro|ducati|tyrenoise/i], ["usa", "USA", /monterey|laguna seca|pebble beach|daytona|sebring|indianapolis|\busa\b/i], ["cars", "Cars", /alfa|giulia|porsche|aston|mclaren|audi|fuorilegge|universal products/i]];
const BLOG_POI = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, "data/blog-poi.json"), "utf8")); } catch (e) { return {}; } })();
// the one button a post gets: the trip's route when there is one, otherwise "Take me there" to the place it's about
const goLink = name => { const rid = TRIP_ROUTE[name], p = BLOG_POI[name];
  return rid ? { href: `/plan/?pick=${rid}`, label: "Show the route ›" } : p ? { href: `/plan/?poi=${p.lat},${p.lon}&n=${encodeURIComponent(p.name)}`, label: `Route me to ${p.name} ›` } : null; };
const SOCIAL = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, "data/social.json"), "utf8")); } catch (e) { return []; } })();
const KIND = { story: "Story", route: "Route", place: "Place" };

// blog card: the photo, then the year, title, the post's own opening lines (word for word) and Read it
const plainOf = h => String(h || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#8217;|&rsquo;/g, "’").replace(/&#8216;|&lsquo;/g, "‘").replace(/&#8220;|&ldquo;/g, "“").replace(/&#8221;|&rdquo;/g, "”").replace(/&#8211;|&ndash;/g, "–").replace(/&#8230;|&hellip;/g, "…").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
const opening = (t, n = 170) => { t = plainOf(t); if (t.length < 25) return ""; if (t.length <= n) return t; const c = t.slice(0, n); return c.slice(0, c.lastIndexOf(" ")).replace(/[,;:–-]$/, "") + "…"; };
const toCard = (html, ex, read = "Read it ›", ext = false) => html.replace(/<span class="cmeta"><b>([\s\S]*?)<\/b><span>([\s\S]*?)<\/span><\/span><\/a>/, (m, t, meta) => {
  const href = (html.match(/<a class="cimg" href="([^"]+)"/) || [])[1] || "#", tgt = ext ? ' target="_blank" rel="noopener"' : "";
  return `</a><div class="cbody"><span class="cy">${meta}</span><a class="ct" href="${href}"${tgt}>${t}</a>${ex ? `<p>${esc(ex)}</p>` : ""}<a class="cr" href="${href}"${tgt}>${read}</a></div>`; });
function storiesIndex(M) {
  const ADV = /namibia|lesotho|wild coast|cdba|enduro|africa twin|790 adventure|eu road trip|tortoise|introduction|cycle tour/i;
  const MOT = /eu road trip|motor valley|eicma|motogp|monterey|laguna seca|pebble beach/i;
  const groups = [...M.entries()].sort((a, b) => b[1][b[1].length - 1].date.localeCompare(a[1][a[1].length - 1].date)).filter(([, L]) => coverOf(L));
  const tile = ([name, L]) => {
    const multi = L.length > 1, href = multi ? `/blog/${tripSlug(name, L)}/` : `/blog/${esc(L[0].slug)}/`;
    const cats = [ADV.test(name) ? "adventure" : "", (MOTOR_RX.test(name) || MOT.test(name)) ? "motorsport" : ""].filter(Boolean).join(" ");
    const rid = TRIP_ROUTE[name], title = multi ? tripName(name) : L[0].title;
    const yr = L[L.length - 1].date.slice(0, 4);
    const tags = TAGS.filter(([, , rx]) => rx.test(name + " " + title)).map(([k]) => k).join(" ");
    const g = goLink(name), kind = TRIP_ROUTE[name] ? "route" : g ? "place" : "story";
    const ex = opening(L[0].lead || L[0].html) || (L[0].gallery || /<img/i.test(L[0].html || "") ? "Photos from the trip." : "");
    return toCard(`<div class="ctile" data-cat="${cats}" data-tags="${tags}" data-kind="${kind}"><a class="cimg" href="${href}"><img src="${esc(coverOf(L))}" alt="" loading="lazy"><span class="badges"><em class="kind k-${kind}">${KIND[kind]}</em></span><span class="cmeta"><b>${esc(title)}</b><span>${yr}${multi ? ` · ${L.length} days of posts` : ""}</span></span></a>${(g => g ? `<a class="plot" href="${esc(g.href)}" title="${esc(g.label.replace(" ›", ""))}">${TRIP_ROUTE[name] ? "Show the route ›" : "Take me there ›"}</a>` : "")(goLink(name))}</div>`, ex);
  };
  const body = `<main class="blog"><p class="blogril"><img src="/img/racing-is-life.png" alt="Racing is life. Everything else is preparation." width="540" height="319"></p><h1>Blog</h1>
${prepCard()}
${lastCard()}
${top5Strip()}
<section class="hub"><div class="hubh"><h2>Autodidact</h2></div><div class="lilpanel"><img src="/img/founder/autodidact-homebuilt.webp" alt="" loading="lazy"><div><b>Building it myself</b><p>${esc((FD.autodidact || {}).intro || "The cars and bikes I build in the shed, and the road trips in them. Nobody taught me. That's the point.")}</p><div class="btnrow"><a class="btn" href="/blog/autodidact/">Autodidact ›</a><a class="btnline" href="/blog/my-racing/">My racing ›</a></div></div></div></section>
<section class="prog" id="roads"><h2>Roads I've ridden</h2><div class="fix rot" data-n="4">${live.filter(r => r.founder).map(routeRow).join("")}</div><a class="btnline" href="/routes/">All the routes ›</a></section>
<section class="hub" id="how-to"><div class="hubh"><h2>How to</h2></div><div class="rot" data-n="2">${HOWTO.map(g => `<div class="lilpanel">${g.cover ? `<img src="${esc(g.cover)}" alt="" loading="lazy">` : ""}<div><b>${esc(g.title)}</b><p>${esc(g.short || "")}</p><div class="btnrow"><a class="btn" href="/how-to/${g.id}/">Read the guide ›</a></div></div></div>`).join("")}</div><div class="btnrow"><a class="btnline" href="/how-to/">All the guides ›</a></div></section>
<section class="hub" id="archive"><div class="hubh"><h2>From the archive</h2></div><div class="collage" id="archpick"></div></section>
<details class="archall"><summary>Every story, 2004 to now ›</summary>
<p class="intro">Twenty-odd years of road trips, race weekends, factories and museums. Mostly on two wheels, mostly not to plan. Tap a picture to read it. A Route opens the whole trip in the planner. A Place routes you there from wherever you are.</p>
<nav class="bpick" aria-label="Show">
<button type="button" class="bbox on" data-f="all"><b>Everything</b></button>
<button type="button" class="bbox tex-gravel" data-f="adventure"><b>Adventure</b><span>Recce. Ride. Report.</span></button>
<button type="button" class="bbox tex-tar" data-f="motorsport"><b>Motorsport</b><span>Race weekends, garages and car culture.</span></button>
</nav>
<nav class="tagchips" aria-label="Tags">${Object.entries({ route: "Routes", place: "Places", story: "Stories" }).map(([k, t]) => `<button type="button" class="kchip" data-kind="${k}">${t}</button>`).join("")}<span class="chipsep"></span>${TAGS.map(([k, t]) => `<button type="button" data-tag="${k}">${t}</button>`).join("")}<a class="aboutlink" href="/about/"><img src="/img/ashley.jpg" alt="">About Ashley ›</a></nav>
<div class="collage">${(() => {
    // Instagram and Facebook posts sit in the collage by date, between the blog posts
    const soc = SOCIAL.filter(x => x.img).map(x => ({ date: x.date.slice(0, 10), html: (() => {
      const txt = x.text || "", cats = [ADV.test(txt) ? "adventure" : "", (MOTOR_RX.test(txt) || MOT.test(txt)) ? "motorsport" : ""].filter(Boolean).join(" ");
      const tags = TAGS.filter(([, , rx]) => rx.test(txt)).map(([k]) => k).join(" "), first = txt.split(/\n/)[0].replace(/#\S+/g, "").trim().slice(0, 90);
      const go = x.lat != null ? `<a class="plot" href="/plan/?poi=${x.lat},${x.lon}&n=${encodeURIComponent(x.place || "")}">Take me there ›</a>` : "";
      const kind = x.lat != null ? "place" : "story"; return toCard(`<div class="ctile soc" data-cat="${cats}" data-tags="${tags}" data-kind="${kind}"><a class="cimg" href="${esc(x.url)}" target="_blank" rel="noopener"><img src="${esc(x.img)}" alt="" loading="lazy"><span class="badges"><em class="kind k-${kind}">${KIND[kind]}</em><em class="srcb">${x.src === "ig" ? "Instagram" : "Facebook"}</em></span><span class="cmeta"><b>${esc(first)}</b><span>${x.date.slice(0, 4)}${x.place ? " · 📍 " + esc(x.place) : ""}</span></span></a>${go}</div>`, opening(x.text, 150), x.src === "ig" ? "See it on Instagram ›" : "See it on Facebook ›", true); })() }));
    const blog = groups.map(g => ({ date: g[1][g[1].length - 1].date, html: tile(g) }));
    const AD = aePick("blog", 6).map(x => `<div class="ctile adtile"><a class="cimg" href="${aeUrl(x, "blog-tile")}" target="_blank" rel="noopener sponsored"><img src="${x.i}&width=480" alt="AlterEgo ${esc(x.b.replace(/\.$/, ""))} ${x.c.split(" ").pop()}" loading="lazy" style="background:#fff;object-fit:contain"><span class="badges"><em class="srcb">AlterEgo · Ad</em></span><span class="cmeta"><b>${esc(x.b)}</b><span>${esc(x.s)} $${x.p}. ${esc(x.c)} ›</span></span></a></div>`);
    const all = [...soc, ...blog].sort((a, b) => b.date.localeCompare(a.date)).map(x => x.html), outT = [];
    all.forEach((h, i) => { outT.push(h); if (i % 12 === 7) outT.push(toCard(AD[Math.floor(i / 12) % AD.length], "", "Shop it ›", true)); });
    return outT.join("");
  })()}</div>
</details>
<p class="note"><a href="/favourites/">The places I'd send you ›</a> · <a href="/blog/autodidact/">Autodidact ›</a> · <a href="/blog/my-racing/">My racing ›</a></p>
<a class="cta" href="/plan/">Plan your own</a></main>
<script>(function(){var day=Math.floor(Date.now()/864e5),rnd=function(i){var x=Math.sin(day*99+i*7)*1e4;return x-Math.floor(x)};
document.querySelectorAll(".rot").forEach(function(r){var k=[].slice.call(r.children),n=+r.dataset.n||3;k.map(function(c,i){return[rnd(i),c]}).sort(function(a,b){return a[0]-b[0]}).forEach(function(p,i){p[1].hidden=i>=n})});
var t=[].slice.call(document.querySelectorAll(".archall .ctile:not(.adtile)")).filter(function(c){return c.dataset.kind==="story"}),a=document.getElementById("archpick");
if(a&&t.length)t.map(function(c,i){return[rnd(i+50),c]}).sort(function(x,y){return x[0]-y[0]}).slice(0,6).forEach(function(p){var c=p[1].cloneNode(true);c.hidden=false;a.appendChild(c)});else if(a)a.closest("section").hidden=true})();</script>${prepCard() ? REMIND_JS : ""}
<script>(function(){var b=document.querySelectorAll(".bbox"),tg=document.querySelectorAll(".tagchips button[data-tag]"),kc=document.querySelectorAll(".tagchips button[data-kind]"),cat="all",tag="",kind="";
function run(){b.forEach(function(y){y.classList.toggle("on",y.dataset.f===cat)});tg.forEach(function(y){y.classList.toggle("on",y.dataset.tag===tag)});kc.forEach(function(y){y.classList.toggle("on",y.dataset.kind===kind)});
document.querySelectorAll(".ctile:not(.adtile)").forEach(function(c){var okc=cat==="all"||(" "+c.dataset.cat+" ").indexOf(" "+cat+" ")>=0,okt=!tag||(" "+c.dataset.tags+" ").indexOf(" "+tag+" ")>=0,okk=!kind||c.dataset.kind===kind;c.hidden=!(okc&&okt&&okk)});
try{history.replaceState(null,"",cat==="all"&&!tag?location.pathname:"#"+[cat!=="all"?cat:"",tag].filter(Boolean).join("+"))}catch(e){}}
b.forEach(function(x){x.onclick=function(){cat=x.dataset.f;run()}});tg.forEach(function(x){x.onclick=function(){tag=tag===x.dataset.tag?"":x.dataset.tag;run()}});kc.forEach(function(x){x.onclick=function(){kind=kind===x.dataset.kind?"":x.dataset.kind;run()}});
var h=location.hash.slice(1).split("+");h.forEach(function(p){if(p==="adventure"||p==="motorsport")cat=p;else if(p)tag=p});
if(!location.hash){try{var p=localStorage.getItem("otm-pick");if(p)cat=p}catch(e){}}run()})();</script>`;
  const ld = { "@context": "https://schema.org", "@type": "Blog", name: "OneTrackMind blog", url: SITE + "/blog/", author: FOUNDER };
  return page({ ads: false, dark: true, active: "/blog/", url: "/blog/", title: "Blog: road trips, race weekends and factories · OneTrackMind", desc: "Twenty years of road trips and race weekends by the founder of OneTrackMind: Namibia, Lesotho, the Wild Coast, Motor Valley, the Nürburgring and Goodwood. Plot any trip and ride it yourself.", body, ld });
}

function advertisePage() {
  const body = `<main><h1>Sponsor or advertise</h1>
<p class="intro">OneTrackMind is free for riders and drivers. Sponsors and advertisers pay for it, and in return reach people who are planning a road trip right now: where to sleep, what to ride, what to hire and where to stop.</p>
<h2>Who uses it</h2>
<p>Motorbike, 4x4 and car travellers planning multi-day trips, at home and abroad, with a strong following for Southern Africa: Namibia, the Cape and the Karoo, mostly off the tar.</p>
<h2>Ways to be seen</h2>
<div class="cards">
<div class="card"><b>Site sponsor</b><span>OneTrackMind is powered by AlterEgo. Your name on the planner, every route page, the trip PDF and the group ride pack.</span></div>
<div class="card"><b>Route or story sponsor</b><span>"This trip brought to you by…" on one route or one of the founder's rides that fits your business.</span></div>
<div class="card"><b>Stop on the map</b><span>Lodges, farm stalls, restaurants and workshops: be the place riders plan to stop at, with a link to book.</span></div>
<div class="card"><b>The weekly email</b><span>One spot in The OneTrackMind Week, sent every Monday to riders who asked for it.</span></div>
<div class="card"><b>On the racecars</b><span>Your logo on the OneTrackMind racecars at hill climbs and track days, in every photo and post from the event.</span></div>
<div class="card"><b>Wild Goose Chase</b><span>Prizes and waypoints in the OneTrackMind riding challenge (coming).</span></div>
</div>
<h2>Talk to us</h2>
<p>Email <a href="mailto:hello@onetrackmind.online?subject=Advertising%20on%20OneTrackMind">hello@onetrackmind.online</a> with what you sell and who you'd like to reach. We only take brands riders would thank us for.</p>
</main>`;
  return page({ active: "/advertise/", url: "/advertise/", title: "Sponsor or advertise · OneTrackMind", desc: "Reach motorbike, 4x4 and car travellers while they plan their road trip. Site, route and story sponsorships, stops on the map, the monthly email and the OneTrackMind racecars.", body });
}

function partnersPage() {
  const P = [
    ["Beds", "Booking.com, Agoda, Expedia, Hotels.com and Trip.com", "Through Stay22, which shows them side by side on one map so you can pick."],
    ["Flights", "Airlines and the big booking sites", "Through Aviasales, which compares them. Every result says who you'd be paying, so you can book with a name you know."],
    ["Car hire", "Discover Cars", "Compares Avis, Hertz, Europcar and the rest at the airport you land at."],
    ["Tours and tickets", "GetYourGuide, and the event's own ticket office", "Event tickets always link to the organiser. Tickets are sold by the organiser. OneTrackMind earns nothing from them."],
    ["eSIMs", "Airalo", "Data for your phone that works when you land."],
  ];
  const body = `<main>
<h1>Who we work with, and how we earn</h1>
<p class="intro">OneTrackMind is free. Booking links and sponsors pay for it, and I'd rather tell you exactly how than have you wonder.</p>
<p class="bestfx">Our best effort to get the dates right. Always check with the organiser before you book.</p>
<h2>How it works</h2>
<ol><li><b>You search here.</b> Beds, flights, cars and tours are filled in for the place and dates you're looking at.</li>
<li><b>You book and pay with them, not us.</b> The booking happens on the company's own site. We never see your card or your booking.</li>
<li><b>We get a small fee.</b> If you book, the company pays OneTrackMind a few percent. Your price is the same either way.</li></ol>
<h2>Who we work with</h2>
<p>We're picky. Only names we'd hand our own money to. If one lets you or us down, it goes.</p>
<ul>${P.map(([k, w, n]) => `<li><b>${esc(k)}:</b> ${esc(w)}. ${esc(n)}</li>`).join("")}</ul>
<p>The fees come through two networks, Travelpayouts and Stay22, which pay us for bookings made through these links. Sponsors are listed on the <a href="/advertise/">Advertise</a> page, and every ad is marked "Ad".</p>
<h2>Disclaimer</h2>
<p>OneTrackMind is not a travel agent. Bookings, payments, changes, cancellations and refunds are between you and the company you book with, on their terms. Prices, dates and availability come from them and can change. Event dates come from the organisers: always check the official site before you book. See the <a href="/terms.html">terms</a> and <a href="/privacy.html">privacy</a> pages for the rest.</p>
<p>Something not right, or a company you think we should drop? <a href="mailto:hello@onetrackmind.online">hello@onetrackmind.online</a></p>
</main>`;
  return page({ active: "", url: "/partners/", title: "Who we work with, and how we earn · OneTrackMind", desc: "OneTrackMind is free. How the booking links work, which companies we work with, and what we earn.", body });
}
function aboutPage() {
  const fav = ["namibia-2020-orange-river", "eu-road-trip-2018", "namibia-2017-epupa", "wild-coast-2019"].map(id => live.find(r => r.id === id)).filter(Boolean);
  const panel = (h, img, alt, html, links = "") => `<section class="hub"><div class="hubh"><h2>${h}</h2></div><div class="lilpanel"><img src="${img}" alt="${esc(alt)}" loading="lazy"><div>${html}${links ? `<div class="btnrow">${links}</div>` : ""}</div></div></section>`;
  const body = `<main class="hubpage about">
<div class="hubhero tex-tar"><span class="pk">About</span><h1>Racing is life. Everything else is preparation.</h1><p>The events worth being at, the roads to get there, and a free planner that does the boring bits. Preparation information. High octane content.</p><div class="btnrow"><a class="btn" href="/high-octane/">What's on ›</a><a class="btnline" href="/about/why-preparation/">Why preparation ›</a></div></div>
${panel("Who's behind it", "/img/ashley.jpg", "Ashley in his garage, leaning on a white Alfa Romeo", `<p>I'm Ashley. I spent 25 years selling speed: Ducati Cape Town first, then KTM Cape Town. For most of those years I was the guy organising the trips, packing too little and trusting my mates to carry the tools.</p>`)}
${panel("How it started", "/media/founder/990-adventure-tortoise.jpg", "", `<p>I've been adventuring Namibia since 2003. The Fish River Canyon, Epupa Falls, the Skeleton Coast, and the Orange River road between Rosh Pinah and Noordoewer, which is still my favourite piece of riding anywhere.</p><p>I've done Europe on a 790 Duke, the Nürburgring on a public Sunday, and a Wild Coast that tried to take me out with goats, taxis and potholes in equal measure. We ran adventure bootcamps because we'd learnt, the hard way, how quickly a small problem in the desert turns into a big one.</p>`, `<a class="btnline" href="/routes/">Roads I've ridden ›</a><a class="btnline" href="/blog/">The stories ›</a>`)}
${panel("The farm, the Alfas and Simola", "/img/founder/my-racing.webp", "", `<p>In 2021 I sold the business. These days I live on a farm in the Swartland, build and race old Alfa Romeos at the Simola Hill Climb (class champion in 2023), and write about the wins and the <s>s</s>cars.</p><p>It all started with a Stepnose I commissioned. Then I built a Bedford CF 4x4 myself, then the widebody.</p>`, `<a class="btnline" href="/blog/my-racing/">My racing ›</a><a class="btnline" href="/blog/autodidact/">Autodidact ›</a>`)}
${panel("Riding and the mind", "/media/founder/990-adventure-gravel-view.jpg", "", `<p>After too many years of unregulated stress management, something had to give. I'm an overthinker, and I learnt I'd been looking after my bikes better than I looked after myself.</p><p>Getting back on a motorcycle showed me how much riding does for my head: a long road, a full tank and the noise in your head goes quiet. I'm not shy about saying it, because plenty of riders feel the same and don't. Look after the machine. Look after the rider too.</p>`)}
<p class="juxend"><span>Four wheels move the body, two wheels move the soul,</span><span>road trips clear the mind.</span></p>
${panel("Why OneTrackMind", "/img/founder/why-preparation.webp", "", `<p>Every trip I've done started with a paper map, a mate who knew the way and a lot of guessing about fuel and where to sleep. OneTrackMind is what I wish I'd had: what's on and when, the real roads graded for your vehicle, fuel gaps, night stops, sunset and the things that bite you in the middle of nowhere.</p>`, `<a class="btn" href="/plan/">Plan a trip ›</a><a class="btnline" href="/about/why-preparation/">Why preparation ›</a>`)}
${fav.length ? `<section class="hub"><div class="hubh"><h2>Some of my trips</h2></div>${cardGrid(fav.map(r => `<a class="card pcard hubcard" href="/routes/${r.id}/"><b>${esc(r.title)}</b><span>${r.founder.year} · ${esc(r.founder.ride)}</span><span class="go">See the route ›</span></a>`).join(""))}</section>` : ""}
<section class="hub"><div class="hubh"><h2>How it's paid for</h2></div><div class="lilpanel lilwide"><div><p>It's free for riders and drivers. Sponsors and advertisers pay for it, and booking links pay a small commission when you book a bed or a car through them, at no cost to you. No tickets: those come from the organiser.</p><div class="btnrow"><a class="btnline" href="/partners/">How we earn ›</a><a class="btnline" href="/advertise/">Advertise ›</a></div></div></div></section>
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
${g.cover ? `<figure><img class="cover" src="${esc(g.cover)}" alt="${esc(g.coverAlt || g.title)}">${g.coverAlt ? `<figcaption class="note">${esc(g.coverAlt)}</figcaption>` : ""}</figure>` : st && st.img ? `<img class="cover" src="${esc(st.img)}" alt="${esc(g.title)}">` : ""}
<p class="intro">${esc(g.short)}</p>
${g.hook.map(t => `<p>${esc(t)}</p>`).join("\n")}
${g.sections.map(x => `<h2>${esc(x.h)}</h2><ul>${x.items.map(t => `<li>${t}</li>`).join("")}</ul>`).join("\n")}
<section class="gethere"><h2>Book it</h2><ul>${g.links.map(([t, u, d]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener sponsored">${esc(t)} ›<span>${esc(d)}</span></a></li>`).join("")}<li><a href="${esc(g.official[1])}" target="_blank" rel="noopener">${esc(g.official[0])} ›<span>Check the day before you go</span></a></li></ul>
<p class="note">Some of these links pay OneTrackMind a small fee if you book, at no cost to you. It's what keeps the planner free.</p></section>
${f ? `<a class="cta" href="/plan/?fav=${esc(f.id)}&go=1">${HOUSE.icon("go", 18)}Take me there</a> <a class="cta ghost" href="/favourites/${esc(f.id)}/">Read about it</a>` : ""}
${r ? `<p class="note">Or take the trip I did: <a href="/routes/${esc(r.id)}/">${esc(r.title)}</a>.</p>` : ""}
<h2>Where this comes from</h2><ul class="sources">${g.sources.map(([t, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a></li>`).join("")}</ul>
</main>`;
  const ld = { "@context": "https://schema.org", "@type": "HowTo", name: g.title, description: g.short, url: `${SITE}/how-to/${g.id}/`, author: FOUNDER, dateModified: g.checked, step: g.sections.map(x => ({ "@type": "HowToSection", name: x.h, itemListElement: x.items.map(t => ({ "@type": "HowToStep", text: t.replace(/<[^>]+>/g, "") })) })) };
  return page({ side: true, active: "/how-to/", url: `/how-to/${g.id}/`, title: `${g.title}: cost, dates, booking and rules · OneTrackMind`, desc: g.short, body, ld });
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

const GENRES = [["adventure","Adventure"],["f1","F1"],["motogp","MotoGP"],["superbike","Superbikes"],["endurance","Endurance and 24 hours"],["nascar","NASCAR"],["indycar","IndyCar"],["rally","Rally"],["offroad","Dakar and off-road"],["mx","Motocross and Supercross"],["hillclimb","Hill climbs"],["roadrace","Road racing and the TT"],["timeattack","Time attack"],["classics","Classics and festivals"],["shows","Motor shows"],["bikefest","Bike festivals"]], genreName = g => (GENRES.find(x => x[0] === g) || [0, ""])[1];
const EVENTS = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, "data/events/events.json"), "utf8")); } catch (e) { return []; } })();

// the founder's own slots (data/founder.json): hidden until filled. The juxtapositions (data/juxtapositions.json): his words, used word for word.
const FD = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, "data/founder.json"), "utf8")); } catch (e) { return {}; } })();
const JUX = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, "data/juxtapositions.json"), "utf8")); } catch (e) { return { pairs: [], closing: [] }; } })();
const hashN = (s, n) => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return n ? h % n : 0; };
const isoWeek = d => { const t = new Date(d + "T12:00:00Z"), y = new Date(Date.UTC(t.getUTCFullYear(), 0, 4, 12)); t.setUTCDate(t.getUTCDate() + 3 - (t.getUTCDay() + 6) % 7); return 1 + Math.round(((t - y) / 864e5 - 3 + (y.getUTCDay() + 6) % 7) / 7); };
// event pages close with one "event" line, the same one every build (picked by the event's id); Autodidact opens with this week's "cars" line
const eventLine = id => JUX.pairs.length ? JUX.pairs[hashN(id, JUX.pairs.length)][0] : "";
const carsLine = () => JUX.pairs.length ? JUX.pairs[(isoWeek(today) - 1) % JUX.pairs.length][1] : "";
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayFmt = s => { const d = new Date(s + "T12:00:00Z"); return `${DOW[d.getUTCDay()]} ${d.getUTCDate()} ${MON3[d.getUTCMonth()]}`; };
const evById = id => EVENTS.find(e => e.id === id);
// "Remind me": the button; /js/remind.js opens the form (email, which reminders, newsletter tick-box)
const remindBtn = (e, cls = "cta ghost") => e.start > today ? `<button type="button" class="${cls}" data-remind="${esc(e.id)}" data-name="${esc(e.name)}" data-start="${e.start}" data-end="${e.end}"${e.bookingOpens ? ` data-book="${esc(e.bookingOpens)}"` : ""}>${cls.includes("cta") ? HOUSE.icon("bell", 18) : ""}Remind me${cls.includes("cta") ? "" : " ›"}</button>` : "";
const REMIND_JS = `<script src="${REMIND_SRC}" defer></script>`;
const rideThere = e => `<a class="cta ghost" href="/plan/?ev=${esc(e.id)}&go=1&sty=rough" title="Back roads and gravel: the planner's Road less travelled setting">${HOUSE.icon("mountain", 18)}Ride there</a>`;
// the header photo for an event: its own "photo" (in its data/events part file), else the artwork for its kind of event (img/events/fallback-<kind>.svg)
const evPhoto = e => e.photo || `/img/events/fallback-${HOUSE.group(e.genre)}.svg`;
const evPic = (src, alt) => `<figure class="evpic"><img src="${esc(src)}" alt="${esc(alt || "")}" width="1600" height="600" fetchpriority="high"></figure>`;
// a place that is an event's venue (within 6 km): its events, soonest first
const venueEvents = x => EVENTS.filter(e => e.end >= today && hav2(e, x) <= 6).sort((a, b) => a.start.localeCompare(b.start));
const myTakeOf = id => { const t = (FD.myTake || {})[id]; return typeof t === "string" && t.trim() ? t.trim() : ""; };
const WATCH = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, "data/events/watch.json"), "utf8")); } catch (e) { return {}; } })();
const NEWS = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, "data/events/news.json"), "utf8")); } catch (e) { return {}; } })();
const RESULTS = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, "data/events/results.json"), "utf8")); } catch (e) { return {}; } })();
const hav2 = (a, b) => { const R = 6371, dLa = (b.lat - a.lat) * Math.PI / 180, dLo = (b.lon - a.lon) * Math.PI / 180, x = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
const MON3 = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const dRange = e => HOUSE.range(e.start, e.end);
function eventPage(e) {
  const w = WATCH[e.series] || {}, res = RESULTS[e.id];
  const near = FAV.filter(f => hav2(e, f) <= 150).map(f => ({ f, d: hav2(e, f) })).sort((a, b) => a.d - b.d).slice(0, 6);
  const sameTime = EVENTS.filter(x => x.id !== e.id && x.end >= e.start && x.start <= e.end && hav2(e, x) <= 400).slice(0, 5);
  const routes = live.filter(r => r.trip && r.trip.start && hav2(e, r.trip.start) <= 250).slice(0, 3);
  const city = e.city || e.venue || e.name;
  const map = `<div id="evmap" class="tripmap evmapbox" role="img" aria-label="Map: ${esc(e.venue || city)}"></div>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>window.evMap=function(){if(window.evMapDone||typeof L==="undefined")return;window.evMapDone=1;var m=L.map("evmap",{scrollWheelZoom:false}).setView([${e.lat},${e.lon}],11);L.tileLayer("https://tiles.stadiamaps.com/tiles/outdoors/{z}/{x}/{y}{r}.png",{maxZoom:18,attribution:'&copy; Stadia Maps &copy; OpenMapTiles &copy; OpenStreetMap'}).addTo(m);L.circleMarker([${e.lat},${e.lon}],{radius:10,color:"#11262B",weight:3,fillColor:"${HOUSE.colour(e.genre)}",fillOpacity:1}).bindTooltip(${JSON.stringify(e.venue || city).replace(/</g, "\\u003c")},{permanent:true,direction:"right"}).addTo(m);var A=${JSON.stringify((a => a && a.km <= 300 ? a : null)(TRIP.airport(e.lat, e.lon))).replace(/</g, "\\u003c")};if(!A)return;
L.circleMarker([A.lat,A.lon],{radius:8,color:"#11262B",weight:3,fillColor:"#fff",fillOpacity:1}).bindTooltip(A.name+" airport ("+A.iata+")",{permanent:true,direction:"left"}).addTo(m);
m.fitBounds([[${e.lat},${e.lon}],[A.lat,A.lon]],{padding:[50,50],maxZoom:12});
var say=function(t){document.querySelectorAll(".airdrive").forEach(function(x){x.textContent=t;x.hidden=false})};
say("From "+A.name+" airport ("+A.iata+"): about "+A.km+" km as the crow flies.");
function dec(s){var i=0,la=0,lo=0,o=[];while(i<s.length){var b,sh=0,r=0;do{b=s.charCodeAt(i++)-63;r|=(b&31)<<sh;sh+=5}while(b>=32);la+=r&1?~(r>>1):r>>1;sh=0;r=0;do{b=s.charCodeAt(i++)-63;r|=(b&31)<<sh;sh+=5}while(b>=32);lo+=r&1?~(r>>1):r>>1;o.push([la/1e6,lo/1e6])}return o}
fetch("https://api.stadiamaps.com/route/v1",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({locations:[{lat:A.lat,lon:A.lon},{lat:${e.lat},lon:${e.lon}}],costing:"auto",units:"kilometers"})}).then(function(r){return r.json()}).then(function(j){if(!j.trip)return;var t=j.trip.summary,mn=Math.round(t.time/60);
L.polyline(dec(j.trip.legs[0].shape),{color:"#E8A317",weight:5,opacity:.9}).addTo(m);say("From "+A.name+" airport ("+A.iata+") to the venue: "+Math.round(t.length)+" km, about "+(mn<60?mn+" min":Math.floor(mn/60)+" h "+(mn%60?mn%60+" min":""))+" by car. Beds near either end save you the drive.")}).catch(function(){});};</script>
<p class="airdrive note" hidden></p>`;
  const where = [e.venue, e.city, e.country].filter(Boolean).map(esc).join(", ");
  const news = NEWS[e.id] || [], take = myTakeOf(e.id), off = esc(e.url || e.source);
  const about = `${esc(e.name)} runs ${dRange(e)}${e.venue ? ` at ${esc(e.venue)}` : ""}${e.city ? `, ${esc(e.city)}` : ""}${e.country ? `, ${esc(e.country)}` : ""}.${e.series && !e.name.includes(e.series) ? ` Part of the ${esc(e.series)}.` : ""}`;
  const T = [
    ["about", "About", "info", `<p class="evlede">${about}</p>
${e.confirmed ? "" : `<p class="evwarn">The organiser hasn't confirmed these dates yet. Check the <a href="${off}" target="_blank" rel="noopener">official site</a> before you book anything.</p>`}
${news.length ? `<h3>In the news</h3>${news.map(n => `<div class="nw"><b>${esc(n.title)}</b>${n.summary ? `<p>${esc(n.summary)}</p>` : ""}<a href="${esc(n.url)}" target="_blank" rel="noopener">Read more on ${esc(n.source)} ›</a></div>`).join("")}<p class="note">Headlines and summaries are ${esc(news[0].source)}'s own words, updated daily.</p>` : ""}
<p class="note">Dates and details come from the organiser and are checked every week. Always confirm on the <a href="${off}" target="_blank" rel="noopener">official site</a> before you book.</p>`],
    ["get-there", "Get there", "go", `${map}
${TRIP.html({ brief: true, place: e.venue || city, town: (e.city || e.venue || "").split(",")[0], country: e.country, lat: e.lat, lon: e.lon, from: e.confirmed ? addDays(e.start, -1) : "", to: e.confirmed ? addDays(e.end, 1) : "", tickets: e.tickets, unconfirmed: !e.confirmed }, `${e.name.replace(/\s*\(.*?\)/g, "")} · ${(e.city || e.venue || "").split(",")[0]} · ${dRange(e)}`)}
<p class="note">Beds near big events go early. Book first, then plan the road trip around them.</p>`],
    ["watch", "Watch", "eye", `<h3>How to watch</h3>${w.watch && w.watch.length ? `<ul>${w.watch.map(x => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.label)} ›</a></li>`).join("")}</ul>${w.note ? `<p class="note">${esc(w.note)}</p>` : ""}` : `<p>Check the <a href="${off}" target="_blank" rel="noopener">official site</a> for live streams and TV.</p>`}
<h3>Results</h3>${res && res.podium ? `<ol>${res.podium.map(p => `<li>${esc(p)}</li>`).join("")}</ol><p class="note">From <a href="${esc(res.source)}" target="_blank" rel="noopener">the official results</a>.</p>` : res && res.link ? `<p><a href="${esc(res.link)}" target="_blank" rel="noopener">${res.fresh ? "Results are in ›" : "Official results ›"}</a></p>` : `<p>${w.results ? `Results go up <a href="${esc(w.results)}" target="_blank" rel="noopener">here</a> once it has run.` : "Results appear here once it has run."}</p>`}`],
    ["nearby", "Nearby", "poi", near.length || sameTime.length || routes.length ? `${sameTime.length ? `<h3>Also on that week</h3><ul>${sameTime.map(x => `<li><a href="/events/${esc(x.id)}/">${esc(x.name)}</a> · ${dRange(x)} · ${Math.round(hav2(e, x))} km away</li>`).join("")}</ul>` : ""}
${near.length ? `<h3>Places nearby</h3><ul>${near.map(({ f, d }) => `<li><a href="/favourites/${esc(f.id)}/">${esc(f.name)}</a> · ${Math.round(d)} km</li>`).join("")}</ul>` : ""}
${routes.length ? `<h3>Ride or drive it</h3><ul>${routes.map(r => `<li><a href="/routes/${esc(r.id)}/">${esc(r.title)}</a></li>`).join("")}</ul>` : ""}
<p class="note">In the planner, turn on ${HOUSE.icon("flag", 16)} High Octane and tap Near me for every museum, track and car place around the venue.</p>` : `<p>Nothing on our list near here yet. In the planner, turn on ${HOUSE.icon("flag", 16)} High Octane and tap Near me for every museum, track and car place around the venue.</p>`]];
  const body = `<main class="evpage">
<div class="evhdr" data-grp="${HOUSE.group(e.genre)}">
${evPic(evPhoto(e), e.photo ? e.name : "")}
<p class="evcrumb"><a href="/events/">FOMO</a>${e.series ? ` / ${esc(e.series)}` : ""}</p>
<span class="evtag" data-grp="${HOUSE.group(e.genre)}">${esc(HOUSE.GROUPS[HOUSE.group(e.genre)][0])}</span>
<h1>${esc(e.name)}</h1>
<p class="evwhen"><b>${dRange(e)}</b>${e.confirmed ? "" : ' <em class="unc">dates unconfirmed</em>'} <span class="evcount" data-start="${e.start}" data-end="${e.end}"></span></p>
<p class="evwhere">${HOUSE.icon("poi", 16)}${where}</p>
<div class="evcta"><a class="cta evmain" href="/plan/?ev=${esc(e.id)}&go=1">${HOUSE.icon("go", 18)}Take me there</a>${rideThere(e)}${remindBtn(e, "cta ghost evmain")}${e.tickets ? `<a class="cta ghost" href="${esc(e.tickets)}" target="_blank" rel="noopener">${HOUSE.icon("tix", 18)}Tickets</a>` : ""}<a class="cta ghost" href="${off}" target="_blank" rel="noopener">${HOUSE.icon("out", 18)}Official site</a></div>
${take ? `<aside class="mytake"><img src="/img/ashley.jpg" alt="" width="48" height="48"><div><b>My take</b><p>${esc(take)}</p></div></aside>` : ""}
</div>
<div class="evtabs" role="tablist" aria-label="About this event">${T.map(([k, t, ic], i) => `<button type="button" class="evtab" role="tab" id="evt-${k}" aria-controls="evp-${k}" aria-selected="${i === 0}" data-tab="${k}">${HOUSE.icon(ic, 18)}<span>${t}</span></button>`).join("")}</div>
${T.map(([k, , , html], i) => `<section class="evpanel" role="tabpanel" id="evp-${k}" aria-labelledby="evt-${k}"${i ? " hidden" : ""}>${html}</section>`).join("\n")}
${eventLine(e.id) ? `<blockquote class="evclose"><p>${esc(eventLine(e.id))}</p><cite>Ashley</cite></blockquote>` : ""}
</main>
<div class="evbar"><a class="cta" href="/plan/?ev=${esc(e.id)}&go=1">${HOUSE.icon("go", 18)}Take me there</a>${remindBtn(e)}</div>${REMIND_JS}
<script>(function(){var s=document.querySelector(".evcount");if(s){var t=new Date();t.setHours(12,0,0,0);var a=new Date(s.dataset.start+"T12:00:00"),b=new Date(s.dataset.end+"T12:00:00"),d=Math.round((a-t)/864e5);s.textContent=t>b?"finished":t>=a?"on now":d===1?"tomorrow":"in "+d+" days";}
var tabs=document.querySelectorAll(".evtab");function show(k,go){var ok=false;tabs.forEach(function(b){var on=b.dataset.tab===k;if(on)ok=true;b.setAttribute("aria-selected",String(on));document.getElementById(b.getAttribute("aria-controls")).hidden=!on});if(!ok)return;if(k==="get-there"&&window.evMap)window.evMap();if(go)document.querySelector(".evtabs").scrollIntoView({block:"start"})}
tabs.forEach(function(b){b.addEventListener("click",function(){show(b.dataset.tab);try{history.replaceState(null,"","#"+b.dataset.tab)}catch(e){}})});
document.querySelector(".evtabs").addEventListener("keydown",function(e){var L=[].slice.call(tabs),i=L.indexOf(document.activeElement);if(i<0)return;var j=e.key==="ArrowRight"?(i+1)%L.length:e.key==="ArrowLeft"?(i+L.length-1)%L.length:-1;if(j<0)return;e.preventDefault();L[j].focus();L[j].click()});
if(location.hash.length>1)show(location.hash.slice(1),true);})();</script>`;
  const ld = { "@context": "https://schema.org", "@type": /shows/.test(e.genre || "") ? "ExhibitionEvent" : /classics|bikefest/.test(e.genre || "") ? "Festival" : "SportsEvent", name: e.name, startDate: e.start, endDate: e.end, url: `${SITE}/events/${e.id}/`, description: `${e.name}, ${dRange(e)}${e.venue ? " at " + e.venue : ""}. How to watch, tickets, beds near the venue and the road trip there.`, image: [`${SITE}/img/og.png`], eventStatus: "https://schema.org/EventScheduled", eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode", ...(e.series ? { organizer: { "@type": "Organization", name: e.series, url: e.url || e.source } } : {}), location: { "@type": "Place", name: e.venue || city, geo: { "@type": "GeoCoordinates", latitude: e.lat, longitude: e.lon }, address: { "@type": "PostalAddress", addressLocality: e.city, addressCountry: e.country } } };
  return page({ side: true, ads: false, cls: "evbody", active: "/events/", url: `/events/${e.id}/`, title: `${e.name} ${e.start.slice(0, 4)}: dates, how to watch, tickets and road trip · OneTrackMind`, desc: `${e.name}, ${dRange(e)}${e.venue ? " at " + e.venue : ""}. How to watch live, tickets, beds near the venue and the road trip there.`, body, ld });
}
function addDays(s, n) { const d = new Date(s + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function eventsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const L = EVENTS.filter(e => e.end >= today);
  const CAT = [["all", "All"], ...GENRES.filter(([k]) => L.some(e => e.genre === k)), ["za", "In South Africa"]];
  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const rng = e => HOUSE.range(e.start, e.end);
  const card = e => `<div class="fx evc" data-start="${e.start}" data-cat="${esc(e.genre || "")}" data-grp="${HOUSE.group(e.genre)}" data-za="${e.country === "South Africa" ? 1 : 0}" data-series="${esc(e.series || "")}"><span class="fxd"><b>${+e.start.slice(8, 10)}</b><i>${MONTHS[+e.start.slice(5, 7) - 1].slice(0, 3)}</i></span><span class="fxb">${e.genre ? `<span class="eg">${esc(genreName(e.genre))}</span>` : ""}<b><a href="/events/${esc(e.id)}/">${esc(e.name)}</a></b><button type="button" class="follow" data-series="${esc(e.series || "")}" title="Follow ${esc(e.series || "")}">☆ ${esc(e.series || "")}</button><span class="evd">${rng(e)}${e.confirmed ? "" : ' <em class="unc">dates unconfirmed</em>'}</span><span class="area">${esc(e.venue || "")}${e.city ? ", " + esc(e.city) : ""}${e.country ? " · " + esc(e.country) : ""}</span><span class="evl"><a href="${esc(e.url || e.source)}" target="_blank" rel="noopener">Official site ›</a>${e.tickets ? ` <a href="${esc(e.tickets)}" target="_blank" rel="noopener sponsored">Tickets ›</a>` : ""} <a href="/plan/?ev=${esc(e.id)}&go=1">Take me there ›</a> ${remindBtn(e, "lnk")} <a href="/events/${esc(e.id)}/">Read about it ›</a></span></span></div>`;
  const months = [...new Set(L.map(e => e.start.slice(0, 7)))], first27 = months.find(m => m >= "2027-01"), n27 = L.filter(e => e.start >= "2027-01-01").length;
  const sec = ym => { const [y, mo] = ym.split("-"); return `<section class="fsec evm prog" id="m-${ym}"${ym === first27 ? ' data-y27' : ""}>${ym === first27 ? '<span id="y2027"></span>' : ""}<h2>${MONTHS[+mo - 1]} ${y}</h2><div class="fix">${L.filter(e => e.start.slice(0, 7) === ym).map(card).join("")}</div></section>`; };
  const body = `<main><p class="note"><a class="btnline" href="/high-octane/">‹ FOMO</a></p><h1>FOMO</h1>
<p class="intro"><b>Events you'll kick yourself for missing.</b> Every date comes from the organiser's own page and is checked every week. Nobody decides on Friday to go to a Grand Prix on Sunday, so book early.</p>
<p class="btnrow"><a class="btn" href="/plan/?evtrip=1">Build a trip around several events ›</a><a class="btnline" href="/events/wall-planner-2027.pdf" download>Get the Wall Planner (PDF) ›</a><a class="btnline" href="/list-your-event/">List your event ›</a></p>
<nav class="chips" aria-label="Show"><button type="button" data-f="mine" class="mine">★ Following</button>${CAT.map(([k, t], i) => `<button type="button" data-f="${k}"${k === "za" ? ' data-grp="home"' : k !== "all" ? ` data-grp="${HOUSE.group(k)}"` : ""}${i ? "" : ' class="on"'}>${t}</button>`).join("")}</nav>
${n27 ? `<p class="ev27"><b>The 2027 calendar is in.</b> ${n27} dates so far. Nobody decides on Friday to go to a Grand Prix on Sunday: <a href="#y2027">see 2027 and book early ›</a></p>` : ""}
<div class="evalert evalert-page"><b>Never miss lights out.</b><span>Every Monday: who's racing that week, where, and how to watch.</span><form class="nlf" data-source="race-alerts" novalidate><input type="text" name="fname" placeholder="First name" autocomplete="given-name" aria-label="First name" maxlength="40"><input type="email" name="email" placeholder="Your email" autocomplete="email" aria-label="Your email" required><input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px"><button type="submit">Count me in</button></form><span class="nlm" aria-live="polite"></span></div>
<p class="note">Tap ☆ next to any series to follow it. ★ Following then shows just yours, here and on the planner map.</p>
${months.length ? months.map(sec).join("\n") : "<p class=\"note\">Events are being added.</p>"}
<p class="note">Dates change. Always check the organiser's page before you book flights and beds. Tickets are sold by the organiser. OneTrackMind earns nothing from them. Missing an event? <a href="/list-your-event/">List your event</a>.</p></main>
<script>(function(){var b=document.querySelectorAll(".chips button");b.forEach(function(x){x.onclick=function(){var f=x.dataset.f;b.forEach(function(y){y.classList.toggle("on",y===x)});var my=[];try{my=JSON.parse(localStorage.getItem("otm-series")||"[]")}catch(e){}document.querySelectorAll(".evc").forEach(function(c){c.hidden=f==="mine"?my.indexOf(c.dataset.series)<0:(f!=="all"&&(f==="za"?c.dataset.za!=="1":c.dataset.cat!==f))});document.querySelectorAll(".evm").forEach(function(s){s.hidden=!s.querySelector(".evc:not([hidden])")})}});function stars(){var my=[];try{my=JSON.parse(localStorage.getItem("otm-series")||"[]")}catch(e){}document.querySelectorAll(".follow").forEach(function(s){var on=my.indexOf(s.dataset.series)>=0;s.classList.toggle("on",on);s.textContent=(on?"★ ":"☆ ")+s.dataset.series})}stars();document.addEventListener("click",function(e){var s=e.target.closest&&e.target.closest(".follow");if(!s)return;var my=[];try{my=JSON.parse(localStorage.getItem("otm-series")||"[]")}catch(x){}var i=my.indexOf(s.dataset.series);if(i>=0)my.splice(i,1);else my.push(s.dataset.series);try{localStorage.setItem("otm-series",JSON.stringify(my))}catch(x){}stars()});})();</script>${REMIND_JS}`;
  const ld = { "@context": "https://schema.org", "@graph": L.slice(0, 80).map(e => ({ "@type": "SportsEvent", name: e.name, startDate: e.start, endDate: e.end, url: e.url || e.source, location: { "@type": "Place", name: e.venue || e.city, address: { "@type": "PostalAddress", addressLocality: e.city, addressCountry: e.country } } })) };
  return page({ active: "/events/", url: "/events/", title: "Motorsport events and festivals: dates, tickets and road trips · OneTrackMind", desc: "F1, MotoGP, WorldSBK, NASCAR, WEC, the 24 hour races, Dakar and the big festivals: confirmed dates, tickets and a road trip planner for each.", body, ld });
}
function howtoIndex() {
  const body = `<main><h1>How to</h1>
<p class="intro">Things you didn't know you could do, and exactly how to do them. Drive the Nürburgring, take your own car on a track, see the factories where your heroes were built. What it costs, when, how to book, and what nobody tells you.</p>
<div class="cards pcards">${HOWTO.map(g => { const f = FAV.find(x => x.id === g.fav), st = f && favStory(f); return `<a class="card pcard" href="/how-to/${g.id}/">${st && st.img ? `<img src="${esc(st.img)}" alt="" loading="lazy">` : f ? `<img class="maptile" src="${tileOf(f.lat, f.lon, 9)}" alt="" loading="lazy">` : ""}<b>${esc(g.title)}</b><span class="lead">${esc(g.short)}</span></a>`; }).join("")}</div>
<p class="note">More coming: a track day in South Africa, Spa-Francorchamps, Motor Valley in four days, the Isle of Man TT.</p>
<a class="cta" href="/">Plan your own</a></main>`;
  return page({ active: "/how-to/", url: "/how-to/", title: "How to: drive the Nürburgring, do a track day, visit the factories · OneTrackMind", desc: "Practical guides from a petrolhead who's done it: what it costs, when it's open, how to book and what nobody tells you.", body, ld: { "@context": "https://schema.org", "@type": "CollectionPage", name: "How to", url: SITE + "/how-to/" } });
}


/* ---------- the front doors: Home, Adventure, Petrolhead, Local is lekker ---------- */
const ADV_RX = /namibia|lesotho|wild coast|cdba|enduro|africa twin|790 adventure|eu road trip|tortoise|introduction|cycle tour|sani|baviaans|cederberg|karoo|swartberg/i;
const MOT_STORY_RX = /eu road trip|motor valley|eicma|motogp|monterey|laguna seca|pebble beach/i;
const LIL = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, "data/local-is-lekker.json"), "utf8")); } catch (e) { return []; } })();
const cardGrid = html => { const n = (html.match(/class="card pcard/g) || []).length; return `<div class="cards pcards" style="--n:${Math.min(4, Math.max(1, n))}">${html}</div>`; };
const storyCards = (rx, n) => [...seriesOf().entries()].filter(([name]) => rx.test(name)).filter(([, L]) => coverOf(L))
  .sort((a, b) => b[1][b[1].length - 1].date.localeCompare(a[1][a[1].length - 1].date)).slice(0, n)
  .map(([name, L]) => { const multi = L.length > 1, href = multi ? `/blog/${tripSlug(name, L)}/` : `/blog/${esc(L[0].slug)}/`;
    return `<a class="card pcard hubcard" href="${href}"><img src="${esc(coverOf(L))}" alt="" loading="lazy"><b>${esc(multi ? tripName(name) : L[0].title)}</b><span class="area">${L[L.length - 1].date.slice(0, 4)}${multi ? ` · ${L.length} parts` : ""}</span></a>`; }).join("");
const placeCards = (list, n) => list.slice(0, n).map(x => { const st = favStory(x);
  return `<a class="card pcard hubcard" href="/favourites/${x.id}/">${st && st.img ? `<img src="${esc(st.img)}" alt="" loading="lazy">` : `<img class="maptile" src="${tileOf(x.lat, x.lon, 9)}" alt="" loading="lazy">`}<b>${esc(x.name)}</b><span class="area">${esc(x.area)}</span></a>`; }).join("");
const routeRow = r => { const n = r.trip.days.length, km = r.stats && r.stats.km, gp = r.stats && r.stats.gravelPct;
  return `<a class="fx" href="/routes/${r.id}/"><span class="fxd"><b>${n}</b><i>day${n > 1 ? "s" : ""}</i></span><span class="fxb"><b>${esc(r.title)}</b><span class="fxs">${esc(r.region)}</span><span class="fxs">${[km && `${km.toLocaleString("en-ZA")} km`, gp != null && (gp ? `${gp}% gravel` : "all tar"), r.founder && r.founder.year && `ridden ${r.founder.year}`].filter(Boolean).join(" · ")}</span></span></a>`; };
// one or two runs: the latest as one wide panel (photos left, story right), the same shape as "How it started"
const lilWide = x => `<div class="lilpanel lilwide"><div class="lilpics"><img src="${esc(x.photo)}" alt="" loading="lazy">${x.photo2 ? `<img src="${esc(x.photo2)}" alt="" loading="lazy">` : ""}</div><div><span class="lilk">${HOUSE.icon("lil", 16)} Local is lekker</span><b>${esc(x.place)}, ${esc(x.town)}</b><p class="note">${esc(x.vehicle || "")}${x.date ? " · " + fmtDate(x.date) : ""}</p>${x.line ? `<p>${esc(x.line)}</p>` : ""}<div class="btnrow"><a class="btn" href="${x.lat != null ? `/plan/?poi=${x.lat},${x.lon}&n=${encodeURIComponent(x.place)}&go=1` : "/local-is-lekker/"}">${HOUSE.icon("go", 18)}Take me there</a><a class="btnline" href="/local-is-lekker/">Every run ›</a></div></div></div>`;
const lilCard = x => `<a class="card pcard hubcard" href="${x.lat != null ? `/plan/?poi=${x.lat},${x.lon}&n=${encodeURIComponent(x.place)}&go=1` : "/local-is-lekker/"}">${x.photo ? `<img src="${esc(x.photo)}" alt="" loading="lazy">` : ""}<b>${esc(x.place)}, ${esc(x.town)}</b><span class="area">${esc(x.vehicle || "")}${x.date ? " · " + fmtDate(x.date) : ""}</span>${x.line ? `<span>${esc(x.line)}</span>` : ""}<span class="go">${HOUSE.icon("go", 18)}Take me there</span></a>`;
// the FOMO box with "Never miss another event" (newsletter sign-up, double opt-in) where the note sits
const FOMO_NL = `<div class="evregs fomonl"><b>Never miss another event</b><form class="nlf" data-source="fomo-header" novalidate><input type="email" name="email" placeholder="Your email" autocomplete="email" aria-label="Your email" required><input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px"><button type="submit">Sign me up</button></form><span class="nlm" aria-live="polite"></span></div>`;
const FOMO_BOX = `<section class="fomo" id="fomo"><div class="evhead"><div class="evview" id="fomoView"></div><div class="evregs" id="fomoReg"></div></div><div class="sqgrid" id="fomoList"><p class="note">Loading the diary…</p></div></section>`;
const FOMO_BOX_NL = FOMO_BOX.replace('<div class="evregs" id="fomoReg"></div>', FOMO_NL);

// "My pick": the event the founder would go to this month (data/founder.json myPick). Nothing shows until it's filled in and the event is still to come.
// Preparing for: the founder's next event, pinned on the Blog and Home; then the last event's reflection
function prepCard(home) {
  const P = FD.preparing || {}, e = P.event && evById(P.event);
  if (!e || e.end < today) return "";
  const pic = e.photo || evPhoto(e), ups = (P.updates || []).filter(u => u && (u.line || "").trim());
  return `<section class="hub prep"><div class="hubh"><h2>${home ? "In other news" : "Preparing for"}</h2>${home ? `<a class="btnline" href="/blog/">More on the Blog ›</a>` : ""}</div><div class="lilpanel mypick"><img src="${esc(pic)}" alt="" loading="lazy"><div>${home ? `<span class="lilk">${HOUSE.icon("flag", 16)} Preparing for</span>` : ""}<b>${esc(e.name)}</b><p class="note">${dRange(e)} · ${esc([e.venue || e.city, e.country].filter(Boolean).join(", "))} · <span class="prepd" data-d="${e.start}"></span></p>${(P.line || "").trim() ? `<p>${esc(P.line.trim())}</p>` : ""}${(P.side || "").trim() ? `<p class="note">On the side: ${esc(P.side.trim())}</p>` : ""}<div class="btnrow"><a class="btn" href="/plan/?ev=${esc(e.id)}&go=1">${HOUSE.icon("go", 18)}Take me there</a>${remindBtn(e, "btnline")}<a class="btnline" href="/events/${esc(e.id)}/">The event ›</a></div></div></div>${ups.length ? `<ul class="prepup">${ups.slice(0, 5).map(u => `<li>${u.photo ? `<img src="${esc(u.photo)}" alt="" loading="lazy">` : ""}<div><span class="note">${esc(u.date || "")}</span><p>${esc(u.line.trim())}</p></div></li>`).join("")}</ul>` : ""}</section>
<script>document.querySelectorAll(".prepd").forEach(function(x){var n=Math.ceil((new Date(x.dataset.d+"T08:00:00")-new Date())/864e5);x.textContent=n>1?n+" days to go":n===1?"tomorrow":"this week"})</script>`;
}
function lastCard() {
  const L = FD.lastEvent || {};
  if (!(L.reflection || "").trim() || !(L.name || "").trim()) return "";
  return `<section class="hub"><div class="hubh"><h2>Last time out</h2></div><div class="lilpanel"${L.photo ? "" : ' style="grid-template-columns:1fr"'}>${L.photo ? `<img src="${esc(L.photo)}" alt="" loading="lazy">` : ""}<div><b>${esc(L.name)}</b>${L.date ? `<p class="note">${esc(L.date)}</p>` : ""}${L.reflection.trim().split(/\n+/).map(t => `<p>${esc(t)}</p>`).join("")}</div></div>${L.video || (L.more || []).length ? `<div class="lastmore">${L.video ? `<video src="${esc(L.video)}" controls playsinline preload="none"${L.poster ? ` poster="${esc(L.poster)}"` : ""}></video>` : ""}${(L.more || []).map(m => `<img src="${esc(m)}" alt="" loading="lazy">`).join("")}</div>` : ""}</section>`;
}
function top5Strip() {
  if (!TOP5.length) return "";
  return `<section class="hub"><div class="hubh"><h2>My top 5</h2></div>${cardGrid(TOP5.slice(0, 2).map(l => `<a class="card pcard hubcard" href="/high-octane/my-top-5/${l.id}/"><b>${esc(l.title)}</b>${l.intro ? `<span>${esc(l.intro)}</span>` : ""}<span class="go">See the list ›</span></a>`).join(""))}<div class="btnrow"><a class="btnline" href="/high-octane/my-top-5/">All my top 5 lists ›</a></div></section>`;
}
function myPickCard() {
  const p = FD.myPick || {}, e = p.event && evById(p.event);
  if (!e || !(p.line || "").trim() || e.end < today) return "";
  const yt = (p.video || "").match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{11})/);
  const media = yt ? `<div class="pickvid"><iframe src="https://www.youtube-nocookie.com/embed/${yt[1]}" title="${esc(e.name)}" loading="lazy" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe></div>` : p.photo ? `<img src="${esc(p.photo)}" alt="" loading="lazy">` : `<img src="/img/ashley.jpg" alt="" loading="lazy">`;
  return `<section class="hub"><div class="lilpanel mypick">${media}<div><span class="lilk">${HOUSE.icon("star", 16)} My pick</span><b>${esc(e.name)}</b><p class="note">${dRange(e)} · ${esc([e.city || e.venue, e.country].filter(Boolean).join(", "))}</p><p>${esc(p.line.trim())}</p>${p.video && !yt ? `<p><a class="btnline" href="${esc(p.video)}" target="_blank" rel="noopener">Watch the video ›</a></p>` : ""}<div class="btnrow"><a class="btn" href="/plan/?ev=${esc(e.id)}&go=1">${HOUSE.icon("go", 18)}Take me there</a>${remindBtn(e, "btnline")}<a class="btnline" href="/events/${esc(e.id)}/">Read about it ›</a></div></div></div></section>`;
}
function homePage() {
  const lat = (() => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, "data/latest.json"), "utf8")); } catch (e) { return []; } })();
  { const C = STORIES.find(x => x.slug === "kalahari-speedweek-2014"); if (C && C.cover && lat.length < 4) lat.push({ title: "Kalahari SpeedWeek 2014", hook: "A dry pan, grown men trying to go very fast, and I came home wanting a faster car.", url: `/blog/${C.slug}/`, cover: C.cover }); }
  const body = `<main class="home">
<div class="hero4"><h1 class="homeril"><svg class="hostamp" viewBox="0 0 200 200" role="img" aria-label="Warning: explicit high octane content"><defs><filter id="ink"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.1 1.55"/><feComposite in="SourceGraphic" operator="in"/></filter><path id="stTop" d="M34,100 A66,66 0 0 1 166,100"/><path id="stBot" d="M26,100 A74,74 0 0 0 174,100"/></defs><g filter="url(#ink)" fill="none" stroke="currentColor"><circle cx="100" cy="100" r="94" stroke-width="5"/><circle cx="100" cy="100" r="84" stroke-width="1.6"/><g fill="currentColor" stroke="none" font-family="'Saira Condensed',Impact,sans-serif" font-weight="800" text-anchor="middle"><text font-size="16" letter-spacing="2.5"><textPath href="#stTop" startOffset="50%">★ WARNING ★</textPath></text><text font-size="16" letter-spacing="2.5"><textPath href="#stBot" startOffset="50%">EXPLICIT CONTENT</textPath></text><rect x="22" y="80" width="156" height="40" rx="2"/><text x="100" y="111" font-size="33" textLength="136" lengthAdjust="spacingAndGlyphs" fill="var(--bg,#0E1417)">HIGH OCTANE</text></g></g></svg><picture><source srcset="/img/racing-is-life.webp" type="image/webp"><img src="/img/racing-is-life.png" alt="Racing is life. Everything else is preparation." width="1081" height="638" fetchpriority="high"></picture></h1>
<p class="h4line">Preparation is everything. <b>Do it here.</b></p>
<a class="h4me" href="/about/"><img src="/img/ashley.jpg" alt="" width="44" height="44"><span>Ducati taught me the road, KTM taught me to live off it. These are the roads, the races and the places I'd tell a mate about. <b>More about me ›</b></span></a></div>
<section class="hub homefomo"><div class="hubh"><h2>FOMO</h2></div>${FOMO_BOX_NL}<div class="btnrow"><a class="btnline" href="/high-octane/">Everything in FOMO ›</a><a class="btnline" href="/events/">The whole diary ›</a><a class="btnline" href="/events/wall-planner-2027.pdf" download>Get the Wall Planner (PDF) ›</a></div></section>
${prepCard(1)}
${top5Strip()}
<form class="wherebar" action="/plan/" method="get"><span class="wbl">Plan a trip</span><label class="wbf"><i>From</i><input name="from" value="My location" autocomplete="off" onfocus="if(this.value==='My location')this.value=''" onblur="if(!this.value.trim())this.value='My location'"></label><label class="wbf wbto"><i>Where to?</i><input name="to" placeholder="A town, a pass, a race…" required autocomplete="off"></label><input type="hidden" name="fll"><input type="hidden" name="tll"><button class="btn" type="submit">${HOUSE.icon("go", 18)}Take me there</button></form>
<script>(function(){var f=document.querySelector(".wherebar");if(!f)return;
var TW=null;function towns(){return TW||(TW=Promise.all([["za","South Africa"],["na","Namibia"]].map(function(c){return fetch("/data/"+c[0]+"/towns.json").then(function(r){return r.ok?r.json():[]}).catch(function(){return[]}).then(function(a){return a.map(function(x){return[x[0],x[1],x[2],x[3],x[4],c[1]]})})})).then(function(a){return a[0].concat(a[1])}))}
[["from","fll"],["to","tll"]].forEach(function(k){var i=f.elements[k[0]],h=f.elements[k[1]],box=document.createElement("ul"),t=null,ctl=null,L=[];box.className="wbsug";box.hidden=true;i.parentNode.appendChild(box);i.setAttribute("autocomplete","off");
function pick(x){i.value=x.name;h.value=x.lat+","+x.lon;box.hidden=true}
i.addEventListener("input",function(){h.value="";clearTimeout(t);var q=i.value.trim();if(q.length<3){box.hidden=true;return}t=setTimeout(function(){if(ctl)ctl.abort();ctl=new AbortController();
var n=function(x){return x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9 ]/g,"").trim()},w=n(q.split(",")[0]),R={city:0,town:1,village:2,hamlet:3};
Promise.all([towns(),fetch("https://photon.komoot.io/api/?limit=8&lat=-33.9&lon=18.6&location_bias_scale=0.2&osm_tag=!highway&osm_tag=!building&q="+encodeURIComponent(q),{signal:ctl.signal}).then(function(r){return r.json()}).catch(function(){return{}})]).then(function(a){
var T=a[0].filter(function(x){return n(x[2]).indexOf(w)===0}).sort(function(x,y){return(n(x[2])===w?0:1)-(n(y[2])===w?0:1)||(R[x[3]]||4)-(R[y[3]]||4)}).slice(0,4).map(function(x){var sub=[x[4],x[5]].filter(Boolean).join(", ");return{name:x[2]+(sub?", "+sub:""),lat:x[0],lon:x[1],main:x[2],sub:sub||x[3]}});
var P=(a[1].features||[]).map(function(x){var p=x.properties,c=x.geometry.coordinates,sub=[p.city!==p.name?p.city:"",p.state,p.country].filter(Boolean).join(", ");return{name:p.name+(sub?", "+sub:""),lat:+c[1].toFixed(5),lon:+c[0].toFixed(5),main:p.name,sub:sub}}).filter(function(x){return x.main&&!T.some(function(y){return n(y.main)===n(x.main)&&Math.abs(y.lat-x.lat)<.2})});
L=T.concat(P).slice(0,7);
box.innerHTML=L.map(function(x,n){return'<li data-n="'+n+'"><b>'+x.main.replace(/</g,"&lt;")+'</b><span>'+x.sub.replace(/</g,"&lt;")+"</span></li>"}).join("");box.hidden=!L.length}).catch(function(){})},250)});
box.addEventListener("mousedown",function(e){var li=e.target.closest("li");if(li){e.preventDefault();pick(L[+li.dataset.n])}});
i.addEventListener("keydown",function(e){if(e.key==="Enter"&&!box.hidden&&L.length&&!h.value){e.preventDefault();pick(L[0])}if(e.key==="Escape")box.hidden=true});
i.addEventListener("blur",function(){setTimeout(function(){box.hidden=true},150)})});})();</script>
<section class="cd" id="cd" hidden></section>
<div class="camps" id="camps"></div>
${myPickCard()}
<section class="hub planown"><h2>Plan your own</h2><p class="lede">Tell it where you're starting, where you're going and what you drive or ride. It finds the roads you like, the fuel, the beds and everything worth stopping for, then puts it on your GPS or phone. Free, no sign-up needed.</p><a class="btn" href="/plan/">Plan a trip ›</a></section>
</main>
<script src="${HUB_SRC}" defer></script>${myPickCard() || prepCard() ? REMIND_JS : ""}
<script>(function(){var q=location.search;if(/[?&](pick|poi|fav|ev|evtrip|s|mode|route)=/.test(q))location.replace("/plan/"+q+location.hash);})();</script>`;
  return page({ active: "/", url: "/", title: "OneTrackMind: Racing is life. Everything else is preparation.", desc: "Back roads and gravel, races and car culture: routes ridden by the founder, the motorsport diary, places worth the detour, and a free trip planner for bikes, 4x4s and cars.", body });
}

// FOMO, the one section (it was Adventure and High Octane): what's on, what's in season, the roads and the places. /adventure/ now lands here.
function petrolheadPage() {
  const adv = FAV.filter(x => x.group !== "petrol"), petrol = FAV.filter(x => x.group === "petrol");
  const body = `<main class="hubpage">
<div class="hubhero tex-tar hohero"><img class="hostick big" src="/img/high-octane.png" alt="Warning: explicit high octane content" width="210" height="256"><span class="pk">FOMO</span><h1>Plan it. Book it. Be there.</h1><p>Fear of Missing Out is real. Race weekends, shows, rallies and the roads at their best. What's on, what to book early, what's in season, and everything worth seeing on the way.</p><div class="btnrow"><a class="btn" href="/plan/">Plan a trip ›</a><a class="btnline" href="/plan/?evtrip=1">Build a trip around several events ›</a></div></div>
<section class="cd" id="cd" hidden></section>
<div class="camps" id="camps"></div>
<section class="hub"><div class="hubh"><h2>What's on</h2></div>${FOMO_BOX_NL}<div class="btnrow"><a class="btnline" href="/events/">The whole diary ›</a><a class="btnline" href="/high-octane/my-top-5/">My top 5 ›</a><a class="btnline" href="/list-your-event/">List your event ›</a><a class="btnline" href="/events/wall-planner-2027.pdf" download>Get the Wall Planner (PDF) ›</a></div></section>
${myPickCard()}
<section class="hub"><div class="hubh"><h2>My top 5</h2></div>${TOP5.length ? cardGrid(TOP5.slice(0, 3).map(l => `<a class="card pcard hubcard" href="/high-octane/my-top-5/${l.id}/"><b>${esc(l.title)}</b>${l.intro ? `<span>${esc(l.intro)}</span>` : ""}<span class="go">See the list ›</span></a>`).join("")) : `<p class="note">The events, roads and places I'd go to, and why. One new list a month.</p>`}<div class="btnrow"><a class="btnline" href="/high-octane/my-top-5/">All my top 5 lists ›</a></div></section>
<section class="hub"><div class="hubh"><h2>Petrolhead places</h2></div>${cardGrid(`${placeCards(petrol, 4)}`)}<div class="btnrow"><a class="btnline" href="/favourites/#petrol">All the petrolhead places ›</a></div></section>
<section class="hub"><div class="hubh"><h2>Places worth the detour</h2></div>${cardGrid(`${placeCards(adv, 4)}`)}<div class="btnrow"><a class="btnline" href="/favourites/">All my places ›</a></div></section>
</main>
<script src="${HUB_SRC}" defer></script>${myPickCard() ? REMIND_JS : ""}`;
  return page({ active: "/high-octane/", url: "/high-octane/", title: "FOMO: events, roads in season and places worth the trip · OneTrackMind", desc: "What's on in motorsport and car culture, what to book early, which roads are in season, and the museums, tracks and places worth the trip. With a planner that gets you there.", body });
}

function lilPage() {
  const body = `<main class="hubpage">
<div class="hubhero tex-tar"><span class="pk">A OneTrackMind campaign</span><h1>Local is lekker</h1><p>Saturdays: one of my cars or bikes, somewhere new for breakfast, and the road there. No reviews, no stars. If I'd go back, it's here. Every place has a button that routes you there from wherever you are.</p></div>
${LIL.length ? `${cardGrid(`${LIL.slice().reverse().map(lilCard).join("")}`)}` : `<div class="lilpanel"><img src="/media/founder/porsche-cayman-portimao-pitlane.jpg" alt="" loading="lazy"><div><b>Coming soon</b><p>Every run goes up here: the place, the town, what I drove and a button that routes you there. Until then, follow along on Instagram, or get The OneTrackMind Week below.</p><a class="btnline" href="https://www.instagram.com/ashleybaud/" target="_blank" rel="noopener">Follow along on Instagram ›</a></div></div>`}
</main>`;
  return page({ active: "/local-is-lekker/", url: "/local-is-lekker/", title: "Local is lekker: Saturday breakfast runs · OneTrackMind", desc: "Saturday breakfast runs in the Western Cape: a car or a bike, somewhere new to eat, and the road there.", body });
}

/* ---------- FOMO additions: List your event, In season, Why preparation, My racing, Autodidact, My top 5 ---------- */
const CATS_LYE = [["racing", "Racing"], ["adventure", "Adventure: rally, enduro, organised ride"], ["show", "Show or festival"], ["classic", "Classics"], ["track", "Track day"], ["other", "Something else"]];
function listEventPage() {
  const body = `<main><h1>List your event</h1>
<p class="intro">Organising a race, rally, ride, show or festival? Send it in. We check the dates on your own website, then it goes into FOMO with Take me there and Remind me, so people can plan their trip around it.</p>
<p class="note">Free. We never sell tickets: the Tickets button goes straight to your ticket page.</p>
<form class="lyf" id="lyf" novalidate>
<label class="full">Event name<input name="name" required maxlength="140" autocomplete="off"></label>
<label>First day<input type="date" name="start" required></label>
<label>Last day<input type="date" name="end"></label>
<label>Venue or town<input name="venue" maxlength="140"></label>
<label>Country<input name="country" maxlength="60" value="South Africa"></label>
<label class="full">Organiser website (where the dates are)<input name="site" type="url" required maxlength="300" placeholder="https://"></label>
<label class="full">Ticket page<input name="tickets" type="url" maxlength="300" placeholder="https://"></label>
<label>Your email<input name="email" type="email" required maxlength="200" autocomplete="email"></label>
<label class="full">Photo (optional: JPG, PNG or WebP, up to 5 MB)<input type="file" name="photo" accept="image/jpeg,image/png,image/webp"></label>
<label>Category<select name="category">${CATS_LYE.map(([k, t]) => `<option value="${k}">${esc(t)}</option>`).join("")}</select></label>
<input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px">
<button type="submit" class="btn full">Send it</button>
<p class="note full" id="lyfm" aria-live="polite"></p>
</form>
<p class="bestfx">Our best effort to get the dates right. Always check with the organiser before you book.</p>
</main>
<script>(function(){var f=document.getElementById("lyf"),m=document.getElementById("lyfm");f.addEventListener("submit",function(e){e.preventDefault();var d={};[].forEach.call(f.elements,function(x){if(x.name&&x.type!=="file")d[x.name]=x.value.trim()});var ph=f.photo.files[0];if(ph&&ph.size>5e6){m.textContent="That photo is too big. Up to 5 MB.";return}if(ph&&["image/jpeg","image/png","image/webp"].indexOf(ph.type)<0){m.textContent="The photo must be a JPG, PNG or WebP.";return}
if(!d.name){m.textContent="What's the event called?";return}if(!d.start){m.textContent="When does it start?";return}if(!d.site){m.textContent="Add your website, so we can check the dates.";return}if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$/.test(d.email)){m.textContent="That email doesn't look right.";return}
var b=f.querySelector("button");b.disabled=true;m.textContent="Sending…";var fd=new FormData();Object.keys(d).forEach(function(k){fd.append(k,d[k])});if(ph)fd.append("photo",ph);fetch("/api/list-event",{method:"POST",body:fd}).then(function(r){return r.json().then(function(j){return[r.ok,j]})}).then(function(x){if(x[0]){f.reset();m.textContent="Thanks. We'll check the dates on your site and email you once it's in FOMO.";}else m.textContent=x[1].error||"Something went wrong. Try again.";b.disabled=false}).catch(function(){b.disabled=false;m.textContent="No connection. Try again."})})})();</script>`;
  return page({ active: "/list-your-event/", url: "/list-your-event/", title: "List your event · OneTrackMind", desc: "Organisers: add your race, rally, ride, show or festival to FOMO, the OneTrackMind event calendar. Free; tickets link straight to you.", body });
}
const seasonRow = (r, left) => `<a class="fx" href="/routes/${r.id}/"><span class="fxd"><b>${left == null ? "All" : left}</b><i>${left == null ? "year" : left === 1 ? "day left" : "days left"}</i></span><span class="fxb"><b>${esc(r.title)}</b><span class="fxs">${esc(r.region)}</span><span class="fxs">Best: ${esc(HOUSE.months(r.season.months))}. ${esc(r.season.why || "")}</span></span></a>`;
function inSeasonPage() {
  const S = live.filter(r => r.season), now = S.map(r => ({ r, s: HOUSE.season(r.season, today) })).filter(x => x.s).sort((a, b) => (a.s.left ?? 999) - (b.s.left ?? 999));
  const nextM = r => { const m0 = +today.slice(5, 7); for (let i = 1; i <= 12; i++) if (r.season.months.includes((m0 + i - 1) % 12 + 1)) return i; return 13; };
  const later = S.filter(r => !HOUSE.season(r.season, today)).sort((a, b) => nextM(a) - nextM(b));
  const body = `<main class="hubpage"><p class="note"><a class="btnline" href="/high-octane/">‹ FOMO</a></p><h1>In season</h1>
<p class="intro">Every road has its months: flowers, dry gravel, open passes, no snow. These are in season now, the ones closing soonest first.</p>
<section class="prog seasons"><h2>In season now</h2><div class="fix" id="isnow">${now.length ? now.map(x => seasonRow(x.r, x.s.left)).join("") : `<p class="note">Nothing in season this month.</p>`}</div></section>
<section class="prog seasons"><h2>Later in the year</h2><div class="fix">${later.map(r => `<a class="fx" href="/routes/${r.id}/" data-months="${r.season.months.join(",")}"><span class="fxd"><b>${MON3[(m0 => { for (let i = 1; i <= 12; i++) { const k = (m0 + i - 1) % 12 + 1; if (r.season.months.includes(k)) return k - 1; } return 0; })(+today.slice(5, 7))]}</b><i>from</i></span><span class="fxb"><b>${esc(r.title)}</b><span class="fxs">${esc(r.region)}</span><span class="fxs">Best: ${esc(HOUSE.months(r.season.months))}. ${esc(r.season.why || "")}</span></span></a>`).join("")}</div></section>
<p class="note">Seasons are a guide from climate and road conditions. Check the weather and road reports before you go.</p>
<div class="btnrow"><a class="btn" href="/plan/?mode=adventure">Plan a trip ›</a><a class="btnline" href="/routes/">All the routes ›</a></div>
</main>`;
  return page({ active: "/adventure/in-season/", url: "/adventure/in-season/", title: "In season: routes at their best right now · OneTrackMind", desc: "Gravel roads, passes and flower routes in South Africa, Namibia and Lesotho that are at their best this month, with how long the season has left.", body });
}
// the founder's choice for this page: five of the 31, in this order (the rest still close the event pages and sign off the newsletter)
const WHY_PAIRS = [8, 22, 23, 29, 31];
function whyPage() {
  const body = `<main><p class="note"><a class="btnline" href="/about/">‹ About</a></p>${evPic("/img/founder/why-preparation.webp", "Ashley in the mirror before a run")}<h1>Why preparation</h1>
<p class="intro"><b>${esc(JUX.heading || "")}</b></p>
<ol class="jux">${WHY_PAIRS.map(n => JUX.pairs[n - 1]).filter(Boolean).map(([a, b]) => `<li><span>${esc(a)}</span><span>${esc(b)}</span></li>`).join("")}</ol>
<p class="juxend">${(JUX.closing || []).map(x => `<span>${esc(x)}</span>`).join("")}</p>
<p class="juxsig">${esc(JUX.signed || "")}</p>
<div class="btnrow"><a class="btn" href="/events/">FOMO: the events ›</a><a class="btnline" href="/blog/autodidact/">Autodidact: the cars ›</a></div>
</main>`;
  return page({ ads: false, active: "/about/why-preparation/", url: "/about/why-preparation/", title: "Why preparation: the event and the cars · OneTrackMind", desc: "Ten years of racing taught me this: the event has a date, the cars have timelines. Racing is life. Everything else is preparation.", body, ld: { "@context": "https://schema.org", "@type": "AboutPage", url: SITE + "/about/why-preparation/", author: FOUNDER } });
}
// the founder's own events: his hill climbs, time attack and rally, from the event list (adventure rallies are other people's)
const MY_RACING_RX = /Simola|Hill ?climb|Time Attack|Rally/i;
const myRacing = () => EVENTS.filter(e => e.end >= today && e.country === "South Africa" && e.genre !== "adventure" && MY_RACING_RX.test(e.name + " " + (e.series || "")));
const evRowCard = e => `<div class="fx evc" data-grp="${HOUSE.group(e.genre)}"><span class="fxd"><b>${+e.start.slice(8, 10)}</b><i>${MON3[+e.start.slice(5, 7) - 1]}</i></span><span class="fxb"><b><a href="/events/${esc(e.id)}/">${esc(e.name)}</a></b><span class="evd">${dRange(e)}${e.confirmed ? "" : ' <em class="unc">dates unconfirmed</em>'}</span><span class="area">${esc([e.venue, e.city].filter(Boolean).join(", "))}</span>${myTakeOf(e.id) ? `<span>${esc(myTakeOf(e.id))}</span>` : ""}<span class="btnrow"><a class="btn" href="/plan/?ev=${esc(e.id)}&go=1">${HOUSE.icon("go", 18)}Take me there</a>${remindBtn(e, "btnline")}</span></span></div>`;
function myRacingPage() {
  const L = myRacing();
  const body = `<main class="hubpage"><p class="note"><a class="btnline" href="/blog/">‹ Blog</a></p>${evPic("/img/founder/my-racing.webp", "The OneTrackMind Alfa, number 37, at the Simola Hillclimb")}<h1>My racing</h1>
<p class="intro">The events I race at. The dates come from the organisers. Tap Remind me and you'll get an email before each one.</p>
<section class="prog"><div class="fix">${L.length ? L.map(evRowCard).join("") : `<p class="note">No dates out yet. They go up here as soon as the organisers publish them.</p>`}</div></section>
${L.length ? `<p class="note">Cape Town hill climb, Killarney time attack and rally dates go up as soon as the organisers publish them.</p>` : ""}
<div class="btnrow"><a class="btnline" href="/blog/autodidact/">Autodidact: the cars ›</a><a class="btnline" href="/about/why-preparation/">Why preparation ›</a></div>
</main>${L.length ? REMIND_JS : ""}`;
  return page({ dark: true, ads: false, active: "/blog/my-racing/", url: "/blog/my-racing/", title: "My racing: hill climbs, time attack and rally · OneTrackMind blog", desc: "The events the founder of OneTrackMind races at: Simola Hillclimb, Cape Town hill climb, Killarney time attack and rally. Dates, the road there and reminders.", body });
}
function autodidactPage() {
  const A = FD.autodidact || {}, E = (A.entries || []).filter(x => x && x.title);
  const body = `<main class="hubpage"><p class="note"><a class="btnline" href="/blog/">‹ Blog</a></p>${carsLine() ? `<p class="carsline">${esc(carsLine())}</p>` : ""}${evPic("/img/founder/autodidact-homebuilt.webp", "The homebuilt Alfa at Simola")}<h1>Autodidact</h1>
${(A.intro || "").trim() ? `<p class="intro">${esc(A.intro.trim())}</p>` : ""}
${E.length ? cardGrid(E.map(x => `<${x.link ? `a href="${esc(x.link)}"` : "div"} class="card pcard hubcard">${x.photo ? `<img src="${esc(x.photo)}" alt="" loading="lazy">` : ""}<b>${esc(x.title)}</b>${x.date ? `<span class="area">${fmtDate(x.date)}</span>` : ""}${x.line ? `<span>${esc(x.line)}</span>` : ""}</${x.link ? "a" : "div"}>`).join("")) : `<div class="soon"><b>Coming soon</b><p class="note">The builds, and the cars I road-trip.</p></div>`}
<div class="btnrow"><a class="btnline" href="/blog/my-racing/">My racing ›</a><a class="btnline" href="/about/why-preparation/">Why preparation ›</a></div>
</main>`;
  return page({ dark: true, ads: false, active: "/blog/autodidact/", url: "/blog/autodidact/", title: "Autodidact: the builds and the cars I road-trip · OneTrackMind blog", desc: "The founder of OneTrackMind builds his own cars, then road-trips and races them. The builds, the cars and what they taught him.", body });
}
// My top 5: the founder's lists (data/founder.json top5). Each item is an event, a route or a place, with his line.
const TOP5 = (FD.top5 || []).filter(l => l && /^[a-z0-9-]{2,60}$/.test(l.id || "") && l.title && (l.items || []).length)
  .concat(MATES_ON ? MATE_GROUPS.map(([k, t]) => ({ id: `mates-${k}`, title: `My top 5: ${t.toLowerCase()}`, intro: "", items: MATES[k].filter(x => x.top >= 1 && x.top <= 5).sort((a, b) => a.top - b.top).slice(0, 5).map(m => ({ mate: m, line: m.line })) })).filter(l => l.items.length) : []);
const mateLink = x => { const p = x.poi && FAV.find(f => f.id === x.poi); return { p, href: p ? `/favourites/${p.id}/` : x.url }; };
function matesPage() {
  const row = x => { const { p } = mateLink(x); return `<li class="mate">${x.logo ? `<img src="${esc(x.logo)}" alt="" loading="lazy">` : ""}<div><b>${x.top >= 1 && x.top <= 5 ? `<span class="mrank">${x.top}</span>` : ""}<a href="${esc(x.url)}" target="_blank" rel="${mateRel(x)}">${esc(x.name)}</a></b>${x.line ? `<p>${esc(x.line)}</p>` : ""}${p ? `<div class="btnrow"><a class="btnline" href="/favourites/${p.id}/">${esc(p.name)} ›</a><a class="btn" href="/plan/?fav=${esc(p.id)}&go=1">${HOUSE.icon("go", 18)}Take me there</a></div>` : ""}</div></li>`; };
  const body = `<main class="hubpage"><p class="note"><a class="btnline" href="/about/">‹ About</a></p><h1>Mates</h1>
<p class="intro">People and places I rate. Nobody paid to be here${MATES_ALL.some(x => x.sponsored) ? " unless it says so" : ""}.</p>
${MATE_GROUPS.filter(([k]) => MATES[k].length).map(([k, t, sub]) => `<section class="hub matesec" id="${k}"><div class="hubh"><h2>${esc(t)}</h2>${sub ? `<span class="hubsub">${esc(sub)}</span>` : ""}</div><ul class="mates">${matesOrder(MATES[k]).map(row).join("")}</ul></section>`).join("\n")}
</main>`;
  return page({ ads: false, active: "/about/mates/", url: "/about/mates/", title: "Mates: people and places I rate · OneTrackMind", desc: "The founder of OneTrackMind's people and places: restaurants, farm stalls, museums, builders, racers, clubs and workshops worth knowing.", body });
}
function top5Item(x) {
  if (x.mate) { const m = x.mate, { p } = mateLink(m); return `<li><div><b><a href="${esc(m.url)}" target="_blank" rel="${mateRel(m)}">${esc(m.name)}</a></b>${x.line ? `<p>${esc(x.line)}</p>` : ""}${p ? `<div class="btnrow"><a class="btn" href="/plan/?fav=${esc(p.id)}&go=1">${HOUSE.icon("go", 18)}Take me there</a><a class="btnline" href="/favourites/${p.id}/">${esc(p.name)} ›</a></div>` : ""}</div></li>`; }
  const e = x.event && evById(x.event), r = x.route && live.find(y => y.id === x.route), p = x.place && FAV.find(y => y.id === x.place);
  if (e) return `<li><div><b><a href="/events/${esc(e.id)}/">${esc(e.name)}</a></b><p class="note">${dRange(e)} · ${esc([e.city || e.venue, e.country].filter(Boolean).join(", "))}</p>${x.line ? `<p>${esc(x.line)}</p>` : ""}<div class="btnrow"><a class="btn" href="/plan/?ev=${esc(e.id)}&go=1">${HOUSE.icon("go", 18)}Take me there</a>${remindBtn(e, "btnline")}</div></div></li>`;
  if (r) return `<li><div><b><a href="/routes/${esc(r.id)}/">${esc(r.title)}</a></b><p class="note">${esc(r.region)}${r.season ? " · best " + esc(HOUSE.months(r.season.months)) : ""}</p>${x.line ? `<p>${esc(x.line)}</p>` : ""}<div class="btnrow"><a class="btn" href="/routes/${esc(r.id)}/">${HOUSE.icon("route", 18)}Ride it</a></div></div></li>`;
  if (p) return `<li><div><b><a href="/favourites/${esc(p.id)}/">${esc(p.name)}</a></b><p class="note">${esc(p.area || "")}</p>${x.line ? `<p>${esc(x.line)}</p>` : ""}<div class="btnrow"><a class="btn" href="/plan/?poi=${p.lat},${p.lon}&n=${enc(p.name)}&go=1">${HOUSE.icon("go", 18)}Take me there</a></div></div></li>`;
  return "";
}
function top5Index() {
  const body = `<main class="hubpage"><p class="note"><a class="btnline" href="/high-octane/">‹ FOMO</a></p><h1>My top 5</h1>
<p class="intro">My picks: what I'd go to, ride or see, and why.</p>
${TOP5.length ? cardGrid(TOP5.map(l => `<a class="card pcard hubcard" href="/high-octane/my-top-5/${l.id}/"><b>${esc(l.title)}</b>${l.intro ? `<span>${esc(l.intro)}</span>` : ""}<span class="go">See the list ›</span></a>`).join("")) : `<div class="soon"><b>Coming soon</b><p class="note">One new list a month.</p></div>`}
</main>`;
  return page({ active: "/high-octane/my-top-5/", url: "/high-octane/my-top-5/", title: "My top 5: events, roads and places worth it · OneTrackMind", desc: "The founder's top 5 lists: the events, roads and places he'd go to, and why.", body });
}
function top5Page(l) {
  const pair = JUX.pairs.length ? JUX.pairs[hashN(l.id, JUX.pairs.length)] : null;
  const body = `<main class="hubpage"><p class="note"><a class="btnline" href="/high-octane/my-top-5/">‹ My top 5</a></p><h1>${esc(l.title)}</h1>
${l.intro ? `<p class="intro">${esc(l.intro)}</p>` : ""}
<ol class="t5">${l.items.map(top5Item).join("")}</ol>
${pair ? `<p class="juxend"><span>${esc(pair[0])}</span><span>${esc(pair[1])}</span></p>` : ""}
</main>${REMIND_JS}`;
  return page({ active: "/high-octane/my-top-5/", url: `/high-octane/my-top-5/${l.id}/`, title: `${l.title} · OneTrackMind`, desc: l.intro || `${l.title}: the founder's picks, with how to get there.`, body });
}

function write(rel, s) { const p = path.join(ROOT, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); }
fs.rmSync(path.join(ROOT, "routes"), { recursive: true, force: true });
live.forEach(r => write(`routes/${r.id}/index.html`, routePage(r)));
write("index.html", homePage());
fs.writeFileSync(path.join(ROOT, "adventure/index.html"), redirectPage("/high-octane/")); // Adventure is part of FOMO now; the old address keeps working
write("high-octane/index.html", petrolheadPage());
write("petrolhead/index.html", redirectPage("/high-octane/"));
write("local-is-lekker/index.html", lilPage());
write("routes/index.html", routesIndex());
write("about/index.html", aboutPage());
write("partners/index.html", partnersPage());
fs.rmSync(path.join(ROOT, "favourites"), { recursive: true, force: true });
write("rides/index.html", redirectPage("/favourites/#trips"));
write("v1/index.html", redirectPage("/plan/"));
write("v3/index.html", redirectPage("/plan/"));
write("favourites/index.html", favIndex());
FAV.forEach(x => write(`favourites/${x.id}/index.html`, favPage(x)));
fs.rmSync(path.join(ROOT, "blog"), { recursive: true, force: true });
{ const M = seriesOf(); write("blog/index.html", storiesIndex(M)); M.forEach((L, n) => { L.forEach(x => write(`blog/${x.slug}/index.html`, storyPage(x, L))); if (L.length > 1) write(`blog/${tripSlug(n, L)}/index.html`, tripPage(n, L)); }); }
write("advertise/index.html", advertisePage());
fs.rmSync(path.join(ROOT, "how-to"), { recursive: true, force: true });
write("how-to/index.html", howtoIndex());
write("record/index.html", recordPage());
write("events/index.html", eventsPage());
write("list-your-event/index.html", listEventPage());
fs.rmSync(path.join(ROOT, "about/mates"), { recursive: true, force: true });
if (MATES_ON) write("about/mates/index.html", matesPage());
write("adventure/in-season/index.html", inSeasonPage());
write("about/why-preparation/index.html", whyPage());
write("blog/my-racing/index.html", myRacingPage());
write("blog/autodidact/index.html", autodidactPage());
fs.rmSync(path.join(ROOT, "high-octane/my-top-5"), { recursive: true, force: true });
write("high-octane/my-top-5/index.html", top5Index());
TOP5.forEach(l => write(`high-octane/my-top-5/${l.id}/index.html`, top5Page(l)));
{ const cut = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10); EVENTS.filter(e => e.end >= cut).forEach(e => write(`events/${e.id}/index.html`, eventPage(e))); }
{ const S = s => STORIES.find(x => x.slug === s), tort = [...seriesOf().entries()].find(([n]) => /Tortoise/.test(n));
  const pick = [
    ["A lap of the Nürburgring, on a public Sunday", "On motorcycles, first time ever. Here's how you do it too.", "/how-to/nurburgring/", { cover: "/media/founder/790-duke-karussell-nurburgring.jpg" }],
    ["Namibia 2017: how not to adventure bike", "A small problem in the desert, and a bakkie rescue.", "/blog/namibia-2017-day-7/", S("namibia-2017-day-7")],
    ["Namibia by Tortoise", "Nine days up the Skeleton Coast and Epupa, with the air conditioning on.", tort ? `/blog/${tripSlug(tort[0], tort[1])}/` : "", tort ? { cover: coverOf(tort[1]) } : null]];
  fs.writeFileSync(path.join(ROOT, "data/latest.json"), JSON.stringify(pick.filter(x => x[3] && x[3].cover && x[2]).map(([title, hook, url, s]) => ({ title, hook, url, cover: s.cover })))); }
HOWTO.forEach(g => write(`how-to/${g.id}/index.html`, howtoPage(g)));
const urls = ["/", "/adventure/in-season/", "/high-octane/", "/high-octane/my-top-5/", ...TOP5.map(l => `/high-octane/my-top-5/${l.id}/`), "/list-your-event/", ...(MATES_ON ? ["/about/mates/"] : []), "/about/why-preparation/", "/blog/my-racing/", "/blog/autodidact/", "/plan/", "/local-is-lekker/", "/routes/", "/favourites/", "/about/", "/partners/", "/advertise/", "/how-to/", "/record/", "/events/", ...EVENTS.filter(e => e.end >= new Date().toISOString().slice(0, 10)).map(e => `/events/${e.id}/`), ...HOWTO.map(g => `/how-to/${g.id}/`), ...live.map(r => `/routes/${r.id}/`), ...FAV.map(x => `/favourites/${x.id}/`), "/blog/", ...STORIES.map(x => `/blog/${x.slug}/`), ...[...seriesOf().entries()].filter(([, L]) => L.length > 1).map(([n, L]) => `/blog/${tripSlug(n, L)}/`), "/terms.html", "/privacy.html", "/rules.html"];
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `<url><loc>${SITE}${u}</loc><lastmod>${today}</lastmod></url>`).join("\n")}\n</urlset>\n`);
write("robots.txt", `# Everyone welcome, search engines and AI assistants included.\nUser-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /kits/\nDisallow: /newsletter/\n\nSitemap: ${SITE}/sitemap.xml\n`);
write("llms.txt", `# OneTrackMind

> Free planner for multi-day motorbike, 4x4 and self-drive trips. Plans a trip day by day on real roads: fuel stops and gaps, night stops and places to stay (filter by camping, guesthouse, hotel, self-catering, backpackers), sunset and weather, height profile, and a road grade for every stretch read for your vehicle. Built by riders, free for riders. Based in South Africa; strongest in South Africa, Namibia and Lesotho, works worldwide.

Take it with you: GPX made for your device (Garmin Zumo/Montana/XT and BMW Navigator, BMW Motorrad Connected, Ducati Link, KTM/Husqvarna/GasGas, Harley Boom! Box, OsmAnd, Calimoto, Kurviger, Scenic), one tap to open each day in Google Maps or Waze on a phone, a group ride pack with every format, and a printable PDF.

Road grades (same road, read per vehicle): Race (tar, smooth), Pre-jeep (graded gravel), Jeep (rough tracks), Pre-single (rocks, sand, river crossings; 4x4 or adventure bike), Single (bike single track or serious 4x4 terrain).

Founder: Ashley, 25 years in motorcycle retail (Ducati Cape Town, KTM Cape Town), adventure rider since the early 2000s, Simola Hill Climb racer. Stories: ${BLOG}

## Pages
- [Plan a trip](${SITE}/): the planner
- [Routes](${SITE}/routes/): all published routes
- [POI: points of interest](${SITE}/favourites/): places to go in Namibia, South Africa, Lesotho and Europe, and petrolhead destinations, with how to get there
- [About the founder](${SITE}/about/)

## Routes
${live.map(r => `- [${r.title}](${SITE}/routes/${r.id}/): ${r.region}, ${r.trip.days.length} day${r.trip.days.length > 1 ? "s" : ""}. ${r.blurb}`).join("\n")}
`);
console.log(`pages: ${live.length} routes, about, sitemap (${urls.length} urls), robots, llms.txt`);
