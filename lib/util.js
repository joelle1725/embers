const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

let _db;
function db() {
  if (!_db) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    _db = createClient(url, key, { auth: { persistSession: false } });
  }
  return _db;
}

function send(res, status, body) {
  res.status(status).setHeader('Cache-Control', 'no-store').json(body);
}

// Wraps a handler: method check, JSON errors, no crashes leaking details.
function handler(method, fn) {
  const methods = Array.isArray(method) ? method : [method];
  return async (req, res) => {
    try {
      if (!methods.includes(req.method)) return send(res, 405, { error: 'Method not allowed' });
      await fn(req, res);
    } catch (e) {
      if (e && e.status) return send(res, e.status, { error: e.message });
      console.error(e);
      send(res, 500, { error: 'Something went wrong. Try again.' });
    }
  };
}

function fail(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function bearer(req) {
  const h = req.headers['authorization'] || '';
  return h.startsWith('Bearer ') ? h.slice(7) : '';
}

const LOOKS = ['classic', 'golden', 'cool35', 'mono'];

// The roll is closed once the host releases the gallery or the end time passes.
function rollClosed(party) {
  if (party.released) return true;
  return Boolean(party.ends_at && new Date(party.ends_at).getTime() <= Date.now());
}

// Accepts an ISO string or null/'' (clears it). Throws 400 on junk.
function parseEndsAt(v) {
  if (v === null || v === undefined || v === '') return null;
  const t = new Date(v);
  if (Number.isNaN(t.getTime())) throw fail(400, 'That end time is not valid.');
  return t.toISOString();
}

const rand = (bytes = 24) => crypto.randomBytes(bytes).toString('base64url');

// Unambiguous characters (no 0/O, 1/I/L)
function partyCode() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

function sixDigit() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

// ---- Host passwords and tokens ----
function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function checkPassword(pw, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(pw, salt, 64);
  const real = Buffer.from(hash, 'hex');
  return test.length === real.length && crypto.timingSafeEqual(test, real);
}

function secret() {
  if (!process.env.HOST_SECRET) throw new Error('Missing HOST_SECRET');
  return process.env.HOST_SECRET;
}

function signHostToken(partyId) {
  const payload = Buffer.from(JSON.stringify({ pid: partyId, exp: Date.now() + 1000 * 60 * 60 * 24 * 7 })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyHostToken(token) {
  const [payload, sig] = String(token).split('.');
  if (!payload || !sig) return null;
  const good = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(good);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!data.exp || data.exp < Date.now()) return null;
    return data.pid;
  } catch {
    return null;
  }
}

// Returns the party row for a valid host token, or throws 401.
async function requireHost(req) {
  const pid = verifyHostToken(bearer(req));
  if (!pid) throw fail(401, 'Please log in again.');
  const { data } = await db().from('parties').select('*').eq('id', pid).single();
  if (!data) throw fail(401, 'Please log in again.');
  return data;
}

// Returns { guest, party } for a valid guest session token, or throws 401.
async function requireGuest(req) {
  const token = bearer(req);
  if (!token) throw fail(401, 'Please join the gathering first.');
  const { data: guest } = await db().from('guests').select('*').eq('token', token).eq('verified', true).single();
  if (!guest) throw fail(401, 'Please join the gathering first.');
  const { data: party } = await db().from('parties').select('*').eq('id', guest.party_id).single();
  if (!party) throw fail(401, 'Gathering not found.');
  return { guest, party };
}

// Gmail ignores dots and +tags, so treat those as the same inbox.
function normalizeEmail(email) {
  const e = String(email).trim().toLowerCase();
  const [local, domain] = e.split('@');
  if (!local || !domain) return e;
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    return local.split('+')[0].replace(/\./g, '') + '@gmail.com';
  }
  return local.split('+')[0] + '@' + domain;
}

const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e).trim()) && String(e).length <= 254;

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---- Rate limiting (failed attempts only) ----
// Counts live in the rate_limits table (see supabase/schema.sql). If that table has not been
// created yet, these helpers quietly do nothing, so the app still works.
function clientIp(req) {
  const xf = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return xf || (req.socket && req.socket.remoteAddress) || 'unknown';
}
async function rateBlocked(key, max, windowSecs) {
  try {
    const { data } = await db().from('rate_limits').select('hits, window_start').eq('key', key).maybeSingle();
    if (!data) return false;
    if (Date.now() - new Date(data.window_start).getTime() > windowSecs * 1000) return false;
    return data.hits >= max;
  } catch (e) { return false; }
}
async function rateFail(key, windowSecs) {
  try { await db().rpc('rate_hit', { p_key: key, p_window: windowSecs }); } catch (e) { /* ignore */ }
}
const TOO_MANY = 'Too many tries. Wait 15 minutes and try again.';

// Reads width and height from a JPEG header. Returns null if it is not a well formed JPEG.
function jpegSize(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    if (marker === 0xff) { i++; continue; }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { i += 2; continue; }
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return null;
}

module.exports = {
  LOOKS, rollClosed, parseEndsAt,
  db, send, handler, fail, bearer, rand, partyCode, sixDigit,
  hashPassword, checkPassword, signHostToken, verifyHostToken,
  requireHost, requireGuest, normalizeEmail, validEmail, escapeHtml,
  clientIp, rateBlocked, rateFail, TOO_MANY, jpegSize,
};
