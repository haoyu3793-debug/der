// POST /api/auth/login   — prove you own a username
//
// Body: { "username": "...", "password": "..." }

import {
  json, verifyPassword, startSession, currentUser, display, DUMMY_HASH,
} from "../_auth.js";

export async function onRequestPost({ request, env }) {
  // Logging in again over a live session would leave the old session row
  // behind with nothing pointing at it.
  const already = await currentUser(request, env);
  if (already) {
    return json({ username: already, handle: display(already), already: true });
  }

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return json({ error: "That was not JSON." }, 400);
  }

  const username = String(body.username || "").trim().replace(/^@+/, "");
  const password = String(body.password || "");
  if (!username || !password) {
    return json({ error: "Enter your username and password." }, 400);
  }

  let row;
  try {
    row = await env.DB.prepare(
      "select username, password from users where username_lc = ?"
    ).bind(username.toLowerCase()).first();
  } catch (err) {
    return json({ error: "Could not check that: " + err.message }, 500);
  }

  // Run the hash even when there is no such user, against a throwaway string.
  // Replying instantly for names that do not exist and slowly for names that do
  // hands anyone who is watching the clock a list of real accounts.
  const okPassword = await verifyPassword(password, row ? row.password : DUMMY_HASH);

  // One message for both "no such user" and "wrong password", for the same
  // reason: which of the two it was is not the asker's business.
  if (!row || !okPassword) {
    return json({ error: "That username and password do not match." }, 401);
  }

  const cookie = await startSession(env, row.username);
  return json(
    { username: row.username, handle: display(row.username) },
    200,
    { "set-cookie": cookie }
  );
}
