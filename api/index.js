// Serves the join page with link-preview tags filled in. When the link has ?p=CODE the preview
// shows the party name, so the shared link looks personal in iMessage, WhatsApp and Instagram.
const fs = require('fs');
const path = require('path');
const { db, escapeHtml } = require('../lib/util');

let template;
function tpl() {
  if (!template) template = fs.readFileSync(path.join(__dirname, '..', 'views', 'join.html'), 'utf8');
  return template;
}

module.exports = async (req, res) => {
  try {
    const code = String((req.query && req.query.p) || '').trim().toUpperCase().slice(0, 6);
    let partyName = '';
    if (/^[A-Z0-9]{6}$/.test(code)) {
      try {
        const { data } = await db().from('parties').select('name').eq('code', code).maybeSingle();
        if (data) partyName = data.name;
      } catch (e) { /* preview still works without the name */ }
    }
    const host = req.headers['x-forwarded-host'] || req.headers.host || '';
    const origin = host ? `https://${host}` : (process.env.SITE_URL || '').replace(/\/$/, '');
    const title = partyName ? `${partyName} on Embers` : 'Embers: one disposable camera for your gathering';
    const desc = partyName
      ? 'Tap to join. You get 10 shots on a film camera in your browser, and everyone sees the photos once the host develops the film.'
      : 'A shared disposable camera in your browser. 10 shots each, and the photos stay hidden until the host develops the film.';
    const html = tpl()
      .replace(/{{OG_TITLE}}/g, escapeHtml(title))
      .replace(/{{OG_DESC}}/g, escapeHtml(desc))
      .replace(/{{OG_URL}}/g, escapeHtml(origin + (req.url || '/')))
      .replace(/{{OG_IMAGE}}/g, escapeHtml(origin + '/og.png'))
      .replace(/{{HEADING}}/g, partyName ? escapeHtml(partyName) : 'Embers');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(html);
  } catch (e) {
    console.error(e);
    res.status(500).send('Something went wrong. Try again.');
  }
};
