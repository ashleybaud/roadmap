// POST: "List your event" (organisers). Saves the event as pending; it waits in the founder's Review panel until the dates are checked.
// "website" is a hidden field only bots fill in.
import { handle, json, body, db, newId, now, validEmail, sameOrigin, HttpError, clean, limitIp } from "../../server/otm.js";
export const CATS = { racing: "Racing", adventure: "Adventure: rally, enduro, organised ride", show: "Show or festival", classic: "Classics", track: "Track day", other: "Something else" };
const day = s => /^\d{4}-\d\d-\d\d$/.test(s || "") ? s : "";
const link = s => { s = clean(s, 300); if (!s) return ""; if (!/^https?:\/\//i.test(s)) s = "https://" + s; try { const u = new URL(s); return /^https?:$/.test(u.protocol) && /\./.test(u.hostname) ? u.toString() : ""; } catch (e) { return ""; } };
export const onRequestPost = handle(async ({ request, env }) => {
  sameOrigin(request);
  const b = await body(request, 4000);
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
  const D = await db(env);
  await D.prepare(`INSERT INTO event_listings (id, name, start, end, venue, town, country, website, tickets, email, category, created) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(newId(12), name, start, end, clean(b.venue, 140), clean(b.town, 100), clean(b.country, 60), website, tickets, email, CATS[b.category] ? b.category : "other", now()).run();
  return json({ ok: true });
});
