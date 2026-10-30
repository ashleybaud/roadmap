// The Wall Planner: an A3 poster of the year (races, shows, festivals, South African public holidays), for the garage wall.
// For people who'd rather print it than scroll it. QR code to the site; Fuelled by AlterEgo in the footer.
// Usage: node scripts/wall-planner.mjs [2027]   -> events/wall-planner-2027.pdf   (needs Playwright + Chromium)
import fs from "fs"; import path from "path"; import { createRequire } from "module";
const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const Y = process.argv[2] || "2027";
const EV = JSON.parse(fs.readFileSync(path.join(ROOT, "data/events/events.json"), "utf8"));
const HOL = JSON.parse(fs.readFileSync(path.join(ROOT, "data/holidays-za.json"), "utf8"));
const M = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const clean = n => n.replace(/\s*\(.*?\)/g, "").replace(/\s+20\d\d$/, "").replace(/^(IMSA|NASCAR Cup|IndyCar|WEC|WRC): /, "");
const dd = (a, b) => { const x = +a.slice(8, 10), y = +b.slice(8, 10); return a === b ? `${x}` : a.slice(5, 7) === b.slice(5, 7) ? `${x}–${y}` : `${x}–${y} ${M[+b.slice(5, 7) - 1].slice(0, 3)}`; };
// what goes on the wall: the big ones, everything at home, the shows and classics, F1 and MotoGP. Long US series seasons stay on the website.
const keep = e => e.tier === 1 || e.country === "South Africa" || ["f1", "motogp", "classics", "shows", "bikefest", "hillclimb", "roadrace", "offroad"].includes(e.genre);
const ev = EV.filter(e => e.start.startsWith(Y) && keep(e));
const hol = (HOL[Y] || []).concat(HOL["gifts" + Y] || []);
const month = i => { const mm = String(i + 1).padStart(2, "0");
  const rows = [...ev.filter(e => e.start.slice(5, 7) === mm).map(e => ({ d: e.start, html: `<li class="${e.tier === 1 ? "big" : ""}${e.country === "South Africa" ? " home" : ""}"><b>${dd(e.start, e.end)}</b><span>${e.genre === "f1" ? "F1 · " : e.genre === "motogp" ? "MotoGP · " : ""}${esc(clean(e.name).replace(/^MotoGP /, ""))}${e.confirmed ? "" : "*"}<i>${esc(e.country === "South Africa" ? (e.city || e.venue) : e.country)}</i></span></li>` })),
    ...hol.filter(h => h[0].slice(5, 7) === mm).map(h => ({ d: h[0], html: `<li class="hol"><b>${+h[0].slice(8, 10)}</b><span>${esc(h[1])}</span></li>` }))].sort((a, b) => a.d.localeCompare(b.d));
  return `<section><h2>${M[i]}</h2><ul>${rows.map(r => r.html).join("") || '<li class="hol"><span>Go ride.</span></li>'}</ul></section>`; };
