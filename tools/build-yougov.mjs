/* THE YOUGOV CUT -> data/yougov.js
 *
 *   node tools/build-yougov.mjs "Google Audience Playgrounds (YouGov data) - Sheet1.csv"
 *
 * Four PA target audiences, 884 survey rows, and two different models that
 * want different things out of them. This script is the only place the sheet
 * is read, so every judgement about what a number means is made once, here,
 * where it can be reviewed.
 *
 * THE ONE TRAP THAT MATTERS: NOT EVERY BANK WAS ASKED OF EVERYONE.
 *
 * Sport interest was put to the whole panel. "Sponsorship actions taken" was
 * only put to people who had noticed a sponsor, and radio genres only to
 * people who listen to radio. An index inside a conditional bank is relative
 * to that bank's own universe, so YTTV reads 235-424 across every radio genre
 * — not because they are radio superfans, but because the few of them who
 * listen are unusual. Averaging that in beside a full-panel bank would hand
 * the loudest number to the narrowest question.
 *
 * The fix is not to re-centre those banks. Re-centring throws away real
 * signal along with the bias: the event battery is mostly sports events, so
 * centring it would score an audience defined by live sport as merely average
 * on the Oscars, which is the opposite of what the rows say.
 *
 * Instead every index here is RECOMPUTED FROM THE PROJECTED POPULATIONS. The
 * sheet gives, for each row, how many adults in total and how many in this
 * audience answered that way, and both are absolute counts. Divide each by
 * the panel-wide figure and the conditional universe cancels out — what comes
 * back is the unconditional rate, which is both comparable across banks and
 * the thing a planner meant in the first place. "6% of this audience acted on
 * a sponsorship" is a fact about the audience; "163 among those who noticed
 * one" is a fact about a question.
 *
 * Indices are ratio data — 200 is twice 100, and 50 is half of it — so every
 * average here is GEOMETRIC. An arithmetic mean of indices drifts above par
 * for no reason other than that the top half of the scale is unbounded.       */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENTITY_MAP } from '../data/entity-map.js';
import { PROPERTY_CHANNELS, DISTRIBUTOR_CHANNELS, CATEGORY_CHANNELS } from '../data/channel-map.js';
import { TOPIC_BANKS, TOPIC_MAP } from '../data/topic-map.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* ---------- CSV ---------- */

