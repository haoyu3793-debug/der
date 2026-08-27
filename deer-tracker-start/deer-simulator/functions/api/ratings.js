// GET  /api/ratings  — everybody's reviews, newest first
// POST /api/ratings  — leave one
//
// Same shape as functions/api/sightings.js, on purpose: once you have read one
// of these files you have read both.
//
// Unlike a sighting, a review does not need an account. A sighting is data other
// people navigate by and it has to be attributable; a review is an opinion, and
// making people sign up before they can say the deer were lovely would collect
// far more reviews of the signup form than of the park. But if you ARE signed
// in, the review is signed with your account name and nobody else's — a name
// you own should not be typeable by a stranger.

import { currentUser, display } from "./_auth.js";

const MAX_TEXT = 400;
const MAX_NAME = 40;

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(
      `select id, stars, name, text, created_at
       from ratings
       order by created_at desc
       limit 200`
    ).all();
    // delete_key is not selected. It only ever goes back to the browser that
    // created the row, in the reply to its POST.
    return json({ ratings: results });
  } catch (err) {
    return json({ error: "Could not read the ratings: " + err.message }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch (err) {
    return json({ error: "That was not JSON." }, 400);
  }

  // The slider only offers 1 to 5 in half steps. Anything can post here without
  // using the slider, so check it properly.
  const stars = Number(body.stars);
  if (!Number.isFinite(stars) || stars < 1 || stars > 5) {
    return json({ error: "stars must be between 1 and 5." }, 400);
  }
  if (Math.round(stars * 2) !== stars * 2) {
    return json({ error: "stars must be a whole or half number." }, 400);
  }

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return json({ error: "Say something about your visit." }, 400);
  if (text.length > MAX_TEXT) return json({ error: "That review is too long." }, 400);

  // Signed in: the name is your account handle and the request does not get a
  // say. Signed out: whatever was typed, kept short and stripped of anything
  // that is not ordinary text, so nobody posts as "<script>" or as a name that
  // breaks the layout. The page escapes on the way out too - belt and braces.
  const user = await currentUser(request, env);
  let name;
  if (user) {
    name = display(user);
  } else {
    name = (String(body.name || "").replace(/[<>&"'`]/g, "").trim().slice(0, MAX_NAME))
      || "Anonymous";
    // A signed-out visitor must not be able to sign a review "@somebody". The
    // leading @ is the site's mark of a real account, so reserve it.
    if (name.startsWith("@")) name = name.replace(/^@+/, "") || "Anonymous";
  }

  const id = crypto.randomUUID();
  const deleteKey = crypto.randomUUID();
  const now = new Date().toISOString();

  try {
    await env.DB.prepare(
      `insert into ratings (id, stars, name, text, delete_key, created_at)
       values (?, ?, ?, ?, ?, ?)`
    ).bind(id, stars, name, text, deleteKey, now).run();
  } catch (err) {
    return json({ error: "The database refused it: " + err.message }, 400);
  }

  return json({ id: id, delete_key: deleteKey, name: name, created_at: now }, 201);
}
