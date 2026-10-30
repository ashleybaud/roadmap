// The founder's year planner: big events with when to start pushing them (4 months before), campaigns, long weekends.
// Usage: node scripts/marketing-calendar.mjs 2027 > reports/marketing-calendar-2027.md
import fs from "fs";
const Y = process.argv[2] || "2027";
const EV = JSON.parse(fs.readFileSync("data/events/events.json", "utf8")), C = JSON.parse(fs.readFileSync("data/campaigns.json", "utf8")).campaigns;
const M = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const add = (s, n) => { const d = new Date(s + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const fd = s => { const d = new Date(s + "T12:00:00Z"); return `${d.getUTCDate()} ${M[d.getUTCMonth()].slice(0, 3)}`; };
const rows = [];
EV.filter(e => e.start.startsWith(Y) && e.tier === 1).forEach(e => { rows.push([add(e.start, -120), `Start pushing **${e.name.replace(/\s*\(.*?\)/g, "")}** (${fd(e.start)}, ${e.city || e.country}): book-ahead post, newsletter, race trip example`]); rows.push([e.start, `🏁 ${e.name.replace(/\s*\(.*?\)/g, "")}${e.confirmed ? "" : " (dates to confirm)"}`]); });
EV.filter(e => e.start.startsWith(Y) && e.country === "South Africa").forEach(e => rows.push([add(e.start, -60), `Home race: start pushing **${e.name}** (${fd(e.start)}): road trip there from Cape Town and Joburg`]));
C.filter(c => c.from.startsWith(Y) || c.to.startsWith(Y)).forEach(c => rows.push([c.from, `Campaign on: **${c.title}**${c.hidden ? " (waiting for affiliate codes)" : ""} until ${fd(c.to)}`]));
rows.sort((a, b) => a[0].localeCompare(b[0]));
let out = `# Marketing calendar ${Y}\n\nBuilt from the events list and data/campaigns.json. Big events get pushed about four months out, home races two months out. Re-run after the events list changes.\n`;
let cur = "";
for (const [d, t] of rows) { if (d.slice(0, 7) !== cur) { cur = d.slice(0, 7); out += `\n## ${M[+cur.slice(5, 7) - 1]} ${cur.slice(0, 4)}\n\n`; } out += `- ${fd(d)}: ${t}\n`; }
process.stdout.write(out);
