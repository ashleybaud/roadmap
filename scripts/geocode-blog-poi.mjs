// One-off/occasional: looks up the place behind each blog post that is about a single place (Photon, OpenStreetMap)
// and writes data/blog-poi.json { "<series name>": {name, lat, lon} }. Posts already in the file keep their place.
import fs from "fs";
const Q = {
  "2014-09 Kalahari SpeedWeek": "Hakskeenpan",
  "2018-05 Speedweek": "Hakskeenpan",
  "Lesotho 2016": "Maseru",
  "2019-06 RedBull Cape Town Circuit": "Green Point Cape Town",
  "2019-03 MotoGP-Qatar": "Lusail International Circuit",
  "2016-06 Franschoek Motor Museum": "Franschhoek Motor Museum",
  "2023-03 WPMC @ Killarney": "Killarney Raceway",
  "2018-05 Simola Hill Climb": "Simola Knysna",
  "2016-06 Port Elizabeth enduros": "Gqeberha",
};
const out = (() => { try { return JSON.parse(fs.readFileSync("data/blog-poi.json", "utf8")); } catch (e) { return {}; } })();
for (const [series, q] of Object.entries(Q)) {
  if (out[series]) continue;
  const r = await fetch("https://photon.komoot.io/api/?limit=1&lat=-33.9&lon=18.6&location_bias_scale=0.5&q=" + encodeURIComponent(q), { headers: { "user-agent": "OneTrackMind blog places" } });
  const j = await r.json(); const f = j.features && j.features[0];
  if (!f) { console.log("not found:", q); continue; }
  const [lon, lat] = f.geometry.coordinates, p = f.properties;
  out[series] = { name: q.replace(/ Cape Town$| Knysna$/, ""), lat: +lat.toFixed(5), lon: +lon.toFixed(5), found: [p.name, p.city || p.county || "", p.country || ""].filter(Boolean).join(", ") };
  console.log(series, "→", out[series].found, lat, lon);
  await new Promise(r => setTimeout(r, 1100));
}
fs.writeFileSync("data/blog-poi.json", JSON.stringify(out, null, 1));
