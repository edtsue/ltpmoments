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

/* app.js delegates every click off document, so a stub that swallows the
   listener leaves each dialog untestable here — their markup only ever exists
   inside a handler. Recording them lets a synthetic click walk the real path:
   selector, branch, render. */
const clicks = [];

globalThis.document = {
  documentElement: { dataset: {} },
  body: { appendChild() {} },
  getElementById: id => els.get(id) || (els.set(id, mk(id)), els.get(id)),
  querySelectorAll: () => [],
  createElement: () => mk('new'),
  addEventListener(type, fn) { if (type === 'click') clicks.push(fn); }
};
globalThis.window = { innerWidth: 1600, innerHeight: 900, addEventListener() {} };
globalThis.matchMedia = () => ({ matches: false });
/* The fold measures a width and then hands the class back over two frames. */
globalThis.requestAnimationFrame = cb => setTimeout(cb, 0);

/* strip.js is a classic script, not a module — it is copied between the
   planning modules and has to stay identical in all of them, so it declares a
   global rather than exporting. The browser gets it from a <script src>; here
   it is evaluated the same way, because app.js calls `Strip.init` at its top
   level and would throw on the import without it. */
{
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../strip.js', import.meta.url), 'utf8');
  // eslint-disable-next-line no-new-func
  globalThis.Strip = new Function(`${src}; return Strip;`)();
}
globalThis.location = { hash: '' };
globalThis.history = { replaceState() {} };

