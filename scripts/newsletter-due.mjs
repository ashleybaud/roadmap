// Which issues to build for a given Monday: weekly every week, fortnightly on even ISO weeks, monthly on the first Monday of the month.
// Usage: node scripts/newsletter-due.mjs [2026-11-02]  -> prints e.g. "weekly fortnightly"
const d = process.argv[2] ? new Date(process.argv[2] + "T12:00:00Z") : (() => { const x = new Date(); x.setUTCDate(x.getUTCDate() + ((8 - x.getUTCDay()) % 7 || 7)); return x; })();
const isoWeek = x => { const t = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate())); t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7)); return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7); };
const out = ["weekly"]; if (isoWeek(d) % 2 === 0) out.push("fortnightly"); if (d.getUTCDate() <= 7) out.push("monthly");
console.log(d.toISOString().slice(0, 10), out.join(" "));
