const { db, send, handler, requireHost, rollClosed } = require('../lib/util');

module.exports = handler('GET', async (req, res) => {
  const party = await requireHost(req);

  const { data: guests } = await db()
    .from('guests')
    .select('id, name, email, verified, shots_used, created_at')
    .eq('party_id', party.id)
    .order('created_at', { ascending: true });

  const { count } = await db()
    .from('photos')
    .select('id', { count: 'exact', head: true })
    .eq('party_id', party.id);

  send(res, 200, {
    party: { name: party.name, code: party.code, released: party.released, releasedAt: party.released_at, maxShots: party.max_shots, endsAt: party.ends_at, filmLook: party.film_look, closed: rollClosed(party) },
    guests: guests || [],
    photoCount: count || 0,
  });
});
