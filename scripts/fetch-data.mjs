// Builds the app's own copy of OpenStreetMap places, one folder per country.
// Run by GitHub Actions each month so the site never waits on busy public servers.
import { mkdir, writeFile } from "node:fs/promises";

const COUNTRIES = { za: "ZA", na: "NA" };
// ONLY=med,ford limits a run to those sets (others keep their previous copies)
const ONLY = (process.env.ONLY || "").split(",").filter(Boolean);
const SERVERS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];
const KINDS = {
  fuel:  `nwr[amenity=fuel]`,
  towns: `node[place~"^(city|town|village|hamlet)$"][name]`,
  view:  `nwr[tourism=viewpoint][name]`,
  pass:  `node[mountain_pass=yes][name]`,
  sight: `nwr[tourism~"^(attraction|museum)$"][name];nwr[historic~"^(monument|ruins|archaeological_site|memorial|castle|fort)$"][name]`,
  food:  `nwr[amenity~"^(restaurant|cafe|pub|fast_food)$"][name]`,
  camp:  `nwr[tourism=camp_site][name]`,
  sleep: `nwr[tourism~"^(hotel|guest_house|hostel|chalet|motel|apartment)$"][name]`,
  med:   `nwr[amenity~"^(hospital|clinic)$"]`,
  ford:  `nwr[ford=yes]`,
  shop:  `nwr[shop~"^(convenience|supermarket|general|kiosk)$"]`,
  toilets: `nwr[amenity=toilets]`,
  cash:  `nwr[amenity=atm];nwr[amenity=bank][atm=yes]`,
  repair: `nwr[shop~"^(tyres|motorcycle|motorcycle_repair|car_repair)$"];nwr[craft=mechanic]`,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function query(q) {
  for (let round = 0; round < 4; round++) {
    for (const url of SERVERS) {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 300000);
      try {
        const r = await fetch(url, {
          method: "POST",
          body: "data=" + encodeURIComponent(q),
          signal: ctl.signal,
          headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "RouteAndRange-data/1.0 (+https://routeandrange.pages.dev)" },
        });
        const text = await r.text();
        if (r.ok && text.trim().startsWith("{")) {
          const j = JSON.parse(text);
          if (j.remark && /error|timed out|out of memory/i.test(j.remark)) { console.log(`  ${url} -> ${j.remark.slice(0, 80)}`); continue; }
          if ((j.elements || []).length) return j.elements;
          console.log(`  ${url} -> empty answer`);
          continue;
        }
        console.log(`  ${url} -> ${r.status}`);
      } catch (e) {
        console.log(`  ${url} -> ${e.name}`);
      } finally {
        clearTimeout(t);
      }
    }
    await sleep(60000);
  }
  throw new Error("all servers failed");
}

function row(e, kind) {
  const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
  if (lat == null) return null;
  const t = e.tags || {};
  const out = [+lat.toFixed(5), +lon.toFixed(5), t.name || t.brand || ""];
  if (kind === "towns") out.push(t.place || "", t["is_in:state"] || t["addr:state"] || "");
  const contact = () => [t.phone || t["contact:phone"] || "", t.website || t["contact:website"] || "", t.email || t["contact:email"] || ""];
  if (kind === "sleep" || kind === "camp") out.push(t.tourism || t.amenity || "", ...contact());
  // places riders stop at: type, contact, opening hours, extra (fuel grades, toilets)
  if (["fuel", "food", "shop", "toilets", "cash", "repair"].includes(kind)) {
    let extra = "";
    if (kind === "fuel") {
      const g = [];
      if (t["fuel:octane_93"] === "yes") g.push("93");
      if (t["fuel:octane_95"] === "yes") g.push("95");
      if (t["fuel:diesel"] === "yes" || t["fuel:50"] === "yes" || t["fuel:500"] === "yes") g.push("D");
      if (t.toilets === "yes") g.push("T");
      if (t.shop && t.shop !== "no") g.push("S");
      extra = g.join(" ");
    }
    if (kind === "toilets" && t.fee) extra = t.fee === "yes" ? "fee" : "";
    out.push(t.amenity || t.shop || t.craft || "", ...contact(), t.opening_hours || "", extra);
    while (out.length > 3 && out[out.length - 1] === "") out.pop();
  }
  if (kind === "med") out.push(t.amenity || "", t.phone || t["contact:phone"] || "");
  return out;
}

let failed = 0;
for (const [cc, iso] of Object.entries(COUNTRIES)) {
  await mkdir(`data/${cc}`, { recursive: true });
  for (const [kind, sel] of Object.entries(KINDS)) {
    if (ONLY.length && !ONLY.includes(kind)) continue;
    const parts = sel.split(";").map((s) => `${s}(area.a);`).join("");
    const q = `[out:json][timeout:280];area["ISO3166-1"="${iso}"][admin_level=2]->.a;(${parts});out center tags;`;
    console.log(`${cc} ${kind}`);
    try {
      const els = await query(q);
      const rows = els.map((e) => row(e, kind)).filter(Boolean);
      await writeFile(`data/${cc}/${kind}.json`, JSON.stringify(rows));
      console.log(`  ${rows.length} places`);
    } catch (e) {
      failed++;
      console.log(`  skipped: ${e.message}`);
    }
    await sleep(5000);
  }
}
await writeFile("data/updated.json", JSON.stringify({ updated: new Date().toISOString() }));
if (failed) console.log(`${failed} sets failed; kept previous copies`);
