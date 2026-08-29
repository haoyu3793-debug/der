// GET /api/auth/me   — "who am I?"
//
// Every page asks this on load to decide whether the nav shows a name or a
// Sign in button. It answers 200 with username: null when nobody is signed in,
// rather than 401 — not being logged in is an ordinary state, not an error, and
// a 401 here would fill everybody's console with red on every page load.

import { json, currentUser, display } from "../_auth.js";

export async function onRequestGet({ request, env }) {
  const username = await currentUser(request, env);
  return json({
    username: username,
    handle: username ? display(username) : null,
  });
}
