const { db, send, handler, fail, checkPassword, signHostToken, clientIp, rateBlocked, rateFail, TOO_MANY } = require('../lib/util');

module.exports = handler('POST', async (req, res) => {
  const { code, password } = req.body || {};
  const WIN = 15 * 60;
  const ipKey = 'host:ip:' + clientIp(req);
  const codeKey = 'host:' + String(code || '').trim().toUpperCase();
  if (await rateBlocked(ipKey, 10, WIN) || await rateBlocked(codeKey, 8, WIN)) throw fail(429, TOO_MANY);
  const { data: party } = await db()
    .from('parties')
    .select('id, code, host_pass_hash')
    .eq('code', String(code || '').trim().toUpperCase())
    .single();

  // Same message for "no such party" and "wrong password".
  if (!party || !checkPassword(String(password || ''), party.host_pass_hash)) {
    await rateFail(ipKey, WIN); await rateFail(codeKey, WIN);
    throw fail(401, 'Party code or password is wrong.');
  }
  send(res, 200, { code: party.code, hostToken: signHostToken(party.id) });
});
