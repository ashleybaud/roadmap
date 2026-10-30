// Race trip: opens "Pick your races", ticks races, builds the trip with faked routing and towns. Run: node tests/evtrip.cjs
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium } = require("playwright");

const ROOT = "/home/claude/roadmap";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css" };
let leafletDir = null;
try { leafletDir = path.dirname(require.resolve("leaflet/dist/leaflet.js", { paths: [ROOT, process.env.LEAFLET_FROM || ROOT] })); } catch (e) {}

function serve() {
  return new Promise(res => {
    const srv = http.createServer((q, r) => {
      const u = decodeURIComponent(q.url.split("?")[0]);
      if (u.startsWith("/api/places")) { let b = ""; q.on("data", c => b += c); q.on("end", () => { const t = decodeURIComponent(b.replace(/^data=/, "").replace(/\+/g, " ")); const els = [...t.matchAll(/around:30000,(-?[\d.]+),(-?[\d.]+)/g)].map((m, i) => ({ type: "node", id: i, lat: +m[1] + 0.05, lon: +m[2] + 0.05, tags: { name: "Town" + i + "@" + (+m[1]).toFixed(1) + "," + (+m[2]).toFixed(1), place: "town" } })); r.writeHead(200, { "Content-Type": "application/json" }); r.end(JSON.stringify({ elements: els })); }); return; }
      if (u.startsWith("/api/")) { r.writeHead(200, { "Content-Type": "application/json" }); return r.end("[]"); }
      let f = path.join(ROOT, u === "/" ? "index.html" : u); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, "index.html");
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
      r.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r);
    }).listen(0, () => res(srv));
  });
}

// encode a straight line between two points as a Valhalla polyline6, with points every ~1 km
function enc6(pts) {
  let out = "", pl = 0, pn = 0;
  const e = v => { v = v < 0 ? ~(v << 1) : v << 1; let s = ""; while (v >= 0x20) { s += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; } return s + String.fromCharCode(v + 63); };
  pts.forEach(([la, lo]) => { const a = Math.round(la * 1e6), b = Math.round(lo * 1e6); out += e(a - pl) + e(b - pn); pl = a; pn = b; });
  return out;
}
function fakeRoute(body) {
  const [a, b] = body.locations; const R = 6371, rad = x => x * Math.PI / 180;
  const km = 2 * R * Math.asin(Math.sqrt(Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2)) * 1.2;
  const n = Math.max(2, Math.round(km)); const pts = [];
  for (let i = 0; i <= n; i++) pts.push([a.lat + (b.lat - a.lat) * i / n, a.lon + (b.lon - a.lon) * i / n]);
  return { trip: { summary: { length: km, time: km / 70 * 3600 }, legs: [{ shape: enc6(pts) }] } };
}

// BRouter-style answer: a straight line in three parts, tar, gravel and a rough 4x4 track
function fakeBrouter(u) {
  const ll = decodeURIComponent(u.match(/lonlats=([^&]+)/)[1]).split("|").map(x => x.split(",").map(Number));
  const [[lo1, la1], [lo2, la2]] = ll, R = 6371, rad = x => x * Math.PI / 180;
  const km = 2 * R * Math.asin(Math.sqrt(Math.sin(rad(la2 - la1) / 2) ** 2 + Math.cos(rad(la1)) * Math.cos(rad(la2)) * Math.sin(rad(lo2 - lo1) / 2) ** 2)) * 1.2;
  const n = Math.max(2, Math.round(km)), coords = [];
  for (let i = 0; i <= n; i++) coords.push([lo1 + (lo2 - lo1) * i / n, la1 + (la2 - la1) * i / n, 200 + 600 * Math.sin(Math.PI * i / n)]);
  const m = km * 1000, parts = [[0.5, "highway=primary surface=asphalt"], [0.35, "highway=unclassified surface=gravel"], [0.15, "highway=track tracktype=grade4"]];
  const messages = [["Longitude", "Latitude", "Elevation", "Distance", "CostPerKm", "ElevCost", "TurnCost", "NodeCost", "InitialCost", "WayTags", "NodeTags", "Time", "Energy"],
    ...parts.map(([f, w]) => ["0", "0", "0", String(Math.round(m * f)), "1000", "0", "0", "0", "0", w, "", "0", "0"])];
  return { type: "FeatureCollection", features: [{ type: "Feature", properties: { "track-length": String(Math.round(m)), messages }, geometry: { type: "LineString", coordinates: coords } }] };
}
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const TRIP = {
  startDate: day(1), endDate: day(2), round: false, sugV: 5,
  start: { name: "Malmesbury", lat: -33.4608, lon: 18.7271 },
  end: { name: "Calvinia", lat: -31.4707, lon: 19.776 },
  days: [
    { to: { name: "Clanwilliam", lat: -32.1786, lon: 18.8916 }, style: "default", vias: [{ name: "Piketberg", lat: -32.9035, lon: 18.7563 }], legs: [] },
    { to: null, style: "default", vias: [{ name: "Nieuwoudtville", lat: -31.3747, lon: 19.1131 }], legs: [] },
  ],
};


