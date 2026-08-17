/* Cultural Calendar CSV (+ optional 2027 Culture Map) -> moments.js
   The sheet is a working document: two rows of instructions sit above the real
   header, category names carry stray trailing spaces, and the date columns hold
   three different grades of certainty in one format. All of that is normalised
   here rather than in the app, so the app only ever sees clean records.

   A second source may be passed after the CSV — the exported Culture Map HTML,
   which carries the civic year the sheet barely touches. The sheet stays
   primary: where both describe the same moment, the sheet's record wins and the
   map only fills in blanks. See tools/read-culturemap.mjs.

   Run: node tools/build-moments.mjs "<path to csv>" ["<path to map html>"]     */

import { readFileSync, writeFileSync } from 'node:fs';
import { readCultureMap } from './read-culturemap.mjs';

const SRC = process.argv[2];
const MAP_SRC = process.argv[3];
if (!SRC) { console.error('usage: node tools/build-moments.mjs <csv> [culturemap.html]'); process.exit(1); }

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
    cc: bool(r[C.cc]),
    from: 'csv'
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

/* ---------- second source: the 2027 Culture Map ---------- */
/* The sheet and the map overlap on the moments everybody knows about, and the
   overlap does not line up on the nose: the sheet says "Super Bowl LXI" on
   2027-02-14, the map says "Super Bowl", flagged TBC, on the same day. Exact
   name plus date — the rule that dedupes the sheet against itself — sees two
   different moments there and would file both.

   So the cross-source rule is looser in both directions: one name contains the
   other's whole tokens, AND the dates are within a fortnight. That is wide
   enough to catch a placeholder date sitting a few days off the real one, and
   narrow enough that a tour leg in March and another in June stay separate.
   Every merge is printed, because a dedupe nobody can see is indistinguishable
   from data quietly going missing. */
/* Words that carry no identity. "Awards" is the whole overlap between the
   Grammys and the D.I.C.E Awards; "Day" is the whole overlap between National
   Pi Day and National School Walkout Day. Matching on them merges unrelated
   moments, which is worse than leaving a duplicate in — a duplicate is visible,
   a wrongly merged moment is gone. */
const GENERIC = new Set([
  'the', 'awards', 'award', 'day', 'days', 'game', 'games', 'festival', 'fest',
  'week', 'month', 'season', 'national', 'world', 'international', 'final',
  'finals', 'championship', 'championships', 'show', 'live', 'begins', 'start',
  'starts', 'ceremony', 'official', 'annual', 'weekend'
]);
/* Which edition it is — "LXI", "2027", "3rd". Super Bowl LXI is the Super Bowl. */
const EDITION = /^(?:\d{1,4}|[ivxlcdm]{1,7}|\d+(?:st|nd|rd|th))$/;
/* Qualifiers that make two similarly-named things different events. */
const SPLITS = /^(?:women|womens|men|mens|girls|boys|junior|juniors|senior)$/;

/* Accents folded before the letters are counted, because the map files the
   same holiday twice — "Día de los Muertos" under Multicultural and "Dia de
   los Muertos" under Holidays. Folded here rather than in `norm`, which the
   sheet's own dedupe depends on and which has no reason to change. */
const fold = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

const core = s => {
  const out = new Set();
  for (const w of norm(fold(s)).split(' ')) {
    if (!w) continue;
    if (w.length <= 2 && !/\d/.test(w)) continue;   // keep "w1"/"w2", drop "of"
    if (GENERIC.has(w)) continue;
    if (EDITION.test(w)) continue;
    out.add(w);
  }
  return out;
};
/* Digits read BEFORE editions are stripped, or the strip eats the very thing
   that tells two rows apart: Coachella Weekend 1 and Weekend 2 both reduce to
   "coachella" once "weekend" goes as generic and the numeral goes as an
   edition. Compared only when both names carry a number, so "FIFA Women's
   World Cup 2027" can still match the same tournament written without a year. */
