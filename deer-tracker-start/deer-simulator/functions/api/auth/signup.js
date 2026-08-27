// POST /api/auth/signup   — claim a username and set its password
//
// Body: { "username": "...", "password": "..." }
// On success the reply carries a Set-Cookie for the new session, so signing up
// logs you in: nobody wants to type the same password twice in a row.

import {
  json, hashPassword, startSession, currentUser,
  USERNAME_RE, MIN_PASSWORD, MAX_PASSWORD, display,
} from "../_auth.js";

export async function onRequestPost({ request, env }) {
  // Already signed in? Making a second account from a live session is almost
  // always a mistake, and it would silently strand the first one's cookie.
  if (await currentUser(request, env)) {
    return json({ error: "You are already signed in. Log out first." }, 409);
  }

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return json({ error: "That was not JSON." }, 400);
  }

  const username = String(body.username || "").trim().replace(/^@+/, "");
  const password = String(body.password || "");

  // The page checks these too. These are the ones that count, because anything
  // on the internet can post here without ever loading the page.
  if (!USERNAME_RE.test(username)) {
    return json({
      error: "A username is 3 to 20 characters, using letters, numbers, dot, dash or underscore.",
    }, 400);
  }
  if (password.length < MIN_PASSWORD) {
    return json({ error: "The password needs at least " + MIN_PASSWORD + " characters." }, 400);
  }
  if (password.length > MAX_PASSWORD) {
    return json({ error: "That password is too long." }, 400);
  }
  // A password that is just the username is not a password.
  if (password.toLowerCase() === username.toLowerCase()) {
    return json({ error: "Pick a password that is not your username." }, 400);
  }

  const usernameLc = username.toLowerCase();
  const stored = await hashPassword(password);
  const now = new Date().toISOString();

  try {
    await env.DB.prepare(
      `insert into users (username, username_lc, password, created_at)
       values (?, ?, ?, ?)`
    ).bind(username, usernameLc, stored, now).run();
  } catch (err) {
    // The unique index on username_lc is what actually decides who got the
    // name: two people signing up at the same second both pass a "is it free?"
    // check, and only one of them gets past this insert.
    if (/unique/i.test(err.message)) {
      return json({ error: "That username is taken." }, 409);
    }
    return json({ error: "Could not create the account: " + err.message }, 500);
  }

  const cookie = await startSession(env, username);
  return json(
    { username: username, handle: display(username) },
    201,
    { "set-cookie": cookie }
  );
}
