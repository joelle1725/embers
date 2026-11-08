// Sends email through Resend (if RESEND_API_KEY is set) or Gmail SMTP (if GMAIL_USER is set).
const nodemailer = require('nodemailer');

let _smtp;
function smtp() {
  if (!_smtp) {
    _smtp = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    });
  }
  return _smtp;
}

function configured() {
  return Boolean(process.env.RESEND_API_KEY || (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD));
}

// messages: [{ to, subject, html }]
async function sendMany(messages) {
  if (!configured()) throw new Error('Email is not configured. Set RESEND_API_KEY or GMAIL_USER + GMAIL_APP_PASSWORD.');

  if (process.env.RESEND_API_KEY) {
    const from = process.env.MAIL_FROM || 'Embers <onboarding@resend.dev>';
    let sent = 0;
    const failed = [];
    for (let i = 0; i < messages.length; i += 100) {
      const chunk = messages.slice(i, i + 100);
      const r = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk.map((m) => ({ from, to: [m.to], subject: m.subject, html: m.html }))),
      });
      if (r.ok) sent += chunk.length;
      else {
        console.error('Resend error', r.status, await r.text());
        chunk.forEach((m) => failed.push(m.to));
      }
    }
    return { sent, failed };
  }

  const from = process.env.MAIL_FROM || `Embers <${process.env.GMAIL_USER}>`;
  let sent = 0;
  const failed = [];
  for (const m of messages) {
    try {
      await smtp().sendMail({ from, to: m.to, subject: m.subject, html: m.html });
      sent++;
    } catch (e) {
      console.error('SMTP error for', m.to, e.message);
      failed.push(m.to);
    }
  }
  return { sent, failed };
}

module.exports = { sendMany, configured };