const fileUrl = p => "file://" + p;
const html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:B;src:url(${fileUrl(path.join(ROOT, "scripts/fonts/saira-condensed-latin-800-normal.woff2"))});font-weight:800}
@font-face{font-family:B;src:url(${fileUrl(path.join(ROOT, "scripts/fonts/saira-condensed-latin-700-normal.woff2"))});font-weight:700}
@font-face{font-family:P;src:url(${fileUrl(path.join(ROOT, "scripts/fonts/ibm-plex-sans-latin-400-normal.woff2"))});font-weight:400}
@font-face{font-family:P;src:url(${fileUrl(path.join(ROOT, "scripts/fonts/ibm-plex-sans-latin-600-normal.woff2"))});font-weight:600}
@page{size:A3 landscape;margin:0}*{box-sizing:border-box;margin:0;padding:0}
body{width:420mm;height:297mm;font-family:P;color:#121A1E;background:#fff;padding:10mm 12mm 7mm;display:flex;flex-direction:column}
header{display:flex;gap:6mm;justify-content:space-between;align-items:flex-end;border-bottom:3mm solid #E8A317;padding-bottom:3mm;margin-bottom:4mm}
.hos{height:26mm;transform:rotate(-4deg);box-shadow:0 1mm 2mm rgba(0,0,0,.3)}h1{flex:1;font:800 22mm/0.9 B;text-transform:uppercase;letter-spacing:-.3mm}h1 span{color:#0A4A63}
.sub{font:700 6mm/1.1 B;text-transform:uppercase;color:#0A4A63;text-align:right}.sub small{display:block;font:400 3.4mm/1.3 P;text-transform:none;color:#444;margin-top:1.5mm}
main{flex:1;min-height:0;display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(3,1fr);gap:3mm}
section{border:.5mm solid #0A4A63;border-radius:2mm;padding:2.2mm 2.8mm;overflow:hidden}
h2{font:800 6.5mm/1 B;text-transform:uppercase;color:#0A4A63;border-bottom:.4mm solid #ccd;padding-bottom:1mm;margin-bottom:1.2mm}
ul{list-style:none}li{display:grid;grid-template-columns:13mm 1fr;gap:1.5mm;font-size:3.05mm;line-height:1.22;padding:.55mm 0}
li b{font:700 3.3mm/1.2 B;color:#0A4A63}li i{font-style:normal;color:#666;margin-left:1.2mm;font-size:2.7mm}
li.big span{font-weight:600;font-size:3.35mm}li.big b{color:#B5740A}li.home span{font-weight:600}li.home span::after{content:" ★";color:#E8A317}
li.hol b,li.hol span{color:#8a2d1c;font-style:italic}
footer{flex:none;display:flex;align-items:center;gap:6mm;margin-top:3mm;border-top:.5mm solid #ccd;padding-top:3mm}
footer img.qr{width:22mm;height:22mm}footer .t{flex:1;font-size:3.4mm;line-height:1.35}footer .t b{font:800 5.5mm/1 B;text-transform:uppercase;display:block;color:#0A4A63}
footer .ae{display:flex;align-items:center;gap:3mm;font:700 4mm B;text-transform:uppercase}footer .ae img{height:18mm}
.key{font-size:2.9mm;color:#444;margin-top:1mm}.t .key b{font:600 2.9mm P;display:inline;text-transform:none;color:#B5740A}
</style><body>
<header><img class="hos" src="${fileUrl(path.join(ROOT, "img/high-octane.png"))}"><h1>The ${Y} <span>Wall Planner</span></h1><div class="sub">FOMO: races, shows and festivals<br>you'll kick yourself for missing<small>Book early: nobody decides on Friday to go to a Grand Prix on Sunday.</small></div></header>
<main>${M.map((_, i) => month(i)).join("")}</main>
<footer><img class="qr" src="${fileUrl(path.join(ROOT, "img/qr-events.svg"))}"><div class="t"><b>onetrackmind.online/events</b>Every date checked weekly, tickets, how to watch, and a trip planner to get you there. Dates change: check before you book.<div class="key"><b>Gold</b> = the big ones · ★ = in South Africa · <i style="color:#8a2d1c">red</i> = public holidays and gift days · * = date to be confirmed. Printed ${new Date().toISOString().slice(0, 10)}.</div></div><div class="ae">Fuelled by <img src="${fileUrl(path.join(ROOT, "img/alterego-logo-black.png"))}"></div></footer>
</body>`;
const tmp = path.join(ROOT, "events", "_wall.html"); fs.mkdirSync(path.dirname(tmp), { recursive: true }); fs.writeFileSync(tmp, html);
const { chromium } = require("playwright");
const b = await chromium.launch(), p = await b.newPage();
await p.goto(fileUrl(tmp)); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
const out = path.join(ROOT, "events", `wall-planner-${Y}.pdf`);
await p.pdf({ path: out, format: "A3", landscape: true, printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
await p.setViewportSize({ width: 1587, height: 1123 }); await p.screenshot({ path: path.join(ROOT, "events", `wall-planner-${Y}.png`) });
await b.close(); fs.rmSync(tmp);
console.log(`events/wall-planner-${Y}.pdf: ${ev.length} events, ${hol.length} holidays`);
