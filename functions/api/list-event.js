// POST: "List your event" (organisers). Saves the event as pending; it waits in the founder's Review panel until the dates are checked.
// Sent as a form (multipart), so it can carry an optional photo: jpg, png or webp, up to 5 MB, stored in R2 (binding MEDIA) like riders' photos.
// "website" is a hidden field only bots fill in.
import { handle, json, body, db, newId, now, validEmail, sameOrigin, HttpError, clean, limitIp } from "../../server/otm.js";
export const CATS = { racing: "Racing", adventure: "Adventure: rally, enduro, organised ride", show: "Show or festival", classic: "Classics", track: "Track day", other: "Something else" };
const day = s => /^\d{4}-\d\d-\d\d$/.test(s || "") ? s : "";
const link = s => { s = clean(s, 300); if (!s) return ""; if (!/^https?:\/\//i.test(s)) s = "https://" + s; try { const u = new URL(s); return /^https?:$/.test(u.protocol) && /\./.test(u.hostname) ? u.toString() : ""; } catch (e) { return ""; } };
export const onRequestPost = handle(async ({ request, env }) => {
  sameOrigin(request);
  let b, file = null;
  if ((request.headers.get("Content-Type") || "").includes("multipart/form-data")) {
    if (+(request.headers.get("Content-Length") || 0) > 5.5e6) throw new HttpError(413, "That photo is too big. Up to 5 MB.");
    const f = await request.formData(); b = {}; for (const [k, v] of f.entries()) if (typeof v === "string") b[k] = v; else if (k === "photo" && v.size) file = v;
  } else b = await body(request, 4000);
  if (b.website) return json({ ok: true });
  const email = String(b.email || "").trim().toLowerCase(), name = clean(b.name, 140), start = day(b.start), end = day(b.end) || start;
  if (!name) throw new HttpError(400, "What's the event called?");
  if (!start) throw new HttpError(400, "When does it start?");
  if (end < start) throw new HttpError(400, "It ends before it starts. Check the dates.");
  if (start < new Date().toISOString().slice(0, 10)) throw new HttpError(400, "That date has passed.");
  if (!validEmail(email)) throw new HttpError(400, "That email address doesn't look right.");
  const website = link(b.site), tickets = link(b.tickets);
  if (!website) throw new HttpError(400, "Add the organiser's website, so we can check the dates.");
  await limitIp(env, request, "list-event", 5, 3600e3, "Lots of events from here. Try again in an hour.");
  // the photo: checked by its first bytes, not its name
  let photo = null, buf = null, type = "";
  if (file) {
    if (file.size > 5e6) throw new HttpError(413, "That photo is too big. Up to 5 MB.");
    buf = new Uint8Array(await file.arrayBuffer());
    type = buf[0] === 0xff && buf[1] === 0xd8 ? "jpg" : buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 ? "png" : buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50 ? "webp" : "";
    if (!type) throw new HttpError(415, "The photo must be a JPG, PNG or WebP.");
    if (!env.MEDIA) throw new HttpError(503, "Photo uploads aren't switched on yet. Send it without the photo and email it to hello@onetrackmind.online.");
  }
  const D = await db(env), id = newId(12);
  if (buf) { photo = `listing/${id}.${type}`; await env.MEDIA.put(photo, buf, { httpMetadata: { contentType: type === "jpg" ? "image/jpeg" : "image/" + type, cacheControl: "public, max-age=31536000, immutable" } }); }
  await D.prepare(`INSERT INTO event_listings (id, name, start, end, venue, town, country, website, tickets, email, category, created, photo) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id, name, start, end, clean(b.venue, 140), clean(b.town, 100), clean(b.country, 60), website, tickets, email, CATS[b.category] ? b.category : "other", now(), photo).run();
  return json({ ok: true });
});
