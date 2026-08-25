/* LTP Moments — five directions over one state.

   Every direction reads the same three things: the audience selected in the
   rail, the categories left switched on, and the twelve-month window. Nothing
   is per-direction except how it draws — so switching directions never changes
   what is being argued, only how it is shown, which is the only way five
   mockups can be compared honestly. */

import { MOMENTS } from './data/moments.js';
import { AUDIENCES, CAT_COLOR, GROUPS, CAT_GROUPS, OFFICIAL } from './data/audiences.js';
import { scoreMoments, BANDS, WEIGHTS, CONGESTION_MAX, weekKey, unclaimed, MODES, REACH_SOURCE, reachOf } from './data/relevance.js';
import { MODELS, DEFAULT_MODEL, modelById, coverage } from './data/models.js';
import { YOUGOV_SOURCE } from './data/yougov.js';
import { parseAudienceData, buildAudience } from './data/parse.js';

/* ---------- audiences the user has added ---------- */
/* The six that ship are placeholders and are marked as such. An audience the
   user defines is theirs, lives in their browser, and is never mixed in with
   the built-ins — it carries `custom` so the rail can say which is which and
   only offer to delete the ones it is safe to delete. */
const LS_KEY = 'ltpm.audiences.v1';

function loadCustom() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter(a => a && a.id && a.name && a.aff) : [];
  } catch (e) { void e; return []; }
}
function saveCustom() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(CUSTOM)); }
  catch (e) { void e; }        // a full or blocked store must not lose the session
}
let CUSTOM = loadCustom();
const ROSTER = () => [...OFFICIAL, ...AUDIENCES, ...CUSTOM];

/* Which heading an audience sits under. A record the user defined is custom
   whatever else it claims, so `custom` is read first — otherwise a saved
   record carrying a stale `group` from an older build could file itself
   under the PA's own targets, which is the one group that has to stay
   trustworthy. */
const groupOf = a => a.custom ? 'custom' : (a.group || 'popular');
const inGroup = id => ROSTER().filter(a => groupOf(a) === id);

/* Which families are collapsed, kept across reloads. A reader who shuts
   everything but Sport is telling you how they work, and making them say it
   again on every visit is the kind of small rudeness that gets a tool put
   down. Stored as a plain list of ids so a stale one is simply ignored. */
/* ZOOM. How many pixels a month is worth on the ribbon. The rungs are a fixed
   ladder rather than free scaling because every step has to stay legible: a
   bar's label either fits or it does not, and a continuous zoom spends most of
   its range in the region where labels are half-drawn.

   'fit' is a real rung, not a synonym for the smallest one — it drops the
   minimum width entirely so the year fills whatever space there is and nothing
   scrolls sideways. That is the view you want when the question is "how busy
   is the autumn", and no fixed pixel figure answers it on every screen.

   DEFAULT is the width the board was designed against; the readout is a
   percentage of it, so 100% means "as drawn". */
const ZOOM = ['fit', 88, 110, 132, 152, 190, 250, 340, 480, 680];
const ZOOM_DEFAULT = ZOOM.indexOf(152);
const ZOOM_KEY = 'ltpm.zoom.v1';

function loadZoom() {
  try {
    /* Tested for null BEFORE the cast. Number(null) is 0, and 0 is a valid
       rung — the Fit one — so a missing key read as a deliberate choice and
       every first visit opened on Fit instead of the width the board is
       designed against. */
    const raw = localStorage.getItem(ZOOM_KEY);
    if (raw === null || raw === '') return ZOOM_DEFAULT;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 && n < ZOOM.length ? n : ZOOM_DEFAULT;
  } catch (e) { void e; return ZOOM_DEFAULT; }
}
function saveZoom() {
  try { localStorage.setItem(ZOOM_KEY, String(S.zoom)); }
  catch (e) { void e; }
}
const zoomLabel = () => ZOOM[S.zoom] === 'fit'
  ? 'Fit'
  : Math.round(ZOOM[S.zoom] / ZOOM[ZOOM_DEFAULT] * 100) + '%';

const SHUT_KEY = 'ltpm.shut.v1';
function loadShut() {
  try {
    const raw = JSON.parse(localStorage.getItem(SHUT_KEY) || '[]');
    return new Set(Array.isArray(raw) ? raw.filter(x => typeof x === 'string') : []);
  } catch (e) { void e; return new Set(); }
}
function saveShut() {
  try { localStorage.setItem(SHUT_KEY, JSON.stringify([...S.shut])); }
  catch (e) { void e; }
}

/* ---------- window: the planning year opens in July 2026 ---------- */
const WIN_START = '2026-07-01';
const WIN_MONTHS = 12;

const MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function monthList() {
  const out = [];
  let y = +WIN_START.slice(0, 4), m = +WIN_START.slice(5, 7) - 1;
  for (let i = 0; i < WIN_MONTHS; i++) {
    out.push({ y, m, key: `${y}-${String(m + 1).padStart(2, '0')}`, label: MO[m], yy: String(y).slice(2) });
    if (++m > 11) { m = 0; y++; }
  }
  return out;
}
const MONTHS = monthList();
const WIN_END = (() => {
  const last = MONTHS[MONTHS.length - 1];
  return `${last.y}-${String(last.m + 1).padStart(2, '0')}-${new Date(Date.UTC(last.y, last.m + 1, 0)).getUTCDate()}`;
})();

const dayNo = iso => Math.round((Date.parse(iso + 'T00:00:00Z') - Date.parse(WIN_START + 'T00:00:00Z')) / 86400000);
const WIN_DAYS = dayNo(WIN_END) + 1;

const CATS = [...new Set(MOMENTS.map(m => m.cat))]
  .sort((a, b) => MOMENTS.filter(m => m.cat === b).length - MOMENTS.filter(m => m.cat === a).length);

/* Only what the window actually holds. A moment that starts before July and is
   still running on day one is kept — it is a moment you plan against. */
const IN_WINDOW = MOMENTS.filter(m => m.start <= WIN_END && m.end >= WIN_START);

const fmtDate = iso => {
  const [y, m, d] = iso.split('-');
  return `${+d} ${MO[+m - 1]} ${y.slice(2)}`;
};
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- state ---------- */
/* Direction and audience live in the hash, so a link carries what you were
   looking at — which is the whole point of five mockups: somebody has to be
   able to send back "03, sports superfans, this bar". */
/* `#/<audiences>[/<combine>][/<model>]`, and a leading direction digit is
   still read so that links written while there were five mockups keep working.

   THE READER AND THE WRITER HAD DRIFTED APART. This function required the
   direction segment, and render() had long since stopped writing one — so
   every hash the app produced failed its own parse and no reload ever
   restored anything. It went unnoticed because the fallback is a working
   board. Now the digit is optional on the way in, never written on the way
   out, and there is a test for the round trip. */
function fromHash() {
  /* `[a-z]+` would not match a user-defined audience — their ids are slugged
     from the name and "women1834" has digits in it — so a custom audience
     never survived a reload either. */
  const m = /^#\/(?:(\d)\/)?([a-z0-9+]+)((?:\/[a-z]+)*)$/.exec(location.hash || '');
  if (!m) return {};
  const dir = m[1] ? +m[1] : undefined;
  const ids = m[2].split('+').filter(id => ROSTER().some(a => a.id === id));
  /* The trailing segments are read by what they ARE rather than by position,
     so a link carrying only a model still works and the order cannot rot. */
  const rest = (m[3] || '').split('/').filter(Boolean);
  return {
    dir: dir >= 1 && dir <= 5 ? dir : undefined,
    auds: ids.length ? ids : undefined,
    mode: rest.find(x => MODES.some(y => y.id === x)),
    model: rest.find(x => MODELS.some(y => y.id === x))
  };
}
const H = fromHash();

const S = {
  auds: H.auds || [AUDIENCES[0].id],   // one or several; never none
  mode: H.mode || 'blend',
  /* Which model the board is being read through. Lives in the hash beside the
     audience because it changes what the audience MEANS — a link that carries
     one without the other carries half a claim. */
  model: H.model || DEFAULT_MODEL,
  dir: H.dir || 3,
  off: new Set(),          // categories switched off
  showWatch: false,        // draw the Watch band as well as Anchor and Play
  /* Families shut on the board. Separate from `off`: switching a category off
     removes its moments from the board AND from every count, because it is a
     filter. Collapsing a family only stops drawing its lanes — the moments are
     still in the year, still in the congestion, still counted in the header.
     Conflating the two would let a reader collapse a family and quietly change
     the numbers they are reading. */
  shut: loadShut(),
  zoom: loadZoom()          // index into ZOOM — how wide a month is drawn
};

/* Falls back rather than returning empty: a custom audience deleted in another
   tab leaves a hash pointing at nothing, and the board must still draw. There
   is always at least one selected audience — a board with none has nothing to
   say, so the last one cannot be switched off. */
function audiences() {
  const list = S.auds.map(id => ROSTER().find(a => a.id === id)).filter(Boolean);
  if (list.length) return list;
  /* Falling back to whatever sorts first would now land on an official target
     with no cut loaded, and a par board is the worst thing to recover into —
     it looks like an answer. Fall back to the first audience that can actually
     score something. */
  const roster = ROSTER();
  return [roster.find(a => !a.pending) || roster[0]];
}
const audience = () => audiences()[0];
const multi = () => audiences().length > 1;

/* The active model, and the audiences it can actually speak for. Everything
   that draws a score goes through these two rather than through relevance.js
   directly — which is what lets one set of drawing code serve both models. */
const MODEL = () => modelById(S.model);
const COVER = () => coverage(MODEL(), audiences());

let SCORED = [];
function recompute() {
  SCORED = MODEL().score(IN_WINDOW, audiences(), S.mode);
}
const visible = () => SCORED.filter(m => !S.off.has(m.cat));

/* ============================================================
   RAIL
   ============================================================ */
