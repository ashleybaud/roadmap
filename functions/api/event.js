// POST {name}: add one to today's anonymous count for that action. Nothing about the person is stored.
import { handle, json, db, HttpError } from "../../server/otm.js";
const NAMES = new Set(["visit", "plan", "try", "pick", "gpx", "gpx_all", "group", "gmaps", "waze", "pdf", "save", "near", "book", "signin"]);
export const onRequestPost = handle(async ({ request, env }) => {
  const origin = request.headers.get("Origin"); if (origin && new URL(origin).host !== new URL(request.url).host) throw new HttpError(403, "Wrong site.");
  let name = ""; try { name = String(JSON.parse((await request.text()).slice(0, 200)).name || ""); } catch (e) {}
  if (!NAMES.has(name)) throw new HttpError(400, "Unknown event.");
  if (/bot|crawl|spider|headless|lighthouse/i.test(request.headers.get("User-Agent") || "")) return json({ ok: true });
  const D = await db(env), day = new Date().toISOString().slice(0, 10);
  await D.prepare(`INSERT INTO events (day, name, n) VALUES (?, ?, 1) ON CONFLICT(day, name) DO UPDATE SET n = n + 1`).bind(day, name).run();
  return json({ ok: true });
});
