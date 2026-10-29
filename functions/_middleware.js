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
  return ctx.next();
}
