/* ════════════════════════════════════════════════════════════════════
   Password gate for the whole site, plus a permanent block on the two
   directories that should never have been reachable.

   Runs at the edge before anything is served. A valid signed cookie
   passes straight through; anything else gets the unlock page.

   Env: GATE_PW — the password. If it is unset the gate is open, so a
   missing variable can never lock you out of your own site. The block on
   tools/ and dist/ is deliberately *above* that fail-open, because a
   no-build host serves the whole repo root: dist/ is a single file
   containing the entire application and the entire cultural calendar,
   the browser never asks for it, and it must stay unreachable whether
   the gate is configured or not.

   The cookie is `exp.signature`, signed with HMAC-SHA256 keyed on the
   password itself. Two consequences worth knowing:

     · the expiry is inside the signature, so a client cannot extend its
       own session by holding the cookie past its date, and
     · changing GATE_PW invalidates every cookie in existence, so a
       rotation evicts everyone.
   ════════════════════════════════════════════════════════════════════ */

export const config = {
  matcher: [
    // Everything except the unlock page, its endpoint, and the one asset that
    // page loads. The styling is inline so no stylesheet has to be let out —
    // but the tab icon is a file, and gating it left the lock screen showing a
    // blank favicon while the browser quietly followed a 307 to an HTML page.
    '/((?!api/gate|gate\\.html|gate$|favicon\\.svg|_vercel).*)',
  ],
};

const COOKIE = 'ltpm_gate';
const enc = new TextEncoder();

/* Repo directories the browser never asks for. tools/ holds the build scripts
   and the smoke harness; dist/ holds the flattened single-file bundle, which is
   the whole application including the calendar — served from here it would be
   an unauthenticated copy of everything the gate exists to protect. */
const NEVER_SERVE = /^\/(tools|dist)\//;

async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(String(value)));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Constant-time compare, so a wrong cookie cannot be probed byte by byte. */
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* Framework-agnostic edge middleware, so `request` is a plain Request —
   there is no `request.cookies` helper. Parse the header ourselves. */
function readCookie(request, name) {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

export default async function middleware(request) {
  const url = new URL(request.url);

  // Above the fail-open on purpose — see the note at the top of the file.
  if (NEVER_SERVE.test(url.pathname)) {
    return new Response('Not found', {
      status: 404,
      headers: { 'content-type': 'text/plain' },
    });
  }

  const secret = process.env.GATE_PW;
  if (!secret) return; // fail open — never lock the owner out over a missing var

  const cookie = readCookie(request, COOKIE);
  if (cookie) {
    const dot = cookie.indexOf('.');
    const exp = cookie.slice(0, dot);
    const sig = cookie.slice(dot + 1);
    if (dot > 0 && sig && Number(exp) > Date.now() && safeEqual(sig, await sign(exp, secret))) {
      return; // valid and unexpired
    }
  }

  // Give the API a clean 401 rather than an HTML page it cannot parse.
  if (url.pathname.startsWith('/api/')) {
    return new Response(JSON.stringify({ error: 'Locked' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  url.pathname = '/gate.html';
  url.search = '';
  return Response.redirect(url, 307);
}
