// DELETE /api/ratings/<id>
//
// Identical to the sightings version. Reviews used to have no way to be removed
// at all, which was odd on a page where a sighting could be: same site, same
// person, two different answers to "can I take that back".

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function onRequestDelete({ params, request, env }) {
  const key = request.headers.get("x-delete-key");
  if (!key) return json({ error: "Missing delete key." }, 401);

  try {
    const row = await env.DB.prepare(
      "select delete_key from ratings where id = ?"
    ).bind(params.id).first();

    // One answer for both "no such row" and "wrong key", so nobody can use the
    // difference to work out which ids exist.
    if (!row || row.delete_key !== key) {
      return json({ error: "Not found, or that key does not match." }, 404);
    }

    await env.DB.prepare("delete from ratings where id = ?").bind(params.id).run();
    return json({ deleted: params.id });
  } catch (err) {
    return json({ error: "Could not delete it: " + err.message }, 500);
  }
}
