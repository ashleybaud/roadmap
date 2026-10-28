// GET: the visitor's country (from Cloudflare, nothing stored), so the first screen can show the right door.
export const onRequestGet = ({ request }) => new Response(JSON.stringify({ country: (request.cf && request.cf.country) || null }),
  { headers: { "Content-Type": "application/json", "Cache-Control": "private, max-age=3600" } });
