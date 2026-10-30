// Builds server/home-airports.js: the airports a visitor is likely to fly FROM (the main hubs in src/js/03-trip.js plus every
// large airport), for /api/where. Run after make-airports.mjs: node scripts/make-home-airports.mjs
import fs from "fs"; import path from "path";
const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const air = JSON.parse(fs.readFileSync(path.join(ROOT, "data/airports.json"), "utf8"));
const hub = fs.readFileSync(path.join(ROOT, "src/js/03-trip.js"), "utf8").match(/var HUB = "([A-Z ]+)"/)[1].split(" ");
const out = air.filter(a => hub.includes(a[0]) || a[4]).map(a => [a[0], a[1], a[2], a[3], hub.includes(a[0]) ? 1 : 0]);
fs.writeFileSync(path.join(ROOT, "server/home-airports.js"), "// made by scripts/make-home-airports.mjs: [IATA, name, lat, lon, main hub 1/0]\nexport default " + JSON.stringify(out) + ";\n");
console.log(out.length, "airports,", out.filter(a => a[4]).length, "hubs");
