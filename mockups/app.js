/* LTP Moments — five directions over one state.

   Every direction reads the same three things: the audience selected in the
   rail, the categories left switched on, and the twelve-month window. Nothing
   is per-direction except how it draws — so switching directions never changes
   what is being argued, only how it is shown, which is the only way five
   mockups can be compared honestly. */

import { MOMENTS } from './data/moments.js';
import { AUDIENCES, CAT_COLOR } from './data/audiences.js';
import { scoreMoments, BANDS, WEIGHTS, CONGESTION_MAX, weekKey, unclaimed } from './data/relevance.js';

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
  const m = /^#\/(\d)\/([a-z]+)/.exec(location.hash || '');
  if (!m) return {};
  const dir = +m[1], aud = m[2];
  return {
    dir: dir >= 1 && dir <= 5 ? dir : undefined,
    aud: AUDIENCES.some(a => a.id === aud) ? aud : undefined
  };
}
const H = fromHash();

const S = {
  aud: H.aud || AUDIENCES[0].id,
  dir: H.dir || 1,
  off: new Set(),          // categories switched off
  showWatch: false,        // direction 01: draw the Watch band too
  rankShown: 25,
  pmSel: null,             // pressure map: selected [cat, weekIndex]
  io: null                 // in/out board: id -> 'in' | 'und' | 'out'
};

const audience = () => AUDIENCES.find(a => a.id === S.aud);

let SCORED = [];
function recompute() {
  SCORED = scoreMoments(IN_WINDOW, audience());
  S.io = null;
  S.rankShown = 25;
  S.pmSel = null;
}
const visible = () => SCORED.filter(m => !S.off.has(m.cat));

/* ============================================================
   RAIL
   ============================================================ */
