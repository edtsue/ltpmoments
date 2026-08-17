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

const { AUDIENCES, GROUPS } = await import('../data/audiences.js');
const { WINDOW_FROM } = await import('../data/moments.js');

/* The window app.js draws: twelve months from WINDOW_FROM. Derived rather than
   copied, so this file cannot drift from the one the app uses. */
const WINDOW_TO = (() => {
  const d = new Date(WINDOW_FROM + 'T00:00:00Z');
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
})();

/* The group block for an id, as the rail writes it. A substring test on the
   heading alone would pass on a rail that drew the words and none of the
   structure. */
const inRail = (html, id) => html.includes(`data-grp="${id}"`);

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
      const rail = els.get('audList').innerHTML;
      if (!rail) problems.push('empty rail');

      /* The rail is grouped, and an empty group must still draw its heading —
         that is the whole point of the official one. Checked on every case
         because the rail is re-rendered on each state change and a group that
         only survives the first paint is a bug nobody sees until a demo. */
      for (const g of GROUPS) {
        if (!rail.includes(g.label)) problems.push(`no "${g.label}" heading`);
        if (!inRail(rail, g.id)) problems.push(`no ${g.id} group block`);
      }
      /* Official ships empty on purpose. If it ever silently gains a member,
         something has mislabelled itself as the PA's own cut. */
      if (!rail.includes(GROUPS[0].empty)) problems.push('official group is not showing its empty state');
      /* Every built-in is estimated, so every one carries the badge. */
      const badges = (rail.match(/class="est"/g) || []).length;
      if (badges !== AUDIENCES.filter(a => a.est).length) {
        problems.push(`${badges} Est. badges for ${AUDIENCES.filter(a => a.est).length} estimated audiences`);
      }
      if (!rail.includes('id="audAdd"')) problems.push('no add-audience button');

      /* FAMILIES. Every category drawn on the board has to sit under exactly
         one family header. The failure this catches is a category added to
         data but not to CAT_GROUPS: it still draws, in the "Other" block, and
         without this check nobody would notice until someone asked why the
         board had grown a heading called Other. */
      if (html.includes('data-fam="other"')) problems.push('a category is filed under no family');
      const fams = (html.match(/data-fam="/g) || []).length;
      if (!fams) problems.push('no family blocks on the board');

      /* TODAY. Drawn only while today falls inside the planning window, so the
         check is conditional on the same thing the drawing is — otherwise this
         starts failing on 1 July 2027 for a correct reason. When it is drawn,
         its offset has to be a real fraction of the window: a line stuck at 0
         or 1 is the failure mode worth catching, because it still looks like a
         line and points at the wrong week. */
      const today = new Date().toISOString().slice(0, 10);
      if (today >= WINDOW_FROM && today <= WINDOW_TO) {
        const m = html.match(/class="today" style="--f:([\d.]+)"/);
        if (!m) problems.push('today is in the window but no today line was drawn');
        else if (!(Number(m[1]) > 0 && Number(m[1]) < 1)) {
          problems.push(`today line at --f:${m[1]}, which is not inside the window`);
        }
      } else if (html.includes('class="today"')) {
        problems.push('today is outside the window but a today line was drawn');
      }
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
