/* Fill the gaps in the sports year — without letting a model invent a date.

   The lane is not thin because the sheet is small; it holds 136 sports moments
   in the window. It is thin because the milestones that anchor a US sporting
   year are missing: no NHL season start, no NFL playoff rounds by name, no
   Army-Navy, no rivalry Saturday.

   The obvious fix is to ask Gemini for them, and the obvious fix is wrong. The
   2027 schedules are mostly unpublished — the NFL releases its 2027 schedule in
   May 2027 — so a model asked for dates will produce plausible ones, and a
   plausible date on a planning board is worse than an absence: it is acted on.

   So this asks for the RULE and computes the date itself.

     Gemini      which milestones exist, and that Army-Navy is "the second
                 Saturday of December". That is recall and language.
     this file   what the second Saturday of December 2026 actually is. That
                 is arithmetic, and tools/calendar-rules.mjs is tested on it.

   Anything that will not reduce to a rule is refused rather than guessed at,
   which is the whole point: what comes back is short and right.

   Run:
     node tools/derive-sports.mjs                (asks for the gate password)
     node tools/derive-sports.mjs --dry          (prints, writes nothing)

   Writes data/derived-sports.json, which tools/build-moments.mjs merges as a
   third source alongside the sheet and the Culture Map.                      */

import { writeFileSync } from 'node:fs';
import { MOMENTS } from '../data/moments.js';
import { evaluateRule } from './calendar-rules.mjs';
import { gateLogin, callGemini } from './gate-login.mjs';

const arg = name => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const BASE = (arg('--base') || 'https://ltpmoments.mfgpilots.com').replace(/\/$/, '');
const DRY = process.argv.includes('--dry');

const WIN_FROM = '2026-07-01';
const WIN_TO = '2027-06-30';

const BRIEF = `The calendar covers 1 July 2026 to 30 June 2027 — the 2026-27 US season.

Its sports lane is missing the milestones that give an American sporting year
its shape. Look across the major US leagues and college sport: NFL, NBA, MLB,
NHL, MLS, WNBA, NCAA football and basketball, plus the fixtures that are
national events in their own right.

What is wanted is the milestones a media planner would build a calendar
around — season openers, playoff rounds, drafts, signature rivalry games,
championship weekends — and NOT individual regular-season fixtures.`;

/* ---------- what the calendar already holds ---------- */

const inWindow = MOMENTS.filter(m => m.end >= WIN_FROM && m.start <= WIN_TO);

/* Anchors are CONFIRMED dates only. A playoff round derived from a date that
   is itself provisional would compound a guess, so anything the sheet marks as
   anything other than a confirmed date is not offered as something to hang
   another date on. */
const anchors = inWindow
  .filter(m => m.cat === 'Sports' && m.conf === 'Confirmed Date')
  .map(m => ({ name: m.name, date: m.start }))
  .slice(0, 40);

const existing = inWindow.filter(m => m.cat === 'Sports').map(m => m.name);

/* ---------- resolving a rule to a date in this window ---------- */

const norm = s => String(s).toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim();
const anchorMap = Object.fromEntries(anchors.map(a => [a.name.toLowerCase().trim(), a.date]));

/* A month rule does not carry a year, and the window straddles two. Both are
   tried and exactly one can land inside a twelve-month window — a rule for
   January resolves into 2027, one for October into 2026. Neither landing, or
   both, means the rule is not what it looks like, and it is dropped. */
function resolve(rule) {
  const hits = [];
  for (const year of [2026, 2027]) {
    const out = evaluateRule(rule, { year, anchors: anchorMap });
    if (out.date && out.date >= WIN_FROM && out.date <= WIN_TO) hits.push(out);
  }
  if (hits.length === 1) return hits[0];
  if (!hits.length) {
    const why = evaluateRule(rule, { year: 2027, anchors: anchorMap }).why;
    return { date: null, why: `resolves outside the window (${why})` };
  }
  return { date: null, why: 'resolves twice inside the window' };
}

/* ---------- run ---------- */

console.log(`base: ${BASE}`);
console.log(`${existing.length} sports moments already in the window, ${anchors.length} confirmed anchors\n`);

let cookie;
try {
  cookie = await gateLogin(BASE);
} catch (e) {
  console.error(`\n${e.message}`);
  process.exit(1);
}
console.log(cookie ? 'unlocked\n' : 'deployment is open — no gate to pass\n');