function parseCSV(txt) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) {
      if (c === '"') { if (txt[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

/* ---------- the four audiences, and what to call them on a rail ---------- */

/* The sheet's own headings are the audience's real names and they are kept
   whole in `full`, because that string is what somebody would search the
   research library for. `name` is what fits a 260px rail row, and `pa` is the
   product area whose target it is. Neither is derivable from the sheet, so
   both are declared — and the CSV heading is asserted against `match` so a
   re-export with the columns in a different order cannot silently swap two
   audiences' numbers. */
const AUDIENCE_META = [
  { id: 'search26',  pa: 'Search', name: "Search '26",            match: /^Search Audience/i,
    def: 'The Search product area’s own 2026 target. The broadest of the four by a distance — a quarter of US adults — so it moves the board by weight of numbers rather than by intensity.' },
  { id: 'gemini26',  pa: 'Gemini', name: "Gemini '26",            match: /^Gemini Audience/i,
    def: 'Gemini’s 2026 target. The one audience here that under-indexes on live sport and over-indexes hard on education, indie games and Discord — a moments board built for them looks nothing like the other three.' },
  { id: 'seekers26', pa: 'Pixel',  name: "Millennial Seekers '26", match: /^Millennial Seekers/i,
    def: 'The Pixel proxy, v2. Sits close to par on most things and separates on motoring, horror and the practical end of podcasting — a cut that rewards specificity rather than scale.' },
  { id: 'yttv2544',  pa: 'YouTube TV', name: 'YTTV Sport 25–44',  match: /^YTTV/i,
    def: 'YouTube TV’s 25–44 HHI $50k+ live-sport streamers who describe themselves as avid fans. Over-indexes on essentially every sport in the study, so the interesting question for them is never “do they care” but “is there a way in”.' }
];

/* ---------- which survey rows speak for which moment category ---------- */

/* Twelve categories on the board, and the sheet does not have an answer for
   all twelve. The three that get `null` are not an oversight and must not be
   quietly filled: there is no holiday battery, no civic-calendar battery and
   no heritage battery in this cut, so those lanes sit at par for every
   audience and the UI says so. Inventing a proxy — reading Latin music
   affinity as an answer about Hispanic Heritage Month — would produce exactly
   the confident-and-wrong number this tool exists to prevent.
   `bank` is a row_title; `rows` narrows it to named category_labels. */
const CATEGORY_SOURCES = {
  'Sports':            [{ bank: 'PDLC' }],
  'Music':             [{ bank: 'Music genres preferred' }],
  'Movies':            [{ bank: 'Movies - genres watched' }],
  'TV & Streaming':    [{ bank: 'TV - genres watched' }, { bank: 'Streaming services used' }],
  'Gaming':            [{ bank: 'Video game genres preferred' }, { bank: 'Gaming genres played' }],
  'Tech':              [{ bank: 'Online content genres preferred', rows: ['Tech and reviews'] },
                        { bank: 'Podcast genre - listened to',    rows: ['Science and Technology'] },
                        { bank: 'Magazine genres read',           rows: ['Technology'] },
                        { bank: 'Genres followed',                rows: ['Computers and technology'] },
                        { bank: 'Genre(s) of Blogs/Vlogs followed', rows: ['Tech'] }],
  'Fashion & Awards':  [{ bank: 'ELOI', rows: ['Academy Awards', 'Emmy Awards', 'Golden Globes', 'Grammy Awards', 'Latin Grammys'] },
                        { bank: 'Online content genres preferred', rows: ['Beauty and Fashion'] },
                        { bank: 'Magazine genres read',            rows: ['Lifestyle/Fashion'] },
                        { bank: 'Genres followed',                 rows: ['Beauty'] },
                        { bank: 'Genre(s) of Blogs/Vlogs followed', rows: ['Fashion'] },
                        { bank: 'Events attended - last 12 months', rows: ['Fashion shows / apparel & clothing / retail events'] }],
  'Tours & Concerts':  [{ bank: 'Music festival genre' },
                        { bank: 'Events attended - last 12 months',
                          rows: ['Show/concert in larger venue (e.g. arena, stadium, etc.)',
                                 'Show/concert in smaller venue (e.g. a club, a bar, a theatre, etc.)',
                                 'Show/concert at an Amphitheater', 'Music festivals'] }],
  'Culture':           [{ bank: 'Events attended - last 12 months',
                          rows: ['Broadway musical', 'Broadway play', 'Touring Broadway show', 'Art fair',
                                 'Cirque du Soleil', 'Cons (i.e. comic con, anime conventions, etc.)'] },
                        { bank: 'Podcast genre - listened to', rows: ['History'] },
                        { bank: 'Online content genres preferred', rows: ['History'] },
                        { bank: 'Book genres preferred', rows: ['Historical Fiction'] }],
  'Holidays':            null,
  'National Days':       null,
  'Heritage & Identity': null
};

/* ---------- receptivity ---------- */

/* Two halves, because "would you mind" and "would you do anything about it"
   are different questions and an audience can be high on one and low on the
   other. Polarity is DECLARED, never inferred: a batch of survey statements
   contains both "I expect advertisements to entertain me" and "I think
   advertisements are just a waste of my time", and averaging them raw scores
   an audience for having opinions rather than for welcoming a brand.
   A negative item is inverted geometrically — 10000/index — so that par maps
   to par and a 125 on "waste of my time" becomes an 80 on receptivity. */
const WELCOME_ITEMS = [
  ['I expect advertisements to entertain me', +1],
  ['I enjoy watching advertisements with my favorite celebrities', +1],
  ['Advertising helps me choose what I buy', +1],
  ['I pay attention to the ads at events', +1],
  ['I take notice of who sponsors the sporting events I watch', +1],
  ['I love seeing that my favorite team has cool sponsors', +1],
  ['Sponsorship can help keep companies socially relevant', +1],
  ['I like brands that are willing to get involved in social issues', +1],
  ['Posters/billboards help me to become aware of new products and services', +1],
  ['I think advertisements are just a waste of my time', -1],
  ['I feel bombarded by advertising', -1],
  ["I don't trust the advertisements on TV", -1],
  ["I skip through the advertisements on programs I've recorded", -1],
  ['I use an ad blocker when I surf the internet', -1],
  ['I rarely notice who sponsors an event', -1],
  ['Personalized advertisements creep me out', -1]
];

const RESPOND_ITEMS = [
  ['Visited a social media profile of the sponsor', +1],
  ['Visited a website of the sponsor and made a purchase', +1],
  ['Visited a website of the sponsor but made no purchase', +1],
  ['Researched the sponsor further', +1],
  ['Spoke to another person about the sponsor', +1],
  ['Acknowledged the sponsor in other walks of life', +1],
  /* The sheet's two "searched for it afterwards" statements are both worded
     about posters and billboards specifically, so they measure an OOH habit
     rather than a willingness to respond. Left out: the sponsorship battery
     above already asks the question without the channel attached. */
  ['If you sponsor my team, I will buy your products', +1],
  ['I like to support my teams by buying products from their sponsors', +1]
];

/* ---------- helpers ---------- */

const clean = t => t
  .replace(/^ELOI Top 2 /, '')
  .replace(/\s*[-–]\s*level of interest\s*[-–]?\s*(Top 2)?\s*$/i, '')
  .replace(/\s*[-–]\s*Top 2\s*$/i, '')
  .trim();

/* Population-weighted geometric mean of a set of indices. Weighting by the
   whole-population figure lets a genre a third of the country watches count
   for more than one that 3% do — without it, "Soap opera" and "Comedy" carry
   the same vote for what an audience thinks of television. */
function geoMean(pairs) {
  let num = 0, den = 0;
  for (const [idx, w] of pairs) {
    if (!(idx > 0) || !(w > 0)) continue;
    num += Math.log(idx) * w; den += w;
  }
  return den ? Math.exp(num / den) : null;
}

const round1 = n => n == null ? null : Math.round(n * 10) / 10;

/* ---------- build ---------- */

function build(csvPath) {
  const rows = parseCSV(fs.readFileSync(csvPath, 'utf8'));
  const head = rows[0], hdr = rows[2];
  const data = rows.slice(3).filter(r => r[0] && r.length >= 18);

  /* Columns. Asserted against the sheet's own headings rather than assumed,
     because four audiences in the wrong order is a bug that produces a
     perfectly plausible board. */
  const cols = [];
  for (const meta of AUDIENCE_META) {
    const at = head.findIndex(h => meta.match.test((h || '').trim()));
    if (at < 0) throw new Error(`Audience heading not found in the sheet: ${meta.match}`);
    cols.push({ ...meta, full: head[at].trim(), pct: at, idx: at + 1, pop: at + 2 });
  }
  if (hdr[cols[0].idx] !== 'col_index') {
    throw new Error(`Expected col_index at ${cols[0].idx}, found "${hdr[cols[0].idx]}"`);
  }

  const bankOf = r => r[0].startsWith('pdlc') ? 'PDLC'
                    : r[0].startsWith('ELOI') ? 'ELOI'
                    : r[1];
  const banks = new Map();
  for (const r of data) {
    const b = bankOf(r);
    if (!banks.has(b)) banks.set(b, []);
    banks.get(b).push(r);
  }

  /* Each bank's implied audience size, and therefore its universe. */
  const impliedSize = (rowsIn, c) => {
    const v = [];
    for (const r of rowsIn) {
      const pAll = Number(r[5]), pa = Number(r[c.pop]), ix = Number(r[c.idx]);
      if (pAll > 0 && pa > 0 && ix > 0) v.push((pa / pAll) / (ix / 100));
    }
    if (!v.length) return null;
    v.sort((a, b) => a - b);
    return v[Math.floor(v.length / 2)];
  };

  /* The panel universe is the share the most rows agree on — worked out per
     audience, because each column has its own size and reading all four off
     the first one is how four audiences end up the same size on the rail. */
  const panelShare = {};
  for (const c of cols) {
    const tally = new Map();
    for (const [, rowsIn] of banks) {
      const sz = impliedSize(rowsIn, c);
      if (sz == null) continue;
      /* One vote per BANK, not per row. Weighting by rows lets the five
         attitude batteries — 341 rows between them, all put to the same
         conditional universe — outvote the twelve banks that were actually
         asked of the whole panel, and the audience comes out less than half
         its real size with every index doubled to match. */
      const k = sz.toFixed(3);
      tally.set(k, (tally.get(k) || 0) + 1);
    }
    panelShare[c.id] = Number([...tally.entries()].sort((a, b) => b[1] - a[1])[0][0]);
  }

  /* Reported, not corrected for — see the note at the top. Knowing which
     banks were conditional is worth surfacing in the methodology even though
     recomputing from populations already cancels the effect. */
  const conditional = new Set();
  for (const [name, rowsIn] of banks) {
    const sz = impliedSize(rowsIn, cols[0]);
    if (sz == null || Math.abs(sz - panelShare[cols[0].id]) / panelShare[cols[0].id] > 0.02) conditional.add(name);
  }


  /* The population the whole study is projected onto — median of every row's
     own implication, so one odd row cannot move it. */
  const popAll_ = (() => {
    const v = data.map(r => { const p = Number(r[5]), a = parseFloat(r[4]); return (p > 0 && a > 0) ? p / (a / 100) : null; })
                  .filter(Boolean).sort((a, b) => a - b);
    return v[Math.floor(v.length / 2)];
  })();

  /* THE INDEX, REBUILT FROM COUNTS.

     The sheet's own col_index is relative to whatever universe its question
     was put to. These two lines put every row back on the same base: the
     audience's rate among the WHOLE audience, against the population's rate
     among the WHOLE population. Identical to the printed index for a bank
     asked of everyone, and the honest version of it for one that was not.

     Falls back to the printed index only when a row carries no populations
     at all, which in this cut means a row nobody answered. */
  const indexOf = (r, c) => {
    const popA = Number(r[c.pop]), popAll = Number(r[5]);
    if (popA > 0 && popAll > 0) {
      const mine = popA / (panelShare[c.id] * popAll_);
      const theirs = popAll / popAll_;
      return theirs > 0 ? (mine / theirs) * 100 : null;
    }
    const raw = Number(r[c.idx]);
    return raw > 0 ? raw : null;
  };

  const findRow = (bank, label) =>
    (banks.get(bank) || []).find(r => clean(r[3]) === label || r[3].trim() === label);

  /* ---- per audience ---- */
  const out = [];
  const warnings = [];

  for (const c of cols) {
    const sizeN = Math.round(panelShare[c.id] * popAll_);

    /* Category affinity. */
    const aff = {}, affP = {}, affFrom = {};
    for (const [cat, sources] of Object.entries(CATEGORY_SOURCES)) {
      if (!sources) {
        aff[cat] = null; affP[cat] = null;
        affFrom[cat] = { rows: 0, banks: [], note: 'no battery in this cut' }; continue;
      }
      const pairs = []; const used = []; const shares = [];
      for (const s of sources) {
        const bankRows = banks.get(s.bank);
        if (!bankRows) { warnings.push(`category ${cat}: no bank "${s.bank}"`); continue; }
        const pick = s.rows
          ? s.rows.map(l => { const r = findRow(s.bank, l);
                              if (!r) warnings.push(`category ${cat}: no row "${l}" in "${s.bank}"`);
                              return r; }).filter(Boolean)
          : bankRows;
        for (const r of pick) {
          const i = indexOf(r, c);
          if (i) pairs.push([i, Number(r[5])]);
          const pa = Number(r[c.pop]);
          if (pa > 0) shares.push(pa / sizeN);
        }
        if (pick.length) used.push(s.bank + (conditional.has(s.bank) ? ' (centred)' : ''));
      }
      aff[cat] = round1(geoMean(pairs));
      /* PARTICIPATION, NOT JUST INDEX. How much of this audience takes part in
         the category at all — the mean share across its rows. Rows overlap
         (one person likes three genres) so this is not a reach figure and
         must not be read as one; it is a relative volume term, and its whole
         job is to stop a high-indexing niche outranking a mainstream one.
         Leaving it out cost a whole board: without a volume anchor at the
         coarse rungs, three of the four audiences returned near-identical top
         tens led by whichever category they happened to index highest on. */
      affP[cat] = shares.length ? Math.round(1e4 * shares.reduce((x, y) => x + y, 0) / shares.length) / 1e4 : null;
      affFrom[cat] = { rows: pairs.length, banks: used };
    }

    /* Entity interest, in ENTITY_MAP order so the runtime can take the first
       match and know it is the most specific one. Participation is read off
       the projected population rather than the rounded percentage column. */
    const ent = {}, entP = {};
    for (const [key] of ENTITY_MAP) {
      const r = (banks.get('ELOI') || []).find(x => clean(x[1]) === key)
             || (banks.get('PDLC') || []).find(x => clean(x[1]) === key);
      if (!r) { warnings.push(`entity "${key}" is not a row in this cut`); continue; }
      const i = indexOf(r, c);
      if (i == null) continue;
      ent[key] = round1(i);
      entP[key] = Math.round(1e4 * Number(r[c.pop]) / sizeN) / 1e4;
    }

    /* The middle rung. Every sub-topic data/topic-map.js can route a moment
       to, read out of the battery named for that category. Asserted rather
       than assumed: a genre label that has been reworded in a re-export would
       otherwise go missing silently and take a whole rung with it. */
    const topic = {}, topicP = {};
    for (const [cat, rules] of Object.entries(TOPIC_MAP)) {
      const bank = TOPIC_BANKS[cat];
      if (!bank) { warnings.push(`topic map has no bank for "${cat}"`); continue; }
      for (const [label] of rules) {
        if (topic[label] != null) continue;
        const r = findRow(bank, label);
        if (!r) { warnings.push(`sub-topic "${label}" is not a row in "${bank}"`); continue; }
        const i = indexOf(r, c);
        if (i != null) topic[label] = round1(i);
        const pa = Number(r[c.pop]);
        if (pa > 0) topicP[label] = Math.round(1e4 * pa / sizeN) / 1e4;
      }
    }

    /* Channels. One flat lookup keyed by the sheet's own channel name. */
    const reach = {}, reachP = {};
    const wanted = new Set();
    for (const mix of Object.values(PROPERTY_CHANNELS)) for (const [ch] of mix) wanted.add(ch);
    for (const [, mix] of DISTRIBUTOR_CHANNELS) for (const [ch] of mix) wanted.add(ch);
    for (const mix of Object.values(CATEGORY_CHANNELS)) for (const [ch] of mix) wanted.add(ch);
    for (const ch of wanted) {
      const r = findRow('TV networks regularly watched - extended list', ch)
             || findRow('Streaming services used', ch)
             || findRow('Social networks used', ch)
             || (banks.get('Streaming services used') || []).find(x => x[3].startsWith(ch))
             || (banks.get('TV networks regularly watched - extended list') || []).find(x => x[3].startsWith(ch));
      if (!r) { warnings.push(`channel "${ch}" is not a row in this cut`); continue; }
      const i = indexOf(r, c);
      if (i != null) reach[ch] = round1(i);
      const pa = Number(r[c.pop]);
      if (pa > 0) reachP[ch] = Math.round(1e4 * pa / sizeN) / 1e4;
    }

    /* Receptivity, ipsatised against the widest attitudinal grid there is —
       every statement battery in the sheet, not the sub-battery each item
       came from. Centring on the sub-battery would subtract the very thing
       being measured along with the acquiescence bias. */
    const attRows = data.filter(r => r[0].startsWith('attitudes') || r[1] === 'Sponsorship actions taken');
    const grid = geoMean(attRows.map(r => [Number(r[c.idx]), Number(r[5])])) || 100;
    const half = (items, label) => {
      const pairs = [];
      for (const [text, pol] of items) {
        const r = attRows.find(x => x[3].trim() === text);
        if (!r) { warnings.push(`${label} item not found: "${text}"`); continue; }
        const raw = Number(r[c.idx]);
        if (!(raw > 0)) continue;
        const ips = raw * 100 / grid;
        pairs.push([pol > 0 ? ips : 1e4 / ips, Number(r[5])]);
      }
      return { value: round1(geoMean(pairs)), rows: pairs.length };
    };
    const welcome = half(WELCOME_ITEMS, 'welcome');
    const respond = half(RESPOND_ITEMS, 'respond');

    out.push({
      id: c.id, pa: c.pa, name: c.name, full: c.full, def: c.def,
      sizeN, size: (sizeN / 1e6).toFixed(1) + 'M',
      aff, affP, affFrom, ent, entP, topic, topicP, reach, reachP,
      recep: {
        welcome: welcome.value, respond: respond.value,
        value: round1(Math.sqrt((welcome.value || 100) * (respond.value || 100))),
        rows: welcome.rows + respond.rows
      }
    });
  }

  return { out, warnings, popAll: popAll_, conditional: [...conditional], banks: banks.size };
}

/* ---------- emit ---------- */

function emit(res, csvPath) {
  const j = v => JSON.stringify(v);
  const body = res.out.map(a => `  {
    id: ${j(a.id)}, pa: ${j(a.pa)},
    name: ${j(a.name)},
    full: ${j(a.full)},
    size: ${j(a.size)}, sizeN: ${a.sizeN},
    def: ${j(a.def)},
    aff: ${j(a.aff)},
    affP: ${j(a.affP)},
    affFrom: ${j(a.affFrom)},
    ent: ${j(a.ent)},
    entP: ${j(a.entP)},
    topic: ${j(a.topic)},
    topicP: ${j(a.topicP)},
    reach: ${j(a.reach)},
    reachP: ${j(a.reachP)},
    recep: ${j(a.recep)}
  }`).join(',\n');

  return `/* Generated by tools/build-yougov.mjs — do not edit by hand.
   Source: ${path.basename(csvPath)}
   ${res.out.length} audiences, ${res.banks} question banks, ${res.conditional.length} of them conditional.

   Every number here is a measured survey response. Where a lane has no
   battery in the cut the value is null rather than 100 — par and "not asked"
   are different claims and the board draws them differently. */

export const YOUGOV_SOURCE = {
  name: 'YouGov Profiles',
  cut: 'Google Audience Playgrounds',
  pop: ${res.popAll ? Math.round(res.popAll) : 0},
  banks: ${res.banks},
  conditional: ${JSON.stringify(res.conditional)}
};

export const YOUGOV = [
${body}
];
`;
}

const csvPath = process.argv[2];
if (!csvPath) { console.error('usage: node tools/build-yougov.mjs <csv>'); process.exit(1); }

const res = build(csvPath);
fs.writeFileSync(path.join(ROOT, 'data', 'yougov.js'), emit(res, csvPath));

console.log(`Wrote data/yougov.js — ${res.out.length} audiences from ${res.banks} banks.`);
console.log(`Panel projected onto ${(res.popAll / 1e6).toFixed(1)}M adults.`);
console.log(`Banks put to a conditional universe, corrected by count (${res.conditional.length}): ${res.conditional.join(', ')}`);
for (const a of res.out) {
  const named = Object.entries(a.aff).filter(([, v]) => v != null);
  console.log(`\n  ${a.name.padEnd(22)} ${a.size.padStart(7)}  entities ${Object.keys(a.ent).length}  topics ${Object.keys(a.topic).length}  channels ${Object.keys(a.reach).length}  receptivity ${a.recep.value}`);
  console.log('    ' + named.map(([k, v]) => `${k.split(' ')[0]} ${v}`).join('  '));
}
if (res.warnings.length) {
  console.log(`\n${res.warnings.length} WARNINGS — every one of these is a row the model wanted and did not get:`);
  for (const w of [...new Set(res.warnings)]) console.log('  ! ' + w);
} else {
  console.log('\nNo warnings: every declared row, entity and channel was found in the sheet.');
}
