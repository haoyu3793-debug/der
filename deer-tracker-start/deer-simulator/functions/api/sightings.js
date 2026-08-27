// GET  /api/sightings   — everybody's sightings, newest first
// POST /api/sightings   — add one
//
// This file is the whole backend for reading and writing sightings. Cloudflare
// Pages turns any file under functions/ into a URL automatically: this one sits
// at functions/api/sightings.js, so it answers /api/sightings.
//
// env.DB is the D1 database, wired up in wrangler.toml.
//
// Reading is open to anyone. Posting is not: a sighting is signed with a name,
// and a name is only worth anything if the person it belongs to is the only one
// who can put it there. That is what the session cookie is checked for below.

import { currentUser, display } from "./_auth.js";

const MAX_NOTE = 300;
const MAX_PHOTO = 400 * 1024;   // 400 KB of base64 — the browser sends ~40 KB
const PLACES = [
  "Fifteen Acres", "Furry Glen", "Phoenix Monument", "Wellington Monument",
  "Papal Cross", "Magazine Fort", "Áras an Uachtaráin perimeter",
  "Chesterfield Avenue", "Glen Pond", "Citadel Pond",
];
const SPECIES = [
  "Fallow stag (male, antlered)", "Fallow doe (female)",
  "Fawn (juvenile)", "Mixed herd",
];

// Phoenix Park, with a generous margin. A sighting outside this is either a
// mistake or somebody poking at the API.
const BOUNDS = { minLat: 53.33, maxLat: 53.38, minLng: -6.37, maxLng: -6.28 };

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // The browser must never cache the feed - it is the whole point that it
      // changes when somebody else posts.
      "cache-control": "no-store",
    },
  });
}

function bad(message) {
  return json({ error: message }, 400);
}

export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(
      `select id, seen_at, lat, lng, location, species, count, note, author, photo
       from sightings
       order by seen_at desc
       limit 500`
    ).all();

    // delete_key is deliberately not selected. It never leaves the server
    // except in the reply to the POST that created the row.
    return json({ sightings: results });
  } catch (err) {
    return json({ error: "Could not read the sightings: " + err.message }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  // Before anything else: is this a real account? Doing this first means an
  // anonymous request never reaches the rest of the handler at all.
  const user = await currentUser(request, env);
  if (!user) {
    return json({ error: "Sign in to log a sighting." }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return bad("That was not JSON.");
  }

  // Everything below re-checks what the page already checked. The page's checks
  // are a convenience for the person filling the form; these are the real ones,
  // because anything on the internet can post here without using the page.
  const count = Number(body.count);
  if (!Number.isInteger(count) || count < 1 || count > 200) {
    return bad("count must be a whole number between 1 and 200.");
  }

  if (!PLACES.includes(body.location)) return bad("Unknown location.");
  if (!SPECIES.includes(body.species)) return bad("Unknown species.");

  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) ||
      lat < BOUNDS.minLat || lat > BOUNDS.maxLat ||
      lng < BOUNDS.minLng || lng > BOUNDS.maxLng) {
    return bad("That location is not in Phoenix Park.");
  }

  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (note.length > MAX_NOTE) return bad("The note is too long.");

  let photo = null;
  if (body.photo) {
    if (typeof body.photo !== "string" || !body.photo.startsWith("data:image/")) {
      return bad("The photo is not an image.");
    }
    if (body.photo.length > MAX_PHOTO) return bad("The photo is too big.");
    photo = body.photo;
  }

  // The author is whoever the cookie says it is, and body.author is ignored
  // entirely. It used to be taken from the request, which meant posting as
  // somebody else was a matter of editing one line of JSON — the handle was
  // decoration, not identity. The name was checked at signup, so it needs no
  // sanitising here: it can only be 3-20 characters of [a-zA-Z0-9._-].
  const author = display(user);

  // Trust the server's clock for "when the row was created", but let the person
  // say when they saw the deer - back-dating is a real thing people do.
  const now = new Date();
  let seenAt = new Date(body.seen_at);
  if (isNaN(seenAt) || seenAt > now) seenAt = now;         // no sightings in the future

  const id = crypto.randomUUID();
  const deleteKey = crypto.randomUUID();

  try {
    await env.DB.prepare(
      `insert into sightings
         (id, seen_at, lat, lng, location, species, count, note, author, photo,
          delete_key, created_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, seenAt.toISOString(), lat, lng, body.location, body.species, count,
      note || null, author, photo, deleteKey, now.toISOString()
    ).run();
  } catch (err) {
    // A CHECK constraint failing lands here. The message names the rule, which
    // is more useful than a generic 500.
    return json({ error: "The database refused it: " + err.message }, 400);
  }

  // delete_key is returned exactly once, to the browser that created the row.
  // If it loses it, that sighting can no longer be deleted from the page.
  // author comes back too: the page no longer chooses it, so it has to be told
  // what was actually written.
  return json({
    id: id, delete_key: deleteKey, author: author,
    seen_at: seenAt.toISOString(),
  }, 201);
}
