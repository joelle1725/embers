const { db, send, handler, fail, partyCode, hashPassword, signHostToken, parseEndsAt, LOOKS } = require('../lib/util');

module.exports = handler(['GET', 'POST'], async (req, res) => {
  // The host page asks this first, so it only shows the passcode box when one is set.
  if (req.method === 'GET') return send(res, 200, { needsKey: Boolean(process.env.CREATE_PASSCODE) });

  const { name, hostPassword, createKey, endsAt, filmLook } = req.body || {};

  // Optional: stops strangers from creating gatherings on your deployment.
  if (process.env.CREATE_PASSCODE && createKey !== process.env.CREATE_PASSCODE) {
    throw fail(403, 'Wrong creator passcode.');
  }

  const partyName = String(name || '').trim();
  if (!partyName || partyName.length > 80) throw fail(400, 'Give your gathering a name (up to 80 characters).');
  if (!hostPassword || String(hostPassword).length < 6) throw fail(400, 'Host password must be at least 6 characters.');

  const ends = parseEndsAt(endsAt);
  const look = LOOKS.includes(filmLook) ? filmLook : 'classic';
  const pass = hashPassword(String(hostPassword));

  for (let i = 0; i < 5; i++) {
    const code = partyCode();
    const { data, error } = await db()
      .from('parties')
      .insert({ code, name: partyName, host_pass_hash: pass, ends_at: ends, film_look: look })
      .select('id, code')
      .single();
    if (!error) return send(res, 200, { code: data.code, hostToken: signHostToken(data.id) });
    if (error.code !== '23505') throw error; // anything but "code already exists"
  }
  throw fail(500, 'Could not create the gathering. Try again.');
});
