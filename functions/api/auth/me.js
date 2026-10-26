// GET: who is signed in ({user:null} if nobody), and whether accounts are switched on yet.
import { handle, json, currentUser, isAdmin } from "../../../server/otm.js";
export const onRequestGet = handle(async ({ request, env }) => {
  const ready = !!(env.DB && env.RESEND_API_KEY);
  const user = ready ? await currentUser(env, request) : null;
  return json({ ready, user, admin: isAdmin(env, user), contributor: !!(user && (user.contributor || isAdmin(env, user))) });
});
