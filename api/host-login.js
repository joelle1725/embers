const { db, send, handler, fail, checkPassword, signHostToken } = require('../lib/util');

module.exports = handler('POST', async (req, res) => {
  const { code, password } = req.body || {};
  const { data: party } = await db()
    .from('parties')
    .select('id, code, host_pass_hash')
    .eq('code', String(code || '').trim().toUpperCase())
    .single();

  // Same message for "no such party" and "wrong password".
  if (!party || !checkPassword(String(password || ''), party.host_pass_hash)) {
    throw fail(401, 'Party code or password is wrong.');
  }
  send(res, 200, { code: party.code, hostToken: signHostToken(party.id) });
});
