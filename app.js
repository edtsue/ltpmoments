/* LTP Moments — five directions over one state.

   Every direction reads the same three things: the audience selected in the
   rail, the categories left switched on, and the twelve-month window. Nothing
   is per-direction except how it draws — so switching directions never changes
   what is being argued, only how it is shown, which is the only way five
   mockups can be compared honestly. */

import { MOMENTS } from './data/moments.js';
import { AUDIENCES, CAT_COLOR } from './data/audiences.js';
import { scoreMoments, BANDS, WEIGHTS, CONGESTION_MAX, weekKey, unclaimed, MODES } from './data/relevance.js';
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
const ROSTER = () => [...AUDIENCES, ...CUSTOM];

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
function fromHash() {
  /* `[a-z]+` here would not match a user-defined audience — their ids are
     slugged from the name and "women1834" has digits in it — so a custom
     audience never survived a reload. Several ids join on `+`, and the combine
     mode is the third segment. */
  const m = /^#\/(\d)\/([a-z0-9+]+)(?:\/([a-z]+))?/.exec(location.hash || '');
  if (!m) return {};
  const dir = +m[1];
  const ids = m[2].split('+').filter(id => ROSTER().some(a => a.id === id));
  return {
    dir: dir >= 1 && dir <= 5 ? dir : undefined,
    auds: ids.length ? ids : undefined,
    mode: MODES.some(x => x.id === m[3]) ? m[3] : undefined
  };
}
const H = fromHash();

const S = {
  auds: H.auds || [AUDIENCES[0].id],   // one or several; never none
  mode: H.mode || 'blend',
  dir: H.dir || 3,
  off: new Set(),          // categories switched off
  showWatch: false         // draw the Watch band as well as Anchor and Play
};

/* Falls back rather than returning empty: a custom audience deleted in another
   tab leaves a hash pointing at nothing, and the board must still draw. There
   is always at least one selected audience — a board with none has nothing to
   say, so the last one cannot be switched off. */
function audiences() {
  const list = S.auds.map(id => ROSTER().find(a => a.id === id)).filter(Boolean);
  return list.length ? list : [ROSTER()[0]];
}
const audience = () => audiences()[0];
const multi = () => audiences().length > 1;

let SCORED = [];
function recompute() {
  SCORED = scoreMoments(IN_WINDOW, audiences(), S.mode);
}
const visible = () => SCORED.filter(m => !S.off.has(m.cat));

/* ============================================================
   RAIL
   ============================================================ */
function renderRail() {
  const a = audience();
  const sel = new Set(S.auds);
  const only = S.auds.length === 1;
  document.getElementById('audList').innerHTML = ROSTER().map(x => `
    <div class="aud-row">
      <button class="aud ${sel.has(x.id) ? 'on' : ''}" data-aud="${x.id}" type="button"
        role="checkbox" aria-checked="${sel.has(x.id)}"
        ${sel.has(x.id) && only ? 'aria-disabled="true" title="At least one audience has to stay on"' : ''}>
        <span class="tick" aria-hidden="true">${sel.has(x.id) ? '\u2713' : ''}</span>
        <span class="at">
          <span class="an">${esc(x.name)}${x.custom ? '<span class="mine">Yours</span>' : ''}</span>
          <span class="as">${esc(x.size || '\u2014')} \u00b7 ${topCats(x)}</span>
        </span>
      </button>
      ${x.custom ? `<button class="aud-x" data-del="${esc(x.id)}" type="button"
        title="Remove ${esc(x.name)}" aria-label="Remove ${esc(x.name)}">\u00d7</button>` : ''}
    </div>`).join('') +
    `<button class="aud-add" id="audAdd" type="button">
       <span aria-hidden="true">+</span> New target audience</button>`;

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
  return Object.entries(a.aff).sort((x, y) => y[1] - x[1]).slice(0, 2).map(e => e[0].split(' ')[0]).join(' · ');
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

  const v = visible();
  const b = Object.fromEntries(BANDS.map(x => [x.id, v.filter(m => m.band.id === x.id).length]));
  const w = document.getElementById('watchTog');
  w.classList.toggle('on', S.showWatch);
  w.setAttribute('aria-pressed', String(S.showWatch));

  document.getElementById('hdRight').innerHTML = `
    <span class="hd-pill" style="--pill-ink:var(--pill-green);--pill-line:var(--pill-green-line)">Anchor <b>${b.anchor}</b></span>
    <span class="hd-pill" style="--pill-ink:var(--pill-blue);--pill-line:var(--pill-blue-line)">Play <b>${b.play}</b></span>
    <span class="hd-pill" style="--pill-ink:var(--pill-amber);--pill-line:var(--pill-amber-line)">Watch <b>${b.watch}</b></span>
    <span class="hd-pill">Skip <b>${b.skip}</b></span>`;
}

const bandLegend = () => BANDS.map(b =>
  `<span class="li"><span class="bandpill ${b.id}">${b.label}</span> ${b.note}</span>`).join('');

/* ============================================================
   THE FIVE COMPONENTS, WRITTEN OUT
   Shared vocabulary rather than one view's furniture: wherever a score is
   shown, the thing that produced it has to be openable.
   ============================================================ */
