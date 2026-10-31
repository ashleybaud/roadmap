// Merges data/events/part-*.json into data/events/events.json (validated, de-duplicated, sorted by start date).
import fs from "fs"; import path from "path";
const D = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "data/events");
const out = path.join(D, "events.json");
const all = new Map();
try { JSON.parse(fs.readFileSync(out, "utf8")).forEach(e => all.set(e.id, e)); } catch (e) {}
const parts = fs.readdirSync(D).filter(f => /^part-.*\.json$/.test(f));
let bad = 0;
for (const f of parts) {
  let arr = []; try { arr = JSON.parse(fs.readFileSync(path.join(D, f), "utf8")); } catch (e) { console.log("skip", f, e.message); continue; }
  for (const e of arr) {
    const ok = e.id && e.name && /^\d{4}-\d\d-\d\d$/.test(e.start || "") && /^\d{4}-\d\d-\d\d$/.test(e.end || "") && e.end >= e.start && typeof e.lat === "number" && typeof e.lon === "number" && /^https:\/\//.test(e.source || e.url || "");
    if (!ok) { bad++; console.log("rejected:", e.id || e.name); continue; }
    all.set(e.id, Object.assign({ category: "festival", tickets: "", confirmed: true }, e, e.tier ? { tierSet: true } : {}, e.genre ? { genreSet: true } : {}, { checked: e.checked || (all.get(e.id) || {}).checked || new Date().toISOString().slice(0, 10) }));
  }
}
// the founder's own tours and Wild Goose Chase rounds (data/founder.json "tours"): dated events like any other, rebuilt from that file every time
for (const [id, e] of all) if (e.founderTour) all.delete(id);
{ let F = {}; try { F = JSON.parse(fs.readFileSync(path.join(D, "..", "founder.json"), "utf8")); } catch (e) {}
  for (const t of F.tours || []) {
    const e = Object.assign({ series: "OneTrackMind", category: "adventure", genre: "adventure", tier: 2, url: "https://onetrackmind.online/blog/my-racing/" }, t, { founderTour: true, confirmed: true, tierSet: true, genreSet: true });
    e.source = e.source || e.url;
    if (e.id && e.name && /^\d{4}-\d\d-\d\d$/.test(e.start || "") && /^\d{4}-\d\d-\d\d$/.test(e.end || e.start) && typeof e.lat === "number" && typeof e.lon === "number") { e.end = e.end || e.start; e.checked = new Date().toISOString().slice(0, 10); all.set(e.id, e); }
    else { bad++; console.log("rejected tour:", t.id || t.name); }
  } }
// the same event added twice from two sources: keep the better one
const DROP = ["24h-kyalami-2027", "imsa-rolex-24-at-daytona-2027", "wec-24-hours-of-le-mans-2027", "rally-finland-2027"];
DROP.forEach(id => all.delete(id));
// how big a deal it is, for the size of its card: 1 = the ones the world knows, 2 = championship rounds and big shows, 3 = the rest
// (an event can set its own "tier" in its part file; that wins)
const ICON = /Monaco Grand Prix|^(WEC )?24 Hours of Le Mans|Indianapolis 500|Isle of Man TT|Goodwood Festival of Speed|Goodwood Revival|^Dakar|Pikes Peak|Daytona 500|Rolex 24 at Daytona|24 Hours of Spa|Macau Grand Prix|^SEMA Show|^EICMA|Pebble Beach|Car Week|24h N(ü|u)rburgring|Bathurst|British Grand Prix|Italian Grand Prix|Las Vegas Grand Prix|1000 Miglia|Twelve Hours of Sebring|Sturgis|Bike Week|Le Mans Classic/i;
const MAJOR_SERIES = ["Formula 1", "MotoGP", "FIA WEC", "WorldSBK", "IndyCar", "NASCAR Cup Series", "WRC", "IMSA WeatherTech", "IMSA WeatherTech SportsCar Championship", "AMA Supercross", "MXGP", "FIM EWC", "AMA Pro Motocross"];
const MAJOR = /Essen Motor Show|R(é|e)tromobile|Kyalami|Simola|Members' Meeting|Silverstone Classic|Barrett-Jackson|IAA Mobility|Motorcycle Live|Southern 100|North West 200|Africa Eco Race|Nürburgring Classic|Cape Grand Prix Revival/i;
for (const e of all.values()) if (!e.tierSet) e.tier = ICON.test(e.name) ? 1 : MAJOR_SERIES.includes(e.series) || MAJOR.test(e.name) ? 2 : 3;
// genre: what kind of racing (or not racing), for the tags on the cards and the filters riders save
const GENRE = e => { const x = e.series + " " + e.name;
  if (e.series === "Formula 1") return "f1";
  if (e.series === "MotoGP") return "motogp";
  if (/WorldSBK|FIM EWC/.test(e.series)) return "superbike";
  if (/NASCAR/.test(e.series)) return "nascar";
  if (/IndyCar/.test(e.series)) return "indycar";
  if (/WRC/.test(e.series)) return "rally";
  if (/Dakar|Africa Eco Race/.test(x)) return "offroad";
  if (/Supercross|Motocross|MXGP/.test(x)) return "mx";
  if (/Hill ?climb|Pikes Peak/i.test(x)) return "hillclimb";
  if (/Isle of Man TT|Road Races|Southern 100|North West 200|Macau/i.test(x)) return "roadrace";
  if (/Time Attack|GRIDLIFE/i.test(x)) return "timeattack";
  if (/WEC|IMSA|24H|24h|GT World|Intercontinental|Endurance|Nine Hour|12 Hour|Le Mans(?! Classic)/.test(x)) return "endurance";
  if (/SEMA|EICMA|Essen Motor Show|IAA|Motorcycle Live|Motor Bike Expo|Show(?! 20)/i.test(x) && !/Classic/i.test(x)) return "shows";
  if (/Bike Week|Sturgis/i.test(x)) return "bikefest";
  return "classics"; };
for (const e of all.values()) if (!e.genreSet) e.genre = GENRE(e);
const list = [...all.values()].sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name));
fs.writeFileSync(out, JSON.stringify(list, null, 1));
console.log(`events.json: ${list.length} events (${bad} rejected)`);
