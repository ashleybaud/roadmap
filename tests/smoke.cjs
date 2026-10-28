// Smoke test: loads the built index.html with a seeded 2-day trip, fakes the routing server,
// and checks the main screens work. Run: node tests/smoke.cjs  (needs Playwright + Chromium)
const http = require("http"), fs = require("fs"), path = require("path");
const { chromium } = require("playwright");

const ROOT = path.join(__dirname, "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css" };
let leafletDir = null;
try { leafletDir = path.dirname(require.resolve("leaflet/dist/leaflet.js", { paths: [ROOT, process.env.LEAFLET_FROM || ROOT] })); } catch (e) {}

function serve() {
  return new Promise(res => {
    const srv = http.createServer((q, r) => {
      const u = decodeURIComponent(q.url.split("?")[0]);
      if (u.startsWith("/api/")) { r.writeHead(200, { "Content-Type": "application/json" }); return r.end("[]"); }
      const f = path.join(ROOT, u === "/" ? "index.html" : u);
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

(async () => {
  const srv = await serve(), base = `http://localhost:${srv.address().port}/`;
  const browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [], fails = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.route("**/*", async route => {
    const u = route.request().url();
    if (u.startsWith(base)) return route.continue();
    if (u.includes("brouter.de/brouter/profile")) return route.fulfill({ contentType: "application/json", body: '{"profileid":"custom_1"}' });
    if (u.includes("brouter.de/brouter?")) return route.fulfill({ contentType: "application/json", body: JSON.stringify(fakeBrouter(u)) });
    if (u.includes("api.stadiamaps.com/route")) return route.fulfill({ contentType: "application/json", body: JSON.stringify(fakeRoute(JSON.parse(route.request().postData()))) });
    if (leafletDir && /unpkg\.com\/leaflet@[\d.]+\/dist\/(.+)$/.test(u)) { const f = path.join(leafletDir, u.match(/dist\/(.+)$/)[1]); if (fs.existsSync(f)) return route.fulfill({ path: f }); }
    if (u.includes("unpkg.com/leaflet")) return route.continue();
    return route.abort();
  });
  await page.addInitScript(t => { if (!sessionStorage.getItem("seeded")) { localStorage.clear(); localStorage.setItem("rr4-trip", t); localStorage.setItem("rr-welcome", "1"); localStorage.setItem("otm-gpsasked", "1"); sessionStorage.setItem("seeded", "1"); } }, JSON.stringify(TRIP));
  await page.goto(base);
  const ok = (c, m) => { if (!c) fails.push(m); };
  await page.waitForFunction(() => typeof plan !== "undefined" && plan && !planStale && plan.days.filter(Boolean).length === 2, null, { timeout: 30000 }).catch(() => fails.push("route not worked out"));
  await page.waitForFunction(() => placesOk && typeof townList !== "undefined" && townList, null, { timeout: 30000 }).catch(() => fails.push("places/towns not loaded"));
  await page.waitForTimeout(1500);

  ok(await page.evaluate(() => !document.getElementById("welcome").open), "welcome card shows again after it was closed");
  ok(await page.$$eval("#iconbar .ib", b => b.length) === 9, "map buttons missing");
  ok(await page.$$eval("#iconbar [data-key]", b => b.length) === 1, "key (?) button missing from the map box");
  ok(await page.evaluate(() => trip.days.every(d => !d.fresh)), "suggestions not settled after one pass");
  ok(await page.$$eval(".sumbox", b => b.length) >= 2, "overview day boxes missing");
  ok(await page.$$eval(".sumbox .wmin", b => b.length) === 0, "fuel warning text shown on overview");
  const gr = await page.evaluate(() => { const G = tripGrade(); return G && { top: G.top, g1: Math.round(G.km[1]), g2: Math.round(G.km[2]), g4: Math.round(G.km[4]) }; });
  ok(gr && gr.top === 4 && gr.g1 > gr.g2 && gr.g2 > gr.g4 && gr.g4 > 0, "route grading wrong: " + JSON.stringify(gr));
  ok(await page.$$eval(".sumbox .gradebar", b => b.length) >= 2, "grade bar missing on the day boxes");
  const el = await page.evaluate(() => { const E = dayElev(0); return E && { up: E.up, top: E.top }; });
  ok(el && el.top >= 700 && el.up >= 500, "elevation not worked out: " + JSON.stringify(el));
  ok(await page.$$eval(".sumbox .elevline", b => b.length) >= 2, "climb line missing on the day boxes");

  await page.click('[data-day="0"]'); await page.waitForTimeout(500);
  ok(await page.$$eval("ol.stops li", b => b.length) >= 2, "day stop list missing");
  ok(await page.$$eval(".gtk", b => b.length) === 1, "Good to know section missing on the day view");
  const gtk = await page.evaluate(() => goodToKnow(0).map(x => x.lvl + ":" + x.sec + ":" + x.text));
  ok(gtk.some(x => x.startsWith("info:dest:Arrive at") || /dest:You arrive/.test(x)), "Good to know has no arrival line");
  const pdf = await page.evaluate(() => printHtml());
  ok(/Before you go/.test(pdf) && /At your destination/.test(pdf), "PDF is missing the critical-first sections");
  const title = await page.$eval(".fbtn", b => b.title).catch(() => "");
  ok(/fuel stops? en route/.test(title), "fuel pill hover text wrong: " + title);

  await page.click('[data-legsty="0:1"]');
  await page.waitForFunction(() => trip.days[0].vias[0].fast === true && !planStale, null, { timeout: 15000 }).catch(() => fails.push("way choice per stretch not saved"));

  await page.click('[data-lay="med"]');
  ok(await page.$eval('[data-lay="med"]', b => b.classList.contains("on")), "map button did not toggle");

  await page.click('[data-day="1"]'); await page.waitForTimeout(500);
  ok(await page.$$eval("ol.stops li", b => b.length) >= 2, "second day stop list missing");

  // open a OneTrackMind pick
  await page.click('[data-day="ov"]'); await page.waitForTimeout(300);
  await page.click("[data-picks]"); await page.waitForSelector("[data-pkopen]", { timeout: 10000 }).catch(() => fails.push("picks list didn't load"));
  await page.click('[data-pkopen="tankwa-gannaga"]').catch(() => {});
  await page.waitForFunction(() => trip.pick === "tankwa-gannaga" && plan && !planStale && plan.days.filter(Boolean).length === 2, null, { timeout: 20000 }).catch(() => fails.push("pick route didn't open and route"));

  // plan a whole trip from a GPX file
  await page.click('[data-day="ov"]'); await page.waitForTimeout(300);
  await page.setInputFiles("[data-tripgpx]", { name: "test-west-coast.gpx", mimeType: "application/gpx+xml", buffer: Buffer.from(require("./fixtures-route.cjs")) });
  await page.waitForFunction(() => trip.gpx && plan && !planStale && plan.days.filter(Boolean).length === trip.days.length && placesOk, null, { timeout: 30000 }).catch(() => fails.push("GPX trip not planned"));
  const g = await page.evaluate(() => ({ days: trip.days.length, nights: trip.days.slice(0, -1).map(d => d.to && d.to.name), followed: plan.days.every(d => d.legs.every(l => l.gpx || false)), km: Math.round(plan.total), sym: (() => { let t = ""; const o = URL.createObjectURL; URL.createObjectURL = b => { b.text().then(x => window._gpxOut = x); return o.call(URL, b); }; downloadGpx(0); URL.createObjectURL = o; return 1; })() }));
  await page.waitForTimeout(300);
  const gpxOut = await page.evaluate(() => window._gpxOut || "");
  ok(g.days >= 2, "GPX trip not split into days: " + JSON.stringify(g));
  ok(g.followed, "GPX trip stretches are not following the file");
  ok(/<sym>(Lodging|Gas Station)<\/sym>/.test(gpxOut), "GPX export has no Garmin symbols");
  console.log("gpx trip:", JSON.stringify({ days: g.days, nights: g.nights, km: g.km }));

  ok(errors.length === 0, "page errors: " + errors.join(" | "));
  const nav = await page.evaluate(() => ({ g: gmParts(0), w: wazeStops(0), html: navHtml().length, btn: navButtons(0).includes("Google Maps") }));
  if (!nav.g.length || !nav.g[0].url.startsWith("https://www.google.com/maps/dir/?api=1&origin=") || !nav.btn || !nav.w.length || !nav.w[0].url.includes("waze.com/ul?ll=")) throw new Error("phone nav links: " + JSON.stringify(nav).slice(0, 400));
  if (nav.g.some(p => (p.url.match(/%7C/g) || []).length > 8)) throw new Error("too many Google waypoints");
  await page.evaluate(() => { ui.tab = 0; renderAll(); }); await page.waitForTimeout(300);
  const trio = await page.evaluate(() => ({ rows: document.querySelectorAll("#details .stop").length, trio: document.querySelectorAll("#details .stop .trioset .avi").length, lay: ui.lay }));
  ok(trio.rows > 0 && trio.trio === trio.rows * ["fuel","stay","food","sights"].filter(c => trio.lay[c]).length, "fuel/food/bed icons on every stop: " + JSON.stringify(trio));
  if (process.env.SHOT) { await page.evaluate(() => ui.lay.food = ui.lay.fuel = ui.lay.stay = true); await page.evaluate(() => renderAll()); const el = await page.$("#details ol.stops"); if (el) await el.screenshot({ path: process.env.SHOT }); }
  await page.evaluate(() => { ui.tab = "ov"; renderAll(); });
  const ov = await page.evaluate(() => { ui.lay.stay = true; ui.lay.fuel = true; ui.tab = "ov"; renderAll(); const b = document.querySelector("[data-ovav]"); if (!b) return { btn: false }; b.click(); return { btn: true, tab: ui.tab, list: !!document.querySelector(".ovlist"), rows: document.querySelectorAll(".ovrows li").length, pins: document.querySelectorAll(".numpin").length }; });
  ok(!ov.btn || (ov.tab === "ov" && ov.list), "overview icon list: " + JSON.stringify(ov));
  console.log("overview icons:", JSON.stringify(ov));
  await page.evaluate(() => { ovFocus = null; renderAll(); });
  console.log("phone nav:", nav.g.length, "google part(s),", nav.w.length, "waze stops; first:", nav.g[0].url.slice(0, 160));
  const sh = await page.evaluate(async () => { renderDetails(); const btns = document.querySelectorAll("[data-sharetrip]").length; const f = window.fetch; let sent = null;
    window.fetch = (u, o) => { if (String(u) === "/api/share") { sent = JSON.parse(o.body); return Promise.resolve(new Response('{"id":"abc23xyz"}', { status: 200 })); } return f(u, o); };
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    localStorage.setItem("otm-myname", "Sam");
    await shareTrip(); window.fetch = f; return { btns, days: sent && sent.trip.days.length, toast: document.getElementById("toast").textContent, text: shareText("x") }; });
  ok(sh.btns >= 1 && sh.days >= 2 && sh.toast.includes("/?s=abc23xyz") && sh.text.startsWith("Sam thought you might like this trip"), "share link: " + JSON.stringify(sh));
  console.log("share:", JSON.stringify(sh).slice(0, 160));
  await page.evaluate(() => { Object.keys(trip).forEach(x => delete trip[x]); Object.assign(trip, { startDate: tomorrow, endDate: addDays(tomorrow, 1), start: pt("Cape Town", -33.925, 18.424), end: pt("Upington", -28.448, 21.256), round: false, sugV: 5, days: [{ to: null, style: "default", vias: [], legs: [] }, { to: null, style: "default", vias: [], legs: [] }] }); plan = null; changed(); });
  await page.waitForFunction(() => trip.days[0].to && plan && !planStale && plan.days.filter(Boolean).length === 2, null, { timeout: 30000 }).catch(() => {});
  const nt = await page.evaluate(() => ({ night: trip.days[0].to && trip.days[0].to.name, auto: !!(trip.days[0].to && trip.days[0].to.autoNight), days: plan ? plan.days.filter(Boolean).map(d => Math.round(d.km)) : null }));
  ok(nt.night && nt.auto && nt.days && nt.days.length === 2, "auto night stop: " + JSON.stringify(nt));
  console.log("auto night:", JSON.stringify(nt));
  // shrink to 1 day and back to 2: a night must be picked again, with no leftover stop
  await page.evaluate(() => { trip.endDate = trip.startDate; changed(); });
  await page.waitForTimeout(500);
  await page.evaluate(() => { trip.endDate = addDays(trip.startDate, 1); changed(); });
  await page.waitForFunction(() => trip.days.length === 2 && trip.days[0].to && plan && !planStale, null, { timeout: 30000 }).catch(() => {});
  const nt2 = await page.evaluate(() => ({ night: trip.days[0].to && trip.days[0].to.name, vias: trip.days.map(d => d.vias.length) }));
  ok(nt2.night && nt2.vias.every(v => v === 0), "night after 2>1>2 days: " + JSON.stringify(nt2));
  // From box: pick twice in a row (the box is wired once)
  for (const q of ["Clanwilliam", "Calvinia"]) {
    await page.focus("#startPlace"); await page.fill("#startPlace", q);
    await page.waitForSelector("#startPlace ~ .sugg button, .ac:has(#startPlace) .sugg button", { timeout: 8000 }).catch(() => {});
    const b = await page.$(".ac:has(#startPlace) .sugg button"); if (b) await b.dispatchEvent("mousedown");
    await page.waitForTimeout(400);
    const nm = await page.evaluate(() => trip.start && trip.start.name);
    ok(nm === q, "From pick " + q + " gave " + nm);
  }
  await page.evaluate(() => tryRoute());
  await page.waitForFunction(() => trip.pick === "swartberg-loop", null, { timeout: 8000 }).catch(() => {});
  const tr = await page.evaluate(() => ({ pick: trip.pick, hero: !!document.querySelector(".hero [data-tryroute]"), welcome: !!document.querySelector("#welcome [data-tryroute]") }));
  ok(tr.pick === "swartberg-loop" && tr.hero && tr.welcome, "Try a route: " + JSON.stringify(tr));
  console.log("try a route:", JSON.stringify(tr));
  const dw = await page.evaluate(() => { const k = nDays() - 1, before = trip.days[k].vias.length; drawStart(); drawLine = true; drawAdd({ latlng: { lat: -33.2, lng: 18.9 } }); drawLine = false; drawAdd({ latlng: { lat: -33.0, lng: 19.0 } });
    const d = trip.days[k], r = { added: d.vias.length - before, straight: !!d.vias.find(v => v.drawn && v.straight), road: d.vias.filter(v => v.drawn).length === 2 && !d.vias.filter(v => v.drawn)[1].straight }; drawUndo(); drawUndo(); r.undone = d.vias.length === before; drawStop(); return r; });
  ok(dw.added === 2 && dw.straight && dw.road && dw.undone, "draw mode: " + JSON.stringify(dw));
  console.log("draw:", JSON.stringify(dw));
  await browser.close(); srv.close();
  if (fails.length) { console.error("SMOKE TEST FAILED:\n - " + fails.join("\n - ")); process.exit(1); }
  console.log(`smoke test passed (fuel pill: "${title}")`);
})().catch(e => { console.error("SMOKE TEST CRASHED:", e.message); process.exit(1); });
