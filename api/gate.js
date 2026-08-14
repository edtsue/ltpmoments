/* POST /api/gate  { password, remember }
 *
 * Sets the access cookie when the password matches GATE_PW. The cookie never
 * carries the password — it is `exp.signature`, signed with HMAC-SHA256 keyed
 * on the password, which middleware.js re-signs and compares. So there is one
 * secret, not two, and rotating it evicts every existing session.
 *
 * Classic Node handler on purpose, matching api/draft.js — a returned Response
 * object hangs on the Node runtime and would need the edge runtime instead.
 */

'use strict';

const { createHmac, timingSafeEqual } = require('node:crypto');

const COOKIE = 'ltpm_gate';
const REMEMBER_MS = 7 * 24 * 60 * 60 * 1000; // the "remember me" window
const SESSION_MS = 12 * 60 * 60 * 1000; // ceiling on an un-remembered tab

const sign = (value, secret) =>
  createHmac('sha256', secret).update(String(value)).digest('base64url');

module.exports = function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method' });
  }

  const secret = process.env.GATE_PW;
  // No password configured → the site is open and there is nothing to unlock.
  // Matches the fail-open in middleware.js.
  if (!secret) return res.status(200).json({ ok: true, open: true });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  const pw = String((body && body.password) || '');

  // Constant-time compare so the endpoint cannot be timing-probed. Buffers of
  // unequal length throw in timingSafeEqual, so length is checked separately —
  // it leaks the password's length and nothing else.
  const a = Buffer.from(pw);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return res.status(401).json({ ok: false, error: 'bad' });
  }

  const remember = !!(body && body.remember);
  const exp = Date.now() + (remember ? REMEMBER_MS : SESSION_MS);
  const token = exp + '.' + sign(exp, secret);

  // Remembered → a dated cookie that survives a browser restart. Otherwise a
  // session cookie, which dies with the browser and expires in 12h regardless.
  let cookie = `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax`;
  if (remember) cookie += `; Max-Age=${Math.floor(REMEMBER_MS / 1000)}`;

  res.setHeader('Set-Cookie', cookie);
  return res.status(200).json({ ok: true, remember: remember });
};
