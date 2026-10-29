// Daily: pulls the newest posts from the OneTrackMind Facebook Page and its linked Instagram (@ashleybaud)
// into data/social.json, with each photo copied to media/social/ (Meta's own image links expire).
// Needs META_TOKEN: a Page access token for the Onetrackmind Page (made from a long-lived user token, so it doesn't expire).
import fs from "fs"; import path from "path"; import { execFileSync } from "child_process";
const T = process.env.META_TOKEN, G = "https://graph.facebook.com/v21.0";
if (!T) { console.log("No META_TOKEN yet, nothing to do."); process.exit(0); }
const get = async (p, q = {}) => { const u = new URL(G + p); Object.entries({ ...q, access_token: T }).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetch(u); const j = await r.json(); if (j.error) throw new Error(`${p}: ${j.error.message}`); return j; };
const me = await get("/me", { fields: "id,name,instagram_business_account{id,username}" });
const items = [];
try {
  const fb = await get("/me/posts", { fields: "id,message,full_picture,permalink_url,created_time", limit: "15" });
  fb.data.filter(x => x.full_picture && x.message).forEach(x => items.push({ id: "fb-" + x.id, src: "fb", text: x.message, pic: x.full_picture, url: x.permalink_url, date: x.created_time }));
} catch (e) { console.log("Facebook:", e.message); }
const ig = me.instagram_business_account;
if (ig) try {
  const m = await get(`/${ig.id}/media`, { fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp", limit: "15" });
  m.data.forEach(x => { const pic = x.media_type === "VIDEO" ? x.thumbnail_url : x.media_url; if (pic) items.push({ id: "ig-" + x.id, src: "ig", text: x.caption || "", pic, url: x.permalink, date: x.timestamp }); });
} catch (e) { console.log("Instagram:", e.message); }
items.sort((a, b) => b.date.localeCompare(a.date));
// the same post shared to both: keep the Instagram one
const seen = new Set(), out = [];
for (const x of items) { const k = x.text.slice(0, 60).toLowerCase(); if (k && seen.has(k)) continue; seen.add(k); out.push(x); if (out.length >= 9) break; }
const dir = "media/social"; fs.mkdirSync(dir, { recursive: true });
const keep = new Set();
for (const x of out) {
  const f = path.join(dir, x.id.replace(/[^\w-]/g, "_") + ".jpg"); keep.add(path.basename(f));
  if (!fs.existsSync(f)) { const b = Buffer.from(await (await fetch(x.pic)).arrayBuffer()); fs.writeFileSync(f, b);
    try { execFileSync("mogrify", ["-resize", "720x720>", "-quality", "80", "-strip", "-format", "jpg", f]); } catch (e) {} }
  x.img = "/" + f; delete x.pic;
  x.text = x.text.replace(/\s*(#[\wÀ-ɏ]+\s*)+$/u, "").trim(); // hashtags at the end drop off
}
fs.readdirSync(dir).forEach(f => { if (!keep.has(f)) fs.unlinkSync(path.join(dir, f)); });
fs.writeFileSync("data/social.json", JSON.stringify(out, null, 1));
console.log(`${me.name}${ig ? " + @" + ig.username : " (no Instagram linked)"}: ${out.length} posts`);
