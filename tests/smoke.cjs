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

const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const TRIP = {
  startDate: day(1), endDate: day(2), round: false, sugV: 4,
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
    if (u.includes("api.stadiamaps.com/route")) return route.fulfill({ contentType: "application/json", body: JSON.stringify(fakeRoute(JSON.parse(route.request().postData()))) });
    if (leafletDir && /unpkg\.com\/leaflet@[\d.]+\/dist\/(.+)$/.test(u)) { const f = path.join(leafletDir, u.match(/dist\/(.+)$/)[1]); if (fs.existsSync(f)) return route.fulfill({ path: f }); }
    if (u.includes("unpkg.com/leaflet")) return route.continue();
    return route.abort();
  });
  await page.addInitScript(t => { if (!sessionStorage.getItem("seeded")) { localStorage.clear(); localStorage.setItem("rr4-trip", t); sessionStorage.setItem("seeded", "1"); } }, JSON.stringify(TRIP));
  await page.goto(base);
  const ok = (c, m) => { if (!c) fails.push(m); };
  await page.waitForFunction(() => typeof plan !== "undefined" && plan && !planStale && plan.days.filter(Boolean).length === 2, null, { timeout: 30000 }).catch(() => fails.push("route not worked out"));
  await page.waitForFunction(() => placesOk && typeof townList !== "undefined" && townList, null, { timeout: 30000 }).catch(() => fails.push("places/towns not loaded"));
  await page.waitForTimeout(1500);

  ok(await page.$$eval("#iconbar .ib", b => b.length) === 6, "map buttons missing");
  ok(await page.$$eval(".sumbox", b => b.length) >= 2, "overview day boxes missing");
  ok(await page.$$eval(".sumbox .wmin", b => b.length) === 0, "fuel warning text shown on overview");

  await page.click('[data-day="0"]'); await page.waitForTimeout(500);
  ok(await page.$$eval("ol.stops li", b => b.length) >= 2, "day stop list missing");
  const title = await page.$eval(".fbtn", b => b.title).catch(() => "");
  ok(/fuel stops? en route/.test(title), "fuel pill hover text wrong: " + title);

  await page.click('[data-legsty="0:1"]');
  await page.waitForFunction(() => trip.days[0].vias[0].fast === true && !planStale, null, { timeout: 15000 }).catch(() => fails.push("way choice per stretch not saved"));

  await page.click('[data-lay="med"]');
  ok(await page.$eval('[data-lay="med"]', b => b.classList.contains("on")), "map button did not toggle");

  await page.click('[data-day="1"]'); await page.waitForTimeout(500);
  ok(await page.$$eval("ol.stops li", b => b.length) >= 2, "second day stop list missing");

  ok(errors.length === 0, "page errors: " + errors.join(" | "));
  await browser.close(); srv.close();
  if (fails.length) { console.error("SMOKE TEST FAILED:\n - " + fails.join("\n - ")); process.exit(1); }
  console.log(`smoke test passed (fuel pill: "${title}")`);
})().catch(e => { console.error("SMOKE TEST CRASHED:", e.message); process.exit(1); });
