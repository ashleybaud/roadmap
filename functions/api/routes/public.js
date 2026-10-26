// GET ?region=za: routes riders have made public (picks first), with their average rating.
import { handle, json, db, clean } from "../../../server/otm.js";
export const onRequestGet = handle(async ({ request, env }) => {
  const region = clean(new URL(request.url).searchParams.get("region"), 10);
  const D = await db(env);
  const q = `SELECT r.id, r.title, r.summary, r.km, r.days, r.vehicle, r.style, r.region, r.pick, r.grade_json, r.updated,
      (SELECT ROUND(AVG(stars),1) FROM route_ratings WHERE route_id = r.id AND stars IS NOT NULL) AS stars,
      (SELECT COUNT(*) FROM route_ratings WHERE route_id = r.id) AS ratings
    FROM routes r WHERE r.visibility = 'public' ${region ? "AND (r.region = ?1 OR r.region IS NULL)" : ""} ORDER BY r.pick DESC, ratings DESC, r.updated DESC LIMIT 200`;
  const st = D.prepare(q); const res = await (region ? st.bind(region) : st).all();
  return json({ routes: res.results || [] });
});