const digitsOf = name => [...new Set(norm(fold(name)).split(' ').filter(w => /\d/.test(w)))].sort().join(',');

/* Deliberately conservative. Merge only where the identifying words are the
   same set; anything merely similar is imported and reported for a human. The
   asymmetric cases this refuses to touch — "Masters Golf" against "The
   Masters", "Oscars" against "Oscars / Academy Awards" — are real duplicates,
   but the rule that would catch them also swallows Christmas into NBA
   Christmas Games. */
const sameMoment = (a, b) => {
  /* Category is deliberately NOT part of this. The map files ESPYs under both
     Sports and Broadcast and TwitchCon under both Gaming and Tech, so requiring
     a category match would let the map's own duplicates straight through. What
     keeps Thanksgiving the holiday apart from Thanksgiving football is the
     size test below — "thanksgiving" alone is not the same set as
     "thanksgiving football" — and that guard does the job without this one. */
  if (b.sameAs && norm(b.sameAs) === norm(a.name)) return true;
  const A = core(a.name), B = core(b.name);
  if (!A.size || !B.size) return false;
  const da = digitsOf(a.name), db = digitsOf(b.name);
  if (da && db && da !== db) return false;                 // Coachella Weekend 1 is not Weekend 2
  const qa = [...A].filter(w => SPLITS.test(w)).sort().join(',');
  const qb = [...B].filter(w => SPLITS.test(w)).sort().join(',');
  if (qa !== qb) return false;                             // the men's cup is not the women's
  if (A.size !== B.size) return false;
  for (const w of A) if (!B.has(w)) return false;
  return true;
};
const daysApart = (a, b) => Math.abs(Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 86400000;

let mapReport = null;
if (MAP_SRC) {
  const { moments: mapped, excluded, watch, unparsed } = readCultureMap(MAP_SRC);
  const inRange = mapped.filter(m => m.end >= FROM);
  const merged = [];
  const added = [];

  /* Close but not merged — same fortnight, a shared identifying word, and a
     different shape. Every one of these is a judgement call, so they are
     imported and listed rather than resolved by a script. */
  const close = [];
  const unmatchedAlias = [];

  for (const m of inRange) {
    const hit = kept.find(k => daysApart(k.start, m.start) <= 14 && sameMoment(k, m));
    if (hit) {
      /* The sheet's row survives: it carries platform, rights holder and PA
         tagging the map has no idea about. The map's description is the one
         thing it knows better, so it fills a blank note and never overwrites. */
      if (!hit.notes && m.notes) hit.notes = m.notes;
      merged.push([m.name, hit.name]);
      continue;
    }
    const near = kept.find(k => {
      if (daysApart(k.start, m.start) > 14) return false;
      const A = core(k.name), B = core(m.name);
      if (!A.size || !B.size) return false;
      /* The same 0.6 bar the sheet's own near-duplicate report uses. Below it
         the list fills with pairs sharing one weak word — Rose Bowl beside
         Orange Bowl — and a report nobody can finish reading is not a report. */
      const shared = [...A].filter(w => B.has(w)).length;
      return shared / Math.min(A.size, B.size) >= 0.6;
    });
    if (near) close.push([m.name, near.name, m.start]);

    /* A hand-matched alias that never found its partner — the name it points at
       is not in the calendar, or not within a fortnight of this date. Worth
       saying out loud: it means the table has gone stale. */
    if (m.sameAs) unmatchedAlias.push([m.name, m.sameAs]);
    delete m.sameAs;                       // a matching hint, not a data field

    kept.push(m);
    added.push(m);
  }

  mapReport = { mapped, inRange, merged, added, close, unmatchedAlias, excluded, watch, unparsed };
}

/* ---------- third source: dates derived from calendar rules ---------- */
/* Written by tools/derive-sports.mjs, and optional — the file may not exist,
   and a build must not depend on having run a tool that needs the network.

   These are merged last and deduped the same way, but they are NOT provisional:
   each one is computed from a rule that holds every year, so "the second
   Saturday of December" is as firm a date as anything the sheet confirms. */
let derivedReport = null;
try {
  const raw = JSON.parse(readFileSync(new URL('../data/derived-sports.json', import.meta.url), 'utf8'));
  const list = (raw.moments || []).filter(m => m.end >= FROM);
  const added = [], held = [];
  for (const m of list) {
    const hit = kept.find(k => daysApart(k.start, m.start) <= 14 && sameMoment(k, m));
    if (hit) { held.push([m.name, hit.name]); continue; }
    kept.push(m);
    added.push(m);
  }
  derivedReport = { added, held, total: list.length };
} catch (e) {
  /* Absent is the normal case and not worth a warning; anything else is. */
  if (e.code !== 'ENOENT') console.warn(`[derived-sports] ignored: ${e.message}`);
}

kept.sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name));
kept.forEach((m, i) => { m.id = 'm' + (i + 1); });

