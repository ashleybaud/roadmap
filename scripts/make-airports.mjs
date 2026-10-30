// Builds data/airports.json: the world's big airports with scheduled flights (from OurAirports, public domain).
// Used by the "Make a trip of it" block for the nearest airport to fly into and pick up a hire car.
// Usage: node scripts/make-airports.mjs path/to/airports.csv   (https://github.com/davidmegginson/ourairports-data)
import fs from "fs"; import path from "path";
const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const csv = fs.readFileSync(process.argv[2], "utf8").split("\n");
const cols = l => { const o = []; let c = "", q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === "," && !q) { o.push(c); c = ""; } else c += ch; } o.push(c); return o; };
const H = cols(csv[0]), I = k => H.indexOf(k);
const out = [];
for (const l of csv.slice(1)) { if (!l) continue; const r = cols(l);
  if (!/large_airport|medium_airport/.test(r[I("type")]) || r[I("scheduled_service")] !== "yes" || !/^[A-Z]{3}$/.test(r[I("iata_code")])) continue;
  const name = r[I("name")].replace(/\s*(International|Intl\.?)?\s*Airport$/i, "").replace(/\s+International$/i, "").trim();
  out.push([r[I("iata_code")], name, +(+r[I("latitude_deg")]).toFixed(3), +(+r[I("longitude_deg")]).toFixed(3), r[I("type")] === "large_airport" ? 1 : 0]); }
fs.writeFileSync(path.join(ROOT, "data/airports.json"), JSON.stringify(out));
console.log(out.length, "airports,", out.filter(a => a[4]).length, "large");
