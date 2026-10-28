// GET: the trip behind a share link, so the planner can open it.
import { handle, json, db, HttpError } from "../../../server/otm.js";
export const onRequestGet = handle(async ({ params, env }) => {
  const id = String(params.id || ""); if (!/^[a-z0-9]{6,12}$/.test(id)) throw new HttpError(404, "That link doesn't work.");
  const D = await db(env), r = await D.prepare(`SELECT title, data FROM shares WHERE id = ?`).bind(id).first();
  if (!r) throw new HttpError(404, "That link doesn't work. Ask for a new one.");
  await D.prepare(`UPDATE shares SET opens = opens + 1 WHERE id = ?`).bind(id).run();
  const d = JSON.parse(r.data);
  return json({ title: r.title, trip: d.trip, settings: d.settings });
});
