import { handle, json, endSession, sameOrigin } from "../../../server/otm.js";
export const onRequestPost = handle(async ({ request, env }) => {
  sameOrigin(request);
  return json({ ok: true }, 200, { "Set-Cookie": await endSession(env, request) });
});
