const { db, send, handler, fail, requireHost, parseEndsAt, LOOKS } = require('../lib/util');

// Host changes the roll end time, the film look, or closes the roll right now.
module.exports = handler('POST', async (req, res) => {
  const party = await requireHost(req);
  const { endsAt, filmLook, closeNow } = req.body || {};
  const patch = {};

  if (closeNow) patch.ends_at = new Date().toISOString();
  else if (endsAt !== undefined) patch.ends_at = parseEndsAt(endsAt);

  if (filmLook !== undefined) {
    if (!LOOKS.includes(filmLook)) throw fail(400, 'Unknown film look.');
    patch.film_look = filmLook;
  }
  if (!Object.keys(patch).length) throw fail(400, 'Nothing to change.');

  const { error } = await db().from('parties').update(patch).eq('id', party.id);
  if (error) throw error;
  send(res, 200, { ok: true, endsAt: patch.ends_at !== undefined ? patch.ends_at : party.ends_at, filmLook: patch.film_look || party.film_look });
});
