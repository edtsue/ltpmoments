/* WHAT 'HIGH RELEVANCE' MEANS — a proposed methodology.

   The logic here is real and is what I would ship. The INPUTS it reads are
   placeholders (see audiences.js, and `scaleOf` below), so treat the numbers
   as illustrative and the model as the actual proposal.

   The rule the model is built around: a planner has to be able to argue with
   a score. So relevance is never a bare number — it is five named components
   that each answer a question a planner would otherwise ask out loud, and the
   UI always opens them up.

     AFFINITY      Does this audience care?          weight .50
     SCALE         How many of them show up?          weight .20
     ACTIONABILITY Can we actually buy into it?       weight .15
     TIMING        Is the date firm enough to plan?   weight .15
     CONGESTION    How loud is everything else?       multiplier, up to -25%

   Affinity is the driver and the thing that changes per audience — the other
   four are properties of the moment and are the same for everyone. That is
   deliberate: it keeps the audience switch honest. Flipping the rail should
   reorder the year because the audience cares about different things, not
   because the model quietly re-weighted itself.

   WHY .50 AND NOT .40. The first cut of this weighted affinity at .40, which
   left 60% of every score identical for all six audiences — so the Oscars came
   out top for Gen Z, for families AND for tech buyers, because a big, firmly
   dated, buyable moment wins on three terms out of four no matter who is
   watching. An audience switch that returns the same answer is not an audience
   switch. Affinity carries the majority now, and it is run through a curve
   (see `affinityOf`) rather than a straight rescale, because a flat map put
   every real-world index between 70 and 160 into a 35–80 band and flattened
   the only term that was supposed to vary.

   Congestion is a MULTIPLIER rather than a sixth weighted term because it is
   not a virtue of the moment, it is a tax on it. A moment that is perfect on
   the other four and lands in the loudest week of the year is still worth
   less than the same moment in a quiet one — but it never drops out of the
   running, which a subtractive term would let it do.

   Congestion is also the term that answers the Cultural Playground question
   the LTP process actually asks — "what is the moment nobody in the category
   has claimed?" — so it is surfaced in the UI on its own, not just folded
   into the total.                                                            */

/* ---------- the four moment-side components ---------- */

/* SCALE. Placeholder: a keyword ladder over the moment name, floored by
   category and nudged by whether the distributor is a major. In production
   this is one number per moment from the reach model — expected 18+ reach, or
   the buy's own delivery estimate — and this whole function disappears. */
const TENTPOLE = [
  [/super bowl|world cup|olympic/i, 100],
  [/world series|nba finals|stanley cup|playoffs|wimbledon|masters|kentucky derby|indy 500|daytona/i, 86],
  [/oscar|academy award|grammy|emmy|vma|video music award|game awards|met gala/i, 84],
  [/all-star|comic-con|coachella|unpacked|wwdc|ces\b/i, 78],
  [/thanksgiving|christmas|halloween|new year|black friday|prime day|mother's day|father's day/i, 82],
  [/final season|series finale|s\d+ finale/i, 66],
  [/world tour|tour\b/i, 60],
  [/album release/i, 54]
];
const CAT_SCALE = {
  'Sports': 62, 'Holidays': 74, 'Movies': 58, 'TV & Streaming': 52,
  'Music': 48, 'Tours & Concerts': 50, 'Gaming': 52,
  'Fashion & Awards': 60, 'Tech': 54, 'Culture': 56
};
const MAJORS = /disney|netflix|warner|nbcu|amazon|paramount|sony|fox|apple|umg|google|samsung|nintendo/i;

/* SPORTS SCALE COMES FROM MEASUREMENT, NOT FROM THE NAME.

   Everywhere else this term is a keyword ladder over the moment's title, which
   is a guess dressed as a number. For sport it does not have to be: WPP Media's
   Sports Reach analysis gives average 1-month P18-49 reach per league per
   month, off Nielsen's Big Data+Panel, and that is the actual answer to "how
   many of them show up".

   Two things it gets right that the ladder never could. It is SEASONAL — the
   NBA reaches 13.7% of P18-49 in October and 35.4% in May, and the ladder gave
   both the same 62. And it is ORDERED across leagues by measurement rather
   than by how famous the name sounds: the NFL in November (54.6%) really is
   four times the reach of the Premier League in November (4.8%).

   The curve. Reach runs from 0.2% to 54.6%, and mapping that straight onto
   0-100 would put every sport except the NFL in the bottom third — reach is
   distributed with a long thin tail and a score is not. The 0.6 exponent
   lifts the middle without reordering anything, so a 33% October MLB lands at
   74 and a 5% Premier League Saturday at 23.

   A moment whose league is not in the deck, or whose month is out of that
   league's season, falls through to the ladder below rather than to zero: an
   absent month means the deck did not measure it, not that nobody watched. */
