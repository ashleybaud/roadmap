// One address: www.onetrackmind.online goes to onetrackmind.online (same path).
// The old blog address, onetrackmind.co.za, goes to the blog: an old post's link lands on the same post when it exists, everything else on /blog/.
export async function onRequest(ctx) {
  const u = new URL(ctx.request.url);
  if (u.hostname === "www.onetrackmind.online") { u.hostname = "onetrackmind.online"; return Response.redirect(u.toString(), 301); }
  if (u.hostname === "onetrackmind.co.za" || u.hostname === "www.onetrackmind.co.za") {
    let to = "https://onetrackmind.online/blog/";
    const slug = u.pathname.split("/").filter(Boolean).pop();
    if (slug && /^[a-z0-9-]{2,120}$/.test(slug) && ctx.env.ASSETS) {
      try { const r = await ctx.env.ASSETS.fetch(new Request(`https://onetrackmind.online/blog/${slug}/`)); if (r.ok) to = `https://onetrackmind.online/blog/${slug}/`; } catch (e) {}
    }
    return Response.redirect(to, 301);
  }
  // the project's own working files are not part of the website
  if (/^\/(server|scripts|src|tests|docs|reports|routing|functions|node_modules|\.git[^/]*)(\/|$)|^\/(build\.sh|package(-lock)?\.json|\.gitlab-ci\.yml|\.gitignore|README\.md|wrangler\.toml)$/i.test(u.pathname))
    return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain", "Cache-Control": "no-store" } });
  const res = await ctx.next();
  // standard browser protections on every page
  const r = new Response(res.body, res);
  r.headers.set("X-Content-Type-Options", "nosniff");
  r.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  r.headers.set("Strict-Transport-Security", "max-age=31536000");
  r.headers.set("Permissions-Policy", "camera=(), microphone=(), payment=(), usb=(), geolocation=(self)");
  if (!r.headers.has("Content-Security-Policy")) r.headers.set("Content-Security-Policy", "frame-ancestors 'self'; base-uri 'self'; object-src 'none'");
  if (!r.headers.has("X-Frame-Options")) r.headers.set("X-Frame-Options", "SAMEORIGIN");
  return r;
}