function renderRail() {
  const a = audience();
  document.getElementById('audList').innerHTML = AUDIENCES.map(x => `
    <button class="aud ${x.id === S.aud ? 'on' : ''}" data-aud="${x.id}" type="button"
      aria-pressed="${x.id === S.aud}">
      <span class="an">${esc(x.name)}</span>
      <span class="as">${esc(x.size)} · ${topCats(x)}</span>
    </button>`).join('');
  document.getElementById('audDef').textContent = a.def;

  document.getElementById('catList').innerHTML = CATS.map(c => `
    <button class="cat ${S.off.has(c) ? 'off' : ''}" data-cat="${esc(c)}" type="button"
      aria-pressed="${!S.off.has(c)}">
      <span class="sw" style="--c:${CAT_COLOR[c] || '#5C6279'}"></span>${esc(c)}
    </button>`).join('');

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
const DIRS = [
  { n: 1, id: 'wall', tab: 'The Year Wall',
    title: 'The Year Wall',
    lede: 'Ten categories down, twelve months across, one audience at a time. Every moment the audience has a claim on, in the cell where it lands — so the shape of the year is legible before a single row is read. Anchors are filled, Play is outlined, Watch is faint.' },
  { n: 2, id: 'rank', tab: 'The Ranked Brief',
    title: 'The Ranked Brief',
    lede: 'The same year as an argued list. Every row opens onto the five components behind its score, because a planner has to be able to disagree with a number and say which part of it is wrong.' },
  { n: 3, id: 'rib', tab: 'The Ribbon',
    title: 'The Ribbon',
    lede: 'Time as a continuous axis rather than twelve boxes, so a window reads as a window and a single day reads as a tick. Under it, how loud each week is — which is the half of the picture a ranked list cannot show.' },
  { n: 4, id: 'pm', tab: 'The Pressure Map',
    title: 'The Pressure Map',
    lede: 'Fifty-two weeks by ten categories, inked by how much this audience cares about what lands there. Built to answer the one question the process asks and a ranked list never can: which week is loud, and which week is empty.' },
  { n: 5, id: 'io', tab: 'The In / Out Board',
    title: 'The In / Out Board',
    lede: 'The year after a decision has been taken on it. Moments in, moments out, and the ones still open — which is the artefact stage 6.2 is supposed to produce, and the thing Big Ideas and Flighting are actually waiting for.' }
];

function renderHead() {
  const d = DIRS[S.dir - 1];
  document.getElementById('dirTitle').textContent = d.title;
  document.getElementById('dirLede').textContent = d.lede;
  document.getElementById('dirKick').textContent = `Direction 0${d.n} — ${audience().name}`;

  const v = visible();
  const b = Object.fromEntries(BANDS.map(x => [x.id, v.filter(m => m.band.id === x.id).length]));
  document.getElementById('hdRight').innerHTML = `
    <span class="hd-pill" style="--pill-ink:var(--pill-green);--pill-line:var(--pill-green-line)">Anchor <b>${b.anchor}</b></span>
    <span class="hd-pill" style="--pill-ink:var(--pill-blue);--pill-line:var(--pill-blue-line)">Play <b>${b.play}</b></span>
    <span class="hd-pill" style="--pill-ink:var(--pill-amber);--pill-line:var(--pill-amber-line)">Watch <b>${b.watch}</b></span>
    <span class="hd-pill">Skip <b>${b.skip}</b></span>`;

  document.querySelectorAll('.mk-tab').forEach(t => t.classList.toggle('on', +t.dataset.dir === S.dir));
}

const bandLegend = () => BANDS.map(b =>
  `<span class="li"><span class="bandpill ${b.id}">${b.label}</span> ${b.note}</span>`).join('');

/* ============================================================
   01 — THE YEAR WALL
   ============================================================ */
function drawWall() {
  const v = visible();
  const min = S.showWatch ? 40 : 56;
  const shown = v.filter(m => m.score >= min);

  const byMonth = new Map();
  for (const m of shown) {
    const k = m.start < WIN_START ? MONTHS[0].key : m.start.slice(0, 7);
    if (!byMonth.has(k)) byMonth.set(k, []);
    byMonth.get(k).push(m);
  }
  const weight = MONTHS.map(mo => (byMonth.get(mo.key) || []).reduce((s, m) => s + m.score, 0));
  const wMax = Math.max(1, ...weight);

  const cats = CATS.filter(c => !S.off.has(c));
  const cell = (c, mo) => {
    const list = (byMonth.get(mo.key) || []).filter(m => m.cat === c).sort((a, b) => b.score - a.score);
    if (!list.length) return `<div class="wall-cell empty"></div>`;
    const cap = 4;
    const head = list.slice(0, cap).map(m => chip(m)).join('');
    const rest = list.length > cap
      ? `<button class="wall-more" data-more="${esc(c)}|${mo.key}">+${list.length - cap} more</button>` : '';
    return `<div class="wall-cell">${head}${rest}</div>`;
  };

  return `
    <div class="legend">
      ${bandLegend()}
      <span class="li" style="margin-left:auto">
        <button class="mk-tog" id="wallWatch" style="background:var(--card);color:var(--shell-ink3);border-color:var(--shell-line)">
          ${S.showWatch ? '✓ ' : ''}Include Watch
        </button>
      </span>
    </div>
    <div class="wall" style="--months:${MONTHS.length}">
      <div class="wall-row wall-hd">
        <div></div>
        ${MONTHS.map((mo, i) => `
          <div class="wall-mo">
            <span class="m">${mo.label}</span><span class="y">'${mo.yy}</span>
            <div class="bar"><i style="width:${Math.round(weight[i] / wMax * 100)}%"></i></div>
          </div>`).join('')}
      </div>
      ${cats.map(c => `
        <div class="wall-row">
          <div class="wall-cat">
            <span class="sw" style="--c:${CAT_COLOR[c]}"></span>
            <span>${esc(c)}</span>
            <span class="n">${shown.filter(m => m.cat === c).length}</span>
          </div>
          ${MONTHS.map(mo => cell(c, mo)).join('')}
        </div>`).join('')}
    </div>`;
}
const chip = m =>
  `<button class="chip ${m.band.id}" data-id="${m.id}" style="--c:${CAT_COLOR[m.cat]}" title="${esc(m.name)} — ${m.score}">${esc(m.name)}</button>`;

/* ============================================================
   02 — THE RANKED BRIEF
   ============================================================ */
const PART_META = {
  aff:   { k: 'Affinity',      c: '#1A67D2', w: WEIGHTS.aff,   why: 'Category index for this audience, sharpened by any entity read.' },
  scale: { k: 'Scale',         c: '#0B7A67', w: WEIGHTS.scale, why: 'How many of them actually show up.' },
  act:   { k: 'Actionability', c: '#946200', w: WEIGHTS.act,   why: 'Whether there is a door in — a distributor, a sponsorship.' },
  tim:   { k: 'Timing',        c: '#6D5DE0', w: WEIGHTS.tim,   why: "The sheet's own date confirmation." },
  cong:  { k: 'Congestion',    c: '#C5221F', w: null,          why: 'Everything else fighting for the same week. A tax, not a term.' }
};

function partsBlock(m) {
  return `<div class="parts">${Object.entries(PART_META).map(([k, p]) => `
    <div class="part">
      <div class="pk"><span>${p.k}${p.w ? ` · ${Math.round(p.w * 100)}%` : ' · −25% max'}</span><b>${Math.round(m.parts[k])}</b></div>
      <div class="pb"><i style="width:${Math.round(m.parts[k])}%;--pc:${p.c}"></i></div>
      <div class="pw">${p.why}</div>
    </div>`).join('')}</div>`;
}

function drawRank() {
  const v = visible().sort((a, b) => b.score - a.score || a.start.localeCompare(b.start));
  const list = v.slice(0, S.rankShown);
  const tile = (b) => {
    const n = v.filter(m => m.band.id === b.id).length;
    return `<div class="tile" style="--tc:${b.color}">
      <div class="k">${b.label}</div><div class="v">${n}</div><div class="d">${b.note}</div></div>`;
  };
  return `
    <div class="tiles">${BANDS.map(tile).join('')}</div>
    <div class="rank">${list.map((m, i) => rankRow(m, i + 1)).join('')}</div>
    ${S.rankShown < v.length ? `<button class="more" id="rankMore">Show 25 more — ${v.length - S.rankShown} left</button>` : ''}`;
}

function rankRow(m, n) {
  return `
  <div class="rk" data-rk="${m.id}">
    <button class="rk-hd" type="button" data-open="${m.id}" aria-expanded="false">
      <span class="rk-no">${String(n).padStart(2, '0')}</span>
      <span class="rk-sc"><b>${m.score}</b><i style="width:${m.score}%;--bc:${m.band.color}"></i></span>
      <span class="rk-nm">
        <span class="t">${esc(m.name)}</span>
        <span class="s"><span class="dot" style="--c:${CAT_COLOR[m.cat]}"></span>${esc(m.cat)}${m.plat ? ' · ' + esc(m.plat) : ''}</span>
      </span>
      <span class="rk-dt">${fmtDate(m.start)}${m.end !== m.start ? ' → ' + fmtDate(m.end) : ''}</span>
      <span class="bandpill ${m.band.id}">${m.band.label}</span>
      <span class="rk-cv">▾</span>
    </button>
    <div class="rk-bd" hidden>
      ${partsBlock(m)}
      <div class="rk-eq">
        (${Math.round(m.parts.aff)}×.40 + ${Math.round(m.parts.scale)}×.25 + ${Math.round(m.parts.act)}×.20 + ${Math.round(m.parts.tim)}×.15)
        × (1 − ${(m.parts.cong / 100 * CONGESTION_MAX).toFixed(2)}) = <b>${m.score}</b>
      </div>
      <div class="rk-meta">
        ${esc(m.conf)} · ${esc(m.type)}${m.src ? ' · ' + esc(m.src) : ''}${m.spons ? ' · sponsorship: ' + esc(m.spons) : ''}
        ${m.notes ? '<br>' + esc(m.notes) : ''}
      </div>
    </div>
  </div>`;
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
    /* Greedy packing into sub-rows: a bar goes in the first row whose last bar
       has already finished, with a small gutter so two touching moments do not
       read as one. Three rows maximum — beyond that the lane stops being a
       lane and the reader should be in the Pressure Map instead. */
    const rows = [];
    for (const m of list) {
      const s = Math.max(0, dayNo(m.start));
      const e = Math.min(WIN_DAYS, dayNo(m.end) + 1);
      const w = Math.max(e - s, 3);
      let r = rows.find(row => row.end <= s - 4);
      if (!r) { if (rows.length >= 3) { r = rows[rows.length - 1]; } else { r = { end: 0, bars: [] }; rows.push(r); } }
      r.end = Math.max(r.end, s + w);
      r.bars.push({ m, s, w });
    }
    if (!rows.length) rows.push({ bars: [] });
    return `
      <div class="rib-lane">
        <div class="rib-lb"><span class="sw" style="--c:${CAT_COLOR[c]}"></span>${esc(c)}</div>
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
    <div class="legend">${bandLegend()}
      <span class="li" style="margin-left:auto">
        <button class="mk-tog" id="wallWatch" style="background:var(--card);color:var(--shell-ink3);border-color:var(--shell-line)">
          ${S.showWatch ? '✓ ' : ''}Include Watch</button>
      </span>
    </div>
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
   04 — THE PRESSURE MAP
   ============================================================ */
function drawPressure() {
  const v = visible();
  const weeks = weekAxis();
  const cats = CATS.filter(c => !S.off.has(c));
  const key = (c, w) => c + '|' + w;
  const cellv = new Map();
  for (const m of v) {
    const k = key(m.cat, weekKey(m.start < WIN_START ? WIN_START : m.start));
    cellv.set(k, (cellv.get(k) || 0) + m.score);
  }
  const vMax = Math.max(1, ...cellv.values());

  /* Month rules across the top rather than a week label every column — 52
     labels do not fit and would not be read if they did. */
  const monthSpan = MONTHS.map(mo => weeks.filter(w => `${w.y}-${String(w.m + 1).padStart(2, '0')}` === mo.key).length);

  const uc = unclaimed(v);

  return `
    <div class="legend">
      <span class="li"><b>Ink</b> = total relevance landing in that week, for this audience.</span>
      <span class="li"><b>Empty</b> = nothing this audience has a claim on. That is a finding, not a gap.</span>
    </div>
    <div class="pm">
      <div class="pm-grid">
        <div class="pm-mos">
          <div></div>
          <div class="mos" style="grid-template-columns:${monthSpan.map(s => s + 'fr').join(' ')}">
            ${MONTHS.map(mo => `<div class="mo">${mo.label}</div>`).join('')}
          </div>
        </div>
        <div style="--weeks:${weeks.length}">
        ${cats.map(c => `
          <div class="pm-row">
            <div class="pm-lb"><span class="sw" style="--c:${CAT_COLOR[c]}"></span>${esc(c)}</div>
            ${weeks.map((w, i) => {
              const val = cellv.get(key(c, w.key)) || 0;
              if (!val) return `<button class="pm-cell zero" disabled aria-label="${esc(c)}, ${w.label}: nothing"></button>`;
              const t = Math.min(1, val / vMax);
              const sel = S.pmSel && S.pmSel[0] === c && S.pmSel[1] === i ? ' sel' : '';
              return `<button class="pm-cell${sel}" data-pm="${esc(c)}|${i}"
                style="--c:${CAT_COLOR[c]};--t:${Math.round(18 + t * 82)}%"
                title="${esc(c)} · ${w.label} — ${Math.round(val)}"></button>`;
            }).join('')}
          </div>`).join('')}
        </div>
      </div>
      <div class="pm-side">
        <div class="panel eg">
          <h3>The unclaimed moment</h3>
          <p class="sub">Highest affinity sitting in the quietest weeks — not the highest score. This is the question stage 6.2 asks that a ranked list will never answer.</p>
          ${uc.map((m, i) => `
            <div class="uc">
              <span class="n">${String(i + 1).padStart(2, '0')}</span>
              <span>
                <span class="t">${esc(m.name)}</span>
                <span class="m">${fmtDate(m.start)} · affinity <b>${Math.round(m.parts.aff)}</b> · congestion ${Math.round(m.parts.cong)}</span>
              </span>
            </div>`).join('')}
        </div>
        <div class="panel" id="pmDetail">
          <h3>Week detail</h3>
          <p class="sub">Pick a cell to see what lands in it.</p>
        </div>
      </div>
    </div>`;
}

function pmDetail() {
  const el = document.getElementById('pmDetail');
  if (!el || !S.pmSel) return;
  const [c, i] = S.pmSel;
  const weeks = weekAxis();
  const w = weeks[i];
  const list = visible().filter(m => m.cat === c && weekKey(m.start < WIN_START ? WIN_START : m.start) === w.key)
    .sort((a, b) => b.score - a.score);
  el.innerHTML = `
    <h3>${esc(c)} · week of ${w.label}</h3>
    <p class="sub">${list.length} moment${list.length === 1 ? '' : 's'}, ${Math.round(list.reduce((s, m) => s + m.score, 0))} total relevance.</p>
    ${list.map(m => `
      <div class="uc">
        <span class="n">${m.score}</span>
        <span><span class="t">${esc(m.name)}</span>
        <span class="m">${fmtDate(m.start)} · ${esc(m.conf)}</span></span>
      </div>`).join('')}`;
}

/* ============================================================
   05 — THE IN / OUT BOARD
   ============================================================ */
function seedIO() {
  S.io = {};
  for (const m of visible()) {
    S.io[m.id] = m.band.id === 'anchor' ? 'in' : m.band.id === 'skip' ? 'out' : 'und';
  }
}

function drawIO() {
  if (!S.io) seedIO();
  const v = visible().sort((a, b) => b.score - a.score);
  const lane = id => v.filter(m => (S.io[m.id] || 'und') === id);
  const cols = [
    { id: 'in',  k: 'Moments in',  d: 'We are buying into these. Each one needs a line in the plan.' },
    { id: 'und', k: 'Undecided',   d: 'Still arguable. Nothing leaves this board undecided.' },
    { id: 'out', k: 'Moments out', d: 'Deliberately skipped, and said out loud so nobody re-opens it in November.' }
  ];
  const card = m => `
    <div class="mcard" style="--c:${CAT_COLOR[m.cat]}">
      <div class="t">${esc(m.name)}</div>
      <div class="r">
        <span class="dt">${fmtDate(m.start)}</span>
        <span class="bandpill ${m.band.id}">${m.band.label}</span>
        <span class="sc">${m.score}</span>
      </div>
      <div class="mv">
        ${['in', 'und', 'out'].filter(t => t !== (S.io[m.id] || 'und'))
          .map(t => `<button data-io="${m.id}|${t}" type="button">${t === 'in' ? 'In' : t === 'out' ? 'Out' : 'Undecided'}</button>`).join('')}
      </div>
    </div>`;

  const CAP = 14;
  return `
    <div class="legend">
      <span class="li">Seeded from the score — <b>Anchor → in</b>, <b>Skip → out</b>, everything else open — and then argued with. The seed is a starting position, not a verdict.</span>
    </div>
    <div class="io">
      ${cols.map(c => {
        const list = lane(c.id);
        return `<div class="col ${c.id}">
          <div class="col-hd"><div class="k">${c.k}</div><div class="c">${list.length}</div><div class="d">${c.d}</div></div>
          <div class="col-bd">
            ${list.length ? list.slice(0, CAP).map(card).join('') : '<div class="col-empty">Nothing here yet.</div>'}
            ${list.length > CAP ? `<div class="col-empty">+${list.length - CAP} more below the fold</div>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>
    <div class="io-foot">
      <div class="feed"><span class="ar">→</span><span>
        <span class="k">Feeds 6.3</span><span class="t">Big Ideas &amp; Partnerships</span>
        <span class="d">The in-list is the shortlist a partnership is proposed against.</span></span></div>
      <div class="feed"><span class="ar">→</span><span>
        <span class="k">Feeds step 03</span><span class="t">Flighting</span>
        <span class="d">Dates and weights, straight into the annual scenario.</span></span></div>
      <div class="feed"><span class="ar">→</span><span>
        <span class="k">Produces</span><span class="t">The Calendar</span>
        <span class="d">Which is what stage 6.2 is defined as producing.</span></span></div>
    </div>`;
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
    ${m.notes ? `<div class="note">${esc(m.notes)}</div>` : ''}`;
  document.body.appendChild(popEl);
  const w = popEl.offsetWidth, h = popEl.offsetHeight;
  let x = Math.min(window.innerWidth - w - 12, Math.max(12, r.left));
  let y = r.bottom + 8;
  if (y + h > window.innerHeight - 12) y = Math.max(12, r.top - h - 8);
  popEl.style.left = x + 'px';
  popEl.style.top = y + 'px';
}

/* ============================================================
   RENDER
   ============================================================ */
function render() {
  closePop();
  /* replaceState rather than assigning location.hash: this is where you ARE,
     not somewhere you went, and a back button that walks through every rail
     click is worse than one that leaves the page. */
  try { history.replaceState(null, '', `#/${S.dir}/${S.aud}`); } catch (e) { void e; }
  renderRail();
  renderHead();
  const body = document.getElementById('body');
  body.innerHTML = [drawWall, drawRank, drawRibbon, drawPressure, drawIO][S.dir - 1]();
  if (S.dir === 4 && S.pmSel) pmDetail();
  body.scrollTop = 0;
}

/* ---------- one delegated listener ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-aud],[data-cat],[data-dir],[data-id],[data-open],[data-pm],[data-io],[data-more],#rankMore,#wallWatch,#themeTog');
  if (!t) { closePop(); return; }

  if (t.dataset.aud)  { S.aud = t.dataset.aud; recompute(); return render(); }
  if (t.dataset.dir)  { S.dir = +t.dataset.dir; return render(); }
  if (t.dataset.cat)  {
    const c = t.dataset.cat;
    S.off.has(c) ? S.off.delete(c) : S.off.add(c);
    if (S.dir === 5) S.io = null;
    return render();
  }
  if (t.id === 'wallWatch') { S.showWatch = !S.showWatch; return render(); }
  if (t.id === 'rankMore')  { S.rankShown += 25; return render(); }
  if (t.id === 'themeTog')  {
    const cur = document.documentElement.dataset.theme;
    const next = cur === 'dark' ? 'light' : cur === 'light' ? 'dark'
      : (matchMedia('(prefers-color-scheme: dark)').matches ? 'light' : 'dark');
    document.documentElement.dataset.theme = next;
    t.textContent = next === 'dark' ? '☀ Light' : '☾ Dark';
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
  if (t.dataset.pm) {
    const [c, i] = t.dataset.pm.split('|');
    S.pmSel = [c, +i];
    document.querySelectorAll('.pm-cell.sel').forEach(x => x.classList.remove('sel'));
    t.classList.add('sel');
    return pmDetail();
  }
  if (t.dataset.io) {
    const [id, to] = t.dataset.io.split('|');
    S.io[id] = to;
    return render();
  }
  if (t.dataset.id) {
    const m = SCORED.find(x => x.id === t.dataset.id);
    if (m) openPop(m, t);
    return;
  }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closePop(); });
window.addEventListener('resize', closePop, { passive: true });

/* ---------- boot ---------- */
document.getElementById('mkTabs').innerHTML = DIRS.map(d =>
  `<button class="mk-tab" data-dir="${d.n}" type="button"><i>0${d.n}</i>${d.tab}</button>`).join('');
recompute();
render();
