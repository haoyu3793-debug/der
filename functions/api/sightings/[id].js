// DELETE /api/sightings/<id>
//
// The square brackets in the filename are how Cloudflare Pages says "this part
// of the URL is a variable". A request for /api/sightings/abc-123 arrives here
// with params.id === "abc-123".
//
// Anyone on the internet can send this request, so the id alone must not be
// enough to delete a row - ids are visible to everybody in the feed. The
// browser has to prove it is the one that created the sighting, by sending
// back the delete_key it was given at the time.
//
// Now that sightings are signed by a real account there is a second way in: if
// the session cookie says you are the author, you may delete it. The delete_key
// only ever lived in one browser's localStorage, so before this, logging in on
// your phone left you unable to remove something you had posted from your
// laptop — your own sighting, and no way to take it back.

import { currentUser } from "../_auth.js";

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function onRequestDelete({ params, request, env }) {
  const id = params.id;

  // The key comes in a header rather than the URL: URLs end up in server logs,
  // browser history and the Referer header, and this one is a secret.
  const key = request.headers.get("x-delete-key");
  const user = await currentUser(request, env);

  // Neither proof of ownership offered at all: stop here.
  if (!key && !user) return json({ error: "Missing delete key." }, 401);

  try {
    const row = await env.DB.prepare(
      "select delete_key, author_user from sightings where id = ?"
    ).bind(id).first();

    const holdsKey = !!(key && row && row.delete_key === key);

    // Compare the ACCOUNT, never the displayed name. row.author is a string
    // somebody typed; a session is backed by a password. Both can be the text
    // "@velvetmeadow81", and === will say they are equal - correctly, they are
    // equal strings. What is wrong is treating equal strings as the same
    // person. Registering a name that already appeared on old rows used to
    // hand you those rows.
    //
    // author_user is null on every guest row and on every row posted before
    // accounts existed, so those match nobody and fall back to the delete key.
    // That is the right outcome: they were never owned by an account, so they
    // cannot start being owned by one now.
    const isAuthor = !!(user && row && row.author_user === user);

    // Same answer whether the row does not exist or neither proof matched.
    // Telling the difference would let someone probe which ids are real.
    if (!row || (!holdsKey && !isAuthor)) {
      return json({ error: "Not found, or that key does not match." }, 404);
    }

    await env.DB.prepare("delete from sightings where id = ?").bind(id).run();
    return json({ deleted: id });
  } catch (err) {
    return json({ error: "Could not delete it: " + err.message }, 500);
  }
}
