// POST /api/auth/logout   — end this session
//
// POST, not GET: a GET that changes something can be triggered by any image tag
// on any page on the internet, and being logged out by a stranger's <img> is a
// small but real annoyance.

import { json, endSession, clearSessionCookie } from "../_auth.js";

export async function onRequestPost({ request, env }) {
  await endSession(request, env);
  // Clearing the cookie is not optional even if the row was already gone:
  // otherwise the browser keeps presenting a token forever.
  return json({ ok: true }, 200, { "set-cookie": clearSessionCookie() });
}
