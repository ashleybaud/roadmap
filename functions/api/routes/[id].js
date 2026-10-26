// GET one route (yours, or anyone's that's shared or public). PUT {title?, trip?, visibility?}: update yours. DELETE: remove yours.
import { handle, json, body, db, currentUser, requireUser, sameOrigin, clean, now, HttpError } from "../../../server/otm.js";
import { routeCols } from "./index.js";

const VIS = ["private", "link", "public"];
async function own(env, request, id) {
  const u = await requireUser(env, request), D = await db(env);
  const r = await D.prepare(`SELECT * FROM routes WHERE id = ?`).bind(id).first();
  if (!r || r.user_id !== u.id) throw new HttpError(404, "Route not found.");
  return { u, D, r };
}
export const onRequestGet = handle(async ({ request, env, params }) => {
  const D = await db(env), r = await D.prepare(`SELECT * FROM routes WHERE id = ?`).bind(params.id).first();
  const u = await currentUser(env, request), mine = !!(r && u && r.user_id === u.id);
  if (!r || (!mine && r.visibility === "private")) throw new HttpError(404, "Route not found, or it isn't shared.");
  const { data, user_id, ...rest } = r;
  return json({ route: { ...rest, mine, ...JSON.parse(data) } });
});
export const onRequestPut = handle(async ({ request, env, params }) => {
  sameOrigin(request); const { D, r } = await own(env, request, params.id), b = await body(request);
  const vis = VIS.includes(b.visibility) ? b.visibility : r.visibility;
  if (b.trip) {
    const c = routeCols({ ...b, title: b.title || r.title });
    await D.prepare(`UPDATE routes SET title=?, summary=?, data=?, km=?, days=?, vehicle=?, style=?, region=?, start_lat=?, start_lon=?, visibility=?, updated=? WHERE id=?`)
      .bind(c.title, c.summary, c.data, c.km, c.days, c.vehicle, c.style, c.region, c.start_lat, c.start_lon, vis, now(), r.id).run();
  } else {
    await D.prepare(`UPDATE routes SET title=?, visibility=?, updated=? WHERE id=?`).bind(clean(b.title, 120) || r.title, vis, now(), r.id).run();
  }
  return json({ ok: true });
});
export const onRequestDelete = handle(async ({ request, env, params }) => {
  sameOrigin(request); const { D, r } = await own(env, request, params.id);
  await D.batch([D.prepare(`DELETE FROM routes WHERE id = ?`).bind(r.id), D.prepare(`DELETE FROM route_ratings WHERE route_id = ?`).bind(r.id)]);
  return json({ ok: true });
});
