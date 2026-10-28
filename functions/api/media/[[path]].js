// GET /api/media/<key>: a photo from R2 (cached for a year; keys never change).
export const onRequestGet = async ({ params, env }) => {
  if (!env.MEDIA) return new Response("Not found", { status: 404 });
  const key = (Array.isArray(params.path) ? params.path.join("/") : String(params.path || ""));
  if (!/^[\w./-]{3,200}$/.test(key) || key.includes("..")) return new Response("Not found", { status: 404 });
  const obj = await env.MEDIA.get(key); if (!obj) return new Response("Not found", { status: 404 });
  return new Response(obj.body, { headers: { "Content-Type": obj.httpMetadata?.contentType || "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable" } });
};
