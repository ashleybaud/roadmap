// The real road line for each picked trip, for the maps on the blog trip pages. Runs on GitHub (routers reachable there).
// Writes data/picks/lines.json: { routeId: [[lat,lon],...] } (thinned to ~250 m). Keeps lines already there unless the stops changed.
import fs from "node:fs"; import path from "node:path";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const routes = JSON.parse(fs.readFileSync(path.join(ROOT, "data/picks/picks.json"), "utf8")).routes.filter(r => !r.draft);
const OUT = path.join(ROOT, "data/picks/lines.json");
const old = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ll = p => `${p.lon.toFixed(5)},${p.lat.toFixed(5)}`;
async function leg(pts, style) {
  const prof = style === "tar" || style === "fast" ? "car-fast" : "car-vario";
  for (let t = 0; t < 3; t++) {
    try {
      const r = await fetch(`https://brouter.de/brouter?lonlats=${pts.map(ll).join("|")}&profile=${prof}&alternativeidx=0&format=geojson`);
      const s = await r.text(); if (!s.startsWith("{")) throw new Error(s.slice(0, 80));
      return JSON.parse(s).features[0].geometry.coordinates.map(([lo, la]) => [la, lo]);
    } catch (e) { console.log("brouter", e.message); await sleep(3000); }
  }
  const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${pts.map(ll).join(";")}?overview=full&geometries=geojson`);
  const j = await r.json(); if (j.code !== "Ok") throw new Error("osrm " + j.code);
  return j.routes[0].geometry.coordinates.map(([lo, la]) => [la, lo]);
}
const km = (a, b) => { const R = 6371, d = x => x * Math.PI / 180, dl = d(b[0] - a[0]), dn = d(b[1] - a[1]); return 2 * R * Math.asin(Math.sqrt(Math.sin(dl / 2) ** 2 + Math.cos(d(a[0])) * Math.cos(d(b[0])) * Math.sin(dn / 2) ** 2)); };
const out = {};
for (const r of routes) {
  const t = r.trip, sig = JSON.stringify([t.start, t.end, t.round, t.days.map(d => [d.vias, d.to, d.style])]);
  if (old[r.id] && old[r.id].sig === sig) { out[r.id] = old[r.id]; continue; }
  let at = t.start, line = [];
  try {
    for (const [i, d] of t.days.entries()) {
      const last = i === t.days.length - 1, to = d.to || (last ? (t.round ? t.start : t.end) : null);
      const pts = [at, ...(d.vias || []), ...(to ? [to] : [])].filter(p => p && p.lat != null);
      if (pts.length > 1) { line.push(...await leg(pts, d.style || r.style || "rough")); await sleep(1500); }
      if (to) at = to;
    }
    const thin = []; for (const p of line) if (!thin.length || km(thin[thin.length - 1], p) > 0.25) thin.push([+p[0].toFixed(4), +p[1].toFixed(4)]);
    out[r.id] = { sig, line: thin }; console.log(r.id, thin.length, "points");
  } catch (e) { console.log("FAILED", r.id, e.message); if (old[r.id]) out[r.id] = old[r.id]; }
}
fs.writeFileSync(OUT, JSON.stringify(out));
