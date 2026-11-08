const { send, handler, requireGuest, rollClosed } = require('../lib/util');

module.exports = handler('GET', async (req, res) => {
  const { guest, party } = await requireGuest(req);
  const site = (process.env.SITE_URL || '').replace(/\/$/, '');
  send(res, 200, {
    name: guest.name,
    partyName: party.name,
    maxShots: party.max_shots,
    shotsLeft: Math.max(party.max_shots - guest.shots_used, 0),
    endsAt: party.ends_at,
    filmLook: party.film_look || 'classic',
    closed: rollClosed(party),
    released: party.released,
    galleryUrl: party.released ? `${site}/gallery?p=${encodeURIComponent(party.code)}&k=${encodeURIComponent(guest.gallery_key)}` : null,
  });
});