function renderRail() {
  const a = audience();
  const sel = new Set(S.auds);
  const only = S.auds.length === 1;
  renderModelToggle();
  /* One row. Two badges it can carry, and they answer different questions:
     "Yours" is whose it is, "Est." is what the numbers rest on. A custom
     audience defined in words is both. */
  const row = x => `
    <div class="aud-row">
      <button class="aud ${sel.has(x.id) ? 'on' : ''}" data-aud="${x.id}" type="button"
        role="checkbox" aria-checked="${sel.has(x.id)}"
        ${sel.has(x.id) && only ? 'aria-disabled="true" title="At least one audience has to stay on"' : ''}>
        <span class="tick" aria-hidden="true">${sel.has(x.id) ? '\u2713' : ''}</span>
        <span class="at">
          <span class="an">${esc(x.name)}${x.custom ? '<span class="mine">Yours</span>' : ''}${
            x.est ? '<span class="est" title="Estimated \u2014 not a research cut">Est.</span>' : ''}${
            x.measured ? '<span class="meas" title="Measured \u2014 YouGov Profiles">Cut</span>' : ''}${
            x.pending ? '<span class="pend" title="No cut loaded \u2014 every category sits at par">No cut</span>' : ''}${
            /* The one badge that depends on the toggle rather than on the
               audience. Under the response model an estimated audience has
               nothing measured to score, and saying so ON THE ROW is the
               difference between a reader understanding the board and
               thinking the tool is broken. */
            MODEL().supports(x) ? '' : `<span class="unsup" title="${esc(MODEL().label)} needs a research cut, and this audience does not have one">Needs a cut</span>`}</span>
          <span class="as">${x.pending
            ? `${esc(x.pa || '')}${x.pa ? ' \u00b7 ' : ''}awaiting cut`
            : `${esc(x.size || '\u2014')} \u00b7 ${topCats(x)}`}</span>
        </span>
      </button>
      <button class="aud-i" data-info="${esc(x.id)}" type="button"
        title="What this audience is built from"
        aria-label="Definition and indices for ${esc(x.name)}">i</button>
      ${x.custom ? `<button class="aud-x" data-del="${esc(x.id)}" type="button"
        title="Remove ${esc(x.name)}" aria-label="Remove ${esc(x.name)}">\u00d7</button>` : ''}
    </div>`;

  /* THE TOGGLE.

   Two buttons and a line of explanation, and then — when it matters — a
   warning. The warning is the part worth having: switching to the response
   model with an estimated audience selected produces a board full of nothing,
   and a reader who was not told why will conclude the tool is broken rather
   than that the audience has no research behind it. So the count of
   audiences the model can speak for is drawn under the toggle whenever it is
   not all of them, BEFORE the board redraws. */
function renderModelToggle() {
  const cur = MODEL();
  const cov = COVER();
  const el = document.getElementById('modelTog');
  if (!el) return;
  /* An empty board needs a way off it, not just an explanation of itself.
     The first audience this model CAN speak for, offered by name — hunting
     the rail for one is the reader doing the tool's work. */
  const firstScorable = ROSTER().find(x => cur.supports(x) && !S.auds.includes(x.id));

  el.innerHTML = `
    <div class="rl-hd gap">Relevance model</div>
    <div class="seg mdl">${MODELS.map(m => `
      <button type="button" data-model="${m.id}" class="${m.id === S.model ? 'on' : ''}"
        style="--mc:${m.color};--mcd:${m.colorDark}"
        aria-pressed="${m.id === S.model}"
        title="${esc(m.gist)}"><span class="mi" aria-hidden="true">${m.icon}</span>${esc(m.short)}</button>`).join('')}</div>
    <p class="mdl-gist" style="--mc:${cur.color};--mcd:${cur.colorDark}">${esc(cur.gist)}</p>
    ${cov.ok === cov.total ? '' : `
      <p class="mdl-warn">${cov.ok
        ? `Scores <b>${cov.ok} of ${cov.total}</b> selected audiences. ${cov.missing.map(x => esc(x.name)).join(', ')} ${cov.missing.length === 1 ? 'has' : 'have'} <b>no research cut</b>, so ${cov.missing.length === 1 ? 'it is' : 'they are'} left out of the board rather than scored at par.`
        /* ⚠️ THE NEGATION IS THE WHOLE SENTENCE. This read "This audience HAS
           a research cut behind it" for one release — the exact opposite of
           the truth — so the one message whose entire job was to explain an
           empty board explained nothing, and the board looked broken. */
        : `<b>Nothing to score.</b> ${cov.missing.length === 1
            ? `<b>${esc(cov.missing[0].name)}</b> has <b>no research cut</b> behind it`
            : `<b>None</b> of these audiences have a research cut behind them`}, and this
           model reads nothing else — so rather than score every moment at par and
           call that an answer, it scores none of them.`}</p>
      ${cov.ok ? '' : `
        <div class="mdl-fix">
          ${firstScorable ? `<button type="button" class="mdl-fix-b" data-pick-aud="${esc(firstScorable.id)}">Show me ${esc(firstScorable.name)}</button>` : ''}
          <button type="button" class="mdl-fix-b" data-model="${MODELS[0].id}">Back to ${esc(MODELS[0].short)}</button>
        </div>`}`}
    <button class="mdl-help" id="modelHelpBtn" type="button"
      aria-haspopup="dialog" aria-controls="modelHelp">Which should I use?</button>`;
}

/* An empty group keeps its heading. The official group is the reason: a
     planner has to be able to see that the PA's own targets have not been
     loaded, and a group that disappears when it is empty cannot say that. */
  document.getElementById('audList').innerHTML = GROUPS.map(g => {
    const list = inGroup(g.id);
    const shut = S.shut.has(`aud:${g.id}`);
    /* How many are selected in a shut group, so collapsing never hides the
       fact that a group is contributing to the board. A closed group with
       nothing selected says nothing; a closed group with two selected has to
       say two. */
    const on = list.filter(x => sel.has(x.id)).length;
    return `<div class="aud-grp${shut ? ' shut' : ''}" data-grp="${g.id}"
      style="--gc:${g.color || 'var(--shell-ink3)'}">
      <button class="rl-hd gap grp-tog" type="button" data-grp-tog="${g.id}"
        aria-expanded="${!shut}" aria-controls="grp-${g.id}">
        <span class="grp-dot" aria-hidden="true"></span>
        <span class="grp-caret" aria-hidden="true">▾</span>
        <span class="grp-nm">${esc(g.label)}</span>
        <span class="grp-n">${on ? `${on} on` : (list.length || '—')}</span>
      </button>
      <div class="aud-grp-bd" id="grp-${g.id}"${shut ? ' hidden' : ''}>
        ${shut ? '' : (list.length ? list.map(row).join('') : `<p class="aud-none">${esc(g.empty)}</p>`)}
        ${!shut && g.id === 'custom' ? `<button class="aud-add" id="audAdd" type="button">
          <span aria-hidden="true">+</span> New target audience</button>` : ''}
      </div>
    </div>`;
  }).join('');

  document.getElementById('audDef').textContent = multi()
    ? audiences().map(x => x.name).join('  +  ')
    : (a.def || '');

  /* The combine control only exists once there is something to combine, and it
     says what it does in a sentence — three audiences blended and three
     audiences overlapped are different questions, not a display preference. */
  const mode = document.getElementById('audMode');
  if (multi()) {
    const m = MODES.find(x => x.id === S.mode) || MODES[0];
    const unweighted = S.mode === 'blend' && SCORED.length && !SCORED[0].affWeighted;
    mode.hidden = false;
    mode.innerHTML = `
      <div class="rl-hd gap">Combine ${S.auds.length} audiences</div>
      <div class="seg">${MODES.map(x => `
        <button type="button" data-mode="${x.id}" class="${x.id === S.mode ? 'on' : ''}"
          aria-pressed="${x.id === S.mode}">${x.label}</button>`).join('')}</div>
      <p class="seg-note">${esc(m.note)}${unweighted
        ? ' <b>Unweighted</b> \u2014 one of these has no size, so each counts equally.' : ''}</p>`;
  } else {
    mode.hidden = true;
    mode.innerHTML = '';
  }

  const v = visible();
  document.getElementById('railFoot').innerHTML =
    `${v.length} moments in window<br>${MONTHS[0].label} ${MONTHS[0].y} — ${MONTHS[11].label} ${MONTHS[11].y}<br>` +
    `<span style="opacity:.7">${MOMENTS.length} total to ${MOMENTS[MOMENTS.length - 1].start.slice(0, 4)}</span>`;
}
/* The two categories this audience over-indexes on hardest. It is the fastest
   honest summary of a cut, and it fits on the rail's second line. */
function topCats(a) {
  /* Nulls are dropped rather than sorted. Three of the twelve categories have
     no battery in the research cut, and `null` sorts as though it were zero —
     which would make "Holidays" look like the thing this audience cares
     least about instead of the thing nobody asked them. */
  const named = Object.entries(a.aff || {}).filter(([, v]) => typeof v === 'number');
  if (!named.length) return 'no cut';
  return named.sort((x, y) => y[1] - x[1]).slice(0, 2).map(e => e[0].split(' ')[0]).join(' \u00b7 ');
}

/* ============================================================
   HEADER
   ============================================================ */
/* The header is a control strip now, not a title block. The kicker, the big
   name and the explanatory lede belonged to a mockup being compared against
   four others; in the tool they cost 90px of height that the lanes need —
   Tours & Concerts alone runs to eighteen rows. */
function renderHead() {
  document.getElementById('catStrip').innerHTML = CATS.map(c => `
    <button class="cat ${S.off.has(c) ? 'off' : ''}" data-cat="${esc(c)}" type="button"
      aria-pressed="${!S.off.has(c)}">
      <span class="sw" style="--c:${CAT_COLOR[c] || '#5C6279'}"></span>${esc(c)}
    </button>`).join('');

  const dark = document.documentElement.dataset.theme === 'dark';
  document.getElementById('themeTog').innerHTML = dark ? '&#9728;' : '&#9790;';

  /* The zoom readout, and the two buttons disabled at the ends of the ladder —
     a control that still looks live at its limit reads as broken. */
  const rd = document.getElementById('zoomRd');
  rd.textContent = zoomLabel();
  rd.classList.toggle('on', S.zoom !== ZOOM_DEFAULT);
  for (const [id, at] of [['zoomOut', 0], ['zoomIn', ZOOM.length - 1]]) {
    const btn = document.getElementById(id);
    btn.disabled = S.zoom === at;
    btn.setAttribute('aria-disabled', String(S.zoom === at));
  }

  const v = visible();
  const b = Object.fromEntries(MODEL().bands.map(x => [x.id, v.filter(m => m.band && m.band.id === x.id).length]));
  const w = document.getElementById('watchTog');
  w.classList.toggle('on', S.showWatch);
  w.setAttribute('aria-pressed', String(S.showWatch));

  document.getElementById('hdRight').innerHTML = `
    <span class="hd-pill" style="--pill-ink:var(--pill-green);--pill-line:var(--pill-green-line)">Anchor <b>${b.anchor}</b></span>
    <span class="hd-pill" style="--pill-ink:var(--pill-blue);--pill-line:var(--pill-blue-line)">Play <b>${b.play}</b></span>
    <span class="hd-pill" style="--pill-ink:var(--pill-amber);--pill-line:var(--pill-amber-line)">Watch <b>${b.watch}</b></span>
    <span class="hd-pill">Skip <b>${b.skip}</b></span>`;
}

/* The legend has to show the ENCODING, not just name the bands. It drew four
   coloured pills, which said what Anchor and Play mean but never said that a
   solid bar is one and a tinted bar is the other — so the first question the
   board actually provokes, "why are some bars dark?", had no answer on screen.
   Each row now carries a bar drawn in its own treatment.

   Neutral, not category-coloured: this legend is about WEIGHT. A row of
   coloured keys would read as a second category scale.

   Skip is not listed. A bar is only drawn at 40 or above, and Skip is below
   40, so it can never appear on the ribbon — a legend entry for it would be
   describing something that is not there. The Skip count stays in the header,
   where it is a count rather than a drawing. */
/* HOW RELEVANT, AS A SHADE.

   The bar already carries its category in its hue, and hue is what lets a
   reader scan a year of a thousand rows. Relevance goes on the other channel:
   same hue, more ink. A dense bar is a moment this audience cares about, a
   pale one is a moment it barely does, and the two can be told apart at arm's
   length without reading a number.

   Six steps rather than a continuous ramp. Continuous shading looks precise
   and is not — the difference between 63 and 65 is inside the model's own
   noise, and drawing it invites a reader to act on it. Six steps are as many
   as the eye can order reliably against a coloured background, and each one is
   a real difference in the score.

   The steps are NOT evenly spaced in score, because the scores are not evenly
   spread. Drawn moments pile up just above the Play line — for Sports
   Superfans, two thirds of the board sits between 56 and 63 — so evenly cut
   steps put most of the year on one shade and waste the top of the ramp on the
   two moments that reach 84. These thresholds were cut against the actual
   distribution across several audiences so every step carries real weight.

   The bottom two only ever appear with Watch switched on. That band is meant
   to recede, so it gets the pale end.

   Two knobs, not one. `fill` is how much of the category hue survives against
   the card — that is the pale half of the ramp. `dark` takes the top steps
   PAST the hue by mixing toward black, which is the only way the most relevant
   moments actually pop: a category hue at full strength is a mid-tone, and a
   board of mid-tones has no top end. The densest step is a near-black box in
   its own hue, carrying white type. */
/* Read from the active model — see the ramp note in data/models.js. */
const shadeOf = s => {
  const r = MODEL().shades;
  return r.find(x => s >= x.min) || r[r.length - 1];
};

/* The ramp itself, drawn in the legend — the encoding is only usable if it is
   stated somewhere, and a reader should not have to infer that darker means
   more. Drawn in a neutral ink rather than one category's hue, so it reads as
   a scale rather than as a category. */
const shadeLegend = () => `
  <span class="li ramp">
    <b>Relevance</b>
    <span class="rmp">${[...MODEL().shades].reverse().map(s =>
      `<i style="--f:${s.fill}%;--dk:${s.dark}%" title="score ${s.label}"></i>`).join('')}</span>
    <span class="rmp-x">paler = less relevant to this audience</span>
  </span>`;

/* The cuts are read off the active model's own bands rather than typed in.
   They are not the same in both — the response model's Anchor starts at 70,
   not 72 — and a legend quoting the other model's numbers is a legend that
   lies about the board underneath it. */
const bandLegend = () => {
  const bands = MODEL().bands;
  return bands.filter(b => b.id !== 'skip').map((b, i) => {
    const dim = b.id === 'watch' && !S.showWatch;
    const above = bands[i - 1];
    const range = above ? `${b.min}–${above.min - 1}` : `${b.min}+`;
    return `<span class="li${dim ? ' dim' : ''}">
      <span class="key ${b.id}"></span>
      <b>${b.label}</b> ${range} · ${b.note}
      ${dim ? '<i>— switch Watch on to draw these</i>' : ''}
    </span>`;
  }).join('');
};

/* ============================================================
   THE FIVE COMPONENTS, WRITTEN OUT
   Shared vocabulary rather than one view's furniture: wherever a score is
   shown, the thing that produced it has to be openable.
   ============================================================ */
/* Drawn from the active model rather than declared here. Two models with
   different components cannot share a hard-coded panel, and a panel that
   names a component the board is not computing is worse than no panel. */
const partMeta = () => Object.fromEntries(MODEL().parts.map(p => [p.key, {
  k: p.name, c: p.color, w: p.weight, note: p.note || null, why: p.why
}]));

/* With several audiences selected, affinity is a combination \u2014 so the panel
   shows what it was combined FROM. A blended figure nobody can take apart is
   exactly the kind of number this tool refuses to produce anywhere else. */
function affByBlock(m) {
  if (!m.affBy) return '';
  const mode = MODES.find(x => x.id === S.mode) || MODES[0];
  const top = Math.max(...m.affBy.map(x => x.value)) || 1;
  return `<div class="affby">
    <div class="affby-k">Affinity by audience \u00b7 ${esc(mode.label.toLowerCase())}</div>
    ${m.affBy.map(x => `
      <div class="affby-r">
        <span class="n">${esc(x.name)}</span>
        <span class="b"><i style="width:${Math.round(x.value / top * 100)}%"></i></span>
        <span class="v">${Math.round(x.value)}</span>
      </div>`).join('')}
  </div>`;
}

