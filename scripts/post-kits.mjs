// Daily post kits for Instagram and Facebook, one per day, built from the site's own content.
//   Mon Race Week · Tue Places · Wed Roads · Thu Throwback · Fri The Garage · Sat Breakfast Run · Sun Race Day
// Each day gets post.jpg (1080x1350, feed), story.jpg (1080x1920), caption-ig.txt and caption-fb.txt.
// Everything for the week is on one phone-friendly page: kits/<monday>/ (save the picture, copy the caption, post).
// Founder photos for Friday and Saturday go in kits/inbox/<monday>/ (see kits/inbox/README.md); without them those days
// fall back to the archive (Friday) or a "photos needed" card (Saturday).
// Usage: node scripts/post-kits.mjs [--from 2026-11-02]   (needs Playwright + Chromium)
import fs from "fs"; import path from "path"; import { createRequire } from "module";
const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const J = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8")); } catch (e) { return d; } };
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const add = (s, n) => { const d = new Date(s + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const monday = d => { const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x.toISOString().slice(0, 10); };
const from = arg("from", monday(add(new Date().toISOString().slice(0, 10), 7)));
const isoWeek = s => { const t = new Date(s + "T12:00:00Z"); t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7)); return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7); };
const W = isoWeek(from) + 53 * (+from.slice(0, 4) - 2026);
const SITE = "https://onetrackmind.online", SHORT = "onetrackmind.online";
const M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fd = s => { const d = new Date(s + "T12:00:00Z"); return `${d.getUTCDate()} ${M[d.getUTCMonth()]}`; };
const rng = e => e.start === e.end ? fd(e.start) : `${fd(e.start)} – ${fd(e.end)}`;
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const cut = (s, n) => { s = String(s || "").trim(); if (s.length <= n) return s; const t = s.slice(0, n); const p = Math.max(t.lastIndexOf(". "), t.lastIndexOf("! "), t.lastIndexOf("? ")); return p > n * 0.5 ? t.slice(0, p + 1) : t.slice(0, t.lastIndexOf(" ")) + "…"; };

const EV = J("data/events/events.json", []), WATCH = J("data/events/watch.json", {});
const FAV = J("data/favourites/favourites.json", []), PICKS = (J("data/picks/picks.json", {}).routes || []).filter(r => !r.draft);
const STORIES = J("data/stories/stories.json", []);
const FPH = (J("data/founder-photos.json", {}).photos || []).filter(x => fs.existsSync(path.join(ROOT, x.file)));
// a founder photo post: his own line if he gave one, otherwise the kit asks him for it
const fMatch = (...texts) => { const t = texts.join(" ").toLowerCase(); const x = FPH.find(p => p.line && p.use === "throwback" && (() => { const w = p.line.replace(/\.$/, "").toLowerCase(); return w.length > 4 && !/^(morocco|namibia)$/.test(w) && t.includes(w); })()); return x ? path.join(ROOT, x.file) : null; };
const photoPost = (x, base) => Object.assign(base, { photo: path.join(ROOT, x.file), needsLine: !x.line,
  title: x.line ? x.line.replace(/\.$/, "") : base.title, sub: base.sub,
  link: x.link ? SITE + x.link : SITE, ig: [x.line || "[Where and when, in your words]", "", x.line ? "" : "[One or two lines: what happened]", "", x.link ? "Link in bio." : "", "", x.place ? `📍 ${x.place}` : "", "", base.tags] });
const OUT = path.join(ROOT, "kits", from), INBOX = path.join(ROOT, "kits", "inbox", from);
const USED_F = path.join(ROOT, "kits", "used.json"), USED = J("kits/used.json", {});
fs.mkdirSync(OUT, { recursive: true });

