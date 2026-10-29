// Results sniffer: after each race weekend, finds the official results and writes data/events/results.json.
// Rule: a winner is only printed when it comes from an official data feed or the founder typed it in (data/events/results-manual.json).
// Everything else gets a "results are in" link to the official results page, once that page has changed since the race.
//   Formula 1: the Jolpica feed (the open Ergast successor that F1 timing sites use) gives the podium.
//   Other series: the official results page in watch.json (or the event's own site) is fetched; when its content has changed
//   since the race ended, the link is marked fresh. No winner is guessed from page text.
// Usage: node scripts/sniff-results.mjs [--today 2026-11-10] [--days 21]
import fs from "fs"; import path from "path"; import crypto from "crypto";
const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const J = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8")); } catch (e) { return d; } };
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const EV = J("data/events/events.json", []), WATCH = J("data/events/watch.json", {});
const OUT = "data/events/results.json", out = J(OUT, {}), MANUAL = J("data/events/results-manual.json", {});
const today = arg("today", new Date().toISOString().slice(0, 10)), DAYS = +arg("days", 21);
const add = (s, n) => { const d = new Date(s + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const UA = { "User-Agent": "OneTrackMind results check (onetrackmind.online)" };
const get = async (url, as = "text") => { const r = await fetch(url, { headers: UA, redirect: "follow", signal: AbortSignal.timeout(20000) }); if (!r.ok) throw new Error(`${r.status} ${url}`); return as === "json" ? r.json() : r.text(); };
const strip = h => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const hash = s => crypto.createHash("sha1").update(s).digest("hex").slice(0, 16);
const days = (a, b) => Math.abs((new Date(a) - new Date(b)) / 864e5);

// only racing finished in the window; shows and festivals have no results
const done = EV.filter(e => e.end < today && e.end >= add(today, -DAYS) && WATCH[e.series] && e.category !== "festival");
const log = [];

// Formula 1 from the feed, one call per season
const f1 = {};
async function f1Season(y) {
  if (f1[y]) return f1[y];
  try { const j = await get(`https://api.jolpi.ca/ergast/f1/${y}/results/?limit=100`, "json"); f1[y] = (j.MRData.RaceTable.Races || []); }
  catch (e) { log.push(`F1 feed unavailable: ${e.message}`); f1[y] = []; }
  // the feed pages results (about 20 rows per race); fetch per round if a race came back short
  return f1[y];
}
async function f1Podium(e) {
  const races = await f1Season(e.end.slice(0, 4));
  let race = races.find(r => days(r.date, e.end) <= 1);
  if (!race) return null;
  if (!race.Results || race.Results.length < 3) {
    try { const j = await get(`https://api.jolpi.ca/ergast/f1/${race.season}/${race.round}/results/`, "json"); race = j.MRData.RaceTable.Races[0] || race; } catch (err) { return null; }
  }
  const top = (race.Results || []).filter(x => ["1", "2", "3"].includes(String(x.position))).sort((a, b) => a.position - b.position);
  if (top.length < 3) return null;
  return { podium: top.map(x => `${x.Driver.givenName} ${x.Driver.familyName} (${x.Constructor.name})`), source: (WATCH["Formula 1"] || {}).results || "https://www.formula1.com/en/results", via: "feed" };
}

for (const e of done) {
  const have = out[e.id] || {};
  if (MANUAL[e.id] && MANUAL[e.id].podium) { out[e.id] = { ...MANUAL[e.id], via: "founder", checked: today }; log.push(`${e.name}: podium typed in by the founder`); continue; }
  if (have.podium) continue; // settled
  if (e.series === "Formula 1") {
    const p = await f1Podium(e);
    if (p) { out[e.id] = { ...p, checked: today }; log.push(`${e.name}: podium from the F1 feed, ${p.podium[0]} won`); continue; }
  }
  const link = (WATCH[e.series] || {}).results || e.url;
  if (!link) { log.push(`${e.name}: no results page known`); continue; }
  try {
    const h = hash(strip(await get(link)));
    // first look after the race stores the page; a later change means results have been posted
    const fresh = !!(have.hash && have.hash !== h) || !!have.fresh;
    out[e.id] = { link, hash: h, first: have.first || today, fresh, checked: today };
    log.push(`${e.name}: ${fresh ? "results page updated" : "results page saved, waiting for it to change"}`);
  } catch (err) { out[e.id] = { ...have, link, checked: today, error: String(err.message).slice(0, 80) }; log.push(`${e.name}: couldn't open the results page (${err.message})`); }
}

// before the weekend: save how each results page looks now, so after the race any change shows the results are up
const soon = EV.filter(e => e.end >= today && e.start <= add(today, 3) && WATCH[e.series] && e.category !== "festival" && !(out[e.id] || {}).hash);
for (const e of soon) {
  const link = (WATCH[e.series] || {}).results || e.url; if (!link) continue;
  try { out[e.id] = { link, hash: hash(strip(await get(link))), first: today, fresh: false, checked: today }; log.push(`${e.name}: results page saved before the race`); }
  catch (err) { log.push(`${e.name}: couldn't open the results page before the race (${err.message})`); }
}

// keep the file small: drop entries for events more than a year old
const keep = new Set(EV.filter(e => e.end >= add(today, -370)).map(e => e.id));
for (const k of Object.keys(out)) if (!keep.has(k)) delete out[k];
fs.writeFileSync(path.join(ROOT, OUT), JSON.stringify(out, null, 1) + "\n");
fs.mkdirSync(path.join(ROOT, "reports"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "reports/results-sniff.md"), `# Results check ${today}\n\n${done.length} races finished in the last ${DAYS} days.\n\n${log.map(l => "- " + l).join("\n") || "- nothing to do"}\n`);
console.log(`${done.length} races checked\n` + log.join("\n"));
