const { db, send, handler, fail, requireHost, escapeHtml } = require('../lib/util');
const { sendMany, configured } = require('../lib/mail');

// Releases the gallery (stops new photos) and emails every verified guest their link.
// Calling it again re-sends the emails.
module.exports = handler('POST', async (req, res) => {
  const party = await requireHost(req);
  if (!configured()) throw fail(500, 'Email is not set up yet. Add your email settings in Vercel, then try again.');

  const { data: guests } = await db()
    .from('guests')
    .select('name, email, gallery_key')
    .eq('party_id', party.id)
    .eq('verified', true);

  if (!guests || guests.length === 0) throw fail(400, 'No guests have joined yet.');

  if (!party.released) {
    await db().from('parties').update({ released: true, released_at: new Date().toISOString() }).eq('id', party.id);
  }

  const site = (process.env.SITE_URL || '').replace(/\/$/, '');
  const messages = guests.map((g) => {
    const link = `${site}/gallery?p=${encodeURIComponent(party.code)}&k=${encodeURIComponent(g.gallery_key)}`;
    return {
      to: g.email,
      subject: `${party.name}: your photos are ready`,
      html: `<div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;padding:28px;color:#d5d5d5;background:#0a0a0a;border:1px solid #353535;border-radius:16px">
        <h2 style="margin:0 0 12px">Your film is developed</h2>
        <p>Hi ${escapeHtml(g.name)}, the photos from <b>${escapeHtml(party.name)}</b> are ready.</p>
        <p><a href="${link}" style="display:inline-block;background:#ff1493;color:#0a0a0a;padding:13px 24px;border-radius:999px;text-decoration:none;font-weight:bold">See the photos</a></p>
        <p style="font-size:13px;color:#9a9a9a">This link is just for you. Everyone from the gathering can see the shared gallery, so please don't forward it outside the group. If the link ever stops working, open the gallery and sign in with the party code (${escapeHtml(party.code)}) and this email address.</p>
      </div>`,
    };
  });

  const result = await sendMany(messages);
  send(res, 200, { released: true, emailed: result.sent, failed: result.failed });
});