const { AUDIENCES, GROUPS, CAT_GROUPS, OFFICIAL } = await import('../data/audiences.js');
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
  { hash: `#/3/${OFFICIAL[0].id}`, name: 'official target, no cut' },
  { hash: `#/3/${OFFICIAL[0].id}+sports`, name: 'no-cut target blended' },
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
      /* The official targets are named but have no cut yet, and that state has
         to be visible on every one of them. An audience with no affinity
         scores every moment exactly as any other audience with no affinity
         does, so an unmarked one is a board that looks like an answer. */
      const pend = OFFICIAL.filter(a => a.pending);
      for (const a of OFFICIAL) {
        if (!rail.includes(a.name)) problems.push(`official target "${a.name}" is not in the rail`);
      }
      const marks = (rail.match(/class="pend"/g) || []).length;
      if (marks !== pend.length) problems.push(`${marks} "no cut" marks for ${pend.length} targets without one`);
      /* And nothing without a cut may claim to be estimated — those are
         different states and the badges must not both appear. */
      if (OFFICIAL.some(a => a.pending && a.est)) problems.push('an official target is marked both pending and estimated');
      /* Every built-in is estimated, so every one carries the badge. */
      const badges = (rail.match(/class="est"/g) || []).length;
      if (badges !== AUDIENCES.filter(a => a.est).length) {
        problems.push(`${badges} Est. badges for ${AUDIENCES.filter(a => a.est).length} estimated audiences`);
      }
      if (!rail.includes('id="audAdd"')) problems.push('no add-audience button');

      /* Every audience gets an i — the rail shows a name and two categories,
         and everything that makes a board arguable is in the other ten. An
         audience without one is a set of numbers nobody can inspect. */
      const eyes = (rail.match(/data-info="/g) || []).length;
      const roster = OFFICIAL.length + AUDIENCES.length;
      if (eyes !== roster) problems.push(`${eyes} info buttons for ${roster} audiences`);

      /* FAMILIES. Every category drawn on the board has to sit under exactly
         one family header. The failure this catches is a category added to
         data but not to CAT_GROUPS: it still draws, in the "Other" block, and
         without this check nobody would notice until someone asked why the
         board had grown a heading called Other. */
      if (html.includes('data-fam="other"')) problems.push('a category is filed under no family');
      const fams = [...html.matchAll(/data-fam="([a-z]+)"/g)].map(m => m[1]);
      if (!fams.length) problems.push('no family blocks on the board');

      /* Families are drawn in CAT_GROUPS order — sport first, culture last —
         because that order is a decision about where the eye lands, not an
         accident of how the categories happen to sort. */
      const wanted = CAT_GROUPS.map(g => g.id).filter(id => fams.includes(id));
      if (fams.join() !== wanted.join()) {
        problems.push(`families drawn ${fams.join(' > ')}, expected ${wanted.join(' > ')}`);
      }

      /* Both stacks collapse, and each toggle has to carry the state a screen
         reader reads. A caret that looks like a toggle and announces nothing
         is the failure worth catching. */
      for (const [what, sel2, n] of [['family', /data-fam-tog="/g, fams.length],
                                     ['rail group', /data-grp-tog="/g, GROUPS.length]]) {
        const got = (html + rail).match(sel2);
        if (!got || got.length !== n) problems.push(`${got ? got.length : 0} ${what} toggles, expected ${n}`);
      }
      if (!/aria-expanded="(true|false)"/.test(html + rail)) {
        problems.push('a collapse toggle does not say whether it is open');
      }

      /* SHADE. Relevance is carried by how much ink a bar has, so the board
         has to actually use the ramp. One or two shades in play means the
         encoding has collapsed and every moment looks equally relevant —
         which is what it looked like before the ramp existed, and is
         indistinguishable from it at a glance. */
      const shades = new Set([...html.matchAll(/class="bar [^"]*"[^>]*--f:(\d+)%/g)].map(m => m[1]));
      if (shades.size < 3) {
        problems.push(`only ${shades.size} relevance shade(s) drawn — the ramp has collapsed`);
      }
      /* White type only where the fill can carry it. Below full hue the
         contrast against white falls under the ink's, so a bar that flips its
         type early is less legible while looking bolder. */
      const litWrong = [...html.matchAll(/class="bar [^"]*\blit\b[^"]*"[^>]*--f:(\d+)%/g)]
        .filter(m => m[1] !== '100');
      if (litWrong.length) problems.push(`${litWrong.length} bars use white type below full fill`);

      /* The top of the ramp has to go PAST the hue, or the most relevant
         moments are the same mid-tone as the merely relevant ones and nothing
         pops. Checked on the legend rather than on the bars: the legend always
         draws every step, where a board legitimately holds no moment at all in
         the top step — a hard overlap of two audiences, or an audience with no
         cut, tops out in the middle and that is the right answer. */
      const rampDark = Math.max(0, ...[...html.matchAll(/class="rmp"[\s\S]*?<\/span>/g)]
        .flatMap(m => [...m[0].matchAll(/--dk:(\d+)%/g)]).map(m => +m[1]));
      if (rampDark < 20) problems.push(`the ramp's top step only darkens ${rampDark}% — it will not stand out`);

      /* Darkening is for the top of the ramp only. A pale bar that has been
         pushed toward black is a bar whose two knobs have been crossed. */
      const oddDark = [...html.matchAll(/class="bar [^"]*"[^>]*--f:(\d+)%;--dk:(\d+)%/g)]
        .filter(m => +m[2] > 0 && m[1] !== '100');
      if (oddDark.length) problems.push(`${oddDark.length} bars darken below full hue`);

      /* ZOOM. The ribbon must always carry a sizing style — either a month
         width or the dropped minimum that Fit uses. Without one it falls back
         to the stylesheet's default and the control silently does nothing. */
      if (!/<div class="rib" style="[^"]*(--mo-w:\d+px|min-width:0)/.test(html)) {
        problems.push('the ribbon carries no zoom sizing');
      }

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
      /* checked++ already ran if the render itself succeeded, so counting it
         again here reported more cases than there are. */
      fail++;
      console.log(`THROW ${c.name}: ${e.message}`);
    }
  }
}
/* ---------- the methodology overlay ---------- */
/* Driven through the real delegation rather than by calling the builder, so it
   fails if the selector stops matching the chip — which is how this breaks in
   practice, and what a direct call would never catch. */
{
  const fire = t => clicks[clicks.length - 1]({ target: { closest: () => t } });
  const problems = [];

  fire({ id: 'methBtn', dataset: {} });
  const meth = document.getElementById('meth');
  const html = meth.innerHTML;

  if (meth.hidden !== false) problems.push('host still hidden after opening');
  if (!html.includes('role="dialog"')) problems.push('no dialog role');
  if (/undefined|NaN|\[object Object\]/.test(html)) {
    problems.push('rendered ' + (html.match(/undefined|NaN|\[object Object\]/) || [])[0]);
  }

  /* The panel's whole claim is that it reads the live model. If a weight or a
     band cut moves in relevance.js and the panel keeps the old number, it is
     describing a formula the board is not running — so assert the drawn text
     against the imported objects, never against a copy of them. */
  const { WEIGHTS, BANDS, CONGESTION_MAX } = await import('../data/relevance.js');
  const want = Object.values(WEIGHTS).map(w => w.toFixed(2).replace(/^0/, ''));

  /* Each weight is drawn TWICE — once in the equation, once in its table row —
     so a plain `html.includes` passes while one of the two is hardcoded, the
     other silently covering for it. The two places are pulled apart and
     checked separately for exactly that reason. */
  const eq = (html.match(/class="meth-eq">([\s\S]*?)<\/div>/) || [, ''])[1];
  want.forEach((s, i) => {
    if (!eq.includes(s)) problems.push(`weight ${Object.keys(WEIGHTS)[i]} (${s}) is not in the equation`);
  });
  const rw = [...html.matchAll(/class="meth-rw">([^<]*)</g)].map(m => m[1]);
  want.forEach((s, i) => {
    if (rw[i] !== s) problems.push(`row ${i + 1} weighs ${rw[i]}, model says ${s}`);
  });
  for (const b of BANDS) {
    if (!html.includes(b.label)) problems.push(`band "${b.label}" missing`);
    if (!html.includes(`${b.min}+`)) problems.push(`band cut ${b.min} missing`);
  }
  if (rw[want.length] !== `−${Math.round(CONGESTION_MAX * 100)}%`) problems.push(`congestion row reads ${rw[want.length]}`);

  /* Both honesty notes have to survive an edit to the panel. */
  if (!/invented/i.test(html)) problems.push('no placeholder warning');
  if (!/Fandom/.test(html)) problems.push('no note on what replaces this model');

  fire({ id: '', dataset: { methClose: '1' } });
  if (meth.hidden !== true) problems.push('did not close');
  if (meth.innerHTML !== '') problems.push('left markup behind when closed');

  checked++;
  if (problems.length) { fail++; console.log(`FAIL  methodology overlay: ${problems.join('; ')}`); }
  else console.log(`ok    ${'methodology overlay'.padEnd(24)} ${String(html.length).padStart(6)} chars`);
}

console.log(`\n${checked - fail}/${checked} renders clean`);
process.exit(fail ? 1 : 0);
