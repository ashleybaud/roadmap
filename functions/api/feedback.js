// POST {kind, text, page, data, lat, lon, email}: feedback or a suggested correction. Kept in the database and emailed to the feedback inbox.
import { handle, json, body, db, currentUser, sameOrigin, clean, newId, now, sendEmail, validEmail, HttpError } from "../../server/otm.js";

const KINDS = { feedback: "Feedback", fix: "Suggested change", bug: "Something broke" };
export const onRequestPost = handle(async ({ request, env }) => {
  sameOrigin(request);
  const b = await body(request, 60000), kind = KINDS[b.kind] ? b.kind : "feedback", text = clean(b.text, 4000);
  if (text.length < 3) throw new HttpError(400, "Write a few words first.");
  const u = await currentUser(env, request).catch(() => null);
  const email = u ? u.email : (validEmail(String(b.email || "").trim()) ? String(b.email).trim().toLowerCase() : null);
  const has = v => v !== null && v !== undefined && v !== "" && Number.isFinite(+v);
  const lat = has(b.lat) && has(b.lon) ? +b.lat : null, lon = lat != null ? +b.lon : null;
  const id = newId(8), D = await db(env);
  const recent = await D.prepare(`SELECT COUNT(*) AS n FROM feedback WHERE created > ? AND (email = ? OR ? IS NULL)`).bind(now() - 3600e3, email, email).first();
  if (recent && recent.n >= (email ? 20 : 200)) throw new HttpError(429, "Thanks, that's plenty for now. Try again later.");
  await D.prepare(`INSERT INTO feedback (id, user_id, email, kind, text, page, data, lat, lon, created) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .bind(id, u ? u.id : null, email, kind, text, clean(b.page, 200), b.data ? JSON.stringify(b.data).slice(0, 50000) : null, lat, lon, now()).run();
  if (env.RESEND_API_KEY) {
    const where = lat != null ? `\nWhere: https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=15/${lat}/${lon}` : "";
    await sendEmail(env, { to: env.FEEDBACK_TO || "feedback@onetrackmind.online", replyTo: email || undefined,
      subject: `${KINDS[kind]}: ${text.slice(0, 60)}`,
      text: `${KINDS[kind]} (${id})\nFrom: ${email || "not signed in"}\nPage: ${clean(b.page, 200)}${where}\n\n${text}\n\n${b.data ? "Trip: " + JSON.stringify(b.data).slice(0, 3000) : ""}` }).catch(() => {});
  }
  return json({ ok: true, id });
});
