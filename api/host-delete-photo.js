const { db, send, handler, fail, requireHost } = require('../lib/util');

// Host removes one photo. The file is deleted from storage first (that is what frees the space),
// then the database row. A guest's shot count is NOT given back, so deleting never hands out extra shots.
module.exports = handler('POST', async (req, res) => {
  const party = await requireHost(req);
  const photoId = String((req.body && req.body.photoId) || '');
  if (!photoId) throw fail(400, 'Missing photo.');

  const { data: photo } = await db().from('photos').select('id, path, party_id').eq('id', photoId).maybeSingle();
  if (!photo || photo.party_id !== party.id) throw fail(404, 'Photo not found.');

  const { error: rmErr } = await db().storage.from('photos').remove([photo.path]);
  if (rmErr) throw fail(500, 'Could not delete the file. Nothing was changed. Try again.');

  const { error: rowErr } = await db().from('photos').delete().eq('id', photo.id);
  if (rowErr) throw rowErr;

  send(res, 200, { ok: true });
});
