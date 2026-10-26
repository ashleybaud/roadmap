// Shared server code for the OneTrackMind API (Cloudflare Pages Functions + D1).
// Needs: a D1 binding called DB; a secret RESEND_API_KEY for login emails.
// The database tables are created on first use, so no separate setup step is needed.

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT, created INTEGER NOT NULL, last_seen INTEGER)`,
  `CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, created INTEGER NOT NULL, expires INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id)`,
  `CREATE TABLE IF NOT EXISTS login_tokens (id TEXT PRIMARY KEY, email TEXT NOT NULL, created INTEGER NOT NULL, expires INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0, back TEXT)`,
  `CREATE INDEX IF NOT EXISTS login_tokens_email ON login_tokens(email, created)`,
  // a saved route: the whole trip as the planner holds it, plus a few columns to list and search by
  `CREATE TABLE IF NOT EXISTS routes (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL, summary TEXT, data TEXT NOT NULL,
     km REAL, days INTEGER, vehicle TEXT, style TEXT, region TEXT, start_lat REAL, start_lon REAL,
     visibility TEXT NOT NULL DEFAULT 'private', pick INTEGER NOT NULL DEFAULT 0, grade_json TEXT,
     created INTEGER NOT NULL, updated INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS routes_user ON routes(user_id, updated)`,
  `CREATE INDEX IF NOT EXISTS routes_public ON routes(visibility, region)`,
  `CREATE TABLE IF NOT EXISTS feedback (id TEXT PRIMARY KEY, user_id TEXT, email TEXT, kind TEXT NOT NULL, text TEXT NOT NULL, page TEXT, data TEXT, lat REAL, lon REAL, status TEXT NOT NULL DEFAULT 'new', created INTEGER NOT NULL)`,
  // ready for phase 3-5: grades and ratings only from riders who rode it, dated condition reports, Wild Goose Chase
  `CREATE TABLE IF NOT EXISTS route_ratings (route_id TEXT NOT NULL, user_id TEXT NOT NULL, stars INTEGER, grade INTEGER, rode_on TEXT, vehicle TEXT, created INTEGER NOT NULL, PRIMARY KEY (route_id, user_id))`,
  `CREATE TABLE IF NOT EXISTS reports (id TEXT PRIMARY KEY, route_id TEXT, user_id TEXT NOT NULL, kind TEXT NOT NULL, text TEXT, lat REAL, lon REAL, seen_on TEXT, expires INTEGER, created INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS reports_route ON reports(route_id, created)`,
  // places riders mark (viewpoints, farm stalls, bike-friendly stays...); shown to others once approved
  `CREATE TABLE IF NOT EXISTS spots (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, kind TEXT NOT NULL, name TEXT NOT NULL, note TEXT, lat REAL NOT NULL, lon REAL NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created INTEGER NOT NULL, reviewed INTEGER)`,
  `CREATE INDEX IF NOT EXISTS spots_pos ON spots(status, lat, lon)`,
  `CREATE TABLE IF NOT EXISTS spot_votes (spot_id TEXT NOT NULL, user_id TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY (spot_id, user_id))`,
];
// columns added after tables already existed (each runs once; "duplicate column" errors are expected afterwards)
const MIGRATIONS = [
  `ALTER TABLE reports ADD COLUMN status TEXT NOT NULL DEFAULT 'ok'`,
  `ALTER TABLE users ADD COLUMN contributor INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN blocked INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE users ADD COLUMN trusted INTEGER NOT NULL DEFAULT 0`,
];
let schemaReady = null;
export async function db(env) {
  if (!env.DB) throw new HttpError(503, "The database isn't connected yet.");
  if (!schemaReady) schemaReady = env.DB.batch(SCHEMA.map(s => env.DB.prepare(s)))
    .then(async () => { for (const m of MIGRATIONS) { try { await env.DB.prepare(m).run(); } catch (e) {} } })
    .catch(e => { schemaReady = null; throw e; });
  await schemaReady;
  return env.DB;
}

export class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers } });
export function handle(fn) {
  return async ctx => {
    try { return await fn(ctx); }
    catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.log("api error", e && e.stack || e);
      return json({ error: "Something went wrong on our side. Try again in a minute." }, 500);
    }
  };
}
export const now = () => Date.now();
export function newId(bytes = 16) {
  const a = new Uint8Array(bytes); crypto.getRandomValues(a);
  return [...a].map(b => b.toString(16).padStart(2, "0")).join("");
}
export async function sha256(s) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, "0")).join("");
}
export async function body(request, max = 400000) {
  const t = await request.text();
  if (t.length > max) throw new HttpError(413, "That's too big to save.");
  try { return t ? JSON.parse(t) : {}; } catch (e) { throw new HttpError(400, "Bad request."); }
}
export function sameOrigin(request) {
  const o = request.headers.get("Origin");
  if (o && o !== new URL(request.url).origin) throw new HttpError(403, "Not allowed.");
}

/* ---------- sessions: a random id in an HttpOnly cookie; only its hash is stored ---------- */
const COOKIE = "otm_s", SESSION_DAYS = 180;
function cookieVal(request, name) {
  const c = request.headers.get("Cookie") || "";
  const m = c.split(/;\s*/).find(x => x.startsWith(name + "="));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : null;
}
export async function currentUser(env, request) {
  const raw = cookieVal(request, COOKIE); if (!raw || !env.DB) return null;
  const D = await db(env), sid = await sha256(raw);
  const row = await D.prepare(`SELECT u.id, u.email, u.name, u.contributor, u.blocked, u.trusted, s.expires FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`).bind(sid).first();
  if (!row || row.expires < now()) return null;
  return { id: row.id, email: row.email, name: row.name, contributor: !!row.contributor, blocked: !!row.blocked, trusted: !!row.trusted };
}
export async function requireUser(env, request) {
  const u = await currentUser(env, request);
  if (!u) throw new HttpError(401, "Sign in first.");
  return u;
}
export async function startSession(env, userId) {
  const raw = newId(32), D = await db(env), t = now();
  await D.prepare(`INSERT INTO sessions (id, user_id, created, expires) VALUES (?, ?, ?, ?)`).bind(await sha256(raw), userId, t, t + SESSION_DAYS * 864e5).run();
  return `${COOKIE}=${raw}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`;
}
export async function endSession(env, request) {
  const raw = cookieVal(request, COOKIE);
  if (raw && env.DB) await (await db(env)).prepare(`DELETE FROM sessions WHERE id = ?`).bind(await sha256(raw)).run();
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

/* ---------- email through Resend ---------- */
export const FROM = "OneTrackMind <hello@onetrackmind.online>";
export async function sendEmail(env, { to, subject, text, html, replyTo }) {
  if (!env.RESEND_API_KEY) throw new HttpError(503, "Email isn't set up yet.");
  if (env.EMAIL_LOG) { console.log("EMAIL to", to, "|", subject, "|", text); return; } // local testing only
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, text, html, reply_to: replyTo }),
  });
  if (!r.ok) { console.log("resend", r.status, await r.text()); throw new HttpError(502, "The email couldn't be sent. Try again in a minute."); }
}
export const validEmail = e => typeof e === "string" && e.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
export const clean = (s, n) => String(s == null ? "" : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, n);
export const escHtml = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- admin: emails listed in the ADMIN_EMAILS variable (comma separated) ---------- */
export const isAdmin = (env, u) => !!(u && (env.ADMIN_EMAILS || "").toLowerCase().split(/[,\s]+/).filter(Boolean).includes(u.email));

/* ---------- rider reports: a fixed list, each fades after a while ---------- */
export const REPORT_KINDS = {
  fuel_ok: { label: "Fuel available", days: 30 },
  no_fuel: { label: "No fuel", days: 30 },
  road_closed: { label: "Road closed", days: 14 },
  washaway: { label: "Washaway or flood damage", days: 45 },
  bad_road: { label: "Bad surface: corrugations, ruts, sand", days: 45 },
  graded: { label: "Freshly graded", days: 30 },
  roadworks: { label: "Roadworks or stop-go", days: 30 },
  river_high: { label: "River crossing high", days: 7 },
  animals: { label: "Animals on the road", days: 14 },
  danger: { label: "Danger: crime or unsafe stop", days: 30 },
  good_stay: { label: "Good place to stay or eat", days: 365 },
};

export const SPOT_KINDS = { view: "Viewpoint", pass: "Pass", farmstall: "Farm stall", coffee: "Coffee or food", stay: "Bike-friendly stay", camp: "Camping", workshop: "Workshop or tyres", fuel: "Fuel", water: "Water", other: "Worth a stop" };

// adding things for other riders: needs the contributor rules agreed, and not blocked. Admin and trusted riders go live straight away.
export function requireContributor(env, u) {
  if (u.blocked) throw new HttpError(403, "Your account can't add things for other riders. Email hello@onetrackmind.online if you think that's wrong.");
  if (!u.contributor && !isAdmin(env, u)) throw new HttpError(428, "contributor");
}
export const liveStatus = (env, u) => (isAdmin(env, u) || u.trusted ? "ok" : "pending");
