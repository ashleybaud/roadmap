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
    all.set(e.id, Object.assign({ category: "festival", tickets: "", confirmed: true }, e, { checked: e.checked || new Date().toISOString().slice(0, 10) }));
  }
}
const list = [...all.values()].sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name));
fs.writeFileSync(out, JSON.stringify(list, null, 1));
console.log(`events.json: ${list.length} events (${bad} rejected)`);
