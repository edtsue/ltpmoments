/* Cultural Calendar CSV -> moments.js
   The sheet is a working document: two rows of instructions sit above the real
   header, category names carry stray trailing spaces, and the date columns hold
   three different grades of certainty in one format. All of that is normalised
   here rather than in the app, so the app only ever sees clean records.

   Run: node tools/build-moments.mjs "<path to csv>"                            */

import { readFileSync, writeFileSync } from 'node:fs';

const SRC = process.argv[2];
if (!SRC) { console.error('usage: node tools/build-moments.mjs <csv>'); process.exit(1); }

/* ---------- csv ---------- */
/* Quoted fields in this sheet contain commas AND newlines (the instruction
   blocks run to several lines), so a split on "," would shred them. */
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const rows = parseCsv(readFileSync(SRC, 'utf8'));

/* The header is row 3. Find it rather than hard-coding the index, so a sheet
   that gains another instruction block above it still builds. */
const hi = rows.findIndex(r => r.some(c => c.trim() === 'Moment'));
if (hi < 0) { console.error('no header row containing "Moment"'); process.exit(1); }
const hdr = rows[hi].map(c => c.replace(/\s+/g, ' ').trim());
const col = name => hdr.findIndex(h => h.toLowerCase().startsWith(name.toLowerCase()));

const C = {
  category: col('Category'),
  cc:       col('CC'),
  moment:   col('Moment'),
  source:   col('Content Source'),
  platform: col('Platform/Distributor'),
  start:    col('Launch Date'),
  end:      col('End Date'),
  conf:     col('Date Confirmation'),
  type:     col('Event Type'),
  pas:      col('Involved PAs'),
  notes:    col('Description/Notes'),
  spons:    col('S1 Sponsorships'),
  single:   col('Single Day Event')
};

const iso = s => {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((s || '').trim());
  if (!m) return null;
  const [, mo, d, y] = m;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};

/* Category names arrive with trailing spaces ("Culture ", "Tours / Concerts ")
   and a handful of one-off buckets. Canonicalised to the nine the UI colours. */
const CAT = {
  'tv & streaming': 'TV & Streaming',
  'movies': 'Movies',
  'sports': 'Sports',
  'tours / concerts': 'Tours & Concerts',
  'music': 'Music',
  'gaming': 'Gaming',
  'holidays': 'Holidays',
  'fashion & awards': 'Fashion & Awards',
  'tech': 'Tech',
  'culture': 'Culture',
  'events / conventions': 'Culture',
  'happening': 'Culture',
  'global': 'Culture',
  'livestreaming': 'TV & Streaming',
  'news': 'Culture'
};

const bool = v => String(v).trim().toUpperCase() === 'TRUE';

const out = [];
for (const r of rows.slice(hi + 1)) {
  if (!r || !r[C.moment] || !r[C.moment].trim()) continue;
  const start = iso(r[C.start]);
  if (!start) continue;
  const end = iso(r[C.end]) || start;
  const raw = (r[C.category] || '').replace(/\s+/g, ' ').trim().toLowerCase();
  out.push({
    id: 'm' + (out.length + 1),
    name: r[C.moment].replace(/\s+/g, ' ').trim(),
    cat: CAT[raw] || 'Culture',
    start,
    end: end < start ? start : end,
    conf: (r[C.conf] || '').trim() || 'TBD',
    type: (r[C.type] || '').trim() || 'Singular Event',
    src: (r[C.source] || '').replace(/\s+/g, ' ').trim(),
    plat: (r[C.platform] || '').trim().replace(/^-$/, ''),
    pas: (r[C.pas] || '').split(',').map(s => s.trim()).filter(Boolean),
    notes: (r[C.notes] || '').replace(/\s+/g, ' ').trim(),
    spons: (r[C.spons] || '').replace(/\s+/g, ' ').trim(),
    single: bool(r[C.single]),
    cc: bool(r[C.cc])
  });
}

/* The planning window opens in July 2026. Anything that ended before it is
   history and is dropped; a window that straddles the opening is kept, because
   a moment already running on day one is still a moment you plan against. */
const FROM = '2026-07-01';
let kept = out.filter(m => m.end >= FROM);

/* DUPLICATES. The sheet carries the same moment on several rows — the World
   Cup twice, Super Bowl LXI three times, the Game Awards under both Gaming and
   Fashion & Awards — because different people added it for different partners.
   Left alone they stack up at the top of every ranked list and make a week
   look busier than it is, which corrupts the congestion term as well as the
   ordering.

   Collapsed on (normalised name + launch date). Normalising strips a leading
   "The", punctuation and case, so "Grammys" and "The Grammys" merge. The
   surviving row keeps the richest fields, since the duplicates are usually one
   full row and one stub.

   NOT collapsed: same name on a different date (a tour with several legs is
   genuinely several moments) and same date under a different name, which needs
   a human to look at it. Those are reported below instead. */
const norm = s => s.toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim();
const seen = new Map();
const dropped = [];
for (const m of kept) {
  const k = norm(m.name) + '|' + m.start;
  const prev = seen.get(k);
  if (!prev) { seen.set(k, m); continue; }
  dropped.push(m);
  for (const f of ['src', 'plat', 'notes', 'spons']) if (!prev[f] && m[f]) prev[f] = m[f];
  if (!prev.pas.length && m.pas.length) prev.pas = m.pas;
  if (m.end > prev.end) prev.end = m.end;
}
kept = [...seen.values()];

kept.sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name));
kept.forEach((m, i) => { m.id = 'm' + (i + 1); });

const cats = [...new Set(kept.map(m => m.cat))].sort();
const stamp = kept.reduce((a, m) => m.start > a ? m.start : a, '');

writeFileSync(
  new URL('../data/moments.js', import.meta.url),
  `/* Generated by tools/build-moments.mjs — do not edit by hand.
   ${kept.length} moments, ${FROM} onward, latest ${stamp}. */
export const WINDOW_FROM = ${JSON.stringify(FROM)};
export const CATEGORIES = ${JSON.stringify(cats)};
export const MOMENTS = ${JSON.stringify(kept, null, 0).replace(/\},\{/g, '},\n{')};
`);

console.log(`${kept.length} moments kept of ${out.length} parsed (${dropped.length} exact duplicates collapsed)`);
console.log('categories:', cats.join(', '));
for (const c of cats) console.log('  ', c, kept.filter(m => m.cat === c).length);

/* Same day, similar name, different rows. Not merged — a person has to decide
   whether "MTV Video Music Awards (VMAs)" and "VMAs (Video Music Awards)" are
   one entry or two, and a build script guessing at it would be worse than a
   list to look at. */
const byDate = new Map();
for (const m of kept) {
  if (!byDate.has(m.start)) byDate.set(m.start, []);
  byDate.get(m.start).push(m);
}
const suspects = [];
for (const [d, list] of byDate) {
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = new Set(norm(list[i].name).split(' ').filter(w => w.length > 2));
    const b = new Set(norm(list[j].name).split(' ').filter(w => w.length > 2));
    if (!a.size || !b.size) continue;
    const shared = [...a].filter(w => b.has(w)).length;
    if (shared / Math.min(a.size, b.size) >= 0.6) suspects.push([d, list[i].name, list[j].name]);
  }
}
if (suspects.length) {
  console.log(`\n${suspects.length} near-duplicate pairs left in — same day, overlapping names. Worth a human look:`);
  for (const [d, a, b] of suspects.slice(0, 20)) console.log(`   ${d}  ${a}   <->   ${b}`);
  if (suspects.length > 20) console.log(`   …and ${suspects.length - 20} more`);
}
