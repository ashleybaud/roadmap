// GET: the visitor's country and rough position (from Cloudflare, nothing stored), so the first screen shows the right door
// and a phone or computer location that's clearly wrong (hundreds of km off) isn't used.
export const onRequestGet = ({ request }) => { const c = request.cf || {};
  const num = v => (v == null || v === "" || isNaN(+v) ? null : +(+v).toFixed(2));
  return new Response(JSON.stringify({ country: c.country || null, lat: num(c.latitude), lon: num(c.longitude), city: c.city || null }),
    { headers: { "Content-Type": "application/json", "Cache-Control": "private, max-age=3600" } }); };
