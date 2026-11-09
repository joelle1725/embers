const { db, send, handler, fail, rand, sixDigit, normalizeEmail, validEmail, escapeHtml } = require('../lib/util');
const { sendMany, configured } = require('../lib/mail');

const CODE_MINUTES = 15;

module.exports = handler('POST', async (req, res) => {
  const { code, name, email } = req.body || {};
  const guestName = String(name || '').trim();
  const guestEmail = String(email || '').trim();

  if (!guestName || guestName.length > 40) throw fail(400, 'Enter your name (up to 40 characters).');
  if (!validEmail(guestEmail)) throw fail(400, 'Enter a valid email address.');

  const { data: party } = await db()
    .from('parties')
    .select('id, name, released')
    .eq('code', String(code || '').trim().toUpperCase())
    .single();
  if (!party) throw fail(404, 'That gathering code was not found. Open the invite link again.');
  if (party.released) throw fail(403, 'This gathering\'s film has already been developed.');

  const emailNorm = normalizeEmail(guestEmail);
  const verifyOn = process.env.REQUIRE_VERIFY !== 'false';

  // One roll per inbox per party. Re-entering the same email never resets the count.
  let { data: guest } = await db()
    .from('guests')
    .select('*')
    .eq('party_id', party.id)
    .eq('email_norm', emailNorm)
    .maybeSingle();

  if (!guest) {
    const { data, error } = await db()
      .from('guests')
      .insert({ party_id: party.id, name: guestName, email: guestEmail, email_norm: emailNorm, gallery_key: rand(24) })
      .select('*')
      .single();
    if (error) throw error;
    guest = data;
  }

  // Skip the code step: issue a session right away.
  if (!verifyOn) {
    const token = rand(32);
    await db().from('guests').update({ token, verified: true, name: guestName }).eq('id', guest.id);
    return send(res, 200, { needsVerify: false, token });
  }

  // Throttle code emails (one per 45 seconds per guest).
  if (guest.verify_expires) {
    const sentAt = new Date(guest.verify_expires).getTime() - CODE_MINUTES * 60 * 1000;
    if (Date.now() - sentAt < 45 * 1000) throw fail(429, 'We just sent a code. Wait a few seconds and try again.');
  }

  if (!configured()) throw fail(500, 'Email is not set up yet, so the code cannot be sent.');

  const verifyCode = sixDigit();
  await db()
    .from('guests')
    .update({
      name: guestName,
      verify_code: verifyCode,
      verify_expires: new Date(Date.now() + CODE_MINUTES * 60 * 1000).toISOString(),
      verify_attempts: 0,
    })
    .eq('id', guest.id);

  const result = await sendMany([{
    to: guestEmail,
    subject: `Your code for ${party.name}: ${verifyCode}`,
    html: `<div style="font-family:Georgia,serif;max-width:420px;margin:0 auto;padding:24px;color:#d5d5d5;background:#0a0a0a;border:1px solid #353535;border-radius:16px">
      <p>Hi ${escapeHtml(guestName)}, your code for <b>${escapeHtml(party.name)}</b> is:</p>
      <p style="font-size:32px;letter-spacing:6px;margin:12px 0;color:#ff1493"><b>${verifyCode}</b></p>
      <p style="font-size:13px;color:#9a9a9a">It expires in ${CODE_MINUTES} minutes.</p></div>`,
  }]);
  if (result.failed.length) throw fail(500, 'Could not send the email. Check the address and try again.');

  send(res, 200, { needsVerify: true, guestId: guest.id });
});
