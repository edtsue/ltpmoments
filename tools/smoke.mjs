/* Renders all five directions against every audience, with a DOM stub just
   deep enough for app.js to run. It is not a browser and does not pretend to
   be one — it catches the things that actually break these mockups: a throw
   inside a draw function, an undefined in the markup, a direction that comes
   back empty. Layout is not testable here and is not claimed to be.

   Run: node tools/smoke.mjs                                                  */

const els = new Map();
const mk = (id) => {
  const el = {
    id, innerHTML: '', textContent: '', scrollTop: 0, style: {}, dataset: {},
    classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
    setAttribute() {}, getAttribute: () => null, remove() {}, appendChild() {},
    addEventListener() {}, focus() {},
    querySelector: () => mk('q'), querySelectorAll: () => [],
    offsetWidth: 320, offsetHeight: 200,
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 0, bottom: 0 })
  };
  return el;
};
for (const id of ['audList', 'audDef', 'audMode', 'catStrip', 'railFoot',
                  'hdRight', 'hdTools', 'watchTog', 'themeTog', 'body', 'panel', 'chat', 'chatBody', 'chatIn', 'chatGo', 'chatFold', 'chatClear']) {
  els.set(id, mk(id));
}

globalThis.document = {
  documentElement: { dataset: {} },
  body: { appendChild() {} },
  getElementById: id => els.get(id) || (els.set(id, mk(id)), els.get(id)),
  querySelectorAll: () => [],
  createElement: () => mk('new'),
  addEventListener() {}
};
globalThis.window = { innerWidth: 1600, innerHeight: 900, addEventListener() {} };
globalThis.matchMedia = () => ({ matches: false });
globalThis.location = { hash: '' };
globalThis.history = { replaceState() {} };

const { AUDIENCES } = await import('../data/audiences.js');

/* app.js reads its opening selection off the hash, so each case is booted by
   setting the hash and re-importing with a cache-busting query. Crude, and
   correct: every import is a clean first paint, the state most likely to be
   broken.

   Every audience on its own, then every combine mode over a pair — the pair is
   what exercises the code single selection never reaches. */
const CASES = [
  ...AUDIENCES.map(a => ({ hash: `#/3/${a.id}`, name: a.id })),
  ...['blend', 'overlap', 'any'].map(m => ({ hash: `#/3/sports+gamers/${m}`, name: `sports+gamers ${m}` })),
  { hash: '#/3/nonexistent', name: 'bad id falls back' },
  { hash: '', name: 'no hash at all' }
];

let fail = 0, checked = 0;
for (const c of CASES) {
  {
    els.get('body').innerHTML = '';
    globalThis.location.hash = c.hash;
    const aud = { id: c.name };
    try {
      await import(`../app.js?c=${encodeURIComponent(c.hash)}`);
      const html = els.get('body').innerHTML;
      checked++;
      const problems = [];
      if (!html || html.length < 400) problems.push(`body only ${html.length} chars`);
      if (/undefined|NaN|\[object Object\]/.test(html)) {
        problems.push('rendered ' + (html.match(/undefined|NaN|\[object Object\]/) || [])[0]);
      }
      if (!els.get('audList').innerHTML) problems.push('empty rail');
      if (problems.length) { fail++; console.log(`FAIL  ${c.name}: ${problems.join('; ')}`); }
      else console.log(`ok    ${c.name.padEnd(24)} ${String(html.length).padStart(6)} chars`);
    } catch (e) {
      fail++; checked++;
      console.log(`THROW ${c.name}: ${e.message}`);
    }
  }
}
console.log(`\n${checked - fail}/${checked} renders clean`);
process.exit(fail ? 1 : 0);
