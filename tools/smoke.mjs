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
    querySelector: () => mk('q'), querySelectorAll: () => [],
    offsetWidth: 320, offsetHeight: 200,
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 0, bottom: 0 })
  };
  return el;
};
for (const id of ['audList', 'audDef', 'catList', 'railFoot', 'dirTitle', 'dirLede', 'dirKick', 'hdRight', 'body', 'mkTabs', 'pmDetail']) {
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

/* app.js reads its opening direction and audience off the hash, so each
   combination is booted by setting the hash and re-importing with a cache-
   busting query. Crude, and correct: every import is a clean first paint,
   which is the state most likely to be broken. */
let fail = 0, checked = 0;
for (const aud of AUDIENCES) {
  for (let dir = 1; dir <= 5; dir++) {
    els.get('body').innerHTML = '';
    els.get('dirTitle').textContent = '';
    globalThis.location.hash = `#/${dir}/${aud.id}`;
    try {
      await import(`../app.js?a=${aud.id}&d=${dir}`);
      const html = els.get('body').innerHTML;
      checked++;
      const problems = [];
      if (!html || html.length < 400) problems.push(`body only ${html.length} chars`);
      if (/undefined|NaN|\[object Object\]/.test(html)) {
        problems.push('rendered ' + (html.match(/undefined|NaN|\[object Object\]/) || [])[0]);
      }
      if (!els.get('dirTitle').textContent) problems.push('no title');
      if (problems.length) { fail++; console.log(`FAIL  ${aud.id} / dir ${dir}: ${problems.join('; ')}`); }
      else console.log(`ok    ${aud.id.padEnd(9)} dir ${dir}  ${String(html.length).padStart(6)} chars  "${els.get('dirTitle').textContent}"`);
    } catch (e) {
      fail++; checked++;
      console.log(`THROW ${aud.id} / dir ${dir}: ${e.message}`);
    }
  }
}
console.log(`\n${checked - fail}/${checked} renders clean`);
process.exit(fail ? 1 : 0);
