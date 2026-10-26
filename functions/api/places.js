// Server-side relay to the OpenStreetMap Overpass service.
// Asks several public servers at once and returns the first good answer,
// so one busy or blocked server doesn't stall the page.
const SERVERS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
const TIMEOUT_MS = 25000;

async function ask(url, body, signal) {
  const r = await fetch(url, {
    method: "POST",
    body,
    signal,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "OneTrackMind/0.3 (+https://onetrackmind.online)",
      "Accept": "application/json",
    },
  });
  if (!r.ok) throw new Error(`${url} ${r.status}`);
  const text = await r.text();
  if (!text.trim().startsWith("{")) throw new Error(`${url} not json`);
  return text;
}

export async function onRequestPost({ request }) {
  const body = await request.text();
  if (!body.startsWith("data=") || body.length > 200000) {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const text = await Promise.any(SERVERS.map((u) => ask(u, body, ctl.signal)));
    ctl.abort();
    return new Response(text, { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" } });
  } catch (e) {
    return Response.json({ error: "places service busy" }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
