const crypto = require('crypto');
const { db, send, handler, fail, requireHost, escapeHtml } = require('../lib/util');
const { sendMany, configured } = require('../lib/mail');

// Releases the gallery (stops new photos) and emails every verified guest their link.
// Calling it again re-sends the emails.
module.exports = handler('POST', async (req, res) => {
  const party = await requireHost(req);
  if (!configured()) throw fail(500, 'Email is not set up yet. Add your email settings in Vercel, then try again.');

  const { data: guests } = await db()
    .from('guests')
    .select('id, name, email, gallery_key, gallery_variant')
    .eq('party_id', party.id)
    .eq('verified', true);

  if (!guests || guests.length === 0) throw fail(400, 'No guests have joined yet.');

  if (!party.released) {
    await db().from('parties').update({ released: true, released_at: new Date().toISOString() }).eq('id', party.id);
  }

  // Experiment: half the guests get email A (plain), half get B (personal photo count).
  // The split is stable (hash of the guest id), and a guest keeps their variant if the host re-sends.
  const { data: counts } = await db().from('photos').select('guest_id').eq('party_id', party.id);
  const perGuest = {};
  (counts || []).forEach((r) => { perGuest[r.guest_id] = (perGuest[r.guest_id] || 0) + 1; });
  const total = (counts || []).length;
  const variantOf = (g) => g.gallery_variant || (crypto.createHash('sha256').update(g.id).digest()[0] % 2 === 0 ? 'A' : 'B');

  const site = (process.env.SITE_URL || '').replace(/\/$/, '');
  const messages = guests.map((g) => {
    const link = `${site}/gallery?p=${encodeURIComponent(party.code)}&k=${encodeURIComponent(g.gallery_key)}`;
    const variant = variantOf(g);
    g.variant = variant;
    const mine = perGuest[g.id] || 0;
    const subject = variant === 'B'
      ? `${total} photos from ${party.name}, ${mine} of them yours`
      : `${party.name}: your photos are ready`;
    const intro = variant === 'B'
      ? `Hi ${escapeHtml(g.name)}, the film is developed. There are <b>${total}</b> photos from <b>${escapeHtml(party.name)}</b>, and <b>${mine}</b> of them are yours.`
      : `Hi ${escapeHtml(g.name)}, the photos from <b>${escapeHtml(party.name)}</b> are ready.`;
    return {
      to: g.email,
      subject,
      html: `<div style="background:#F2EEF6;padding:20px 12px"><div style="font-family:'Plus Jakarta Sans','Helvetica Neue',Arial,sans-serif;max-width:480px;margin:0 auto;padding:28px;color:#221F2D;background:#FCFAFD;border:1px solid #D8D7E1;border-radius:18px;line-height:1.5">
        <p style="font-family:Outfit,'Arial Rounded MT Bold','Helvetica Neue',Arial,sans-serif;font-weight:800;font-size:15px;margin:0 0 14px;color:#221F2D">Embers</p>
        <h2 style="font-family:Outfit,'Arial Rounded MT Bold','Helvetica Neue',Arial,sans-serif;font-weight:800;font-size:24px;line-height:1.15;margin:0 0 12px;color:#221F2D">Your film is developed</h2>
        <p>${intro}</p>
        <p><a href="${link}" style="display:inline-block;background:#FF4FA8;color:#221F2D;padding:14px 26px;border-radius:999px;text-decoration:none;font-family:Outfit,'Arial Rounded MT Bold','Helvetica Neue',Arial,sans-serif;font-weight:bold;font-size:16px">See the photos</a></p>
        <p style="font-size:13px;color:#5F5C6B">This link is just for you. Everyone from the gathering can see the shared gallery, so please don't forward it outside the group. If the link ever stops working, open the gallery and sign in with the gathering code (${escapeHtml(party.code)}) and this email address.</p>
      </div></div>`,
    };
  });

  const result = await sendMany(messages);
  const failedSet = new Set(result.failed);
  const now = new Date().toISOString();
  for (const g of guests) {
    if (failedSet.has(g.email)) continue;
    // Only the first send counts for the experiment, so a re-send never resets the clock.
    if (!g.gallery_variant) await db().from('guests').update({ gallery_variant: g.variant, emailed_at: now }).eq('id', g.id);
  }
  send(res, 200, { released: true, emailed: result.sent, failed: result.failed });
});