const cats = [...new Set(kept.map(m => m.cat))].sort();
const stamp = kept.reduce((a, m) => m.start > a ? m.start : a, '');

writeFileSync(
  new URL('../data/moments.js', import.meta.url),
  `/* Generated by tools/build-moments.mjs — do not edit by hand.
   ${kept.length} moments, ${FROM} onward, latest ${stamp}. */
export const WINDOW_FROM = ${JSON.stringify(FROM)};
export const MOMENT_CATEGORIES = ${JSON.stringify(cats)};
export const MOMENTS = ${JSON.stringify(kept, null, 0).replace(/\},\{/g, '},\n{')};
`);

console.log(`${kept.length} moments kept of ${out.length} parsed (${dropped.length} exact duplicates collapsed)`);

if (derivedReport) {
  console.log(`\n--- derived from calendar rules ---`);
  console.log(`${derivedReport.total} read, ${derivedReport.added.length} added, ${derivedReport.held.length} already held`);
  for (const m of derivedReport.added) console.log(`   ${m.start}  ${m.name}  (${m.why || 'rule'})`);
  for (const [a, b] of derivedReport.held) console.log(`   held: ${a} -> ${b}`);
}

if (mapReport) {
  const { mapped, inRange, merged, added, close, unmatchedAlias, excluded, watch, unparsed } = mapReport;
  console.log(`\n--- 2027 Culture Map ---`);
  console.log(`${mapped.length} events read, ${inRange.length} from ${FROM} onward`);
  console.log(`${added.length} added, ${merged.length} already held by the sheet`);

  if (excluded.length) {
    console.log(`\n${excluded.length} EXCLUDED — the map dates these to 2027, but they do not happen in 2027.`);
    console.log(`(Its placeholder rule carries a 2026 date forward, which invents an event when the cadence is not annual.)`);
    for (const { name, why } of excluded) console.log(`   ${name} — ${why}`);
  }
  if (watch.length) {
    console.log(`\n${watch.length} imported with a provisional date but a cycle worth checking by hand:`);
    for (const { name, date } of watch) console.log(`   ${name} (${date})`);
  }
  if (unparsed.length) {
    console.log(`\n${unparsed.length} dropped — date could not be read:`);
    for (const { name, date } of unparsed) console.log(`   ${name} (${JSON.stringify(date)})`);
  }
  if (merged.length) {
    console.log(`\n${merged.length} map events matched something the sheet already had, and were not added:`);
    for (const [m, k] of merged) console.log(`   ${m}   ->   ${k}`);
  }
  if (unmatchedAlias.length) {
    console.log(`\n${unmatchedAlias.length} hand-matched alias(es) found nothing to merge into — check the SAME_AS table:`);
    for (const [m, k] of unmatchedAlias) console.log(`   ${m}   ->   ${k}  (not found within a fortnight)`);
  }
  if (close.length) {
    console.log(`\n${close.length} imported but close to something already held — these need your eye:`);
    for (const [m, k, d] of close) console.log(`   ${d}  ${m}   ~   ${k}`);
  }
}
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