// Race-trip builder test. Defaults: from Stuttgart, EICMA + Portimão MotoGP. Override with env FROM, TO, PICK, REG, SN/SLA/SLO.
const D = { FROM: "2026-11-04", TO: "2026-11-24", PICK: "eicma-2026,motogp-portuguese-grand-prix-2026", REG: "eu", SN: "Stuttgart", SLA: "48.7758", SLO: "9.1829", SHOT1: "/tmp/evtrip-1.png", SHOT2: "/tmp/evtrip-2.png" };
for (const k in D) if (!process.env[k]) process.env[k] = D[k];
(async () => {
  const srv = await serve(), base = `http://localhost:${srv.address().port}/`;
  const browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: +(process.env.VW||1400), height: +(process.env.VH||900) } });
  const errors = [], fails = []; page.on("pageerror", e => errors.push(e.message));
  await page.route("**/*", async route => {
    const u = route.request().url();
    if (u.startsWith(base)) return route.continue();
    if (u.includes("brouter.de/brouter/profile")) return route.fulfill({ contentType: "application/json", body: '{"profileid":"custom_1"}' });
    if (u.includes("brouter.de/brouter?")) return route.fulfill({ contentType: "application/json", body: JSON.stringify(fakeBrouter(u)) });
    if (u.includes("api.stadiamaps.com/route")) return route.fulfill({ contentType: "application/json", body: JSON.stringify(fakeRoute(JSON.parse(route.request().postData()))) });
    if (leafletDir && /unpkg\.com\/leaflet@[\d.]+\/dist\/(.+)$/.test(u)) { const f = path.join(leafletDir, u.match(/dist\/(.+)$/)[1]); if (fs.existsSync(f)) return route.fulfill({ path: f }); }
    return route.abort();
  });
  const ok = (c, m) => { if (!c) fails.push(m); };
  const T = Object.assign({}, TRIP, { start: { name: process.env.SN || "Malmesbury", lat: +(process.env.SLA || -33.4608), lon: +(process.env.SLO || 18.7271) } });
  await page.addInitScript(([t, reg]) => { if (!sessionStorage.getItem("seeded2")) { localStorage.clear(); localStorage.setItem("rr4-trip", t); localStorage.setItem("rr-welcome", "1"); localStorage.setItem("otm-gpsasked", "1"); localStorage.setItem("otm-evtreg", reg); sessionStorage.setItem("seeded2","1"); } }, [JSON.stringify(T), JSON.stringify((process.env.REG||"za").split(","))]);
  await page.goto(base + "plan/"); await page.waitForTimeout(2500);
  await page.click("[data-evtrip]"); await page.waitForTimeout(800);
  await page.fill("#evtFrom", process.env.FROM); await page.dispatchEvent("#evtFrom","change");
  await page.fill("#evtTo", process.env.TO); await page.dispatchEvent("#evtTo","change"); await page.waitForTimeout(300);
  for (const id of process.env.PICK.split(",")) { await page.check(`[data-evtsel="${id}"]`); }
  await page.waitForTimeout(300);
  await page.screenshot({ path: process.env.SHOT1 });
  console.log("warn:", await page.$eval("#evtWarn", e => e.innerText.replace(/\n+/g," / ")), "| btn:", await page.$eval("#evtGo", e => e.textContent));
  await page.click("#evtGo");
  await page.waitForFunction(() => typeof plan !== "undefined" && plan && !planStale, null, { timeout: 40000 }).catch(() => fails.push("route not worked out"));
  await page.waitForTimeout(4000);
  console.log(await page.evaluate(() => JSON.stringify({ start: trip.startDate, end: trip.endDate, from: trip.start.name, to: trip.end.name, nights: trip.days.map((d,k)=>addDays(trip.startDate,k)+":"+(d.to?d.to.name+(d.atEvent?"*":"")+(d.to.autoNight?"(auto)":""):"-")) })));
  console.log("plan days:", await page.evaluate(() => plan && plan.days.map(d => d ? Math.round(d.km||d.dist||0) : "x").join(",")));
  await page.screenshot({ path: process.env.SHOT2 }); const tb = await page.$(".tripbox, #details"); if (tb) await tb.screenshot({ path: process.env.SHOT2.replace(".png","-trip.png") }); console.log("sumbox:", await page.$$eval(".sumbox", b => b.map(x => x.innerText.replace(/\s+/g," ").slice(0,90)).join(" || ")));
  console.log("errors:", errors, "fails:", fails);
  await browser.close(); srv.close();
})();
