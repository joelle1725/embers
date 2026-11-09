const { db, send, handler, fail, bearer, verifyHostToken, normalizeEmail, validEmail, clientIp, rateBlocked, rateFail, TOO_MANY } = require('../lib/util');

// Shared gallery. You get in with the party code AND proof you belong to that party:
//   POST { code, email }  the email you joined with (the sign-in form)
//   GET  ?p=CODE&k=KEY    the personal key from your emailed link
//   GET  with a guest session or host login token
module.exports = handler(['GET', 'POST'], async (req, res) => {
  const isPost = req.method === 'POST';
  const src = isPost ? (req.body || {}) : req.query;
  const code = String(src.code || src.p || '').trim().toUpperCase();
  if (!code) throw fail(400, 'Enter the party code.');

  // Rate limit wrong guesses: 10 per IP and 5 per party and email, per 15 minutes.
  const WIN = 15 * 60;
  const ipKey = 'gal:ip:' + clientIp(req);
  const emailKey = isPost && validEmail(src.email || '') ? 'gal:' + code + ':' + normalizeEmail(src.email) : '';
  if (await rateBlocked(ipKey, 10, WIN) || (emailKey && await rateBlocked(emailKey, 5, WIN))) throw fail(429, TOO_MANY);

  const { data: party } = await db().from('parties').select('id, name, released').eq('code', code).maybeSingle();
  if (!party) { await rateFail(ipKey, WIN); throw fail(404, 'That party code was not found.'); }

  let viewer = null;
  let isHost = false;
  if (isPost) {
    if (!validEmail(src.email || '')) throw fail(400, 'Enter the email you used to join.');
    const { data } = await db().from('guests').select('name').eq('party_id', party.id)
      .eq('email_norm', normalizeEmail(src.email)).eq('verified', true).maybeSingle();
    if (!data) {
      await rateFail(ipKey, WIN); await rateFail(emailKey, WIN);
      throw fail(403, 'We could not find that email at this party. Use the email you joined with.');
    }
    viewer = data.name;
  } else {
    const key = String(req.query.k || '');
    const token = bearer(req);
    if (key) {
      const { data } = await db().from('guests').select('name').eq('party_id', party.id).eq('gallery_key', key).maybeSingle();
      if (data) viewer = data.name;
    }
    if (viewer === null && token) {
      if (verifyHostToken(token) === party.id) { viewer = ''; isHost = true; }
      else {
        const { data } = await db().from('guests').select('name').eq('party_id', party.id).eq('token', token).maybeSingle();
        if (data) viewer = data.name;
      }
    }
    if (viewer === null) {
      if (key) await rateFail(ipKey, WIN);
      throw fail(403, 'Sign in with the party code and your email to see the photos.');
    }
  }

  if (!party.released) return send(res, 200, { partyName: party.name, released: false, photos: [], viewer, isHost });

  const { data: photos } = await db()
    .from('photos')
    .select('id, path, taken_at, guests(name)')
    .eq('party_id', party.id)
    .order('taken_at', { ascending: true });

  const list = photos || [];
  const paths = list.map((p) => p.path);
  let signed = [];
  if (paths.length) {
    const { data, error } = await db().storage.from('photos').createSignedUrls(paths, 60 * 60 * 3);
    if (error) throw error;
    signed = data;
  }

  send(res, 200, {
    partyName: party.name,
    released: true,
    viewer,
    isHost,
    photos: list.map((p, i) => ({
      id: p.id,
      url: signed[i] && signed[i].signedUrl,
      name: (p.guests && p.guests.name) || '',
      takenAt: p.taken_at,
    })).filter((p) => p.url),
  });
});