let out;
try {
  out = await callGemini(BASE, cookie, { action: 'derive-moments', brief: BRIEF, anchors, existing });
} catch (e) {
  console.error(`derive-moments failed — ${e.message}`);
  process.exit(1);
}

const kept = [], dropped = [], disagreed = [], dupes = [];

for (const m of out.moments || []) {
  const r = resolve(m.rule);
  if (!r.date) { dropped.push({ name: m.name, why: r.why }); continue; }

  /* The model's own reading of its rule, checked against the computed date.
     A disagreement does not throw the moment away — the computed date is the
     one that counts and it is right by construction — but it is reported,
     because a model that cannot apply its own rule is a model whose rules
     deserve a second look. */
  if (m.claimedDate && m.claimedDate !== r.date) {
    disagreed.push({ name: m.name, said: m.claimedDate, is: r.date });
  }

  /* Nothing that is already there under any name close to this one. Same test
     the Culture Map merge uses: a shared identifying name within a fortnight. */
  const clash = inWindow.find(x =>
    Math.abs(Date.parse(x.start + 'T00:00:00Z') - Date.parse(r.date + 'T00:00:00Z')) <= 14 * 86400000 &&
    norm(x.name) === norm(m.name));
  if (clash) { dupes.push({ name: m.name, clash: clash.name }); continue; }

  kept.push({
    name: m.name,
    cat: 'Sports',
    start: r.date,
    end: r.date,
    /* A date computed from a rule that holds every year is a real date, not a
       provisional one — which is the entire reason for doing it this way. It
       is scored as confirmed because it IS confirmed: the second Saturday of
       December is not an estimate. */
    conf: 'Confirmed Date',
    type: 'Evergreen',
    src: '',
    plat: '',
    pas: [],
    notes: m.note || '',
    spons: '',
    single: true,
    cc: false,
    from: 'derived',
    /* Kept with the record: the rule it came from, and what that rule means in
       words. A date whose provenance travels with it can be argued with. */
    rule: m.rule,
    why: r.why,
    league: m.league || ''
  });
}

kept.sort((a, b) => a.start.localeCompare(b.start));

console.log(`${kept.length} derived, ${dupes.length} already held, ${dropped.length} unresolvable\n`);
for (const k of kept) console.log(`  ${k.start}  ${(k.league || '').padEnd(6)} ${k.name.padEnd(38)} ${k.why}`);

if (dupes.length) {
  console.log(`\nalready in the calendar:`);
  for (const d of dupes) console.log(`  ${d.name}  ->  ${d.clash}`);
}
if (dropped.length) {
  console.log(`\ndropped — the rule would not resolve:`);
  for (const d of dropped) console.log(`  ${d.name} — ${d.why}`);
}
if (out.refused && out.refused.length) {
  console.log(`\nrefused at the API — rule kind not one we can evaluate:`);
  for (const d of out.refused) console.log(`  ${d.name} — ${d.why}`);
}
if (disagreed.length) {
  console.log(`\nthe model misapplied its own rule (the computed date is used):`);
  for (const d of disagreed) console.log(`  ${d.name} — said ${d.said}, rule gives ${d.is}`);
}
if (out.skipped && out.skipped.length) {
  console.log(`\nit declined to guess at these, which is the right answer:`);
  for (const d of out.skipped) console.log(`  ${d.name} — ${d.why}`);
}

if (!kept.length) {
  console.error('\nnothing derived. Not writing an empty file over a good one.');
  process.exit(1);
}

if (DRY) { console.log('\n--dry: nothing written'); process.exit(0); }

const path = new URL('../data/derived-sports.json', import.meta.url);
writeFileSync(path, JSON.stringify({
  note: 'Generated by tools/derive-sports.mjs. Dates are computed from calendar ' +
        'rules by tools/calendar-rules.mjs, never asserted by the model. ' +
        'Re-run to regenerate; hand-edits will be overwritten.',
  window: { from: WIN_FROM, to: WIN_TO },
  moments: kept
}, null, 2) + '\n');

console.log(`\nwrote ${kept.length} moments to data/derived-sports.json`);
console.log('now rebuild:  node tools/build-moments.mjs "<csv>" "<culturemap.html>"');
