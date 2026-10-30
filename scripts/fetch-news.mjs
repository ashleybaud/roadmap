// Daily: the latest headlines for the races coming up, from Motorsport.com's public RSS feeds.
// Headline and the feed's own short summary, word for word, with the source and a link. Nothing is rewritten or summarised by us.
// A headline goes with an event when it names the event's place (city, venue, country or the race's own name),
// otherwise the series' newest headlines go with that series' next event (within two weeks).
// Writes data/events/news.json: { eventId: [{ title, summary, url, source, date }] }
// Usage: node scripts/fetch-news.mjs [--today 2026-11-02]
import fs from "fs"; import path from "path";
const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const today = arg("today", new Date().toISOString().slice(0, 10));
const add = (s, n) => { const d = new Date(s + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const EV = JSON.parse(fs.readFileSync(path.join(ROOT, "data/events/events.json"), "utf8"));
const MS = "https://www.motorsport.com/rss/";
const FEEDS = { f1: "f1/news/", motogp: "motogp/news/", superbike: "category/bikes/news/", roadrace: "category/bikes/news/", mx: "category/bikes/news/", nascar: "nascar-cup/news/", indycar: "indycar/news/", endurance: "wec/news/", rally: "category/rally/news/", offroad: "category/rally/news/" };
const decode = s => String(s || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;|&#8217;|&rsquo;/g, "'").replace(/&#8216;|&lsquo;/g, "'").replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"').replace(/&#8211;|&ndash;/g, "–").replace(/&#8212;|&mdash;/g, "—").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const tag = (x, t) => { const m = x.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`, "i")); return m ? decode(m[1]) : ""; };
// the feed's own summary, cut at a sentence end so it isn't chopped mid-word
const excerpt = s => { if (s.length <= 220) return s; const t = s.slice(0, 220), p = Math.max(t.lastIndexOf(". "), t.lastIndexOf("? "), t.lastIndexOf("! ")); return p > 80 ? t.slice(0, p + 1) : t.slice(0, t.lastIndexOf(" ")) + "…"; };
async function feed(u) {
  try {
    const r = await fetch(MS + u, { headers: { "User-Agent": "OneTrackMind headlines (onetrackmind.online)" }, signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(r.status);
    return [...(await r.text()).matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => ({ title: tag(m[1], "title"), url: tag(m[1], "link"), summary: excerpt(tag(m[1], "description")), date: new Date(tag(m[1], "pubDate") || Date.now()).toISOString().slice(0, 10), source: "Motorsport.com" })).filter(x => x.title && /^https?:\/\//.test(x.url));
  } catch (e) { console.log("feed failed", u, e.message); return []; }
}
const words = e => [e.city, e.venue, e.country, ...e.name.replace(/\(.*?\)/g, "").split(/[:·,]/)].filter(Boolean).map(w => w.replace(/\b(grand prix|gp|round|motogp|wec|wrc|nascar cup|indycar|international|circuit|raceway|speedway|motor|20\d\d)\b/gi, "").trim()).filter(w => w.length >= 4);
const soon = EV.filter(e => e.start <= add(today, 45) && e.end >= today && FEEDS[e.genre]);
const out = {}, cache = {};
for (const e of soon) {
  const u = FEEDS[e.genre]; if (!cache[u]) cache[u] = await feed(u);
  const items = cache[u].filter(x => x.date >= add(today, -10));
  const W = words(e).map(w => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"));
  let hit = items.filter(x => W.some(rx => rx.test(x.title + " " + x.summary)));
  // nothing names the place: the series' newest headlines go with its next event, if that's within two weeks
  const next = soon.filter(x => x.genre === e.genre).sort((a, b) => a.start.localeCompare(b.start))[0];
  if (!hit.length && next && next.id === e.id && e.start <= add(today, 14) && ["f1", "motogp", "nascar", "indycar", "endurance"].includes(e.genre)) hit = items.slice(0, 2);
  if (hit.length) out[e.id] = hit.slice(0, 3);
}
fs.writeFileSync(path.join(ROOT, "data/events/news.json"), JSON.stringify(out, null, 1) + "\n");
console.log(`${Object.keys(out).length} events with headlines, from ${Object.keys(cache).length} feeds`);