const PART_META = {
  aff:   { k: 'Affinity',      c: '#1A67D2', w: WEIGHTS.aff,   why: 'Category index for this audience, sharpened by any entity read.' },
  scale: { k: 'Scale',         c: '#0B7A67', w: WEIGHTS.scale, why: 'How many of them actually show up.' },
  act:   { k: 'Actionability', c: '#946200', w: WEIGHTS.act,   why: 'Whether there is a door in \u2014 a distributor, a sponsorship.' },
  tim:   { k: 'Timing',        c: '#6D5DE0', w: WEIGHTS.tim,   why: "The sheet's own date confirmation." },
  cong:  { k: 'Congestion',    c: '#C5221F', w: null,          why: 'Everything else fighting for the same week. A tax, not a term.' }
};

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
  return affByBlock(m) + `<div class="parts">${Object.entries(PART_META).map(([k, p]) => `
    <div class="part">
      <div class="pk"><span>${p.k}${p.w ? ` \u00b7 ${Math.round(p.w * 100)}%` : ' \u00b7 \u221225% max'}</span><b>${Math.round(m.parts[k])}</b></div>
      <div class="pb"><i style="width:${Math.round(m.parts[k])}%;--pc:${p.c}"></i></div>
      <div class="pw">${p.why}</div>
    </div>`).join('')}</div>`;
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
            return `<button class="bar ${b.m.band.id}${tick ? ' tick' : ''}"
              data-id="${b.m.id}" style="--c:${CAT_COLOR[c]};left:${pct(b.s)}%;width:${pct(b.w)}%"
              title="${esc(b.m.name)} — ${b.m.score}">${tick ? '' : esc(b.m.name)}</button>`;
          }).join('')}</div>`).join('')}
        </div>
      </div>`;
  };

  /* Congestion, week by week. Same input the score's congestion term reads,
     drawn on its own — the quiet weeks are the point, and they are invisible
     inside a total. */
  const weeks = weekAxis();
  const load = weeks.map(w => visible().filter(m => weekKey(m.start < WIN_START ? WIN_START : m.start) === w.key)
    .reduce((s, m) => s + m.parts.aff, 0));
  const lMax = Math.max(1, ...load);

  return `
    <div class="legend">${bandLegend()}</div>
    <div class="rib">
      <div class="rib-ax">
        <div></div>
        <div class="mos" style="grid-template-columns:repeat(${MONTHS.length},1fr)">
          ${MONTHS.map(mo => `<div class="mo">${mo.label} '${mo.yy}</div>`).join('')}
        </div>
      </div>
      ${cats.map(lane).join('')}
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
  draft = { name: '', def: '', size: '', text: '', parsed: null, aff: {}, ent: {}, quotes: {}, busy: false };
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

          <div class="fld">
            <span>The data that defines them</span>
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
  const clearBtn = (Object.keys(draft.aff).length || draft.text)
    ? `<button type="button" class="clr" id="pnClear">Clear and start again</button>` : '';
  if (!p) {
    el.innerHTML = gemBlock +
      (g ? '' : `<div class="rd empty">Drop or paste the cut and it will be read here, line by line.</div>`) +
      clearBtn;
    return;
  }
  const bad = p.ignored.filter(Boolean);
  el.innerHTML = gemBlock + `
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
function openPop(m, anchor) {
  closePop();
  const r = anchor.getBoundingClientRect();
  popEl = document.createElement('div');
  popEl.className = 'pop';
  popEl.innerHTML = `
    <div class="t">${esc(m.name)}</div>
    <div class="meta"><span class="dot" style="--c:${CAT_COLOR[m.cat]}"></span>${esc(m.cat)}${m.plat ? ' · ' + esc(m.plat) : ''}<br>
      ${fmtDate(m.start)}${m.end !== m.start ? ' → ' + fmtDate(m.end) : ''} · ${esc(m.conf)}</div>
    <div class="row"><span class="sc">${m.score}</span><span class="bandpill ${m.band.id}">${m.band.label}</span></div>
    ${partsBlock(m)}
    ${m.notes ? `<div class="note">${esc(m.notes)}</div>` : ''}
    <div class="pop-read" id="popRead">
      <button type="button" class="gem sm" data-read="${m.id}">Write the read</button>
    </div>`;
  document.body.appendChild(popEl);
  const w = popEl.offsetWidth, h = popEl.offsetHeight;
  let x = Math.min(window.innerWidth - w - 12, Math.max(12, r.left));
  let y = r.bottom + 8;
  if (y + h > window.innerHeight - 12) y = Math.max(12, r.top - h - 8);
  popEl.style.left = x + 'px';
  popEl.style.top = y + 'px';
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
      score: m.score, band: m.band.label, parts: m.parts
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
    const q = S.auds.join('+') + (multi() ? '/' + S.mode : '');
    history.replaceState(null, '', '#/' + q);
  } catch (e) { void e; }
  renderRail();
  renderHead();
  const body = document.getElementById('body');
  body.innerHTML = drawRibbon();
  body.scrollTop = 0;
}

/* ---------- one delegated listener ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-aud],[data-cat],[data-id],[data-open],[data-del],[data-close],#themeTog,#watchTog,#audAdd,[data-mode]');
  if (!t) { closePop(); return; }

  if (t.id === 'audAdd')   return openAudPanel();
  if (t.dataset.close)     return closeAudPanel();
  if (t.dataset.del)       return deleteAudience(t.dataset.del);

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
  closePop();
});
window.addEventListener('resize', closePop, { passive: true });

/* ---------- boot ---------- */
recompute();
render();
