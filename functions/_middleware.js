// One address: www.onetrackmind.online goes to onetrackmind.online (same path), everything else passes through.
export async function onRequest(ctx) {
  const u = new URL(ctx.request.url);
  if (u.hostname === "www.onetrackmind.online") { u.hostname = "onetrackmind.online"; return Response.redirect(u.toString(), 301); }
  return ctx.next();
}
