// One-off: copy the photos the blog uses from the old WordPress site into media/blog/, shrunk for the web.
// Runs on GitHub (the old host is reachable there). Skips files already copied.
import fs from "node:fs"; import path from "node:path"; import { execFileSync } from "node:child_process";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const t = fs.readFileSync(path.join(ROOT, "data/stories/stories.json"), "utf8");
const re = /https?:\/\/(?:www\.)?onetrackmind\.co\.za\/wp-content\/uploads\/([^"\s\\]+)/g;
const rel = [...new Set([...t.matchAll(re)].map(m => decodeURIComponent(m[1])))];
let ok = 0, skip = 0, bad = [];
for (const r of rel) {
  const out = path.join(ROOT, "media/blog", r);
  if (fs.existsSync(out)) { skip++; continue; }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  try {
    const res = await fetch("https://onetrackmind.co.za/wp-content/uploads/" + r.split("/").map(encodeURIComponent).join("/"), { headers: { "user-agent": "Mozilla/5.0 OneTrackMind media move" } });
    if (!res.ok) throw new Error("HTTP " + res.status);
    fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
    if (/\.(jpe?g|png|webp)$/i.test(out)) execFileSync("mogrify", ["-auto-orient", "-resize", "1600x1600>", "-strip", "-quality", "80", out]);
    ok++;
  } catch (e) { bad.push(r + " " + e.message); try { fs.unlinkSync(out); } catch {} }
}
console.log(`copied ${ok}, already there ${skip}, failed ${bad.length}`); bad.forEach(b => console.log("FAILED " + b));