// photos: blog photos are kept in media/blog/ (same path as on the old site)
const local = url => { const m = String(url || "").match(/wp-content\/uploads\/([^"\s?]+)/); if (!m) return null; const p = path.join(ROOT, "media/blog", decodeURIComponent(m[1])); return fs.existsSync(p) ? p : null; };
const storyByOld = u => STORIES.find(s => s.old && u && s.old.replace(/\/$/, "") === u.replace(/\/$/, ""));
const storyPhotos = s => { if (!s) return []; const all = [s.cover, ...[...String(s.html || "").matchAll(/src="([^"]+)"/g)].map(m => m[1])]; return [...new Set(all.map(local).filter(Boolean))]; };
const pickPhoto = r => { for (const p of (r.founder && r.founder.posts) || []) { const ph = storyPhotos(storyByOld(p.u)); if (ph.length) return ph[W % ph.length]; } return null; };
const inbox = re => { try { return fs.readdirSync(INBOX).filter(f => re.test(f)).sort().map(f => path.join(INBOX, f)); } catch (e) { return []; } };
const NOTES = J(path.relative(ROOT, path.join(INBOX, "notes.json")), {});
const TEX = { tar: path.join(ROOT, "img/tex-tar2.jpg"), gravel: path.join(ROOT, "img/tex-gravel.jpg") };
// rotation that doesn't repeat for a while: first item not used in the last `gap` weeks
const pickFresh = (list, key, kind, gap) => { const recent = new Set(Object.entries(USED).filter(([wk, v]) => wk < from && wk >= add(from, -7 * gap)).map(([, v]) => v[kind])); const start = W % list.length;
  for (let i = 0; i < list.length; i++) { const x = list[(start + i) % list.length]; if (!recent.has(key(x))) return x; } return list[start]; };

const BIG = /SEMA|EICMA|Goodwood|Le Mans|Daytona|Indianapolis 500|Indy 500|Pikes Peak|Isle of Man|TT Races|Dakar|Monaco|Pebble Beach|Car Week|Essen Motor|N(ü|u)rburgring 24|Bathurst|Macau|Spa 24|Rennsport|Luftgek|Sebring|Baja 1000|North West 200/i;
const RANK = { f1: 0, endurance: 1, festival: 2, bikes: 3, rally: 4, us: 5, sa: 6, offroad: 7 };
// the size of the event first (tier), home races a step up for our South African readers, then the kind of racing
const rank = e => ((e.tier || (BIG.test(e.name) ? 1 : 2)) - 1) * 10 + (e.country === "South Africa" ? -5 : 0) + (RANK[e.category] ?? 9);
const plainText = st => String(st.html || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#8217;|&rsquo;/g, "’").replace(/&#8211;/g, "–").replace(/\s+/g, " ").trim();
const cleanTitle = t => t.replace(/^\d{4}[\s:-]+/, "").replace(/\s*[-–]\s*Gallery$/i, "").trim();
const short = n => n.replace(/\s+20\d\d$/, "").replace(/\s*\(.*?\)\s*/g, " ").trim();
const used = {};

/* ---------- the seven days ---------- */
const days = [];
const sun = add(from, 6);

// Monday: Race Week
{ const on = EV.filter(e => e.start <= sun && e.end >= from).sort((a, b) => rank(a) - rank(b) || a.start.localeCompare(b.start)).slice(0, 6);
  const head = on[0];
  days.push({ day: "Monday", theme: "Race Week", slug: "1-race-week", tex: "tar",
    title: head ? short(head.name) : "Quiet week", sub: on.length > 1 ? `and ${on.length - 1} more this week` : "",
    rows: on.map(e => [rng(e), short(e.name), e.city || e.country || ""]),
    cta: ["Plan it", `${SHORT}/events`], link: `${SITE}/events/`,
    ig: [on.length ? `What's on this week:` : `Nothing big on this week. Good time to ride.`, "", ...on.map(e => `${rng(e)} · ${short(e.name)}${e.city ? `, ${e.city}` : ""}${e.confirmed ? "" : " (dates to confirm)"}`), "",
      head ? `Going to ${short(head.name)}? The event page has how to watch, getting there and what's worth a detour nearby.` : "", "",
      "Full calendar, link in bio.", "", "#motorsport #raceweek #onetrackmind"] }); }

// Tuesday: Places (roads and petrolhead places, alternating weeks)
{ const pool = FAV.filter(f => (W % 2 ? f.group === "petrol" : f.group !== "petrol"));
  const f = pickFresh(pool.length ? pool : FAV, x => x.id, "place", 26); used.place = f.id;
  // only a photo that is really of this place: a post whose title names it; otherwise the plain card
  const words = f.name.split(/[\s,'’]+/).filter(w => w.length > 4 && !/^(the|and|road|museum|pass)$/i.test(w));
  const hit = s => s && words.some(w => new RegExp(`\\b${w}`, "i").test(s.title));
  const pk = f.trip && PICKS.find(r => r.id === f.trip);
  const st = ((pk && pk.founder && pk.founder.posts) || []).map(x => storyByOld(x.u)).find(hit) || STORIES.find(hit);
  const photo = fMatch(f.name, f.area) || storyPhotos(st)[0] || null;
  const town = (f.area || "").split(",")[0];
  days.push({ day: "Tuesday", theme: "Places", slug: "2-places", tex: f.group === "petrol" ? "tar" : "gravel", photo,
    title: f.name, sub: f.area, cta: ["Visit it", SHORT], link: `${SITE}/plan/?poi=${f.lat},${f.lon}&n=${encodeURIComponent(f.name)}`,
    ig: [f.short, "", cut((f.text || [])[0], 420), "", (f.tips || [])[0] ? `Tip: ${f.tips[0]}` : "", "", "Route there from wherever you are, link in bio.", "", `📍 ${f.name}, ${town}`, "", "#roadtrip #placestogo #onetrackmind"] }); }

// Wednesday: Roads (a founder route)
{ const r = pickFresh(PICKS, x => x.id, "road", 20); used.road = r.id; const s = r.stats || {};
  const facts = [s.km && `${s.km} km`, s.gravelPct != null && (s.gravelPct ? `${s.gravelPct}% gravel` : "all tar"), r.trip && r.trip.days && `${r.trip.days.length} day${r.trip.days.length > 1 ? "s" : ""}`, s.highM && `highest point ${s.highM} m`].filter(Boolean);
  const startName = r.trip && r.trip.start && r.trip.start.name;
  days.push({ day: "Wednesday", theme: "Roads", slug: "3-roads", tex: r.style === "rough" ? "gravel" : "tar", photo: fMatch(r.title, r.region || "") || pickPhoto(r),
    title: r.title, sub: [r.region, facts.join(" · ")].filter(Boolean).join("\n"), cta: ["Ride it", SHORT], link: `${SITE}/plan/?pick=${r.id}`,
    ig: [cut(r.blurb, 400), "", facts.join(" · "), "", "The whole route, ready for your GPS, link in bio.", "", startName ? `📍 ${startName}` : "", "", "#advrider #roadtrip #onetrackmind"] }); }

// Thursday: Throwback: on even weeks one of the founder's own photos (captioned ones first), otherwise a story from around this time of year
const fAll = FPH.filter(x => x.use === "throwback"), fThrow = fAll.some(x => x.line) ? fAll.filter(x => x.line) : fAll;  // captioned ones only, while there are any
if (W % 2 === 0 && fThrow.length) { const x = pickFresh(fThrow, y => y.id, "throwbackPhoto", 40); used.throwbackPhoto = x.id;
  days.push(photoPost(x, { day: "Thursday", theme: "Throwback", slug: "4-throwback", tex: "gravel", title: "From the archive", sub: "", cta: ["Plan yours", SHORT], tags: "#throwbackthursday #tbt #onetrackmind" })); }
else { const doy = s => { const d = new Date(s + "T12:00:00Z"); return (d - Date.UTC(d.getUTCFullYear(), 0, 1)) / 864e5; };
  const target = doy(add(from, 3)), dist = s => { const x = Math.abs(doy(s.date) - target); return Math.min(x, 365 - x); };
  const pool = STORIES.filter(s => s.date && s.date < add(from, -300) && storyPhotos(s).length).sort((a, b) => dist(a) - dist(b));
  const st = pickFresh(pool.slice(0, 12), x => x.slug, "throwback", 52); used.throwback = st.slug;
  const yr = st.date.slice(0, 4), lead = plainText(st) || st.lead;
  days.push({ day: "Thursday", theme: "Throwback", slug: "4-throwback", tex: "gravel", photo: storyPhotos(st)[0],
    title: cleanTitle(st.title), sub: `${M[+st.date.slice(5, 7) - 1]} ${yr}`, cta: ["Read it", SHORT], link: `${SITE}/blog/${st.slug}/`,
    ig: [`${M[+st.date.slice(5, 7) - 1]} ${yr}.`, "", cut(lead, 420), "", "The full story's on the blog, link in bio.", "", "#throwbackthursday #tbt #onetrackmind"] }); }

// Friday: The Garage (founder photo from the inbox, otherwise a build from the archive)
{ const ph = inbox(/^garage.*\.(jpe?g|png|webp)$/i), n = NOTES.garage || {};
  if (ph.length) days.push({ day: "Friday", theme: "The Garage", slug: "5-garage", tex: "tar", photo: ph[0], extra: ph.slice(1),
    title: n.vehicle || "In the garage", sub: n.line || "", cta: ["More builds", SHORT], link: `${SITE}/about/`,
    ig: [n.vehicle ? `${n.vehicle}.` : "", n.line || "", n.more || "", "", "#thegarage #projectcar #onetrackmind"] });
  else if (W % 2 === 1 && FPH.some(x => x.use === "garage" && x.line)) { const x = pickFresh(FPH.filter(y => y.use === "garage" && y.line), y => y.id, "garagePhoto", 10); used.garagePhoto = x.id;
    days.push(photoPost(x, { day: "Friday", theme: "The Garage", slug: "5-garage", tex: "tar", title: "In the garage", sub: "", cta: ["Plan a ride", SHORT], tags: "#thegarage #onetrackmind" })); }
  else { const BUILD = /KTM \d|690|790|390|1290|Porsche|McLaren|Aston|GSXR|Suzuki|Africa Twin|1250|Audi|Giulia|Cafe Racer|Duke|Scalpel|Fuorilegge|996|356|Stepnose|Bedford|Widebody/i, TRIP = /trip|tour|day \d|factory|museum|gallery|road|launch|conference|eicma|archivo/i;
    const pool = STORIES.filter(s => BUILD.test(s.title) && !TRIP.test(s.title) && storyPhotos(s).length);
    const st = pickFresh(pool, x => x.slug, "garage", 30); used.garage = st.slug; const lead = plainText(st) || st.lead;
    days.push({ day: "Friday", theme: "The Garage", slug: "5-garage", tex: "tar", photo: storyPhotos(st)[0], archive: true,
      title: cleanTitle(st.title), sub: `From the archive, ${st.date.slice(0, 4)}`, cta: ["Read it", SHORT], link: `${SITE}/blog/${st.slug}/`,
      ig: [`From the garage archive, ${st.date.slice(0, 4)}.`, "", cut(lead, 380), "", "The full story is on the blog, link in bio.", "", "#thegarage #onetrackmind"] }); } }

// Saturday: Breakfast Run (vehicle at a new place, the food, a few candids)
{ const ph = inbox(/^breakfast.*\.(jpe?g|png|webp)$/i), n = NOTES.breakfast || {};
  const place = n.place || "[Restaurant]", town = n.town || "[Town]", veh = n.vehicle || "[What I drove or rode]";
  days.push({ day: "Saturday", theme: "Breakfast Run", slug: "6-breakfast-run", tex: "tar", photo: ph[0] || null, extra: ph.slice(1), needs: !ph.length,
    title: n.place ? place : "Breakfast Run", sub: n.place ? `${town} · ${veh}` : "Photos needed: the vehicle outside, the food, two or three candids",
    cta: ["Go there", SHORT], link: n.lat ? `${SITE}/plan/?poi=${n.lat},${n.lon}&n=${encodeURIComponent(place)}` : SITE,
    ig: [`Local is lekker. Breakfast Run: ${place}, ${town}.`, "", `Took the ${veh}.`, n.order ? `Ordered: ${n.order}.` : "Ordered: [what you ate].", n.verdict || "[One line: would you go back, and why.]", "", "Route there from wherever you are, link in bio.", "", `📍 ${place}, ${town}`, "", "#localislekker #breakfastrun #onetrackmind"] }); }

// the run goes onto the Local is lekker page once the place is known (photo copied into media/lil/)
{ const n = NOTES.breakfast || {}, ph = inbox(/^breakfast.*\.(jpe?g|png|webp)$/i), sat = add(from, 5);
  if (n.place) { const F = path.join(ROOT, "data/local-is-lekker.json"); let L = []; try { L = JSON.parse(fs.readFileSync(F, "utf8")); } catch (e) {}
    let photo = ""; if (ph[0]) { fs.mkdirSync(path.join(ROOT, "media/lil"), { recursive: true }); const to = `media/lil/${sat}${path.extname(ph[0]).toLowerCase()}`; fs.copyFileSync(ph[0], path.join(ROOT, to)); photo = "/" + to; }
    L = L.filter(x => x.date !== sat); L.push({ date: sat, place: n.place, town: n.town || "", vehicle: n.vehicle || "", line: n.verdict || "", photo, lat: n.lat ?? null, lon: n.lon ?? null });
    L.sort((a, b) => a.date.localeCompare(b.date)); fs.writeFileSync(F, JSON.stringify(L, null, 1) + "\n"); } }

// Sunday: Race Day
{ const racing = e => (WATCH[e.series] || {}).watch && e.category !== "festival";
  const today = EV.filter(e => e.start <= sun && e.end >= sun && racing(e)).sort((a, b) => rank(a) - rank(b)).slice(0, 5);
  const list = today.length ? today : EV.filter(e => e.start > sun && racing(e)).sort((a, b) => a.start.localeCompare(b.start)).slice(0, 4);
  const w = e => ((WATCH[e.series] || {}).watch || [])[0];
  days.push({ day: "Sunday", theme: "Race Day", slug: "7-race-day", tex: "tar",
    title: today.length ? `Racing today` : "No racing today", sub: today.length ? `Sunday ${fd(sun)}` : "Next up",
    rows: list.map(e => [today.length ? (w(e) ? w(e).label : "") : rng(e), short(e.name), e.city || e.country || ""]),
    cta: ["How to watch", `${SHORT}/events`], link: `${SITE}/events/`,
    ig: [today.length ? "Racing today:" : "No racing today. Next up:", "", ...list.map(e => `${short(e.name)}${e.city ? `, ${e.city}` : ""}${today.length && w(e) ? ` · watch on ${w(e).label}` : today.length ? "" : ` · ${rng(e)}`}`), "",
      "Where to watch and results after, link in bio.", "", "#raceday #motorsport #onetrackmind"] }); }

/* ---------- captions: Instagram (link in bio) and Facebook (the link itself) ---------- */
const tidy = a => a.join("\n").replace(/\n{3,}/g, "\n\n").trim();
for (const d of days) {
  d.capIg = tidy(d.ig);
  d.capFb = tidy(d.ig.map(l => /link in bio\.?$/i.test(l) ? l.replace(/,? ?link in bio\.?$/i, "").replace(/[:.]?$/, ": ") + d.link : l).filter(l => !/^#/.test(l)));
}

/* ---------- pictures ---------- */
const FONT = f => "file://" + path.join(ROOT, "scripts/fonts", f);
const fileUrl = p => "file://" + p.split(path.sep).map(encodeURIComponent).join("/");
const CSS = `@font-face{font-family:B;src:url(${FONT("saira-condensed-latin-800-normal.woff2")});font-weight:700}
@font-face{font-family:B;src:url(${FONT("saira-condensed-latin-700-normal.woff2")});font-weight:600}
@font-face{font-family:P;src:url(${FONT("ibm-plex-sans-latin-400-normal.woff2")});font-weight:400}
@font-face{font-family:P;src:url(${FONT("ibm-plex-sans-latin-600-normal.woff2")});font-weight:600}
*{box-sizing:border-box;margin:0}body{width:1080px;overflow:hidden;background:#06303F;font-family:P}
.c{position:relative;width:1080px;overflow:hidden;color:#fff}
.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.tex{filter:brightness(.55) saturate(.8)}
.shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(6,48,63,.55) 0%,rgba(6,48,63,0) 22%,rgba(6,48,63,0) 42%,rgba(6,48,63,.92) 72%,#06303F 100%)}
.flat .shade{background:linear-gradient(180deg,rgba(6,48,63,.35),rgba(6,48,63,.75))}
.top{position:absolute;left:64px;right:64px;top:64px;display:flex;justify-content:space-between;align-items:center}
.pill{background:#E8A317;color:#06303F;font:700 34px/1 B;letter-spacing:.06em;text-transform:uppercase;padding:14px 22px;border-radius:999px}
.brand{font:700 30px/1 B;letter-spacing:.14em;color:#fff;text-shadow:0 2px 12px rgba(0,0,0,.5)}
.bot{position:absolute;left:64px;right:64px;bottom:64px}
h1{font:700 104px/.95 B;text-transform:uppercase;letter-spacing:.01em;text-wrap:balance;text-shadow:0 3px 20px rgba(0,0,0,.35)}
.sub{font:400 36px/1.35 P;color:#CFE6EE;margin-top:20px;white-space:pre-line}
.rows{margin-top:30px;border-top:3px solid #E8A317}
.row{display:flex;gap:26px;align-items:baseline;padding:18px 0;border-bottom:1px solid rgba(181,211,222,.3)}
.row .d{font:700 34px/1.1 B;color:#E8A317;min-width:230px;text-transform:uppercase}
.row .n{font:600 38px/1.15 P}.row .w{font:400 28px/1.2 P;color:#B5D3DE}
.foot{display:flex;justify-content:space-between;align-items:center;margin-top:40px}
.cta{background:#E8A317;color:#06303F;font:700 40px/1 B;text-transform:uppercase;letter-spacing:.04em;padding:20px 30px;border-radius:14px}
.url{font:600 30px/1 P;color:#B5D3DE}
.need{position:absolute;left:64px;right:64px;top:40%;border:4px dashed #E8A317;border-radius:24px;padding:40px;font:600 40px/1.3 P;color:#E8A317;text-align:center}
`;
const card = (d, h, photo) => {
  const bg = photo ? `<img class="bg" src="${fileUrl(photo)}">` : `<img class="bg tex" src="${fileUrl(TEX[d.tex])}">`;
  const rows = d.rows ? `<div class="rows">${d.rows.slice(0, h > 1400 ? 6 : 5).map(r => `<div class="row"><div class="d">${esc(r[0])}</div><div><div class="n">${esc(r[1])}</div>${r[2] ? `<div class="w">${esc(r[2])}</div>` : ""}</div></div>`).join("")}</div>` : "";
  return `<!doctype html><meta charset="utf-8"><style>${CSS}</style><div class="c ${photo ? "" : "flat"}" style="height:${h}px">${bg}<div class="shade"></div>
<div class="top"><div class="pill">${esc(d.day)} · ${esc(d.theme)}</div><div class="brand">ONETRACKMIND</div></div>
${d.needs && !photo ? `<div class="need">Your photo goes here</div>` : ""}
<div class="bot"><h1 style="${d.title.length > 28 ? "font-size:84px" : ""}">${esc(d.title)}</h1>${d.sub ? `<div class="sub">${esc(d.sub)}</div>` : ""}${rows}
<div class="foot"><div class="cta">${esc(d.cta[0])} ›</div><div class="url">${esc(d.cta[1])}</div></div></div></div>`;
};
// extra carousel slides: the photo on its own, small brand mark only
const plain = (photo, h) => `<!doctype html><meta charset="utf-8"><style>${CSS}</style><div class="c" style="height:${h}px"><img class="bg" src="${fileUrl(photo)}"><div class="top" style="justify-content:flex-end"><div class="brand">ONETRACKMIND</div></div></div>`;

const { chromium } = require("playwright");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
const tmp = path.join(OUT, "_render.html");
async function shot(html, h, file) { fs.writeFileSync(tmp, html); await page.setViewportSize({ width: 1080, height: h }); await page.goto(fileUrl(tmp)); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(150); await page.screenshot({ path: file, type: "jpeg", quality: 86 }); }
for (const d of days) {
  const dir = path.join(OUT, d.slug); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  await shot(card(d, 1350, d.photo), 1350, path.join(dir, "post.jpg"));
  await shot(card(d, 1920, d.photo), 1920, path.join(dir, "story.jpg"));
  d.files = ["post.jpg", "story.jpg"];
  for (const [i, p] of (d.extra || []).entries()) { const f = `post-${i + 2}.jpg`; await shot(plain(p, 1350), 1350, path.join(dir, f)); d.files.push(f); }
  fs.writeFileSync(path.join(dir, "caption-ig.txt"), d.capIg + "\n"); fs.writeFileSync(path.join(dir, "caption-fb.txt"), d.capFb + "\n");
}
await browser.close(); fs.rmSync(tmp, { force: true });
// keep the repo light: weeks older than a month are removed (they stay in git history)
for (const wk of fs.readdirSync(path.join(ROOT, "kits"))) if (/^\d{4}-\d\d-\d\d$/.test(wk) && wk < add(from, -28)) fs.rmSync(path.join(ROOT, "kits", wk), { recursive: true, force: true });

/* ---------- the week's page ---------- */
const camps = ((J("data/campaigns.json", {}).campaigns) || []).filter(c => !c.hidden && c.from <= add(from, 6) && c.to >= from);
const dates = days.map((d, i) => add(from, i));
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Posts for ${fd(from)} – ${fd(sun)}</title>
<style>body{margin:0;background:#06303F;color:#fff;font:16px/1.5 system-ui,-apple-system,Segoe UI,Arial,sans-serif}main{max-width:720px;margin:0 auto;padding:20px 16px 60px}
h1{font-size:1.5rem;margin:0 0 4px}.note{color:#B5D3DE;font-size:.92rem}.day{background:#0F5874;border-radius:14px;padding:16px;margin:18px 0;border-top:4px solid #E8A317}
.day h2{margin:0 0 10px;font-size:1.15rem}.day h2 span{color:#E8A317}.pics{display:flex;gap:10px;overflow-x:auto}.pics a{flex:0 0 auto}.pics img{height:260px;border-radius:8px;display:block}
.cap{background:#06303F;border-radius:10px;padding:12px;white-space:pre-wrap;font-size:.92rem;margin:10px 0 6px}.btn{display:inline-block;background:#E8A317;color:#06303F;border:0;border-radius:8px;padding:9px 14px;font-weight:700;font-size:.9rem;text-decoration:none;cursor:pointer;margin:4px 6px 4px 0}
.ghost{background:#13617E;color:#fff}.warn{color:#E8A317;font-weight:700}</style>
<main><h1>Posts for ${fd(from)} – ${fd(sun)}</h1>${camps.length ? `<div class="day" style="border-top-color:#8FD3EA"><h2><span>This week, plan ahead</span></h2>${camps.map(c => `<p><b>${esc(c.title)}.</b> ${esc(c.line)} <a href="${SITE + c.link}" style="color:#E8A317">${esc(c.cta)} ›</a></p>`).join("")}<p class="note">Work it into a post or a story this week. Book-ahead posts do best 3 to 6 months before the date.</p></div>` : ""}
<p class="note">Tap a picture to open it full size, then save it. Copy the caption, post. Stories: add a link sticker with the link shown.</p>
${days.map((d, i) => `<section class="day"><h2><span>${d.day} ${fd(dates[i])}</span> · ${esc(d.theme)}</h2>
${d.needsLine ? `<p class="warn">Your photo: fill in the lines in [brackets] before you post. Or send Claude a line and it goes in for you.</p>` : ""}${d.needs ? `<p class="warn">Needs your photos. Send them to Claude with the place, town and what you drove.</p>` : d.archive ? `<p class="note">No garage photo this week, so this one is from the archive. Send a photo to use your own.</p>` : ""}
<div class="pics">${d.files.map(f => `<a href="${d.slug}/${f}" target="_blank"><img src="${d.slug}/${f}" alt="${esc(d.theme)} ${f}"></a>`).join("")}</div>
<div class="cap" id="ig${i}">${esc(d.capIg)}</div><button class="btn" data-copy="ig${i}">Copy Instagram caption</button>
<div class="cap" id="fb${i}" hidden>${esc(d.capFb)}</div><button class="btn ghost" data-copy="fb${i}">Copy Facebook caption</button>
<p class="note">Story link: <a href="${esc(d.link)}" style="color:#E8A317">${esc(d.link.replace(/^https:\/\//, ""))}</a></p></section>`).join("")}
</main><script>document.addEventListener("click",async e=>{const b=e.target.closest("[data-copy]");if(!b)return;const t=document.getElementById(b.dataset.copy).textContent;try{await navigator.clipboard.writeText(t);b.textContent="Copied";}catch(err){const r=document.createRange();const el=document.getElementById(b.dataset.copy);el.hidden=false;r.selectNodeContents(el);getSelection().removeAllRanges();getSelection().addRange(r);b.textContent="Selected, tap Copy";}});</script></html>`;
fs.writeFileSync(path.join(OUT, "index.html"), html);
USED[from] = used; fs.writeFileSync(USED_F, JSON.stringify(USED, null, 1));
console.log(`kits/${from}/: ${days.map(d => `${d.day.slice(0, 3)} ${d.title}${d.needs ? " (needs photos)" : ""}`).join(" | ")}`);
