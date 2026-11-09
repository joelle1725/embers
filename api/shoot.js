const { db, send, handler, fail, requireGuest, rand, rollClosed, jpegSize } = require('../lib/util');

module.exports = handler('POST', async (req, res) => {
  const { guest, party } = await requireGuest(req);
  if (rollClosed(party)) throw fail(403, 'The roll has ended. No more photos.');

  const image = String((req.body && req.body.image) || '');
  const match = image.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw fail(400, 'Bad image.');
  const buf = Buffer.from(match[1], 'base64');
  // The camera sends a ~960 px JPEG of a few hundred KB. Anything much bigger is not from the app.
  if (buf.length < 1000 || buf.length > 1.5 * 1024 * 1024) throw fail(400, 'Image size is not valid.');
  if (!(buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)) throw fail(400, 'Not a JPEG.');
  if (!(buf[buf.length - 2] === 0xff && buf[buf.length - 1] === 0xd9)) throw fail(400, 'Not a complete JPEG.');
  const dim = jpegSize(buf);
  if (!dim || dim.width < 200 || dim.height < 200 || dim.width > 2000 || dim.height > 2600) throw fail(400, 'Image dimensions are not valid.');

  // Use up a shot first (atomic in the database), then upload.
  const { data: used, error: rpcErr } = await db().rpc('take_shot', { p_guest: guest.id, p_max: party.max_shots });
  if (rpcErr) throw rpcErr;
  if (used === -1) throw fail(403, 'Your roll is full. All 10 shots used!');

  const path = `${party.id}/${guest.id}/${Date.now()}-${rand(6)}.jpg`;
  const { error: upErr } = await db().storage.from('photos').upload(path, buf, { contentType: 'image/jpeg', upsert: false });
  if (upErr) {
    await db().rpc('give_back_shot', { p_guest: guest.id });
    throw fail(500, 'Upload failed. That shot was not used. Try again.');
  }

  const { error: rowErr } = await db().from('photos').insert({ party_id: party.id, guest_id: guest.id, path });
  if (rowErr) {
    await db().storage.from('photos').remove([path]);
    await db().rpc('give_back_shot', { p_guest: guest.id });
    throw fail(500, 'Could not save that shot. It was not used. Try again.');
  }

  send(res, 200, { shotsLeft: Math.max(party.max_shots - used, 0) });
});
