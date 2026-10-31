// Prints src/page.html with the shared menu and house styles filled in (used by build.sh).
const fs = require("fs"), path = require("path"), ROOT = path.join(__dirname, ".."), H = require(path.join(ROOT, "src/js/02-house.js"));
// Mates: hidden (menu and footer) until data/founder.json has 5 entries
let M = {}; try { M = (JSON.parse(fs.readFileSync(path.join(ROOT, "data/founder.json"), "utf8")).mates) || {}; } catch (e) {}
const MATES = ["places", "people", "media", "clubs", "workshops"].flatMap(k => (M[k] || []).filter(x => x && x.name && x.url));
if (MATES.length < 5) H.HIDE.push("/about/mates/");
const ESC = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const MATES_FOOT = MATES.length < 5 ? "" : `<p class="matesfoot">Mates: ${MATES.filter(x => x.top).sort((a, b) => a.top - b.top).concat(MATES.filter(x => !x.top)).slice(0, 6).map(x => `<a href="${ESC(x.url)}" target="_blank" rel="noopener${x.sponsored ? " sponsored" : ""}">${ESC(x.name)}</a>`).join(" · ")} · <a href="/about/mates/">All my mates ›</a></p>`;
process.stdout.write(fs.readFileSync(path.join(ROOT, "src/page.html"), "utf8")
  .replace("<!--NAV-->", H.nav("/plan/").replace('id="sitenav"', 'id="sitenav" style="order:9"'))
  .replace("<!--MATES-->", MATES_FOOT)
  .replace("/*HOUSE_CSS*/", fs.readFileSync(path.join(ROOT, "src/house.css"), "utf8")));
