// Prints src/page.html with the shared menu and house styles filled in (used by build.sh).
const fs = require("fs"), path = require("path"), ROOT = path.join(__dirname, ".."), H = require(path.join(ROOT, "src/js/02-house.js"));
process.stdout.write(fs.readFileSync(path.join(ROOT, "src/page.html"), "utf8")
  .replace("<!--NAV-->", H.nav("/plan/").replace('id="sitenav"', 'id="sitenav" style="order:9"'))
  .replace("/*HOUSE_CSS*/", fs.readFileSync(path.join(ROOT, "src/house.css"), "utf8")));