function partsBlock(m) {
  return affByBlock(m) + `<div class="parts">${Object.entries(partMeta()).map(([k, p]) => {
    const v = m.parts[k];
    /* A component with nothing behind it draws as an absence, not as a zero.
       The response model genuinely has no fandom reading for a public holiday
       — the cut carries no holiday battery — and a bar at 0 would say the
       audience is indifferent, which is a finding nobody made. */
    if (v == null) return `
      <div class="part none">
        <div class="pk"><span>${p.k}</span><b>—</b></div>
        <div class="pb"><i style="width:0"></i></div>
        <div class="pw">Not asked in this cut, so it is left out and the other components carry its weight.</div>
      </div>`;
    return `
    <div class="part">
      <div class="pk"><span>${p.k}${p.w ? ` \u00b7 ${Math.round(p.w * 100)}%` : (p.note ? ` \u00b7 ${p.note}` : '')}</span><b>${Math.round(v)}</b></div>
      <div class="pb"><i style="width:${Math.round(v)}%;--pc:${p.c}"></i></div>
      <div class="pw">${p.why}</div>
    </div>`;
  }).join('')}</div>`;
}

/* ============================================================
   03 — THE RIBBON
   ============================================================ */
function drawRibbon() {
  const v = visible().filter(m => S.showWatch ? m.score >= 40 : m.score >= 56);
  const cats = CATS.filter(c => !S.off.has(c));
  const pct = d => (d / WIN_DAYS) * 100;

  const lane = c => {
    const list = v.filter(m => m.cat === c).sort((a, b) => a.start.localeCompare(b.start));
    /* Greedy packing into sub-rows: sorted by start, each bar goes in the first
       row whose last bar has already finished, plus a small gutter so two
       touching moments do not read as one. Sorted-by-start first-fit is optimal
       for intervals — it never uses more rows than the deepest overlap.

       THE ROW COUNT IS NOT CAPPED. It was capped at three, and the fourth
       onward were dumped into the last row on top of each other: Tours &
       Concerts genuinely needs 18 rows because tours are long windows that all
       run at once, and TV & Streaming needs 43 with Watch switched on. A cap
       does not make a lane shorter, it makes it a lie — the bars are still
       there, just drawn over one another. A tall lane you can scroll is the
       honest drawing, and the categories nobody asked for are one click off in
       the rail. */
    const rows = [];
    for (const m of list) {
      const s = Math.max(0, dayNo(m.start));
      const e = Math.min(WIN_DAYS, dayNo(m.end) + 1);
      const w = Math.max(e - s, 3);
      let r = rows.find(row => row.end <= s - 4);
      if (!r) { r = { end: 0, bars: [] }; rows.push(r); }
      r.end = s + w;
      r.bars.push({ m, s, w });
    }
    if (!rows.length) rows.push({ bars: [] });
    return `
      <div class="rib-lane">
        <div class="rib-lb">
          <span class="sw" style="--c:${CAT_COLOR[c]}"></span>
          <span class="t">${esc(c)}<span class="n">${list.length} moment${list.length === 1 ? '' : 's'} · ${rows.length} row${rows.length === 1 ? '' : 's'}</span></span>
        </div>
        <div class="rib-tr">
          <div class="rib-grid" style="grid-template-columns:repeat(${MONTHS.length},1fr)">${MONTHS.map(() => '<span></span>').join('')}</div>
          ${rows.map(row => `<div class="rib-sub">${row.bars.map(b => {
            const tick = b.w <= 6;
            /* Hue says which category, shade says how relevant. The band class
               stays for the outline weight, but it no longer decides the fill —
               three bands drew as two visible shades, which threw away most of
               the range a reader could have seen. */
            /* No score is not a low score. Under the response model an
               audience with no research cut behind it cannot be scored at
               all, and the bar says so by drawing hollow rather than pale —
               pale already means "scored, and low". */
            const sh = shadeOf(b.m.score == null ? 0 : b.m.score);
            const nd = b.m.score == null;
            return `<button class="bar ${nd ? 'nodata' : b.m.band.id}${!nd && sh.lit ? ' lit' : ''}${tick ? ' tick' : ''}"
              data-id="${b.m.id}" style="--c:${CAT_COLOR[c]};--f:${nd ? 0 : sh.fill}%;--dk:${sh.dark}%;left:${pct(b.s)}%;width:${pct(b.w)}%"
              title="${esc(b.m.name)}${nd ? ' — not scored: no research cut for this audience' : ' — ' + b.m.score}">${tick ? '' : esc(b.m.name)}</button>`;
          }).join('')}</div>`).join('')}
        </div>
      </div>`;
  };

  /* The lanes, gathered under their family. A family with every category
     switched off in the rail draws nothing at all — heading included — because
     unlike the audience rail, an absent family here is a filter the reader set
     themselves and can see in the category strip above the board.

     Any category that belongs to no family still gets drawn, in a family of its
     own at the end. A category quietly vanishing from the board because nobody
     added it to CAT_GROUPS is the kind of bug that survives a demo. */
  function famBlocks(list) {
    const left = new Set(list);
    const blocks = CAT_GROUPS.map(f => {
      const mine = f.cats.filter(c => left.has(c));
      mine.forEach(c => left.delete(c));
      if (!mine.length) return '';
      const n = mine.reduce((s, c) => s + v.filter(m => m.cat === c).length, 0);
      const shut = S.shut.has(f.id);
      /* The count stays visible while the family is shut — that is what makes
         collapsing safe to do. A closed family that hid its own size would
         make the board look emptier than the year is. */
      return `
        <section class="fam${shut ? ' shut' : ''}" data-fam="${f.id}">
          <button class="fam-hd" type="button" data-fam-tog="${f.id}"
            aria-expanded="${!shut}" aria-controls="fam-${f.id}">
            <span class="fam-caret" aria-hidden="true">▾</span>
            <span class="fam-nm">${esc(f.label)}</span>
            <span class="fam-n">${mine.length} categor${mine.length === 1 ? 'y' : 'ies'} · ${n} moment${n === 1 ? '' : 's'}</span>
            <span class="fam-note">${esc(f.note)}</span>
            ${f.source ? `<span class="fam-src" title="${esc(REACH_SOURCE.measure)} ${esc(REACH_SOURCE.basis)}">${esc(f.source)}</span>` : ''}
          </button>
          <div class="fam-bd" id="fam-${f.id}"${shut ? ' hidden' : ''}>
            ${shut ? '' : mine.map(lane).join('')}
          </div>
        </section>`;
    });
    if (left.size) {
      blocks.push(`
        <section class="fam" data-fam="other">
          <div class="fam-hd">
            <span class="fam-nm">Other</span>
            <span class="fam-n">${left.size} categor${left.size === 1 ? 'y' : 'ies'}</span>
            <span class="fam-note">Not yet filed under a family — see CAT_GROUPS.</span>
          </div>
          ${[...left].map(lane).join('')}
        </section>`);
    }
    return blocks.join('');
  }

  /* Congestion, week by week. Same input the score's congestion term reads,
     drawn on its own — the quiet weeks are the point, and they are invisible
     inside a total. */
  const weeks = weekAxis();
  const load = weeks.map(w => visible().filter(m => weekKey(m.start < WIN_START ? WIN_START : m.start) === w.key)
    .reduce((s, m) => s + (m.parts[MODEL().driver] ?? 0), 0));
  const lMax = Math.max(1, ...load);

  /* TODAY. Drawn only when today is inside the planning window — the window
     opens in July 2026 and runs a year, so a line for a date outside it would
     be pinned to an edge and read as a real position. Placed as a fraction of
     the window rather than a percentage of the track, so it stays aligned with
     the bars at any ribbon width.

     Half a day is added because a bar for a single day spans from its start to
     the end of that day; the line belongs in the middle of today, not against
     its leading edge. */
  const today = new Date().toISOString().slice(0, 10);
  const todayIn = today >= WIN_START && today <= WIN_END;
  const todayFrac = ((dayNo(today) + 0.5) / WIN_DAYS).toFixed(5);

  /* A selected audience with no cut cannot re-order anything — every category
     is at par, so the ranking you are looking at is scale, actionability and
     timing only. Said on the board rather than only in the rail, because by
     the time you are reading bars the rail is out of the corner of your eye. */
  const pending = audiences().filter(a => a.pending);

  return `
    ${pending.length ? `<div class="nocut">
      <b>${pending.map(a => esc(a.name)).join(' + ')}</b> ${pending.length === 1 ? 'has' : 'have'} no cut loaded yet,
      so affinity sits at par for every category. This ordering is scale, actionability and timing only —
      it is not this audience's view of the year.
    </div>` : ''}
    <div class="legend">${bandLegend()}${shadeLegend()}</div>
    <div class="rib" style="${ribSizing()}">
      <div class="rib-ax">
        <div class="rib-axlb"></div>
        <div class="mos" style="grid-template-columns:repeat(${MONTHS.length},1fr)">
          ${MONTHS.map(mo => `<div class="mo">${mo.label} '${mo.yy}</div>`).join('')}
        </div>
      </div>
      <div class="rib-lanes">
        ${todayIn ? `<div class="today" style="--f:${todayFrac}" aria-hidden="true"><span>Today</span></div>` : ''}
        ${famBlocks(cats)}
      </div>
      <div class="rib-cong">
        <div class="legend" style="margin-bottom:8px">
          <span class="li"><b>Weekly load</b> — total audience affinity landing in each week. The troughs are where an unclaimed moment lives.</span>
        </div>
        <div class="cong-wrap">
          <div class="rib-lb" style="align-self:end">${weeks.length} weeks</div>
          <div class="cong-bars">${load.map((l, i) => {
            const h = Math.round(l / lMax * 100);
            return `<i style="height:${Math.max(3, h)}%;--cb:${h > 66 ? '#C5221F' : h > 33 ? '#946200' : '#0B7A67'}"
              title="${weeks[i].label} — load ${Math.round(l)}"></i>`;
          }).join('')}</div>
        </div>
      </div>
    </div>`;
}

/* The ribbon's width, from the zoom rung. At 'fit' the minimum is dropped
   altogether so the year fills the space it has and nothing scrolls sideways;
   at every other rung a month is worth a fixed number of pixels and the year
   is as wide as it needs to be. */
function ribSizing() {
  const z = ZOOM[S.zoom];
  return z === 'fit'
    ? `--mos:${MONTHS.length};min-width:0`
    : `--mos:${MONTHS.length};--mo-w:${z}px`;
}

function weekAxis() {
  const out = [];
  let d = new Date(WIN_START + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  const end = new Date(WIN_END + 'T00:00:00Z');
  while (d <= end) {
    const key = d.toISOString().slice(0, 10);
    out.push({ key, label: `${d.getUTCDate()} ${MO[d.getUTCMonth()]}`, m: d.getUTCMonth(), y: d.getUTCFullYear() });
    d = new Date(d.getTime() + 7 * 86400000);
  }
  return out;
}

/* ============================================================
   ADD AN AUDIENCE
   An audience is a name and ten numbers. The numbers are the whole argument,
   so the panel is built around getting them in and SHOWING what arrived —
   never around getting the dialog closed quickly. Three ways in, one result:

     drop a file    a CSV or TSV exported from wherever the cut lives
     paste a table  a cell range straight out of Sheets
     type them      ten boxes, for when there are only two numbers worth having

   Whatever comes in is parsed live and reported back line by line, because the
   failure this panel has to prevent is a number arriving wrong and never being
   noticed. A category the data does not mention stays at par and says so.
   ============================================================ */
let draft = null;

function openAudPanel() {
  draft = {
    name: '', def: '', size: '', text: '', parsed: null,
    aff: {}, ent: {}, quotes: {},
    /* Set only by the describe-it path, and carried onto the saved record by
       buildAudience — an estimate that loses its label in the panel is an
       estimate that reaches the rail looking like a cut. */
    est: false, why: {}, defined: null,
    busy: false
  };
  const el = document.getElementById('panel');
  el.hidden = false;
  el.innerHTML = `
    <div class="pn-scrim" data-close="1"></div>
    <div class="pn-card" role="dialog" aria-modal="true" aria-labelledby="pnTitle">
      <div class="pn-hd">
        <div>
          <div class="pn-kick">New target audience</div>
          <h2 id="pnTitle">Who are they, and what do they care about?</h2>
        </div>
        <button class="pn-x" data-close="1" type="button" aria-label="Close">×</button>
      </div>

      <div class="pn-bd">
        <div class="pn-col">
          <label class="fld">
            <span>Name</span>
            <input id="pnName" type="text" placeholder="e.g. Women 18–34, urban" autocomplete="off">
          </label>
          <label class="fld">
            <span>Who they are</span>
            <textarea id="pnDef" rows="3" placeholder="One or two lines. What defines this group, and what a planner should remember about them."></textarea>
          </label>
          <label class="fld">
            <span>Size <i>optional</i></span>
            <input id="pnSize" type="text" placeholder="e.g. 24.8M" autocomplete="off">
          </label>

          <!-- The third way in, and the only one that does not need a cut at
               all. Everything it produces is an estimate and is marked as one
               everywhere it later appears; it exists because "no cut yet" is
               the normal state of an audience early in a plan, and a rail that
               can only hold measured audiences is a rail nobody can start
               with. -->
          <div class="fld">
            <span>No cut yet? Describe them <i>Gemini estimates the indices</i></span>
            <textarea id="pnDesc" rows="3" spellcheck="false"
              placeholder="e.g. women 25–44 in the Southeast who watch college football, shop Target, and plan the family's year"></textarea>
            <div class="gem-row">
              <button type="button" class="gem" id="pnDefine">Define with Gemini</button>
              <span class="gem-note">Reasons all twelve indices from your description and says why for each.
                Everything it produces is marked <b>Estimated</b> — it is a considered guess, not a research cut,
                and you can edit any number before saving.</span>
            </div>
          </div>

          <div class="fld">
            <span>Or the data that defines them</span>
            <div class="drop" id="pnDrop">
              <b>Drop a CSV or TSV here</b>
              <span>or paste a range from a spreadsheet below</span>
              <input type="file" id="pnFile" accept=".csv,.tsv,.txt,text/csv,text/plain" hidden>
              <button type="button" id="pnPick">Choose a file</button>
            </div>
            <textarea id="pnText" rows="7" spellcheck="false"
              placeholder="Sports, 145&#10;TV &amp; Streaming, 110&#10;Gaming, 162&#10;Taylor Swift, 180"></textarea>
            <p class="hint">Two columns: a category or a name, then an index on a 100 base.
              Commas, tabs, colons and pipes all work. Anything that isn't a category is
              offered as an entity override.</p>
            <!-- For the other case: the cut is real but it is a paragraph, not a
                 table. Gemini's whole job is to find the two columns hiding in
                 the prose — it hands them back and the SAME parser above reads
                 them, so nothing it returns skips a check a pasted CSV faces. -->
            <div class="gem-row">
              <button type="button" class="gem" id="pnGem">Read it with Gemini</button>
              <span class="gem-note">For prose. It only ever extracts numbers already in your text —
                every one is checked back against it, and anything it cannot find is dropped.</span>
            </div>
          </div>
        </div>

        <div class="pn-col">
          <div class="pn-read" id="pnRead"></div>
          <div class="fld">
            <span>Category affinity <i>index, 100 = par</i></span>
            <div class="grid" id="pnGrid"></div>
          </div>
          <div id="pnEnt"></div>
        </div>
      </div>

      <div class="pn-ft">
        <p class="pn-note" id="pnNote">Nothing read yet.</p>
        <div class="pn-acts">
          <button class="btn" data-close="1" type="button">Cancel</button>
          <button class="btn pri" id="pnSave" type="button" disabled>Add audience</button>
        </div>
      </div>
    </div>`;

  renderGrid();
  renderRead();
  document.getElementById('pnName').focus();
  wirePanel();
}

function closeAudPanel() {
  const el = document.getElementById('panel');
  el.hidden = true;
  el.innerHTML = '';
  draft = null;
}

/* The ten boxes. Prefilled from whatever was parsed, and each one says where
   its number came from — read from the data, typed by hand, or left at par. */
function renderGrid() {
  document.getElementById('pnGrid').innerHTML = CATS.map(c => {
    const v = draft.aff[c];
    const q = draft.quotes[c];
    const from = draft.parsed && draft.parsed.aff[c] !== undefined;
    const tag = q ? 'quoted' : from ? 'read' : v === undefined ? 'par' : 'typed';
    return `<div class="gr ${v === undefined ? 'par' : ''} ${q ? 'q' : ''}">
      <span class="sw" style="--c:${CAT_COLOR[c]}"></span>
      <span class="gn">${esc(c)}</span>
      <input type="number" data-aff="${esc(c)}" value="${v === undefined ? '' : v}"
        placeholder="100" min="0" max="400" step="1" inputmode="numeric"
        aria-label="${esc(c)} affinity index">
      <span class="gt">${tag}</span>
      ${q ? `<span class="gq" title="${esc(q)}">&ldquo;${esc(q)}&rdquo;</span>` : ''}
    </div>`;
  }).join('');
}

/* What the parser actually did with the input. This is the part that stops a
   wrong number sliding through: counts, the scale it inferred, and every line
   it could not use, listed rather than summarised. */
function renderRead() {
  const p = draft.parsed;
  const el = document.getElementById('pnRead');
  const g = draft.gem;
  const gemBlock = !g ? '' : `
    <div class="rd gem">
      <div class="rd-row"><b>${g.pairs.length}</b> read by Gemini, each confirmed against your text</div>
      ${g.rejected.length ? `<div class="rd-row warn"><b>${g.rejected.length}</b> dropped —
        ${g.rejected.slice(0, 3).map(r => `${esc(r.label || 'unnamed')} (${esc(r.why)})`).join('; ')}${g.rejected.length > 3 ? '…' : ''}</div>` : ''}
      ${g.notes ? `<div class="rd-row"><i>${esc(g.notes)}</i></div>` : ''}
    </div>`;
  /* An estimated audience says so in the panel, before it is saved rather than
     only after. The count matters as much as the label: a profile covering
     eight of twelve leaves four at par, and that is the difference between an
     audience that re-orders the board and one that barely moves it. */
  const d = draft.defined;
  const estBlock = !d ? '' : `
    <div class="rd est">
      <div class="rd-row"><b>Estimated</b> — reasoned from your description, not read off a cut.
        Edit anything below before saving.</div>
      <div class="rd-row"><b>${d.covered}</b> of ${d.of} categories given an index${
        d.covered < d.of ? `, ${d.of - d.covered} left at par` : ''}</div>
      ${d.dropped.length ? `<div class="rd-row warn"><b>${d.dropped.length}</b> dropped —
        ${d.dropped.slice(0, 3).map(x => `${esc(x.label || 'unnamed')} (${esc(x.why)})`).join('; ')}</div>` : ''}
    </div>`;

  const clearBtn = (Object.keys(draft.aff).length || draft.text)
    ? `<button type="button" class="clr" id="pnClear">Clear and start again</button>` : '';
  if (!p) {
    el.innerHTML = estBlock + gemBlock +
      (g || d ? '' : `<div class="rd empty">Describe them above, or drop a cut and it will be read here line by line.</div>`) +
      clearBtn;
    return;
  }
  const bad = p.ignored.filter(Boolean);
  el.innerHTML = estBlock + gemBlock + `
    <div class="rd">
      <div class="rd-row"><b>${p.matched.length}</b> of ${CATS.length} categories read${p.asMultiplier ? ' <i>· column read as multipliers of par, ×100</i>' : ''}</div>
      ${p.missing.length ? `<div class="rd-row warn"><b>${p.missing.length}</b> not mentioned — left at par: ${p.missing.map(esc).join(', ')}</div>` : ''}
      ${p.unmatched.length ? `<div class="rd-row">${p.unmatched.length} name${p.unmatched.length === 1 ? '' : 's'} kept as entity override${p.unmatched.length === 1 ? '' : 's'}</div>` : ''}
      ${bad.length ? `<div class="rd-row bad"><b>${bad.length}</b> line${bad.length === 1 ? '' : 's'} not used: ${bad.slice(0, 4).map(x => esc(x.slice(0, 42))).join(' · ')}${bad.length > 4 ? ' …' : ''}</div>` : ''}
    </div>` + clearBtn;
  const ent = document.getElementById('pnEnt');
  ent.innerHTML = p.unmatched.length ? `
    <div class="fld"><span>Entity overrides <i>sharper than a category</i></span>
      <div class="ents">${p.unmatched.map(u => `
        <label class="ent"><input type="checkbox" data-ent="${esc(u.label)}" checked>
          <span>${esc(u.label)}</span><b>${u.value}</b></label>`).join('')}</div>
    </div>` : '';
}

/* Both readers write into the same draft and NEITHER clears it. A literal
   parse of prose finds nothing, so replacing on every keystroke would wipe a
   Gemini read the moment somebody corrected a typo in the source. Merging is
   the non-destructive rule; Clear is the explicit way to start again. */
function reparse(text, opts) {
  draft.text = text;
  draft.parsed = text.trim() ? parseAudienceData(text) : null;
  if (draft.parsed) {
    draft.aff = { ...draft.aff, ...draft.parsed.aff };
    draft.ent = { ...draft.ent, ...draft.parsed.entities };
    for (const c of Object.keys(draft.parsed.aff)) delete draft.quotes[c];   // typed beats quoted
  }
  renderRead(opts && opts.gem);
  renderGrid();
  validate();
}

function clearDraftData() {
  draft.aff = {}; draft.ent = {}; draft.quotes = {}; draft.parsed = null; draft.gem = null;
  const t = document.getElementById('pnText');
  if (t) t.value = '';
  draft.text = '';
  renderRead();
  renderGrid();
  validate();
}

function validate() {
  const name = (draft.name || '').trim();
  const n = Object.values(draft.aff).filter(v => Number.isFinite(v)).length;
  const save = document.getElementById('pnSave');
  const note = document.getElementById('pnNote');
  const ok = !!name && n > 0;
  save.disabled = !ok;
  note.textContent = !name ? 'Give the audience a name.'
    : n === 0 ? 'No affinity numbers yet — drop a cut, paste one, or type at least one.'
    : `${name} · ${n} categor${n === 1 ? 'y' : 'ies'} set, ${CATS.length - n} left at par.`;
  note.className = 'pn-note' + (ok ? '' : ' warn');
}

/* One place the browser talks to the function. Errors come back as the
   message the server wrote — a 503 "not configured" and a 502 "Gemini 429" are
   different problems and a single "something went wrong" hides which. */
async function callGemini(payload) {
  const r = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  let j = null;
  try { j = await r.json(); } catch (e) { void e; }
  if (!r.ok || !j || !j.ok) {
    throw new Error((j && j.error) || `The reader is unavailable (${r.status}).`);
  }
  return j;
}

async function readWithGemini() {
  const btn = document.getElementById('pnGem');
  const src = document.getElementById('pnText').value;
  if (draft.busy) return;
  draft.busy = true;
  btn.disabled = true;
  btn.textContent = 'Reading…';
  try {
    const j = await callGemini({ action: 'read-cut', source: src });
    /* Gemini's only output is label/value pairs. They are turned back into the
       two-column text the tested parser expects and read by THAT — so category
       matching, the multiplier rule and the entity handling are all the same
       code a pasted CSV goes through, and there is no second path to audit. */
    const lines = j.pairs.map(x => `${x.label},${x.value}`).join('\n');
    const before = { ...draft.aff };
    draft.gem = { pairs: j.pairs, rejected: j.rejected || [], notes: j.notes || '' };
    const parsed = parseAudienceData(lines);
    draft.aff = { ...draft.aff, ...parsed.aff };
    draft.ent = { ...draft.ent, ...parsed.entities };
    void before;
    /* Keep each quote against the category it ended up in, not against the
       label Gemini used — the parser is what decides which category a label
       belongs to, so that is the mapping the panel has to show. */
    draft.quotes = {};
    for (const x of j.pairs) {
      const one = parseAudienceData(`${x.label},${x.value}`);
      const cat = one.matched[0];
      if (cat) draft.quotes[cat] = x.quote;
    }
    renderRead();
    renderGrid();
    validate();
  } catch (err) {
    draft.gem = null;
    renderRead();
    const el = document.getElementById('pnRead');
    el.innerHTML = `<div class="rd"><div class="rd-row bad">${esc(err.message)}</div></div>` + el.innerHTML;
  } finally {
    draft.busy = false;
    btn.disabled = false;
    btn.textContent = 'Read it with Gemini';
  }
}

/* Defining an audience from a sentence.

   The one path in this tool where a number is produced rather than read, so it
   is the one path that has to be loudest about it. Three things keep it
   honest, and none of them is the prompt:

     · the function validates the shape — real categories, indices clamped,
       fewer than eight of twelve refused because the rest would sit at par and
       the audience would re-order nothing;
     · what comes back is turned into the same two-column text a pasted CSV
       becomes and read by the SAME tested parser, so there is no second path
       into an audience record; and
     · the draft is marked estimated here, which buildAudience puts on the
       record, which every surface that draws the audience reads.               */
async function defineWithGemini() {
  const btn = document.getElementById('pnDefine');
  const desc = document.getElementById('pnDesc').value.trim();
  if (draft.busy) return;

  const box = document.getElementById('pnRead');
  const fail = msg => {
    box.innerHTML = `<div class="rd"><div class="rd-row bad">${esc(msg)}</div></div>` + box.innerHTML;
  };

  if (desc.length < 8) return fail('Describe the audience first — a sentence is enough.');

  draft.busy = true;
  btn.disabled = true;
  btn.textContent = 'Thinking…';
  try {
    const j = await callGemini({ action: 'define-audience', description: desc });

    const lines = j.pairs.map(x => `${x.label},${x.value}`).join('\n');
    const parsed = parseAudienceData(lines);
    draft.aff = { ...draft.aff, ...parsed.aff };

    /* Entities go through the parser too rather than straight onto the draft,
       so an override arriving from here faces the same handling as one typed
       into the box. */
    const entLines = (j.entities || []).map(x => `${x.label},${x.value}`).join('\n');
    if (entLines) {
      const pe = parseAudienceData(entLines);
      draft.ent = { ...draft.ent, ...pe.entities, ...pe.aff };
    }

    /* The reason for each index, filed under the category the PARSER chose
       rather than the label Gemini used — the parser decides where a label
       lands, so that is the mapping the panel has to show. */
    draft.why = draft.why || {};
    for (const x of j.pairs) {
      if (!x.why) continue;
      const one = parseAudienceData(`${x.label},${x.value}`);
      if (one.matched[0]) draft.why[one.matched[0]] = x.why;
    }

    /* Marked here, once, on the draft. Everything downstream reads it. */
    draft.est = true;
    draft.gem = null;
    draft.defined = { covered: j.covered, of: j.of, dropped: j.dropped || [] };

    /* Its name and definition fill only what is still blank — anything typed
       was a decision and this must not overwrite it. */
    const nameEl = document.getElementById('pnName');
    const defEl = document.getElementById('pnDef');
    if (!nameEl.value.trim() && j.name) { nameEl.value = j.name; draft.name = j.name; }
    if (!defEl.value.trim() && j.def) { defEl.value = j.def; draft.def = j.def; }

    renderRead();
    renderGrid();
    validate();
  } catch (err) {
    fail(err.message);
  } finally {
    draft.busy = false;
    btn.disabled = false;
    btn.textContent = 'Define with Gemini';
  }
}

function wirePanel() {
  const P = id => document.getElementById(id);
  P('pnName').addEventListener('input', e => { draft.name = e.target.value; validate(); });
  P('pnDef').addEventListener('input', e => { draft.def = e.target.value; });
  P('pnSize').addEventListener('input', e => { draft.size = e.target.value; });
  P('pnText').addEventListener('input', e => reparse(e.target.value));

  P('pnPick').addEventListener('click', () => P('pnFile').click());
  P('pnFile').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    if (f) readFile(f);
  });

  const drop = P('pnDrop');
  ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => {
    e.preventDefault(); drop.classList.add('over');
  }));
  ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => {
    e.preventDefault(); drop.classList.remove('over');
  }));
  drop.addEventListener('drop', e => {
    const dt = e.dataTransfer;
    if (!dt) return;
    const f = dt.files && dt.files[0];
    if (f) return readFile(f);
    /* Dragged out of another window as text rather than as a file — a selection
       from a sheet arrives this way, and refusing it would be arbitrary. */
    const t = dt.getData('text/plain');
    if (t) { P('pnText').value = t; reparse(t); }
  });

  P('pnGrid').addEventListener('input', e => {
    const c = e.target.dataset.aff;
    if (!c) return;
    const v = e.target.value.trim();
    if (v === '') delete draft.aff[c]; else draft.aff[c] = Number(v);
    e.target.closest('.gr').classList.toggle('par', v === '');
    const tag = e.target.closest('.gr').querySelector('.gt');
    tag.textContent = v === '' ? 'par' : 'typed';
    validate();
  });

  P('pnSave').addEventListener('click', commitAudience);
  P('pnGem').addEventListener('click', readWithGemini);
  P('pnDefine').addEventListener('click', defineWithGemini);
  /* Clear is drawn inside the read panel, which is re-rendered constantly, so
     it is caught on the way up rather than bound to an element that will not
     exist by the time the click happens. */
  document.getElementById('pnRead').addEventListener('click', e => {
    if (e.target.id === 'pnClear') clearDraftData();
  });
}

function readFile(file) {
  /* A dropped spreadsheet is not a CSV. Reading a .xlsx as text produces zip
     bytes, which the parser would dutifully report as 400 unusable lines — a
     true statement that explains nothing. Say what happened instead. */
  if (/\.(xlsx|xls|numbers|pdf|docx)$/i.test(file.name)) {
    draft.parsed = null;
    renderRead();
    document.getElementById('pnRead').innerHTML =
      `<div class="rd"><div class="rd-row bad"><b>${esc(file.name)}</b> is a spreadsheet, not a text file.
       Export it as CSV, or select the cells and paste them below.</div></div>`;
    return;
  }
  const r = new FileReader();
  r.onload = () => {
    const t = String(r.result || '');
    document.getElementById('pnText').value = t;
    reparse(t);
  };
  r.onerror = () => {
    document.getElementById('pnRead').innerHTML =
      `<div class="rd"><div class="rd-row bad">Could not read that file.</div></div>`;
  };
  r.readAsText(file);
}

function commitAudience() {
  const name = draft.name.trim();
  if (!name) return;

  /* Only the overrides still ticked. Unticking one has to actually drop it, or
     the checkbox is decoration. */
  const ent = {};
  document.querySelectorAll('[data-ent]').forEach(cb => {
    if (cb.checked) ent[cb.dataset.ent] = draft.ent[cb.dataset.ent];
  });

  const rec = buildAudience({ ...draft, name, ent }, CATS, ROSTER().map(a => a.id));
  CUSTOM.push(rec);
  saveCustom();
  S.auds = [rec.id];
  closeAudPanel();
  recompute();
  render();
}

function deleteAudience(id) {
  const a = CUSTOM.find(x => x.id === id);
  if (!a) return;
  if (!confirm(`Remove "${a.name}"? Its numbers are only in this browser and cannot be recovered.`)) return;
  CUSTOM = CUSTOM.filter(x => x.id !== id);
  saveCustom();
  S.auds = S.auds.filter(x => x !== id);
  if (!S.auds.length) S.auds = [AUDIENCES[0].id];
  recompute();
  render();
}

/* ============================================================
   POPOVER — shared by the wall and the ribbon
   ============================================================ */
let popEl = null;
function closePop() { if (popEl) { popEl.remove(); popEl = null; } }
/* WHAT AN AUDIENCE IS BUILT FROM.

   The rail can only show a name and two strongest categories, and everything
   that makes a board arguable is in the rest: the twelve indices, where they
   came from, and what each one rests on. A planner who cannot see that a
   ranking is driven by Sports at 195 cannot disagree with it, and a number
   nobody can disagree with is not evidence.

   So this shows every category, not the interesting ones — including the ones
   sitting at par, because a category the cut never mentioned and a category
   genuinely at par are different facts and only this panel can tell them
   apart. */
function openAudInfo(a, anchor) {
  closePop();

  /* Every category the board knows about, plus anything the audience carries
     that the board does not — a cut naming a category the calendar has no
     moments for is worth seeing rather than silently dropping. */
  const all = [...new Set([...CATS, ...Object.keys(a.aff || {})])];
  const rows = all
    .map(c => ({ c, v: a.aff && Number.isFinite(a.aff[c]) ? a.aff[c] : null }))
    .sort((x, y) => (y.v ?? -1) - (x.v ?? -1) || x.c.localeCompare(y.c));

  const provenance = a.pending
    ? `<span class="pv warn">No cut loaded.</span> Every category falls back to par, so this audience cannot re-order the board yet.`
    : a.custom
      ? `<span class="pv">Yours.</span> ${esc(a.read || 'Added in this browser.')}`
      : a.est
        ? `<span class="pv warn">Estimated.</span> Reasoned from a brief, not read off a panel — argue with any of it.`
        : `<span class="pv">Placeholder.</span> Invented numbers with the right shape, standing in until a real cut lands.`;

  const bar = v => {
    if (v == null) return '<span class="ab none"></span>';
    /* Par is the reference, so the bar is drawn against it rather than against
       the largest value on screen — 100 always sits in the same place and two
       audiences can be compared by eye. */
    const w = Math.max(2, Math.min(100, v / 250 * 100));
    return `<span class="ab" style="--w:${w.toFixed(1)}%;--k:${v >= 100 ? 'var(--pill-green)' : 'var(--pill-amber)'}"></span>`;
  };

  popEl = document.createElement('div');
  popEl.className = 'pop aud-pop';
  popEl.innerHTML = `
    <div class="t">${esc(a.name)}${a.custom ? '<span class="mine">Yours</span>' : ''}${
      a.est ? '<span class="est">Est.</span>' : ''}${a.pending ? '<span class="pend">No cut</span>' : ''}</div>
    <div class="meta">${a.pa ? esc(a.pa) + ' · ' : ''}${esc(a.size || 'no size given')}</div>
    ${a.def ? `<div class="note">${esc(a.def)}</div>` : ''}
    ${a.brief ? `<div class="note quiet"><b>Defined from:</b> ${esc(a.brief)}</div>` : ''}
    <div class="prov">${provenance}</div>
    <div class="aff-hd">Category affinity <span>100 = par</span></div>
    <div class="aff">
      ${rows.map(r => `
        <div class="aff-r${r.v == null ? ' unset' : ''}">
          <span class="ac"><span class="dot" style="--c:${CAT_COLOR[r.c] || '#5C6279'}"></span>${esc(r.c)}</span>
          ${bar(r.v)}
          <span class="av">${r.v == null ? '—' : r.v}</span>
          ${a.why && a.why[r.c] ? `<span class="aw">${esc(a.why[r.c])}</span>` : ''}
        </div>`).join('')}
    </div>
    ${Object.keys(a.ent || {}).length ? `
      <div class="aff-hd">Entity overrides <span>where a category is too blunt</span></div>
      <div class="ents">${Object.entries(a.ent).sort((x, y) => y[1] - x[1])
        .map(([k, v]) => `<span class="ent"><b>${esc(k)}</b> ${v}</span>`).join('')}</div>` : ''}`;

  document.body.appendChild(popEl);
  placePop(anchor);
}

/* Shared by both popovers: keep it on screen, preferring below the thing that
   opened it and flipping above when there is no room. */
function placePop(anchor) {
  const r = anchor.getBoundingClientRect();
  const w = popEl.offsetWidth, h = popEl.offsetHeight;
  const x = Math.min(window.innerWidth - w - 12, Math.max(12, r.left));
  let y = r.bottom + 8;
  if (y + h > window.innerHeight - 12) y = Math.max(12, r.top - h - 8);
  popEl.style.left = x + 'px';
  popEl.style.top = y + 'px';
}

function openPop(m, anchor) {
  closePop();
  popEl = document.createElement('div');
  popEl.className = 'pop';
  popEl.innerHTML = `
    <div class="t">${esc(m.name)}</div>
    <div class="meta"><span class="dot" style="--c:${CAT_COLOR[m.cat]}"></span>${esc(m.cat)}${m.plat ? ' · ' + esc(m.plat) : ''}<br>
      ${fmtDate(m.start)}${m.end !== m.start ? ' → ' + fmtDate(m.end) : ''} · ${esc(m.conf)}</div>
    <div class="row">${m.score == null
      ? `<span class="sc none">—</span><span class="bandpill nodata">Not scored</span>`
      : `<span class="sc">${m.score}</span><span class="bandpill ${m.band.id}">${m.band.label}</span>` +
        (m.quadrant ? `<span class="quadpill" style="--c:${m.quadrant.color}" title="${esc(m.quadrant.note)}">${esc(m.quadrant.label)}</span>` : '')}</div>
    ${partsBlock(m)}
    ${reachNote(m)}
    ${m.notes ? `<div class="note">${esc(m.notes)}</div>` : ''}
    <div class="pop-read" id="popRead">
      <button type="button" class="gem sm" data-read="${m.id}">Write the read</button>
    </div>`;
  document.body.appendChild(popEl);
  placePop(anchor);
}

/* Where a sports Scale figure came from. Only drawn when the score actually
   used measured reach — most of the board still runs on the keyword ladder,
   and a source line under a guess would be worse than none.

   It states the LEAGUE-MONTH plainly, because that is the honest scope of the
   figure: it is every national telecast of that league in that month, not this
   fixture on its own. For a tentpole in its own month — the Derby in May, the
   Indy 500 in May — the two are close. For one regular-season game it is an
   upper bound, and saying so is the difference between a source and a claim. */
function reachNote(m) {
  const r = reachOf(m);
  if (!r) return '';
  return `<div class="src">
    <b>${r.pct}%</b> P18-49 reach — ${esc(r.league)}, all national telecasts in ${esc(r.month)}.
    <span>${esc(REACH_SOURCE.name)}, ${esc(REACH_SOURCE.edition)}</span>
  </div>`;
}

/* The paragraph a planner pastes into a deck. Every number in it was computed
   here and handed to the model in the prompt; the function checks the reply for
   any digit it did not supply and refuses the whole thing rather than let an
   invented figure reach a client deck. So this is only ever presented as what
   it is — the tool's own numbers, in sentences. */
async function writeTheRead(m, btn) {
  const box = document.getElementById('popRead');
  if (!box) return;
  btn.disabled = true;
  btn.textContent = 'Writing…';
  try {
    const j = await callGemini({
      action: 'read-moment',
      moment: { name: m.name, cat: m.cat, start: m.start, end: m.end, conf: m.conf, plat: m.plat },
      audience: { name: audience().name, def: audience().def },
      score: m.score, band: m.band ? m.band.label : 'not scored', parts: m.parts
    });
    box.innerHTML = `<p class="rdtxt">${esc(j.read)}</p>
      <button type="button" class="copy" data-copy="1">Copy</button>`;
    box.querySelector('[data-copy]').addEventListener('click', ev => {
      navigator.clipboard.writeText(j.read).then(() => { ev.target.textContent = 'Copied'; }, () => {});
    });
  } catch (err) {
    box.innerHTML = `<p class="rdtxt bad">${esc(err.message)}</p>`;
  }
}

/* ============================================================
   RENDER
   ============================================================ */
function render() {
  closePop();
  /* replaceState rather than assigning location.hash: this is where you ARE,
     not somewhere you went, and a back button that walks through every rail
     click is worse than one that leaves the page. */
  try {
    const q = S.auds.join('+')
      + (multi() ? '/' + S.mode : '')
      + (S.model !== DEFAULT_MODEL ? '/' + S.model : '');
    history.replaceState(null, '', '#/' + q);
  } catch (e) { void e; }
  renderRail();
  renderHead();
  const body = document.getElementById('body');
  body.innerHTML = drawRibbon();
  body.scrollTop = 0;
}

/* ---------- one delegated listener ---------- */

/* ============================================================
   METHODOLOGY
   The board argues with numbers, so the derivation has to be one click from
   them. Everything drawn here is READ FROM THE MODEL — the weights, the
   congestion ceiling, the band cuts and the reach source are the same objects
   scoreMoments() uses. Retyping any of them is how a methodology note starts
   describing a formula the board is not running.
   ============================================================ */

/* ".50" rather than "0.5" — the weights read as a column of shares, and the
   leading zero is noise in a table where every value is below one. */
const shr = w => w.toFixed(2).replace(/^0/, '');

/* Read from the active model, not retyped. The panel's whole claim is that it
   describes the formula the board just ran, and two models cannot share one
   hard-coded list of components without one of them being described wrongly. */
const methParts = () => MODEL().parts.map(x => ({
  name: x.name, w: x.weight, q: x.q, from: x.why, note: x.note
}));

function openMethodology() {
  const cur = MODEL();
  const parts = methParts();
  const weighted = parts.filter(x => x.w);
  const el = document.getElementById('meth');
  el.hidden = false;
  el.innerHTML = `
    <div class="meth-scrim" data-meth-close="1"></div>
    <div class="meth-card" role="dialog" aria-modal="true" aria-labelledby="methTitle">
      <div class="meth-hd">
        <div>
          <div class="meth-kick">Methodology \u00b7 ${esc(cur.label)}</div>
          <h2 id="methTitle">How a moment\u2019s relevance is worked out</h2>
        </div>
        <button class="meth-x" data-meth-close="1" type="button" aria-label="Close">\u00d7</button>
      </div>

      <div class="meth-bd">
        <p class="meth-lede">Relevance is never a bare number. It is
          <b>${weighted.length} named components</b>${parts.length > weighted.length
            ? ` and ${parts.length - weighted.length === 1 ? 'one term that works differently' : 'two terms that work differently'}` : ''},
          each answering a question a planner would otherwise have to ask out loud — so you
          can say <i>which part</i> of a score is wrong rather than just distrusting the total.</p>

        <div class="meth-eq">score = ${cur.id === 'affinity'
          ? `( ${weighted.map(x => `<b>${esc(x.name.toLowerCase())}</b>\u00d7${shr(x.w)}`).join(' + ')} )
             \u00d7 ( 1 \u2212 <b>congestion</b>/100 \u00d7 ${shr(CONGESTION_MAX)} )`
          : `${weighted.map(x => `<b>${esc(x.name.toLowerCase())}</b>\u00d7${shr(x.w)}`).join(' + ')}
             <br>feasibility = ${Object.entries(cur.feasWeights).map(([k, v]) =>
               `<b>${k === 'quiet' ? 'quiet week' : k === 'tim' ? 'timing' : 'access'}</b>\u00d7${shr(v)}`).join(' + ')}`}</div>

        <div class="meth-rows">
          ${parts.map(x => `
            <div class="meth-r">
              <div class="meth-rn">${esc(x.name)}</div>
              <div class="meth-rq">${esc(x.q)}<i>${esc(x.from)}</i></div>
              <div class="meth-rw">${x.w ? shr(x.w) : esc(x.note || '\u2014')}</div>
            </div>`).join('')}
          ${cur.id === 'affinity' ? '' : `
            <div class="meth-r">
              <div class="meth-rn">Congestion</div>
              <div class="meth-rq">How loud is everything else that week?<i>Inside feasibility rather than against the score. Nobody was surveyed about how busy a week is, so under this model it cannot be a term \u2014 but it still decides whether a moment is worth entering.</i></div>
              <div class="meth-rw">in feas.</div>
            </div>`}
        </div>

        <div>
          <div class="meth-h" style="margin-bottom:9px">Bands, not numbers — nobody acts on 71 versus 68</div>
          <div class="meth-bands">
            ${cur.bands.map(b => `
              <div class="meth-band" style="--c:${b.color}">
                <b>${esc(b.label)}</b><span>${b.min}+</span> ${esc(b.note)}
              </div>`).join('')}
          </div>
        </div>

        ${cur.id === 'response' ? `
        <div>
          <div class="meth-h" style="margin-bottom:9px">And the second axis crosses them into four</div>
          <div class="meth-bands">
            ${cur.quadrants.map(q => `
              <div class="meth-band" style="--c:${q.color}">
                <b>${esc(q.label)}</b><span></span> ${esc(q.note)}
              </div>`).join('')}
          </div>
        </div>` : ''}

        ${cur.id === 'affinity' ? `
        <div class="meth-note">
          <div class="meth-h">What is measured here and what is not</div>
          <p>The four <b>official targets</b> carry a real cut — ${esc(YOUGOV_SOURCE.name)},
            ${YOUGOV_SOURCE.banks} question banks — and are marked <b>Cut</b> on the rail.
            Three of the twelve lanes have no battery in it (holidays, national days,
            heritage) and sit at par for every audience rather than being guessed at.</p>
          <p>The six <b>popular</b> audiences carry <b>invented</b> category indices — the right
            shape, none of it true. Scale outside sport is a keyword ladder over the
            moment\u2019s name, not a reach figure.</p>
          <p>Anything you define yourself is either read from data you paste in, or
            <b>estimated by Gemini</b> and labelled as such everywhere it appears.</p>
        </div>` : `
        <div class="meth-note">
          <div class="meth-h">Where each number came from</div>
          <p>Every figure is a ${esc(YOUGOV_SOURCE.name)} response, re-based onto the whole
            audience. ${YOUGOV_SOURCE.conditional.length} of the
            ${YOUGOV_SOURCE.banks} question banks were only put to people who qualified —
            sponsorship actions only to those who had noticed a sponsor — so their indices
            are rebuilt from the projected counts rather than taken as printed.</p>
          <p>Fandom is read at the sharpest rung available and <b>the rung is reported</b> on
            every moment: the named property, the sub-topic, or the lane. Reachability is
            measured across the whole audience rather than across the part of it that
            follows the moment, because this export does not carry that cross.</p>
        </div>`}

        <div class="meth-note next">
          <div class="meth-h">Reading the other model</div>
          <p>${esc(MODELS.find(m => m.id !== cur.id).label)} asks a different question:
            ${esc(MODELS.find(m => m.id !== cur.id).gist)}</p>
          <p>The toggle is at the top of the rail, and
            <b>“Which should I use?”</b> under it sets the two side by side.</p>
        </div>
      </div>
    </div>`;
  el.querySelector('.meth-x').focus();
}

/* ============================================================
   WHICH MODEL SHOULD I USE
   ============================================================

   Ed's brief for this panel was "explain each formula simply and without
   jargon", and the hard part of that is not vocabulary — it is resisting the
   urge to sell one of them. Both are defensible; they answer different
   questions and they have different weaknesses, and a reader who leaves here
   knowing only which one we prefer has been told nothing they can use.

   So: what each one asks, in a sentence. What it is good at. What it is bad
   at. When to pick it. The numbers are read from the models themselves, the
   same as the methodology panel, so this cannot drift from what the board is
   actually computing. */

const MODEL_HELP = {
  affinity: {
    /* THE PLAIN VERSION COMES FIRST AND IS NOT A SUMMARY OF THE REST.

       Ed's brief was "explain the difference simply", and a panel that opens
       with the detailed cards and puts the simple version at the bottom has
       answered a different question — the reader who most needs the plain
       words is the one least likely to scroll past the algebra to find them.
       So this block sits above everything, and the detail is what you go on
       to if you want it. */
    ask: 'Do they like this kind of thing — and is the moment worth buying?',
    counts: [
      ['Does this audience like this sort of thing?', 'half the score',
       'One number per lane — sport, music, gaming — where 100 means “no different from anybody else”. A sports audience might sit at 170 on sport and 85 on fashion.'],
      ['How big is the moment?', 'a fifth'],
      ['Is there a way to buy into it?', 'a bit'],
      ['Is the date firm enough to plan against?', 'a bit'],
      ['How much else is happening that week?', 'taken off the total']
    ],
    only: 'Only the first one changes when you switch audience. The other four are facts about the moment and are the same for everybody.',
    means: 'The big obvious moments float to the top. The Super Bowl is huge, dated and buyable, so it scores well for almost anyone — good for finding the year’s tentpoles.',
    weak: '“How big is it” is guessed from the moment’s <b>name</b> outside sport. The words “World Cup” score higher than the words “Album Release”. That is a guess wearing a number.',
    pick: 'First pass, or any board that mixes real and made-up audiences.',
    line: 'How much does this audience like this kind of thing — and is the moment big, buyable and uncrowded enough to be worth it?',
    plain: [
      ['It starts with taste.', 'Every audience has a score for each of the twelve lanes — sport, music, gaming and so on — where 100 means "no different from anybody else". A sports audience might sit at 170 on sport and 85 on fashion. That taste score is half the answer.'],
      ['Then it asks four things about the moment itself.', 'How big is it. Whether there is a way to buy into it. Whether the date is firm enough to plan against. And how much else is happening that week, which is taken off the total rather than added to it.'],
      ['The four are the same for everybody.', 'Only taste changes when you switch audience. That is deliberate: it means the board reorders because the audience genuinely wants different things, not because the model quietly reweighted itself.']
    ],
    good: [
      'Works for every audience on the rail, including the estimated ones and anything you define yourself — so one board can hold them all side by side.',
      'The big obvious moments rise to the top, because size is part of the score. If you are looking for tentpoles, this finds them.',
      'Every component is something a planner already argues about, so a score you disagree with can be taken apart into the part you disagree with.'
    ],
    bad: [
      'Half the score is not about the audience at all. Two very different audiences can end up with fairly similar boards, because a big, firmly-dated, buyable moment wins three terms out of four no matter who is watching.',
      '"Size" outside sport is inferred from the moment\u2019s name rather than measured — the words "World Cup" score higher than the words "Album Release", which is a guess wearing a number.',
      'A moment the audience would love but that has no obvious way in gets quietly marked down and disappears, instead of being flagged as something to go and build.'
    ],
    when: 'Use it for the first pass, for any board that mixes real and estimated audiences, and whenever you need the year\u2019s tentpoles ranked.'
  },
  response: {
    ask: 'What did these people actually tell a researcher?',
    counts: [
      /* "Do they follow this?" was the first wording and it was too vague to
         be useful — it reads as social-media following, and it hid the fact
         that the term is TWO numbers rather than one. Say both. */
      ['Are they into it — and more than most people are?', 'half the score',
       'Two numbers, not one. <b>How many of them</b> said they are interested, and <b>whether that beats the national rate</b>. A small group who are wildly keen is not the same as a big group who quite like it, and either figure on its own picks the wrong moment.'],
      ['Can we reach them where it lives?', 'three tenths',
       'The channels the moment actually runs on, crossed with how heavily this audience uses each one.'],
      ['Will they welcome a brand turning up?', 'two tenths',
       'Whether they say advertising is worth their time, and whether they have ever acted on a sponsorship. A fact about the audience, so it lifts or lowers a whole board rather than reordering one.']
    ],
    /* Two audiences, one moment, real numbers off the cut. Nothing explains a
       scored term like watching it disagree with itself. */
    eg: {
      what: 'The NBA Finals',
      rows: [
        ['YTTV Sport 25–44', '62% of them are interested — about twice the national rate', 91],
        ['Gemini ’26', '17% are, which is below the national rate', 35]
      ]
    },
    only: 'Nothing is inferred from a name or a size. If nobody was asked, it does not score. Everything about the <b>moment</b> — the date, whether you can buy in, how crowded the week is — comes out of the score and goes on a second scale called <b>feasibility</b>.',
    means: 'Good moments stop disappearing. A moment they would love with no obvious way in comes out in its own box marked <b>“find a door”</b> — go and build a route into this one — instead of quietly sinking.',
    weak: 'It only works for the four official targets, because they are the only ones with real research behind them. And it cannot see seasons: a survey finds the same football fans in June as in November.',
    pick: 'Once you are down to the PA’s own targets, or you need to defend a choice with evidence.',
    line: 'Are these people actually into this, can we reach them where it lives, and will they welcome a brand turning up?',
    plain: [
      ['Everything scored here is an answer somebody gave.', 'Nothing is inferred from the moment\u2019s name or its size. If nobody was asked, it does not score — it is left out and the remaining parts carry the weight.'],
      ['Are they into it, and more than most? — half the score.', 'Read at the sharpest level available: the survey asked about this exact thing (the NFL Draft), or about this kind of thing (fighting games, horror films), or only about the lane. It combines how strongly they index with how many of them actually take part, so a small fervent niche cannot outrank a mainstream passion.'],
      ['Can we reach them there? — three tenths.', 'Every moment has channels it lives on, and every audience has channels it uses heavily. This is the overlap — again crossed with how many of them are really on that channel, not just how distinctive it is.'],
      ['Will they welcome a brand? — two tenths.', 'Whether they say advertising is worth their time, and whether they have actually done something about a sponsorship. This is a fact about the audience rather than the moment, so it lifts or lowers a whole board rather than reordering one.'],
      ['Timing and access come out of the score entirely.', 'They move to a second axis called feasibility, and the two cross. A moment scoring high on relevance with nothing to buy no longer sinks quietly — it reads as "find a door", which is a brief for a partnership rather than a moment you never noticed you dropped.']
    ],
    good: [
      'Every number traces back to a person answering a question. Nothing is a proxy for anything.',
      'Audiences separate much harder, because all three parts vary by audience instead of just one.',
      'The moments you cannot currently buy stop hiding. They come out as their own category with a name that says what to do about them.'
    ],
    bad: [
      'Only works for the four audiences with a research cut behind them. The estimated ones cannot be scored at all, and a board mixing the two will be part empty.',
      'It cannot see seasonality. A survey finds the same football fans in June as in November, so a moment out of season reads exactly like one in season.',
      'Three lanes \u2014 holidays, national days, heritage months \u2014 have no questions behind them in this cut, so they score on reach and receptivity only and say so.',
      'Reachability is measured across the whole audience rather than across the part of it that cares, because the export does not carry that cross. It slightly flatters moments on broadly popular channels.'
    ],
    when: 'Use it once you have narrowed to the PA\u2019s own targets, when you need to defend a choice with research, or when you want to find the moments worth building an access route into.'
  }
};

/* WHY THE "WHAT COUNTS" LIST IS NOT A TABLE.

   It was one. The explanatory sub-line under a term had to span both columns,
   which made its single cell the row's `:last-child` — and that selector
   carried the weight column's rules, including `white-space: nowrap`. A
   wrapping sentence pinned to one line dragged the table past the edge of the
   card and pushed the weight column out of sight, so the panel whose entire
   job is to explain the weights displayed none of them.

   Rows and notes are siblings now and nothing spans anything, which makes that
   failure unreachable rather than fixed. smoke.mjs asserts both: no `colspan`
   anywhere in the panel, and a count of weights that matches the count of rows.

   ⚠️ The markup below lives inside a template literal. A backtick in a comment
   there ends the string and the whole app stops parsing — which is how the
   note above first shipped, before it was moved out here where it belongs.  */
function openModelHelp() {
  const el = document.getElementById('modelHelp');
  el.hidden = false;
  const card = m => {
    const h = MODEL_HELP[m.id];
    const on = m.id === S.model;
    return `
      <div class="mh-card${on ? ' on' : ''}" style="--mc:${m.color};--mcd:${m.colorDark}">
        <div class="mh-hd">
          <b><span class="mi" aria-hidden="true">${m.icon}</span>${esc(m.label)}</b>
          ${on ? '<span class="mh-now">You are reading this one</span>' : `<button class="mh-pick" type="button" data-model="${m.id}" data-help-close="1">Switch to it</button>`}
        </div>
        <p class="mh-line">${esc(h.line)}</p>
        <div class="mh-eq">${m.parts.filter(p => p.weight).map(p =>
            `<b>${esc(p.name.toLowerCase())}</b>&nbsp;\u00d7&nbsp;${p.weight.toFixed(2).replace(/^0/, '')}`).join(' &nbsp;+&nbsp; ')}${
            m.parts.some(p => !p.weight) ? ` &nbsp;\u2014 then ${m.parts.filter(p => !p.weight).map(p => `<b>${esc(p.name.toLowerCase())}</b>`).join(' and ')}` : ''}</div>

        <div class="mh-h">How it works</div>
        ${h.plain.map(([t, b]) => `<p class="mh-p"><b>${esc(t)}</b> ${esc(b)}</p>`).join('')}

        <div class="mh-cols">
          <div class="mh-col good">
            <div class="mh-h">What it is good at</div>
            <ul>${h.good.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
          </div>
          <div class="mh-col bad">
            <div class="mh-h">Where it falls down</div>
            <ul>${h.bad.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
          </div>
        </div>

        <p class="mh-when"><b>Reach for it when</b> ${esc(h.when)}</p>
      </div>`;
  };

  el.innerHTML = `
    <div class="meth-scrim" data-help-close="1"></div>
    <div class="meth-card wide" role="dialog" aria-modal="true" aria-labelledby="mhTitle">
      <div class="meth-hd">
        <div>
          <div class="meth-kick">Relevance model</div>
          <h2 id="mhTitle">Two ways to read the same year</h2>
        </div>
        <button class="meth-x" data-help-close="1" type="button" aria-label="Close">\u00d7</button>
      </div>
      <div class="meth-bd">
        <p class="meth-lede">Both models score every moment out of 100 and sort the year by the
          answer. They disagree about <b>what should count</b>, and that disagreement is worth
          understanding before you take either board to a client.</p>

        <!-- The plain version, first. See the note above MODEL_HELP. -->
        <div class="mh-quick">
          ${MODELS.map(m => {
            const q = MODEL_HELP[m.id];
            return `
            <div class="mh-q" style="--mc:${m.color};--mcd:${m.colorDark}">
              <div class="mh-q-hd">
                <span class="mi" aria-hidden="true">${m.icon}</span>
                <b>${esc(m.short)}</b>
                <i>${esc(q.ask)}</i>
              </div>
              <div class="mh-q-t">
                ${q.counts.map(([k, v, note]) => `
                  <div class="mh-q-row">
                    <span class="mh-q-k">${esc(k)}</span>
                    <span class="mh-q-w">${esc(v)}</span>
                  </div>
                  ${note ? `<p class="mh-q-n">${note}</p>` : ''}`).join('')}
              </div>
              <p class="mh-q-p">${q.only}</p>
              <p class="mh-q-p"><b>What that means:</b> ${q.means}</p>
              <p class="mh-q-p weak"><b>Its weak spot:</b> ${q.weak}</p>
              ${q.eg ? `
                <div class="mh-eg">
                  <div class="mh-eg-h">${esc(q.eg.what)}, two audiences</div>
                  ${q.eg.rows.map(([who, why, score]) => `
                    <div class="mh-eg-r">
                      <span class="mh-eg-w">${esc(who)}</span>
                      <span class="mh-eg-y">${esc(why)}</span>
                      <span class="mh-eg-s">${score}</span>
                    </div>`).join('')}
                </div>` : ''}
              <p class="mh-q-use"><b>Use it for</b> ${esc(q.pick)}</p>
            </div>`;
          }).join('')}
        </div>

        <p class="mh-one">In one sentence —
          <b style="--mc:${MODELS[0].color};--mcd:${MODELS[0].colorDark}">${MODELS[0].icon} ${esc(MODELS[0].short)}</b>
          asks how much they like it and whether it is worth buying;
          <b style="--mc:${MODELS[1].color};--mcd:${MODELS[1].colorDark}">${MODELS[1].icon} ${esc(MODELS[1].short)}</b>
          asks what they told a researcher, and refuses to guess about anything else.</p>

        <div class="mh-more">The same thing in more detail</div>
        <div class="mh-grid">${MODELS.map(card).join('')}</div>

        <div class="meth-note">
          <div class="meth-h">Why there is a choice at all</div>
          <p>The first works everywhere and is easier to argue with. The second is better
            evidence and only covers the four targets with a
            ${esc(YOUGOV_SOURCE.name)} cut behind them. Neither is the right answer on its own,
            which is why the toggle is at the top of the rail rather than buried in a setting.</p>
        </div>
      </div>
    </div>`;
  el.querySelector('.meth-x').focus();
}

function closeModelHelp() {
  const el = document.getElementById('modelHelp');
  el.hidden = true;
  el.innerHTML = '';
  const b = document.getElementById('modelHelpBtn');
  if (b) b.focus();
}

function closeMethodology() {
  const el = document.getElementById('meth');
  el.hidden = true;
  el.innerHTML = '';
  document.getElementById('methBtn').focus();
}

/* ============================================================
   PANEL DEFINITION ON HOVER
   ============================================================ */
/* The official targets are the only rows whose definition is a boolean rather
   than a sentence, and the sentence is the one the rail already shows. A
   planner about to defend a board needs the boolean — "Adults 18–34" is
   checkable, "the broadest of the four" is not — and needing it does not
   justify a click and a full panel.

   So: hover, and keyboard focus, because a hover box nobody can reach with a
   keyboard is a box that is not there for half the ways this rail is used.

   ITS OWN ELEMENT, NOT THE SHARED POPOVER. render() and every outside click
   close popEl, and the rail re-renders on the click that selects a row — a
   tooltip sharing that lifecycle would blink out from under the pointer that
   was reading it. The ⓘ panel stays what it was: the deep one, with the
   twelve indices. This is the reminder. */
let tipEl = null;

function closeTip() {
  if (tipEl) { tipEl.remove(); tipEl = null; }
}

/* To the right of the rail by preference. Below the row — where placePop()
   puts things — would cover the next three audiences, which is exactly the
   comparison the reader is in the middle of making. */
function placeTip(anchor) {
  const r = anchor.getBoundingClientRect();
  const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
  let x = r.right + 10;
  if (x + w > window.innerWidth - 12) x = Math.max(12, r.left - w - 10);
  const y = Math.max(12, Math.min(window.innerHeight - h - 12, r.top - 6));
  tipEl.style.left = x + 'px';
  tipEl.style.top = y + 'px';
}

function openTip(a, anchor) {
  closeTip();
  if (!a || !a.criteria || !a.criteria.length) return;
  tipEl = document.createElement('div');
  tipEl.className = 'aud-tip';
  tipEl.setAttribute('role', 'tooltip');
  tipEl.dataset.forAud = a.id;
  /* Numbered and stacked rather than run together in a paragraph: the clauses
     are ANDed, and an AND buried in prose next to six ORs is an AND nobody
     reads. The joiner is drawn by CSS between the items so it cannot drift
     out of step with the list. */
  tipEl.innerHTML = `
    <div class="tip-t">${esc(a.full || a.name)}</div>
    <div class="tip-k">Panel definition — all of the following</div>
    <ol class="tip-c">${a.criteria.map(c => `<li>${esc(c)}</li>`).join('')}</ol>
    <div class="tip-s">${esc(YOUGOV_SOURCE.name)} \u00b7 ${esc(YOUGOV_SOURCE.cut)}</div>`;
  document.body.appendChild(tipEl);
  placeTip(anchor);
}

const audRow = el => el && el.closest ? el.closest('.aud[data-aud]') : null;

/* mouseover rather than mouseenter: one listener on the document beats one per
   row on a list that is rebuilt on every render. The same-row guard is what
   stops it rebuilding the box each time the pointer crosses a badge inside
   the row it is already describing. */
document.addEventListener('mouseover', e => {
  const t = audRow(e.target);
  if (!t) return closeTip();
  if (tipEl && tipEl.dataset.forAud === t.dataset.aud) return;
  const a = ROSTER().find(x => x.id === t.dataset.aud);
  if (a && a.criteria && a.criteria.length) openTip(a, t); else closeTip();
});

document.addEventListener('focusin', e => {
  const t = audRow(e.target);
  if (!t) return closeTip();
  const a = ROSTER().find(x => x.id === t.dataset.aud);
  if (a && a.criteria && a.criteria.length) openTip(a, t);
});

/* The rail scrolls under a fixed box. Capture, because the scroll is on the
   rail element rather than on the window and a bubbling listener never hears
   it. */
document.addEventListener('scroll', closeTip, { capture: true, passive: true });
window.addEventListener('resize', closeTip, { passive: true });

document.addEventListener('click', e => {
  const t = e.target.closest('[data-aud],[data-pick-aud],[data-cat],[data-id],[data-open],[data-del],[data-close],[data-info],#themeTog,#watchTog,#audAdd,[data-mode],[data-model],[data-fam-tog],[data-grp-tog],#zoomIn,#zoomOut,#zoomRd,#methBtn,[data-meth-close],#modelHelpBtn,[data-help-close]');
  if (!t) { closePop(); return; }

  /* Tested before the popover-closing paths below and before the audience
     toggle: the i sits inside the row, so without its own branch a click on it
     would both open the panel and switch the audience on or off. */
  /* Tested before the close handler: the "Switch to it" button inside the
     comparison carries BOTH data-model and data-help-close, and it has to do
     the switch on the way out rather than only shutting the panel. */
  if (t.dataset.model) {
    const next = t.dataset.model;
    if (t.dataset.helpClose) closeModelHelp();
    if (next !== S.model && MODELS.some(m => m.id === next)) {
      S.model = next;
      recompute();
      render();
    }
    return;
  }

  if (t.id === 'modelHelpBtn') { openModelHelp(); return; }
  if (t.dataset.helpClose) { closeModelHelp(); return; }

  if (t.dataset.info) {
    const a = ROSTER().find(x => x.id === t.dataset.info);
    /* A second click on the same i closes it, rather than redrawing the same
       panel in the same place and looking like nothing happened. */
    if (popEl && popEl.dataset.forAud === t.dataset.info) return closePop();
    if (a) { openAudInfo(a, t); popEl.dataset.forAud = a.id; }
    return;
  }

  if (t.id === 'zoomIn' || t.id === 'zoomOut' || t.id === 'zoomRd') {
    const next = t.id === 'zoomRd' ? ZOOM_DEFAULT
      : t.id === 'zoomIn' ? S.zoom + 1 : S.zoom - 1;
    /* Clamped rather than wrapped — a zoom that jumps from the widest rung
       back to Fit on one more click is a control nobody trusts. */
    const clamped = Math.max(0, Math.min(ZOOM.length - 1, next));
    if (clamped === S.zoom) return;
    S.zoom = clamped;
    saveZoom();
    /* Zoom changes the horizontal scale, so the vertical position should not
       move. render() parks the board back at the top, which is right after an
       audience change and wrong here — you would lose your place in the lanes
       every time you pressed +. */
    const body = document.getElementById('body');
    const y = body.scrollTop;
    render();
    body.scrollTop = y;
    return;
  }

  /* Collapsing. One handler for both stacks — the board's families and the
     rail's audience groups — because they are the same gesture and a reader
     who learns it on one expects it on the other. Rail ids are prefixed so the
     two cannot collide in the one saved list. */
  if (t.dataset.famTog || t.dataset.grpTog) {
    const key = t.dataset.famTog || `aud:${t.dataset.grpTog}`;
    S.shut.has(key) ? S.shut.delete(key) : S.shut.add(key);
    saveShut();
    return render();
  }

  if (t.id === 'methBtn')  return openMethodology();
  if (t.dataset.methClose) return closeMethodology();

  if (t.id === 'audAdd')   return openAudPanel();
  if (t.dataset.close)     return closeAudPanel();
  if (t.dataset.del)       return deleteAudience(t.dataset.del);

  /* Select ONE audience and drop the rest. The ordinary row click toggles,
     which is right on the rail — but the recovery button in the warning is
     answering "show me something this model can read", and adding a fifth
     audience to a selection of four unscoreable ones does not answer it. */
  if (t.dataset.pickAud) {
    S.auds = [t.dataset.pickAud];
    recompute();
    return render();
  }
  if (t.dataset.aud)  {
    const id = t.dataset.aud;
    const i = S.auds.indexOf(id);
    /* The last one cannot be switched off — a board with no audience has
       nothing to say, and an empty rail reads as a bug rather than a choice. */
    if (i >= 0) { if (S.auds.length === 1) return; S.auds.splice(i, 1); }
    else S.auds.push(id);
    recompute();
    return render();
  }
  if (t.dataset.cat)  {
    const c = t.dataset.cat;
    S.off.has(c) ? S.off.delete(c) : S.off.add(c);
    return render();
  }
  if (t.dataset.mode) { S.mode = t.dataset.mode; recompute(); return render(); }
  if (t.id === 'watchTog') { S.showWatch = !S.showWatch; return render(); }
  if (t.id === 'themeTog')  {
    /* Light is the default, so the toggle is a straight flip of a stamp that
       is always present — there is no unstamped third state to reason about.
       Saved, because a choice that does not survive a reload is not a choice. */
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('ltpm.theme', next); } catch (e) { void e; }
    renderHead();
    return;
  }
  if (t.dataset.more) {
    /* "+7 more" opens the cell rather than paging it: the wall's job is the
       shape of the year, and a cell that grows to eleven rows destroys it for
       every other cell in the row. */
    const [c, mk] = t.dataset.more.split('|');
    const list = visible().filter(m => m.cat === c && m.start.slice(0, 7) === mk && m.score >= (S.showWatch ? 40 : 56))
      .sort((a, b) => b.score - a.score);
    t.parentElement.innerHTML = list.map(chip).join('');
    return;
  }
  if (t.dataset.open) {
    const bd = t.parentElement.querySelector('.rk-bd');
    const open = !bd.hidden;
    bd.hidden = open;
    t.setAttribute('aria-expanded', String(!open));
    t.querySelector('.rk-cv').textContent = open ? '▾' : '▴';
    return;
  }
  if (t.dataset.read) {
    const m = SCORED.find(x => x.id === t.dataset.read);
    if (m) writeTheRead(m, t);
    return;
  }
  if (t.dataset.id) {
    const m = SCORED.find(x => x.id === t.dataset.id);
    if (m) openPop(m, t);
    return;
  }
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  /* The panel holds unsaved typing, so it takes Escape ahead of the popover —
     closing a tooltip while a half-filled dialog sits behind it would read as
     the key having done nothing. */
  if (draft) return closeAudPanel();
  if (!document.getElementById('modelHelp').hidden) return closeModelHelp();
  if (!document.getElementById('meth').hidden) return closeMethodology();
  closePop();
});
window.addEventListener('resize', closePop, { passive: true });

/* ---------- the module bar's fold ----------
   strip.js owns everything the fold does; this says which keys it is kept
   under and what the button reads. Open until somebody shuts it.

   ⚠️ TAUGHT STRAIGHT AWAY, AND THAT IS SAFE ONLY BECAUSE THIS GATE IS AT THE
   EDGE. The other modules overlay a lock screen on a page that was served
   anyway, so a demonstration run at boot happens behind it and is spent unseen.
   Here `middleware.js` 307s to gate.html and this page is never served until
   the cookie is valid — so by the time anything runs, the reader is looking
   at it. Nothing else covers the board on a first visit: there is no tour.

   `hold` is passed all the same, watching the two overlays that can be open
   over the header, so a fold cannot reflow underneath one. */
const stripKept = Strip.init({
  box: document.getElementById('hdStrip'),
  tog: document.getElementById('hdStripTog'),
  prefix: 'ltpm',
  labels: {
    hide: 'Hide the module and view controls',
    show: 'Show the module and view controls'
  },
  hold: () => {
    const meth = document.getElementById('meth');
    const panel = document.getElementById('panel');
    return !!((meth && !meth.hidden) || (panel && !panel.hidden));
  }
});

/* ---------- boot ---------- */
recompute();
render();
Strip.teach(stripKept);

/* ============================================================
   THE GEMINI RAIL
   A reader beside the board, not a second board. It is handed a digest of what
   is actually on screen — the selection, the counts, the loudest and quietest
   weeks, the moments in view — and it answers from that. What it cannot see,
   it has to say it cannot see.
   ============================================================ */
const CHAT = { open: true, busy: false, turns: [] };

/* What the model is allowed to know. Built fresh on every question, because a
   digest that lags the board is worse than no digest — it would answer
   confidently about a category the planner switched off a minute ago. */
function boardDigest() {
  const v = visible().sort((a, b) => b.score - a.score);
  const auds = audiences();
  const b = Object.fromEntries(BANDS.map(x => [x.id, v.filter(m => m.band.id === x.id).length]));
  const off = CATS.filter(c => S.off.has(c));

  const weeks = weekAxis();
  const load = weeks.map((w, i) => ({
    i, label: w.label,
    total: v.filter(m => weekKey(m.start < WIN_START ? WIN_START : m.start) === w.key)
            .reduce((s, m) => s + m.score, 0)
  })).sort((x, y) => y.total - x.total);

  const line = m => `${m.start} · ${m.name} · ${m.cat} · ${m.score == null ? 'not scored' : m.score + ' ' + m.band.label}`;
  const shown = S.showWatch ? 'Anchor, Play and Watch' : 'Anchor and Play only';

  return [
    `AUDIENCES: ${auds.map(a => `${a.name} (${a.size || 'size not given'})`).join(' + ')}` +
      (auds.length > 1 ? ` — combined by ${S.mode}` : ''),
    ...auds.map(a => `  ${a.name}: ${a.def}`),
    ``,
    `WINDOW: ${MONTHS[0].label} ${MONTHS[0].y} to ${MONTHS[11].label} ${MONTHS[11].y}. ${v.length} moments.`,
    `BANDS: Anchor ${b.anchor}, Play ${b.play}, Watch ${b.watch}, Skip ${b.skip}.`,
    `DRAWN ON THE RIBBON: ${shown}.`,
    off.length ? `CATEGORIES SWITCHED OFF (not on the board, not in this digest): ${off.join(', ')}.`
               : `All ten categories are on.`,
    ``,
    `BY CATEGORY: ${CATS.filter(c => !S.off.has(c))
      .map(c => `${c} ${v.filter(m => m.cat === c).length}`).join(', ')}.`,
    ``,
    `THE 25 HIGHEST-SCORING MOMENTS IN VIEW:`,
    ...v.slice(0, 25).map(m => '  ' + line(m)),
    ``,
    `THE UNCLAIMED MOMENTS — high affinity, quiet week:`,
    ...unclaimed(v.map(m => ({ ...m, parts: { ...m.parts, aff: m.parts[MODEL().driver] ?? 0 } }))).map(m => `  ${m.start} · ${m.name} · ${MODEL().parts[0].name.toLowerCase()} ${Math.round(m.parts[MODEL().driver] ?? 0)}, congestion ${Math.round(m.parts.cong)}`),
    ``,
    `BUSIEST WEEKS: ${load.slice(0, 3).map(w => `${w.label} (${Math.round(w.total)})`).join(', ')}.`,
    `QUIETEST WEEKS WITH ANYTHING IN THEM: ${load.filter(w => w.total > 0).slice(-3)
      .map(w => `${w.label} (${Math.round(w.total)})`).join(', ')}.`
  ].join('\n');
}

function renderChat() {
  const rail = document.getElementById('chat');
  rail.classList.toggle('shut', !CHAT.open);
  document.getElementById('chatFold').textContent = CHAT.open ? '›' : '‹';
  document.getElementById('chatFold').setAttribute('aria-expanded', String(CHAT.open));

  const body = document.getElementById('chatBody');
  if (!CHAT.turns.length) {
    body.innerHTML = `<div class="ck-empty">
      <p>Ask about what is on the board — why a moment scores where it does,
         which weeks are empty, what these audiences disagree about.</p>
      <p class="ck-cav">It reads a digest of the board, not the whole calendar,
         and it will say so when the answer is not in front of it.</p>
    </div>`;
  } else {
    body.innerHTML = CHAT.turns.map(t => `
      <div class="ck ${t.role}">
        <div class="ck-who">${t.role === 'user' ? 'You' : 'Gemini'}</div>
        <div class="ck-tx">${esc(t.text).replace(/\n/g, '<br>')}</div>
        ${t.unverified && t.unverified.length ? `<div class="ck-warn">
          Not from the board: ${t.unverified.slice(0, 6).map(esc).join(', ')} — check these.
        </div>` : ''}
      </div>`).join('') + (CHAT.busy ? `<div class="ck gemini"><div class="ck-who">Gemini</div>
        <div class="ck-tx muted">Reading the board…</div></div>` : '');
  }
  body.scrollTop = body.scrollHeight;
}

async function askChat() {
  const box = document.getElementById('chatIn');
  const q = box.value.trim();
  if (!q || CHAT.busy) return;
  box.value = '';
  box.style.height = 'auto';
  CHAT.turns.push({ role: 'user', text: q });
  CHAT.busy = true;
  renderChat();
  try {
    const j = await callGemini({
      action: 'chat',
      question: q,
      digest: boardDigest(),
      history: CHAT.turns.slice(0, -1).map(t => ({ role: t.role, text: t.text }))
    });
    CHAT.turns.push({ role: 'gemini', text: j.reply, unverified: j.unverified || [] });
  } catch (err) {
    CHAT.turns.push({ role: 'gemini', text: err.message, error: true });
  } finally {
    CHAT.busy = false;
    renderChat();
  }
}

document.getElementById('chatGo').addEventListener('click', askChat);
document.getElementById('chatIn').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); askChat(); }
});
document.getElementById('chatIn').addEventListener('input', e => {
  e.target.style.height = 'auto';
  e.target.style.height = Math.min(e.target.scrollHeight, 130) + 'px';
});
document.getElementById('chatFold').addEventListener('click', () => {
  CHAT.open = !CHAT.open;
  renderChat();
});
document.getElementById('chatClear').addEventListener('click', () => {
  CHAT.turns = [];
  renderChat();
});
renderChat();
