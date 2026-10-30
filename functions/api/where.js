// GET: the visitor's country and rough position (from Cloudflare, nothing stored), so the first screen shows the right door
// and a phone or computer location that's clearly wrong (hundreds of km off) isn't used.
// air: the airport they'd most likely fly from (a main hub within 250 km, else the nearest large airport), for the Flights tab.
import AIR from "../../server/home-airports.js";
const rad = x => x * Math.PI / 180;
const km = (a, b, c, d) => 12742 * Math.asin(Math.sqrt(Math.sin(rad(c - a) / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad(d - b) / 2) ** 2));
function home(lat, lon) {
  if (lat == null || lon == null) return null;
  let hub = null, hd = 1e9, big = null, bd = 1e9;
  for (const a of AIR) { const d = km(lat, lon, a[2], a[3]); if (a[4] && d < hd) { hd = d; hub = a; } if (d < bd) { bd = d; big = a; } }
  const a = hub && hd <= 250 ? hub : big;
  return a ? { iata: a[0], name: a[1] } : null;
}
export const onRequestGet = ({ request }) => { const c = request.cf || {};
  const num = v => (v == null || v === "" || isNaN(+v) ? null : +(+v).toFixed(2));
  const lat = num(c.latitude), lon = num(c.longitude);
  return new Response(JSON.stringify({ country: c.country || null, lat, lon, city: c.city || null, air: home(lat, lon) }),
    { headers: { "Content-Type": "application/json", "Cache-Control": "private, max-age=3600" } }); };
