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
  if (!key) return json({ error: "Missing delete key." }, 401);

  try {
    const row = await env.DB.prepare(
      "select delete_key from sightings where id = ?"
    ).bind(id).first();

    // Same answer whether the row does not exist or the key is wrong. Telling
    // the difference would let someone probe which ids are real.
    if (!row || row.delete_key !== key) {
      return json({ error: "Not found, or that key does not match." }, 404);
    }

    await env.DB.prepare("delete from sightings where id = ?").bind(id).run();
    return json({ deleted: id });
  } catch (err) {
    return json({ error: "Could not delete it: " + err.message }, 500);
  }
}
