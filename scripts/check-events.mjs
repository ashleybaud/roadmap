// Weekly check: opens each event's source page and looks for the event's dates in the text.
// Writes reports/events-check.md. Exit 0 always; the workflow turns mismatches into an issue.
import fs from "fs";
const list = JSON.parse(fs.readFileSync("data/events/events.json", "utf8"));
const today = new Date().toISOString().slice(0, 10);
const MON = ["january","february","march","april","may","june","july","august","september","october","november","december"];
function forms(iso) { const [y, m, d] = iso.split("-").map(Number), n = MON[m - 1], s = n.slice(0, 3); return [`${d} ${n}`, `${n} ${d}`, `${d} ${s}`, `${s} ${d}`, `${d}th ${n}`, `${d}. ${n}`, iso, `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`, `${d}/${m}/${y}`]; }
const txt = h => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/\s+/g, " ").toLowerCase();
const rows = [];
for (const e of list.filter(e => e.end >= today)) {
  const url = e.source || e.url; let status = "ok", note = "";
  try {
    const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 OneTrackMindEventCheck" }, signal: AbortSignal.timeout(25000), redirect: "follow" });
    if (!r.ok) { status = "unreachable"; note = "HTTP " + r.status; }
    else { const t = txt(await r.text()); const hit = forms(e.start).some(f => t.includes(f)) ; const hitEnd = forms(e.end).some(f => t.includes(f)); if (!hit && !hitEnd) { status = "not-found"; note = "start/end date text not on the page (may be a script-built page)"; } }
  } catch (err) { status = "unreachable"; note = String(err.message || err).slice(0, 80); }
  rows.push({ e, status, note });
}
const bad = rows.filter(r => r.status !== "ok");
let md = `# Events check ${today}\n\n${rows.length} upcoming events checked, ${bad.length} need a look.\n\n`;
bad.forEach(r => md += `- **${r.e.name}** (${r.e.start} to ${r.e.end}): ${r.status}. ${r.note} [source](${r.e.source || r.e.url})\n`);
fs.mkdirSync("reports", { recursive: true }); fs.writeFileSync("reports/events-check.md", md); console.log(md);
