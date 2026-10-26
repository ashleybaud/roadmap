// GET: who is signed in ({user:null} if nobody), and whether accounts are switched on yet.
import { handle, json, currentUser } from "../../../server/otm.js";
export const onRequestGet = handle(async ({ request, env }) => {
  const ready = !!(env.DB && env.RESEND_API_KEY);
  return json({ ready, user: ready ? await currentUser(env, request) : null });
});