const REACH = SPORTS_REACH;
const REACH_MAX = 55;          // the NFL in November, rounded up

/* Whole-word matching, always. The first cut of the entity keys in this file
   matched "CES" inside "Sciences"; three-letter league codes are exactly that
   trap again, so every acronym here is anchored. */
const LEAGUE = [
  ['NFL',                         /\bNFL\b|\bsuper bowl\b|\bpro bowl\b/i],
  ['College Football',            /\bCFB\b|college football|rose bowl|orange bowl|sugar bowl|fiesta bowl|peach bowl|cotton bowl|heisman|army.?navy/i],
  ['NBA',                         /\bNBA\b/i],
  ["Men's College Basketball",    /march madness men|men'?s college basketball|final four men|selection sunday/i],
  ["Women's College Basketball",  /march madness women|women'?s college basketball|final four women|ncaa women'?s final four/i],
  ['WNBA',                        /\bWNBA\b/i],
  ['MLB',                         /\bMLB\b|world series(?! of poker)|home run derby/i],
  ['NHL',                         /\bNHL\b|stanley cup|winter classic/i],
  ['MLS',                         /\bMLS\b/i],
  ['NWSL',                        /\bNWSL\b/i],
  ['Premier League',              /premier league/i],
  ['Liga MX',                     /liga mx/i],
  ['NASCAR Xfinity Series',       /xfinity series/i],
  ['NASCAR Cup Series',           /\bNASCAR\b|daytona 500|coke zero|brickyard/i],
  ['IndyCar',                     /\bindycar\b|indy 500/i],
  ['LPGA Golf',                   /\bLPGA\b/i],
  ['PGA Golf',                    /\bPGA\b|the masters|masters golf|open championship|ryder cup/i],
  ['Tennis',                      /wimbledon|\btennis\b|australian open|french open|roland garros/i],
  ['Horse Racing',                /kentucky derby|preakness|belmont stakes|breeders'? cup|horse racing/i],
  ['UFL',                         /\bUFL\b/i],
  ['College Softball',            /college softball|women'?s college world series/i],
  ["Women's College Volleyball",  /college volleyball|women'?s volleyball/i],
  ['WWE',                         /\bWWE\b|wrestlemania|royal rumble|summerslam/i],
  ['Unrivaled',                   /\bunrivaled\b/i]
];

const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The measured reach for a moment, or null when the deck cannot speak to it. */
export function reachOf(m) {
  if (m.cat !== 'Sports') return null;
  for (const [league, re] of LEAGUE) {
    if (!re.test(m.name)) continue;
    const months = REACH[league];
    if (!months) return null;
    const mon = MON3[Number(String(m.start).slice(5, 7)) - 1];
    const pct = months[mon];
    return Number.isFinite(pct) ? { league, month: mon, pct } : null;
  }
  return null;
}

export function scaleOf(m) {
  const r = reachOf(m);
  if (r) return Math.max(0, Math.min(100, Math.round(100 * Math.pow(r.pct / REACH_MAX, 0.6))));

  let s = CAT_SCALE[m.cat] ?? 50;
  for (const [re, v] of TENTPOLE) if (re.test(m.name)) { s = Math.max(s, v); break; }
  if (MAJORS.test(m.plat || '') || MAJORS.test(m.src || '')) s += 6;
  if (m.type === 'Evergreen') s += 4;               // returns every year, so it is known
  return Math.max(0, Math.min(100, s));
}

/* ACTIONABILITY. Can a plan actually enter this moment? A named distributor is
   a door; a declared sponsorship is an open one. A moment with neither is
   something you talk around, not something you buy. */
export function actionabilityOf(m) {
  let a = 30;
  if (m.plat) a += 28;
  if (m.spons) a += 26;
  if (m.pas && m.pas.length) a += 10;
  if (m.type === 'Evergreen') a += 12;              // a repeating moment can be planned a year out
  return Math.max(0, Math.min(100, a));
}

/* TIMING. Straight off the sheet's own Date Confirmation column, which is the
   most honest field in the file. A window is plannable; a year is a placeholder
   that means December 31st; TBD cannot be flighted against at all. */
const TIMING = { 'Confirmed Date': 100, 'Confirmed Window': 80, 'Confirmed Year': 45, 'TBD': 15 };
export function timingOf(m) { return TIMING[m.conf] ?? 40; }

/* An entity override has to match a WHOLE WORD, not a substring. The first cut
   tested `new RegExp(key, 'i')`, and "CES" duly matched the "ces" inside
   "Academy of Motion Picture Arts and Sciences" — which handed the Oscars a
   190 tech index and made them the single most relevant moment of the year for
   an audience that does not watch them. A three-letter key against 491 free-
   text names will always find something; the boundaries are not optional.

   Left as a named function rather than inlined because it is the piece most
   likely to need a test the day a real entity list arrives. */
export function entityHits(key, m) {
  const re = new RegExp('(^|[^A-Za-z0-9])' + key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^A-Za-z0-9]|$)', 'i');
  return re.test(m.name) || re.test(m.src || '') || re.test(m.plat || '');
}

/* AFFINITY. Category index first, then any entity override that matches the
   moment's name or its source — an override is a sharper read, so it wins.

   The index is on a 100 base, and real cuts cluster hard: almost everything
   lands between 70 and 160, with only a handful of true passions above that.
   A straight rescale (index/200) maps that cluster into 35–80 and throws away
   most of the separation, so the curve below stretches the middle instead —
   100 sits at 50, and each 50 points of index is worth roughly 22 points of
   score until it saturates. An index of 100 means "no different from the
   population", and the model should treat it as exactly the midpoint. */
export function affinityOf(m, aud) {
  let idx = aud.aff[m.cat] ?? 100;

  /* AN AUDIENCE BUILT FROM THE RESEARCH CUT GETS THE ORDERED READ.

     data/entity-map.js lists the survey's 88 entities most-specific-first, so
     the first pattern that matches a moment is the sharpest thing the study
     has to say about it: "NFL Draft" rather than "NFL". Taking the highest of
     every match instead — which is what the free-text path below does — would
     quietly promote each moment to whichever of its readings flattered it
     most. That is not a sharper read, it is a thumb on the scale.

     Only audiences whose `ent` came out of the cut can be read this way,
     because only they are keyed on the map. Anything typed or pasted by a
     user falls through to the scan, where there is no order to trust. */
  const mapped = aud.measured ? entityFor(m) : null;
  if (mapped && aud.ent && aud.ent[mapped] != null) {
    idx = aud.ent[mapped];
  } else {
    for (const [key, v] of Object.entries(aud.ent || {})) {
      if (entityHits(key, m)) idx = Math.max(idx, v);
    }
  }
  /* Logistic on log-index, centred on 100. Monotonic, saturating at both ends,
     and steepest exactly where the data actually sits. */
  const t = Math.log(Math.max(20, idx) / 100) / Math.log(2);   // octaves above/below par
  return Math.max(0, Math.min(100, 100 / (1 + Math.exp(-2.1 * t))));
}

/* CONGESTION. How much else is fighting for the same week — everything, at
   quarter weight, plus same-category moments at full weight, because a
   category rival costs you more than a moment in a different world. Scaled so
   a typical week sits low and the Christmas fortnight sits high. */
export function congestionIndex(moments) {
  const byWeek = new Map();
  for (const m of moments) {
    const k = weekKey(m.start);
    if (!byWeek.has(k)) byWeek.set(k, []);
    byWeek.get(k).push(m);
  }
  const idx = new Map();
  for (const m of moments) {
    const peers = byWeek.get(weekKey(m.start)) || [];
    const same = peers.filter(p => p.cat === m.cat).length - 1;
    const other = peers.length - 1 - same;
    idx.set(m.id, Math.max(0, Math.min(100, (same * 9 + other * 2.2))));
  }
  return idx;
}

export function weekKey(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  const day = (d.getUTCDay() + 6) % 7;                 // Monday = 0
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}

/* ---------- the score ---------- */

import { SPORTS_REACH, REACH_SOURCE } from './sports-reach.js';
import { entityFor } from './entity-map.js';

export { REACH_SOURCE };
export const WEIGHTS = { aff: 0.50, scale: 0.20, act: 0.15, tim: 0.15 };
export const CONGESTION_MAX = 0.25;

/* Four bands, not a number. A planner does not act on 71 versus 68 — they act
   on "this is an anchor" versus "this is a thing we watch". The names are the
   decision the band asks for.

     ANCHOR  build a campaign beat on it
     PLAY    buy into it with what already exists
     WATCH   worth knowing, not worth a line item
     SKIP    say out loud that we are not doing it                            */
export const BANDS = [
  { id: 'anchor', label: 'Anchor', min: 72, color: '#0B7A67', note: 'Build a beat on it.' },
  { id: 'play',   label: 'Play',   min: 56, color: '#1A67D2', note: 'Buy in with what exists.' },
  { id: 'watch',  label: 'Watch',  min: 40, color: '#946200', note: 'Know about it. No line item.' },
  { id: 'skip',   label: 'Skip',   min: 0,  color: '#5C6279', note: 'Say out loud we are not doing it.' }
];
export const bandOf = s => BANDS.find(b => s >= b.min) || BANDS[BANDS.length - 1];

/* `aud` may be one audience or several. One is the ordinary case and behaves
   exactly as it always did; several combines their affinities by `mode` and
   keeps each one's own figure on the result, because a blended number nobody
   can take apart is precisely the kind of number this model refuses to
   produce. */
export function scoreMoments(moments, aud, mode) {
  const auds = Array.isArray(aud) ? aud.filter(Boolean) : [aud];
  const weights = auds.map(sizeOf);
  const cong = congestionIndex(moments);
  return moments.map(m => {
    const each = auds.map(a => ({ id: a.id, name: a.name, value: affinityOf(m, a) }));
    const combined = combineAffinity(each.map(e => e.value), weights, mode || 'blend');
    const parts = {
      aff:   combined.value,
      scale: scaleOf(m),
      act:   actionabilityOf(m),
      tim:   timingOf(m),
      cong:  cong.get(m.id) ?? 0
    };
    const base = parts.aff * WEIGHTS.aff + parts.scale * WEIGHTS.scale
               + parts.act * WEIGHTS.act + parts.tim * WEIGHTS.tim;
    const score = Math.round(base * (1 - (parts.cong / 100) * CONGESTION_MAX));
    return {
      ...m, parts, score, band: bandOf(score),
      affBy: each.length > 1 ? each : null,
      affWeighted: combined.weighted
    };
  });
}

/* The unclaimed moment. Not the highest score — the highest affinity sitting in
   the quietest week, which is a different and more interesting question, and
   the one stage 6.2 actually asks. */
export function unclaimed(scored) {
  return [...scored]
    .filter(m => m.parts.aff >= 55 && m.parts.tim >= 80)
    .sort((a, b) => (b.parts.aff - b.parts.cong * 1.4) - (a.parts.aff - a.parts.cong * 1.4))
    .slice(0, 6);
}

/* ============================================================
   MORE THAN ONE AUDIENCE
   ============================================================

   Only affinity combines. The other four components are facts about the
   moment — its scale, whether there is a way in, how firm the date is, how
   loud that week is — and they do not change because a second audience is
   selected. That falls straight out of the model's central rule and is what
   keeps a multi-audience score comparable with a single-audience one.

   Three ways to combine, because they answer three different briefs and a
   planner means a different thing each time:

     BLEND    the combined audience. A size-weighted mean, which is literally
              what a target audience made of two groups is. The default.
     OVERLAP  the lowest of them. "Where does ONE buy serve all of them?" —
              a moment only survives if every selected audience cares.
     ANY      the highest of them. "Where do we reach at least one of them
              well?" — the reach brief rather than the efficiency one.

   Blend needs sizes, and a user-defined audience may not have given one.
   Rather than invent a weight, an incomplete set falls back to an unweighted
   mean and says so — `weighted: false` travels with the result so the UI can
   report it instead of quietly implying a precision it does not have. */

export const MODES = [
  { id: 'blend',   label: 'Blend',   note: 'The combined audience — size-weighted.' },
  { id: 'overlap', label: 'Overlap', note: 'Only what works for every one of them.' },
  { id: 'any',     label: 'Any',     note: 'What works for at least one of them.' }
];

/* "31.4M" -> 31400000. Returns null for anything it cannot read, which is the
   signal to stop weighting rather than to guess a number. */
export function sizeOf(a) {
  const m = /^\s*([\d.,]+)\s*([kmb])?/i.exec(String((a && a.size) || ''));
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  const mult = { k: 1e3, m: 1e6, b: 1e9 }[(m[2] || '').toLowerCase()] || 1;
  return n * mult;
}

export function combineAffinity(values, weights, mode) {
  if (!values.length) return { value: 0, weighted: false };
  if (values.length === 1) return { value: values[0], weighted: false };
  if (mode === 'overlap') return { value: Math.min(...values), weighted: false };
  if (mode === 'any') return { value: Math.max(...values), weighted: false };

  const usable = weights && weights.length === values.length && weights.every(w => w > 0);
  if (!usable) {
    return { value: values.reduce((s, v) => s + v, 0) / values.length, weighted: false };
  }
  const total = weights.reduce((s, w) => s + w, 0);
  return {
    value: values.reduce((s, v, i) => s + v * weights[i], 0) / total,
    weighted: true
  };
}
