// Server-side relay to the OpenStreetMap Overpass service.
// Browsers get blocked or rate-limited by public Overpass servers; calling from here
// identifies the app properly and tries a second server if the first is busy.
const SERVERS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

export async function onRequestPost({ request }) {
  const body = await request.text();
  if (!body.startsWith("data=") || body.length > 200000) {
    return new Response(JSON.stringify({ error: "bad request" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  let last = "no server answered";
  for (const url of SERVERS) {
    try {
      const r = await fetch(url, {
        method: "POST",
        body,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "RouteAndRange/0.2 (+https://routeandrange.pages.dev)",
          "Accept": "application/json",
        },
      });
      if (r.ok) {
        return new Response(r.body, { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" } });
      }
      last = `${url} answered ${r.status}`;
    } catch (e) {
      last = `${url} failed`;
    }
  }
  return new Response(JSON.stringify({ error: last }), { status: 502, headers: { "Content-Type": "application/json" } });
}
