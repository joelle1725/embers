const { db, send, handler, fail, rand } = require('../lib/util');

module.exports = handler('POST', async (req, res) => {
  const { guestId, code } = req.body || {};
  const { data: guest } = await db().from('guests').select('*').eq('id', String(guestId || '')).maybeSingle();

  if (!guest || !guest.verify_code) throw fail(400, 'Request a new code.');
  if (guest.verify_attempts >= 5) throw fail(429, 'Too many tries. Request a new code.');
  if (!guest.verify_expires || new Date(guest.verify_expires) < new Date()) throw fail(400, 'That code expired. Request a new one.');

  if (String(code || '').trim() !== guest.verify_code) {
    await db().from('guests').update({ verify_attempts: guest.verify_attempts + 1 }).eq('id', guest.id);
    throw fail(400, 'That code is not right.');
  }

  // New session token each time you verify; old devices are signed out.
  const token = rand(32);
  await db()
    .from('guests')
    .update({ token, verified: true, verify_code: null, verify_expires: null, verify_attempts: 0 })
    .eq('id', guest.id);

  send(res, 200, { token });
});
