var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-ufl4Jp/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// .wrangler/tmp/pages-vvltbQ/functionsWorker-0.025592546571003405.mjs
var __defProp2 = Object.defineProperty;
var __name2 = /* @__PURE__ */ __name((target, value) => __defProp2(target, "name", { value, configurable: true }), "__name");
function stripCfConnectingIPHeader2(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader2, "stripCfConnectingIPHeader");
__name2(stripCfConnectingIPHeader2, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader2.apply(null, argArray)
    ]);
  }
});
var SCHEMA = [
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
  `CREATE TABLE IF NOT EXISTS spot_votes (spot_id TEXT NOT NULL, user_id TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY (spot_id, user_id))`
];
var MIGRATIONS = [
  `ALTER TABLE reports ADD COLUMN status TEXT NOT NULL DEFAULT 'ok'`
];
var schemaReady = null;
async function db(env) {
  if (!env.DB)
    throw new HttpError(503, "The database isn't connected yet.");
  if (!schemaReady)
    schemaReady = env.DB.batch(SCHEMA.map((s) => env.DB.prepare(s))).then(async () => {
      for (const m of MIGRATIONS) {
        try {
          await env.DB.prepare(m).run();
        } catch (e) {
        }
      }
    }).catch((e) => {
      schemaReady = null;
      throw e;
    });
  await schemaReady;
  return env.DB;
}
__name(db, "db");
__name2(db, "db");
var HttpError = /* @__PURE__ */ __name(class extends Error {
  constructor(status, msg) {
    super(msg);
    this.status = status;
  }
}, "HttpError");
__name2(HttpError, "HttpError");
var json = /* @__PURE__ */ __name2((data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers } }), "json");
function handle(fn) {
  return async (ctx) => {
    try {
      return await fn(ctx);
    } catch (e) {
      if (e instanceof HttpError)
        return json({ error: e.message }, e.status);
      console.log("api error", e && e.stack || e);
      return json({ error: "Something went wrong on our side. Try again in a minute." }, 500);
    }
  };
}
__name(handle, "handle");
__name2(handle, "handle");
var now = /* @__PURE__ */ __name2(() => Date.now(), "now");
function newId(bytes = 16) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(newId, "newId");
__name2(newId, "newId");
async function sha256(s) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(sha256, "sha256");
__name2(sha256, "sha256");
async function body(request, max = 4e5) {
  const t = await request.text();
  if (t.length > max)
    throw new HttpError(413, "That's too big to save.");
  try {
    return t ? JSON.parse(t) : {};
  } catch (e) {
    throw new HttpError(400, "Bad request.");
  }
}
__name(body, "body");
__name2(body, "body");
function sameOrigin(request) {
  const o = request.headers.get("Origin");
  if (o && o !== new URL(request.url).origin)
    throw new HttpError(403, "Not allowed.");
}
__name(sameOrigin, "sameOrigin");
__name2(sameOrigin, "sameOrigin");
var COOKIE = "otm_s";
var SESSION_DAYS = 180;
function cookieVal(request, name) {
  const c = request.headers.get("Cookie") || "";
  const m = c.split(/;\s*/).find((x) => x.startsWith(name + "="));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : null;
}
__name(cookieVal, "cookieVal");
__name2(cookieVal, "cookieVal");
async function currentUser(env, request) {
  const raw = cookieVal(request, COOKIE);
  if (!raw || !env.DB)
    return null;
  const D = await db(env), sid = await sha256(raw);
  const row = await D.prepare(`SELECT u.id, u.email, u.name, s.expires FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`).bind(sid).first();
  if (!row || row.expires < now())
    return null;
  return { id: row.id, email: row.email, name: row.name };
}
__name(currentUser, "currentUser");
__name2(currentUser, "currentUser");
async function requireUser(env, request) {
  const u = await currentUser(env, request);
  if (!u)
    throw new HttpError(401, "Sign in first.");
  return u;
}
__name(requireUser, "requireUser");
__name2(requireUser, "requireUser");
async function startSession(env, userId) {
  const raw = newId(32), D = await db(env), t = now();
  await D.prepare(`INSERT INTO sessions (id, user_id, created, expires) VALUES (?, ?, ?, ?)`).bind(await sha256(raw), userId, t, t + SESSION_DAYS * 864e5).run();
  return `${COOKIE}=${raw}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`;
}
__name(startSession, "startSession");
__name2(startSession, "startSession");
async function endSession(env, request) {
  const raw = cookieVal(request, COOKIE);
  if (raw && env.DB)
    await (await db(env)).prepare(`DELETE FROM sessions WHERE id = ?`).bind(await sha256(raw)).run();
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
__name(endSession, "endSession");
__name2(endSession, "endSession");
var FROM = "OneTrackMind <hello@onetrackmind.online>";
async function sendEmail(env, { to, subject, text, html, replyTo }) {
  if (!env.RESEND_API_KEY)
    throw new HttpError(503, "Email isn't set up yet.");
  if (env.EMAIL_LOG) {
    console.log("EMAIL to", to, "|", subject, "|", text);
    return;
  }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, text, html, reply_to: replyTo })
  });
  if (!r.ok) {
    console.log("resend", r.status, await r.text());
    throw new HttpError(502, "The email couldn't be sent. Try again in a minute.");
  }
}
__name(sendEmail, "sendEmail");
__name2(sendEmail, "sendEmail");
var validEmail = /* @__PURE__ */ __name2((e) => typeof e === "string" && e.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e), "validEmail");
var clean = /* @__PURE__ */ __name2((s, n) => String(s == null ? "" : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, n), "clean");
var escHtml = /* @__PURE__ */ __name2((s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]), "escHtml");
var isAdmin = /* @__PURE__ */ __name2((env, u) => !!(u && (env.ADMIN_EMAILS || "").toLowerCase().split(/[,\s]+/).filter(Boolean).includes(u.email)), "isAdmin");
var REPORT_KINDS = {
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
  good_stay: { label: "Good place to stay or eat", days: 365 }
};
var SPOT_KINDS = { view: "Viewpoint", pass: "Pass", farmstall: "Farm stall", coffee: "Coffee or food", stay: "Bike-friendly stay", camp: "Camping", workshop: "Workshop or tyres", fuel: "Fuel", water: "Water", other: "Worth a stop" };
async function admin(env, request) {
  const u = await requireUser(env, request);
  if (!isAdmin(env, u))
    throw new HttpError(403, "OneTrackMind only.");
  return u;
}
__name(admin, "admin");
__name2(admin, "admin");
var onRequestGet = handle(async ({ request, env }) => {
  await admin(env, request);
  const D = await db(env);
  const [routes2, spots, reports, feedback] = await D.batch([
    D.prepare(`SELECT r.id, r.title, r.summary, r.km, r.days, r.vehicle, r.updated, u.email FROM routes r JOIN users u ON u.id = r.user_id WHERE r.visibility = 'review' ORDER BY r.updated LIMIT 100`),
    D.prepare(`SELECT s.id, s.kind, s.name, s.note, s.lat, s.lon, s.created, u.email FROM spots s JOIN users u ON u.id = s.user_id WHERE s.status = 'pending' ORDER BY s.created LIMIT 200`),
    D.prepare(`SELECT r.id, r.kind, r.text, r.lat, r.lon, r.seen_on, r.created, u.email FROM reports r JOIN users u ON u.id = r.user_id WHERE r.status = 'pending' AND r.expires > ? ORDER BY r.created LIMIT 200`).bind(now()),
    D.prepare(`SELECT id, kind, text, email, page, lat, lon, created FROM feedback WHERE status = 'new' ORDER BY created DESC LIMIT 200`)
  ]);
  return json({
    routes: routes2.results,
    spots: spots.results.map((s) => ({ ...s, label: SPOT_KINDS[s.kind] || s.kind })),
    reports: reports.results.map((r) => ({ ...r, label: (REPORT_KINDS[r.kind] || {}).label || r.kind })),
    feedback: feedback.results
  });
});
var onRequestPost = handle(async ({ request, env }) => {
  sameOrigin(request);
  await admin(env, request);
  const b = await body(request, 2e3), D = await db(env), ok = b.action === "approve", id = String(b.id || "");
  if (b.type === "route")
    await D.prepare(`UPDATE routes SET visibility = ? WHERE id = ? AND visibility = 'review'`).bind(ok ? "public" : "private", id).run();
  else if (b.type === "spot")
    await D.prepare(`UPDATE spots SET status = ?, reviewed = ? WHERE id = ?`).bind(ok ? "ok" : "rejected", now(), id).run();
  else if (b.type === "report")
    await D.prepare(`UPDATE reports SET status = ? WHERE id = ?`).bind(ok ? "ok" : "rejected", id).run();
  else if (b.type === "feedback")
    await D.prepare(`UPDATE feedback SET status = 'done' WHERE id = ?`).bind(id).run();
  else
    throw new HttpError(400, "Unknown item.");
  return json({ ok: true });
});
var onRequestPost2 = handle(async ({ request, env }) => {
  sameOrigin(request);
  return json({ ok: true }, 200, { "Set-Cookie": await endSession(env, request) });
});
var onRequestGet2 = handle(async ({ request, env }) => {
  const ready = !!(env.DB && env.RESEND_API_KEY);
  const user = ready ? await currentUser(env, request) : null;
  return json({ ready, user, admin: isAdmin(env, user) });
});
var onRequestPost3 = handle(async ({ request, env }) => {
  sameOrigin(request);
  const b = await body(request, 2e3), email = String(b.email || "").trim().toLowerCase();
  if (!validEmail(email))
    throw new HttpError(400, "That email address doesn't look right.");
  const D = await db(env), t = now();
  const recent = await D.prepare(`SELECT COUNT(*) AS n FROM login_tokens WHERE email = ? AND created > ?`).bind(email, t - 36e5).first();
  if (recent && recent.n >= 5)
    throw new HttpError(429, "Too many sign-in emails in the last hour. Use the newest one, or try again later.");
  const raw = newId(32), origin = new URL(request.url).origin;
  const back = typeof b.back === "string" && b.back.startsWith("/") && !b.back.startsWith("//") ? b.back.slice(0, 200) : "/";
  await D.prepare(`INSERT INTO login_tokens (id, email, created, expires, back) VALUES (?, ?, ?, ?, ?)`).bind(await sha256(raw), email, t, t + 20 * 6e4, back).run();
  const link = `${origin}/api/auth/verify?t=${raw}`;
  await sendEmail(env, {
    to: email,
    subject: "Your OneTrackMind sign-in link",
    text: `Tap this link to sign in to OneTrackMind:

${link}

It works once and expires in 20 minutes. If you didn't ask for it, ignore this email.

OneTrackMind \xB7 Recce. Ride. Report.`,
    html: `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;color:#18201C">
      <p>Tap the button to sign in to OneTrackMind.</p>
      <p><a href="${escHtml(link)}" style="display:inline-block;background:#0B6E4F;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:600">Sign in</a></p>
      <p style="color:#5C6660;font-size:14px">It works once and expires in 20 minutes. If you didn't ask for it, ignore this email.</p>
      <p style="color:#5C6660;font-size:13px">OneTrackMind \xB7 Recce. Ride. Report.</p></div>`
  });
  return json({ ok: true });
});
var page = /* @__PURE__ */ __name2((msg) => new Response(
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>OneTrackMind</title>
<body style="font-family:system-ui,sans-serif;max-width:480px;margin:15vh auto;padding:0 16px;color:#18201C;background:#EEF0EA"><h1 style="font-size:1.4rem">${msg}</h1><p><a href="/">Back to the planner</a></p></body>`,
  { status: 400, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
), "page");
var onRequestGet3 = handle(async ({ request, env }) => {
  const raw = new URL(request.url).searchParams.get("t") || "";
  if (!/^[0-9a-f]{64}$/.test(raw))
    return page("That sign-in link isn't complete. Copy the whole link from the email.");
  const D = await db(env), id = await sha256(raw), t = now();
  const tok = await D.prepare(`SELECT * FROM login_tokens WHERE id = ?`).bind(id).first();
  if (!tok)
    return page("That sign-in link isn't valid. Ask for a new one.");
  if (tok.used)
    return page("That sign-in link has already been used. Ask for a new one.");
  if (tok.expires < t)
    return page("That sign-in link has expired. Ask for a new one.");
  await D.prepare(`UPDATE login_tokens SET used = 1 WHERE id = ?`).bind(id).run();
  let user = await D.prepare(`SELECT id FROM users WHERE email = ?`).bind(tok.email).first();
  if (!user) {
    user = { id: newId(12) };
    await D.prepare(`INSERT INTO users (id, email, created, last_seen) VALUES (?, ?, ?, ?)`).bind(user.id, tok.email, t, t).run();
  } else
    await D.prepare(`UPDATE users SET last_seen = ? WHERE id = ?`).bind(t, user.id).run();
  const cookie = await startSession(env, user.id), back = tok.back || "/";
  return new Response(null, { status: 302, headers: { "Location": back + (back.includes("?") ? "&" : "?") + "signedin=1", "Set-Cookie": cookie, "Cache-Control": "no-store" } });
});
var onRequestGet4 = handle(async ({ request, env }) => {
  const region = clean(new URL(request.url).searchParams.get("region"), 10);
  const D = await db(env);
  const q = `SELECT r.id, r.title, r.summary, r.km, r.days, r.vehicle, r.style, r.region, r.pick, r.grade_json, r.updated,
      (SELECT ROUND(AVG(stars),1) FROM route_ratings WHERE route_id = r.id AND stars IS NOT NULL) AS stars,
      (SELECT COUNT(*) FROM route_ratings WHERE route_id = r.id) AS ratings
    FROM routes r WHERE r.visibility = 'public' ${region ? "AND (r.region = ?1 OR r.region IS NULL)" : ""} ORDER BY r.pick DESC, ratings DESC, r.updated DESC LIMIT 200`;
  const st = D.prepare(q);
  const res = await (region ? st.bind(region) : st).all();
  return json({ routes: res.results || [] });
});
function routeCols(b) {
  const trip = b.trip;
  if (!trip || typeof trip !== "object" || !Array.isArray(trip.days) || !trip.start)
    throw new HttpError(400, "There's no trip to save.");
  const s = b.settings || {};
  return {
    title: clean(b.title, 120) || "Untitled route",
    summary: clean(b.summary, 300),
    data: JSON.stringify({ v: 1, trip, settings: { vehicle: s.vehicle, style: s.style, range: s.range, maxHours: s.maxHours, leave: s.leave, pace: s.pace, breakMin: s.breakMin } }),
    km: Number.isFinite(+b.km) ? Math.round(+b.km) : null,
    days: trip.days.length,
    vehicle: clean(s.vehicle, 10) || null,
    style: clean(s.style, 10) || null,
    region: clean(b.region, 10) || null,
    start_lat: Number.isFinite(+trip.start.lat) ? +trip.start.lat : null,
    start_lon: Number.isFinite(+trip.start.lon) ? +trip.start.lon : null,
    grade_json: b.grade && Array.isArray(b.grade.km) ? JSON.stringify({ km: b.grade.km.slice(0, 6).map((x) => Math.max(0, Math.round(+x || 0))), top: Math.max(0, Math.min(5, +b.grade.top || 0)) }) : null
  };
}
__name(routeCols, "routeCols");
__name2(routeCols, "routeCols");
var LIST_COLS = `id, title, summary, km, days, vehicle, style, visibility, pick, grade_json, created, updated`;
var onRequestGet5 = handle(async ({ request, env }) => {
  const u = await requireUser(env, request);
  const r = await (await db(env)).prepare(`SELECT ${LIST_COLS} FROM routes WHERE user_id = ? ORDER BY updated DESC LIMIT 200`).bind(u.id).all();
  return json({ routes: r.results || [] });
});
var onRequestPost4 = handle(async ({ request, env }) => {
  sameOrigin(request);
  const u = await requireUser(env, request), b = await body(request), c = routeCols(b), D = await db(env), t = now();
  const n = await D.prepare(`SELECT COUNT(*) AS n FROM routes WHERE user_id = ?`).bind(u.id).first();
  if (n && n.n >= 500)
    throw new HttpError(400, "You've reached 500 saved routes. Delete some first.");
  const id = newId(8);
  await D.prepare(`INSERT INTO routes (id, user_id, title, summary, data, km, days, vehicle, style, region, start_lat, start_lon, grade_json, created, updated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id, u.id, c.title, c.summary, c.data, c.km, c.days, c.vehicle, c.style, c.region, c.start_lat, c.start_lon, c.grade_json, t, t).run();
  return json({ id, title: c.title });
});
var VIS = ["private", "link", "public"];
async function own(env, request, id) {
  const u = await requireUser(env, request), D = await db(env);
  const r = await D.prepare(`SELECT * FROM routes WHERE id = ?`).bind(id).first();
  if (!r || r.user_id !== u.id)
    throw new HttpError(404, "Route not found.");
  return { u, D, r };
}
__name(own, "own");
__name2(own, "own");
var onRequestGet6 = handle(async ({ request, env, params }) => {
  const D = await db(env), r = await D.prepare(`SELECT * FROM routes WHERE id = ?`).bind(params.id).first();
  const u = await currentUser(env, request), mine = !!(r && u && r.user_id === u.id);
  if (!r || !mine && !["link", "public"].includes(r.visibility) && !isAdmin(env, u))
    throw new HttpError(404, "Route not found, or it isn't shared.");
  const { data, user_id, ...rest } = r;
  return json({ route: { ...rest, mine, ...JSON.parse(data) }, admin: isAdmin(env, u) });
});
var onRequestPut = handle(async ({ request, env, params }) => {
  sameOrigin(request);
  const { u, D, r } = await own(env, request, params.id), b = await body(request);
  let vis = VIS.includes(b.visibility) ? b.visibility : r.visibility;
  if (vis === "public" && r.visibility !== "public" && !isAdmin(env, u))
    vis = "review";
  if (b.pick != null) {
    if (!isAdmin(env, u))
      throw new HttpError(403, "Only OneTrackMind can make a route a pick.");
    await D.prepare(`UPDATE routes SET pick = ?, visibility = CASE WHEN ? = 1 THEN 'public' ELSE visibility END WHERE id = ?`).bind(b.pick ? 1 : 0, b.pick ? 1 : 0, r.id).run();
  }
  if (b.trip) {
    const c = routeCols({ ...b, title: b.title || r.title });
    await D.prepare(`UPDATE routes SET title=?, summary=?, data=?, km=?, days=?, vehicle=?, style=?, region=?, start_lat=?, start_lon=?, grade_json=?, visibility=?, updated=? WHERE id=?`).bind(c.title, c.summary, c.data, c.km, c.days, c.vehicle, c.style, c.region, c.start_lat, c.start_lon, c.grade_json, vis, now(), r.id).run();
  } else {
    await D.prepare(`UPDATE routes SET title=?, visibility=?, updated=? WHERE id=?`).bind(clean(b.title, 120) || r.title, vis, now(), r.id).run();
  }
  return json({ ok: true });
});
var onRequestDelete = handle(async ({ request, env, params }) => {
  sameOrigin(request);
  const { D, r } = await own(env, request, params.id);
  await D.batch([D.prepare(`DELETE FROM routes WHERE id = ?`).bind(r.id), D.prepare(`DELETE FROM route_ratings WHERE route_id = ?`).bind(r.id)]);
  return json({ ok: true });
});
var onRequestPost5 = handle(async ({ request, env }) => {
  sameOrigin(request);
  const u = await requireUser(env, request), b = await body(request, 2e3);
  await (await db(env)).prepare(`UPDATE users SET name = ? WHERE id = ?`).bind(clean(b.name, 60) || null, u.id).run();
  return json({ ok: true });
});
var onRequestDelete2 = handle(async ({ request, env }) => {
  sameOrigin(request);
  const u = await requireUser(env, request), D = await db(env);
  const cookie = await endSession(env, request);
  await D.batch([
    D.prepare(`DELETE FROM routes WHERE user_id = ?`).bind(u.id),
    D.prepare(`DELETE FROM route_ratings WHERE user_id = ?`).bind(u.id),
    D.prepare(`DELETE FROM reports WHERE user_id = ?`).bind(u.id),
    D.prepare(`UPDATE feedback SET user_id = NULL, email = NULL WHERE user_id = ?`).bind(u.id),
    D.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(u.id),
    D.prepare(`DELETE FROM login_tokens WHERE email = ?`).bind(u.email),
    D.prepare(`DELETE FROM users WHERE id = ?`).bind(u.id)
  ]);
  return json({ ok: true }, 200, { "Set-Cookie": cookie });
});
var KINDS = { feedback: "Feedback", fix: "Suggested change", bug: "Something broke" };
var onRequestPost6 = handle(async ({ request, env }) => {
  sameOrigin(request);
  const b = await body(request, 6e4), kind = KINDS[b.kind] ? b.kind : "feedback", text = clean(b.text, 4e3);
  if (text.length < 3)
    throw new HttpError(400, "Write a few words first.");
  const u = await currentUser(env, request).catch(() => null);
  const email = u ? u.email : validEmail(String(b.email || "").trim()) ? String(b.email).trim().toLowerCase() : null;
  const has = /* @__PURE__ */ __name2((v) => v !== null && v !== void 0 && v !== "" && Number.isFinite(+v), "has");
  const lat = has(b.lat) && has(b.lon) ? +b.lat : null, lon = lat != null ? +b.lon : null;
  const id = newId(8), D = await db(env);
  const recent = await D.prepare(`SELECT COUNT(*) AS n FROM feedback WHERE created > ? AND (email = ? OR ? IS NULL)`).bind(now() - 36e5, email, email).first();
  if (recent && recent.n >= (email ? 20 : 200))
    throw new HttpError(429, "Thanks, that's plenty for now. Try again later.");
  await D.prepare(`INSERT INTO feedback (id, user_id, email, kind, text, page, data, lat, lon, created) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(id, u ? u.id : null, email, kind, text, clean(b.page, 200), b.data ? JSON.stringify(b.data).slice(0, 5e4) : null, lat, lon, now()).run();
  if (env.RESEND_API_KEY) {
    const where = lat != null ? `
Where: https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=15/${lat}/${lon}` : "";
    await sendEmail(env, {
      to: env.FEEDBACK_TO || "feedback@onetrackmind.online",
      replyTo: email || void 0,
      subject: `${KINDS[kind]}: ${text.slice(0, 60)}`,
      text: `${KINDS[kind]} (${id})
From: ${email || "not signed in"}
Page: ${clean(b.page, 200)}${where}

${text}

${b.data ? "Trip: " + JSON.stringify(b.data).slice(0, 3e3) : ""}`
    }).catch(() => {
    });
  }
  return json({ ok: true, id });
});
var SERVERS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.private.coffee/api/interpreter"
];
var TIMEOUT_MS = 25e3;
async function ask(url, body2, signal) {
  const r = await fetch(url, {
    method: "POST",
    body: body2,
    signal,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "OneTrackMind/0.3 (+https://onetrackmind.online)",
      "Accept": "application/json"
    }
  });
  if (!r.ok)
    throw new Error(`${url} ${r.status}`);
  const text = await r.text();
  if (!text.trim().startsWith("{"))
    throw new Error(`${url} not json`);
  return text;
}
__name(ask, "ask");
__name2(ask, "ask");
async function onRequestPost7({ request }) {
  const body2 = await request.text();
  if (!body2.startsWith("data=") || body2.length > 2e5) {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const text = await Promise.any(SERVERS.map((u) => ask(u, body2, ctl.signal)));
    ctl.abort();
    return new Response(text, { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" } });
  } catch (e) {
    return Response.json({ error: "places service busy" }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
__name(onRequestPost7, "onRequestPost7");
__name2(onRequestPost7, "onRequestPost");
async function checkRoute(D, id, u) {
  if (/^pick:[a-z0-9-]{2,60}$/.test(id))
    return;
  const r = await D.prepare(`SELECT user_id, visibility FROM routes WHERE id = ?`).bind(id).first();
  if (!r || r.visibility === "private" && (!u || r.user_id !== u.id))
    throw new HttpError(404, "Route not found.");
}
__name(checkRoute, "checkRoute");
__name2(checkRoute, "checkRoute");
var onRequestGet7 = handle(async ({ request, env }) => {
  const id = new URL(request.url).searchParams.get("route") || "", D = await db(env), u = await currentUser(env, request);
  const s = await D.prepare(`SELECT ROUND(AVG(stars),1) AS stars, ROUND(AVG(grade),1) AS grade, COUNT(*) AS n FROM route_ratings WHERE route_id = ?`).bind(id).first();
  const mine = u ? await D.prepare(`SELECT stars, grade, rode_on, vehicle FROM route_ratings WHERE route_id = ? AND user_id = ?`).bind(id, u.id).first() : null;
  return json({ ...s || { n: 0 }, mine: mine || null });
});
var onRequestPost8 = handle(async ({ request, env }) => {
  sameOrigin(request);
  const u = await requireUser(env, request), b = await body(request, 4e3), D = await db(env);
  const id = String(b.route || "");
  await checkRoute(D, id, u);
  const stars = Math.round(+b.stars), grade = Math.round(+b.grade);
  if (!(stars >= 1 && stars <= 5))
    throw new HttpError(400, "Pick 1 to 5 stars.");
  if (!(grade >= 1 && grade <= 5))
    throw new HttpError(400, "Pick the grade you found it.");
  const rode = String(b.rode_on || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rode) || rode > (/* @__PURE__ */ new Date()).toISOString().slice(0, 10))
    throw new HttpError(400, "When did you ride it? Only riders who've ridden it can rate it.");
  await D.prepare(`INSERT INTO route_ratings (route_id, user_id, stars, grade, rode_on, vehicle, created) VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(route_id, user_id) DO UPDATE SET stars=excluded.stars, grade=excluded.grade, rode_on=excluded.rode_on, vehicle=excluded.vehicle, created=excluded.created`).bind(id, u.id, stars, grade, rode, ["bike", "jeep", "car"].includes(b.vehicle) ? b.vehicle : null, now()).run();
  return json({ ok: true });
});
var onRequestGet8 = handle(async ({ request, env }) => {
  const q = new URL(request.url).searchParams, n = /* @__PURE__ */ __name2((k) => +q.get(k), "n");
  const [s, w, nn, e] = [n("s"), n("w"), n("n"), n("e")];
  if (![s, w, nn, e].every(Number.isFinite) || nn - s > 25 || e - w > 25)
    throw new HttpError(400, "Give a smaller area.");
  const D = await db(env), u = await currentUser(env, request);
  const r = await D.prepare(`SELECT id, kind, text, lat, lon, seen_on, created, user_id, status FROM reports WHERE lat BETWEEN ? AND ? AND lon BETWEEN ? AND ? AND expires > ? AND (status = 'ok' OR user_id = ?) ORDER BY created DESC LIMIT 300`).bind(s, nn, w, e, now(), u ? u.id : "").all();
  return json({
    kinds: Object.fromEntries(Object.entries(REPORT_KINDS).map(([k, v]) => [k, v.label])),
    reports: (r.results || []).map(({ user_id, ...x }) => ({ ...x, label: (REPORT_KINDS[x.kind] || {}).label || x.kind, mine: !!(u && user_id === u.id) }))
  });
});
var onRequestPost9 = handle(async ({ request, env }) => {
  sameOrigin(request);
  const u = await requireUser(env, request), b = await body(request, 4e3), D = await db(env);
  const k = REPORT_KINDS[b.kind];
  if (!k)
    throw new HttpError(400, "Pick what you saw.");
  const lat = +b.lat, lon = +b.lon;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180)
    throw new HttpError(400, "Where was it?");
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), seen = /^\d{4}-\d{2}-\d{2}$/.test(b.seen_on || "") && b.seen_on <= today ? b.seen_on : today;
  const recent = await D.prepare(`SELECT COUNT(*) AS n FROM reports WHERE user_id = ? AND created > ?`).bind(u.id, now() - 36e5).first();
  if (recent && recent.n >= 30)
    throw new HttpError(429, "That's a lot of reports in an hour. Try again later.");
  const id = newId(8), from = Date.parse(seen + "T12:00:00Z");
  const status = isAdmin(env, u) ? "ok" : "pending";
  await D.prepare(`INSERT INTO reports (id, route_id, user_id, kind, text, lat, lon, seen_on, expires, created, status) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(id, clean(b.route, 80) || null, u.id, b.kind, clean(b.text, 500) || null, lat, lon, seen, from + k.days * 864e5, now(), status).run();
  return json({ ok: true, id, status });
});
var onRequestDelete3 = handle(async ({ request, env }) => {
  sameOrigin(request);
  const u = await requireUser(env, request), id = new URL(request.url).searchParams.get("id") || "";
  await (await db(env)).prepare(`DELETE FROM reports WHERE id = ? AND user_id = ?`).bind(id, u.id).run();
  return json({ ok: true });
});
var onRequestGet9 = handle(async ({ request, env }) => {
  const q = new URL(request.url).searchParams, n = /* @__PURE__ */ __name2((k) => +q.get(k), "n"), [s, w, nn, e] = [n("s"), n("w"), n("n"), n("e")];
  if (![s, w, nn, e].every(Number.isFinite) || nn - s > 25 || e - w > 25)
    throw new HttpError(400, "Give a smaller area.");
  const D = await db(env), u = await currentUser(env, request), uid = u ? u.id : "";
  const r = await D.prepare(`SELECT s.id, s.kind, s.name, s.note, s.lat, s.lon, s.status, s.user_id = ? AS mine,
      (SELECT COUNT(*) FROM spot_votes v WHERE v.spot_id = s.id) AS been, EXISTS(SELECT 1 FROM spot_votes v WHERE v.spot_id = s.id AND v.user_id = ?) AS beenme
    FROM spots s WHERE s.lat BETWEEN ? AND ? AND s.lon BETWEEN ? AND ? AND (s.status = 'ok' OR s.user_id = ?) LIMIT 500`).bind(uid, uid, s, nn, w, e, uid).all();
  return json({ kinds: SPOT_KINDS, spots: r.results || [] });
});
var onRequestPost10 = handle(async ({ request, env }) => {
  sameOrigin(request);
  const u = await requireUser(env, request), b = await body(request, 4e3), D = await db(env);
  if (b.vote) {
    const sp = await D.prepare(`SELECT id FROM spots WHERE id = ? AND status = 'ok'`).bind(String(b.vote)).first();
    if (!sp)
      throw new HttpError(404, "Place not found.");
    if (b.undo)
      await D.prepare(`DELETE FROM spot_votes WHERE spot_id = ? AND user_id = ?`).bind(sp.id, u.id).run();
    else
      await D.prepare(`INSERT OR IGNORE INTO spot_votes (spot_id, user_id, created) VALUES (?,?,?)`).bind(sp.id, u.id, now()).run();
    return json({ ok: true });
  }
  if (!SPOT_KINDS[b.kind])
    throw new HttpError(400, "What kind of place is it?");
  const name = clean(b.name, 80);
  if (name.length < 2)
    throw new HttpError(400, "Give it a name.");
  const lat = +b.lat, lon = +b.lon;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180)
    throw new HttpError(400, "Where is it?");
  const recent = await D.prepare(`SELECT COUNT(*) AS n FROM spots WHERE user_id = ? AND created > ?`).bind(u.id, now() - 36e5).first();
  if (recent && recent.n >= 30)
    throw new HttpError(429, "That's a lot of places in an hour. Try again later.");
  const id = newId(8), status = isAdmin(env, u) ? "ok" : "pending";
  await D.prepare(`INSERT INTO spots (id, user_id, kind, name, note, lat, lon, status, created) VALUES (?,?,?,?,?,?,?,?,?)`).bind(id, u.id, b.kind, name, clean(b.note, 400) || null, lat, lon, status, now()).run();
  return json({ ok: true, id, status });
});
var onRequestDelete4 = handle(async ({ request, env }) => {
  sameOrigin(request);
  const u = await requireUser(env, request), id = new URL(request.url).searchParams.get("id") || "", D = await db(env);
  await D.batch([D.prepare(`DELETE FROM spots WHERE id = ? AND user_id = ?`).bind(id, u.id), D.prepare(`DELETE FROM spot_votes WHERE spot_id = ? AND NOT EXISTS (SELECT 1 FROM spots WHERE id = ?)`).bind(id, id)]);
  return json({ ok: true });
});
async function onRequest(ctx) {
  const u = new URL(ctx.request.url);
  if (u.hostname === "www.onetrackmind.online") {
    u.hostname = "onetrackmind.online";
    return Response.redirect(u.toString(), 301);
  }
  return ctx.next();
}
__name(onRequest, "onRequest");
__name2(onRequest, "onRequest");
var routes = [
  {
    routePath: "/api/admin/queue",
    mountPath: "/api/admin",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/api/admin/queue",
    mountPath: "/api/admin",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/auth/logout",
    mountPath: "/api/auth",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/api/auth/me",
    mountPath: "/api/auth",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet2]
  },
  {
    routePath: "/api/auth/start",
    mountPath: "/api/auth",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost3]
  },
  {
    routePath: "/api/auth/verify",
    mountPath: "/api/auth",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet3]
  },
  {
    routePath: "/api/routes/public",
    mountPath: "/api/routes",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet4]
  },
  {
    routePath: "/api/routes/:id",
    mountPath: "/api/routes/:id",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete]
  },
  {
    routePath: "/api/routes/:id",
    mountPath: "/api/routes/:id",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet6]
  },
  {
    routePath: "/api/routes/:id",
    mountPath: "/api/routes/:id",
    method: "PUT",
    middlewares: [],
    modules: [onRequestPut]
  },
  {
    routePath: "/api/account",
    mountPath: "/api/account",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete2]
  },
  {
    routePath: "/api/account",
    mountPath: "/api/account",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost5]
  },
  {
    routePath: "/api/feedback",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost6]
  },
  {
    routePath: "/api/places",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost7]
  },
  {
    routePath: "/api/ratings",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet7]
  },
  {
    routePath: "/api/ratings",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost8]
  },
  {
    routePath: "/api/reports",
    mountPath: "/api",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete3]
  },
  {
    routePath: "/api/reports",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet8]
  },
  {
    routePath: "/api/reports",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost9]
  },
  {
    routePath: "/api/routes",
    mountPath: "/api/routes",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet5]
  },
  {
    routePath: "/api/routes",
    mountPath: "/api/routes",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost4]
  },
  {
    routePath: "/api/spots",
    mountPath: "/api",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete4]
  },
  {
    routePath: "/api/spots",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet9]
  },
  {
    routePath: "/api/spots",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost10]
  },
  {
    routePath: "/",
    mountPath: "/",
    method: "",
    middlewares: [onRequest],
    modules: []
  }
];
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
__name2(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name2(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name2(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name2(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name2(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name2(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
__name2(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
__name2(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name2(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
__name2(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
__name2(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
__name2(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
__name2(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
__name2(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
__name2(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
__name2(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");
__name2(pathToRegexp, "pathToRegexp");
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
__name2(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name2(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: () => {
            isFailOpen = true;
          }
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name2((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
var drainBody = /* @__PURE__ */ __name2(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
__name2(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name2(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
__name2(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
__name2(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");
__name2(__facade_invoke__, "__facade_invoke__");
var __Facade_ScheduledController__ = /* @__PURE__ */ __name(class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
}, "__Facade_ScheduledController__");
__name2(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name2(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name2(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
__name2(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
__name2(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;

// ../../../tmp/claude-0/-home-claude/5b6bdadb-e735-5711-b67b-2eb711efc2fa/scratchpad/tools/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default2 = drainBody2;

// ../../../tmp/claude-0/-home-claude/5b6bdadb-e735-5711-b67b-2eb711efc2fa/scratchpad/tools/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError2(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError2(e.cause)
  };
}
__name(reduceError2, "reduceError");
var jsonError2 = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError2(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default2 = jsonError2;

// .wrangler/tmp/bundle-ufl4Jp/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__2 = [
  middleware_ensure_req_body_drained_default2,
  middleware_miniflare3_json_error_default2
];
var middleware_insertion_facade_default2 = middleware_loader_entry_default;

// ../../../tmp/claude-0/-home-claude/5b6bdadb-e735-5711-b67b-2eb711efc2fa/scratchpad/tools/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__2 = [];
function __facade_register__2(...args) {
  __facade_middleware__2.push(...args.flat());
}
__name(__facade_register__2, "__facade_register__");
function __facade_invokeChain__2(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__2(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__2, "__facade_invokeChain__");
function __facade_invoke__2(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__2(request, env, ctx, dispatch, [
    ...__facade_middleware__2,
    finalMiddleware
  ]);
}
__name(__facade_invoke__2, "__facade_invoke__");

// .wrangler/tmp/bundle-ufl4Jp/middleware-loader.entry.ts
var __Facade_ScheduledController__2 = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__2)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__2, "__Facade_ScheduledController__");
function wrapExportedHandler2(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__2 === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__2.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__2) {
    __facade_register__2(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__2(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__2(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler2, "wrapExportedHandler");
function wrapWorkerEntrypoint2(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__2 === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__2.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__2) {
    __facade_register__2(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__2(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__2(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint2, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY2;
if (typeof middleware_insertion_facade_default2 === "object") {
  WRAPPED_ENTRY2 = wrapExportedHandler2(middleware_insertion_facade_default2);
} else if (typeof middleware_insertion_facade_default2 === "function") {
  WRAPPED_ENTRY2 = wrapWorkerEntrypoint2(middleware_insertion_facade_default2);
}
var middleware_loader_entry_default2 = WRAPPED_ENTRY2;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__2 as __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default2 as default
};
//# sourceMappingURL=functionsWorker-0.025592546571003405.js.map
