/* The response model, the research cut behind it, and the joins between the
   two. Run: node --test tools/response.test.mjs
 *
 * Weighted toward the failures this build actually hit rather than toward
 * coverage for its own sake — every test below except the arithmetic ones is
 * a bug that was in the tree and shipped nothing.                          */

import test from 'node:test';
import assert from 'node:assert/strict';

import { YOUGOV, YOUGOV_SOURCE } from '../data/yougov.js';
import { ENTITY_MAP, entityFor } from '../data/entity-map.js';
import { topicFor, TOPIC_MAP } from '../data/topic-map.js';
import { channelsFor, PROPERTY_CHANNELS } from '../data/channel-map.js';
import { MOMENTS } from '../data/moments.js';
import { OFFICIAL, AUDIENCES } from '../data/audiences.js';
import { MODELS, modelById, coverage, DEFAULT_MODEL } from '../data/models.js';
import {
  curve, participationScore, fandomOf, reachabilityOf, receptivityOf,
  feasibilityOf, quadrantOf, hasResponseData, scoreMomentsResponse, RESPONSE_WEIGHTS
} from '../data/response.js';

const m = name => MOMENTS.find(x => x.name === name);
const AUD = Object.fromEntries(OFFICIAL.map(a => [a.id, a]));

/* ---------- the cut ---------- */

test('the four PA targets each carry their own size, not the panel’s', () => {
  const sizes = YOUGOV.map(a => a.sizeN);
  assert.equal(new Set(sizes).size, 4,
    'all four came out the same size — the panel share was read off one column');
  for (const a of YOUGOV) assert.ok(a.sizeN > 1e6 && a.sizeN < 2e8, `${a.id}: ${a.sizeN}`);
});

test('a conditional bank is re-based, a panel bank is left alone', () => {
  /* Sport interest was put to the whole panel, so the rebuilt index has to
     reproduce the sheet's printed one. The correction is only allowed to bite
     where the universe actually differed. */
  const a = YOUGOV.find(x => x.id === 'search26');
  assert.ok(Math.abs(a.ent['FIFA Football World Cup'] - 146.7) < 1,
    `panel bank moved: ${a.ent['FIFA Football World Cup']} vs the sheet's 146.7`);
  assert.ok(YOUGOV_SOURCE.conditional.includes('Sponsorship actions taken'),
    'the sponsorship battery was not recognised as conditional');
});

test('a lane with no battery is null, never par', () => {
  /* Par and "not asked" are different claims. A 100 here would say the
     audience is exactly averagely interested in national days, which nobody
     established. */
  for (const a of YOUGOV) {
    for (const cat of ['Holidays', 'National Days', 'Heritage & Identity']) {
      assert.equal(a.aff[cat], null, `${a.id} has a number for ${cat}`);
    }
    assert.ok(a.aff['Sports'] > 0, `${a.id} has no sports index`);
  }
});

/* ---------- the joins ---------- */

test('every entity key in the map exists in the cut', () => {
  const have = new Set(Object.keys(YOUGOV[0].ent));
  const missing = ENTITY_MAP.map(e => e[0]).filter(k => !have.has(k));
  assert.deepEqual(missing, [], 'the map names rows the sheet does not have');
});

test('every sub-topic in the map exists in the cut', () => {
  const have = new Set(Object.keys(YOUGOV[0].topic));
  const missing = [...new Set(Object.values(TOPIC_MAP).flat().map(r => r[0]))].filter(k => !have.has(k));
  assert.deepEqual(missing, [], 'the topic map names genres the sheet does not have');
});

test('every channel in the map exists in the cut', () => {
  const have = new Set(Object.keys(YOUGOV[0].reach));
  const missing = [...new Set(Object.values(PROPERTY_CHANNELS).flat().map(c => c[0]))].filter(k => !have.has(k));
  assert.deepEqual(missing, [], 'the channel map names networks the sheet does not have');
});

test('the specific reading wins over the general one', () => {
  /* The survey holds both "NFL" and "NFL Draft" and they are 26 index points
     apart for Search. Taking the highest match rather than the first would
     promote every moment to whichever reading flattered it. */
  assert.equal(entityFor(m('NFL Draft')), 'NFL Draft');
  assert.equal(entityFor(m('NFL Combine')), 'NFL Combine');
  assert.equal(entityFor(m('Super Bowl LXI')), 'Super Bowl');
  assert.equal(entityFor({ name: 'NFL Week 1: Patriots At Seahawks', src: '', plat: '' }), 'NFL');
});

test('a whole word, or no match at all', () => {
  /* The original of this bug matched "CES" inside "Sciences" and made the
     Oscars the most relevant moment of the year to tech buyers. */
  assert.equal(entityFor({ name: 'Academy of Motion Picture Arts and Sciences', src: '', plat: '' }), null);
  assert.equal(entityFor({ name: 'Unrivaled League Begins', src: '', plat: '' }), null);
});

test('a world series that is not the World Series', () => {
  assert.equal(entityFor(m("NCAA Men's College World Series")), 'College World Series Baseball');
  assert.equal(entityFor(m('Little League World Series')), 'MLB');
  assert.equal(entityFor(m('MLB Playoffs & World Series')), 'MLB World Series');
  assert.equal(entityFor(m('World Series of Poker Final')), null, 'poker is not baseball');
});

test('the women’s draw reads the women’s row', () => {
  assert.equal(entityFor(m('March Madness Women')), "Division 1 Women's College Basketball");
  assert.equal(entityFor(m('March Madness Men')), 'March Madness');
});

test('the playoff and the season are different rows', () => {
  assert.equal(entityFor(m('CFB Semifinals')), 'College Football Playoff');
  assert.equal(entityFor(m('College Football Season Kickoff')), 'Division 1 Football');
});

test('a channel mix is found at the sharpest rung available', () => {
  assert.equal(channelsFor(m('NBA Finals'), entityFor(m('NBA Finals'))).rung, 'property');
  const tv = MOMENTS.find(x => x.cat === 'TV & Streaming' && /netflix/i.test(x.plat || ''));
  assert.equal(channelsFor(tv, entityFor(tv)).rung, 'distributor');
  const bare = MOMENTS.find(x => x.cat === 'Holidays' && !x.plat && !x.src);
  if (bare) assert.equal(channelsFor(bare, null).rung, 'category');
});

/* ---------- the arithmetic ---------- */

test('par maps to par, and the curve is monotonic', () => {
  assert.equal(Math.round(curve(100)), 50);
  assert.ok(curve(200) > curve(140));
  assert.ok(curve(140) > curve(100));
  assert.ok(curve(100) > curve(70));
  assert.ok(curve(1e6) <= 100 && curve(0) >= 0);
});

test('participation saturates rather than running away', () => {
  assert.equal(participationScore(0), 0);
  assert.ok(participationScore(0.5) === 100);
  assert.ok(participationScore(0.9) === 100, 'past the ceiling it should hold, not exceed');
  assert.ok(participationScore(0.25) < participationScore(0.4));
});

/* ---------- the terms ---------- */

test('fandom reports the rung it was read at', () => {
  const a = AUD.yttv2544;
  assert.match(fandomOf(m('NBA Finals'), a).rung, /entity/);
  const sub = MOMENTS.find(x => x.cat === 'Movies' && topicFor(x) && !entityFor(x));
  assert.match(fandomOf(sub, a).rung, /sub-topic/);
  const holiday = MOMENTS.find(x => x.cat === 'National Days');
  assert.equal(fandomOf(holiday, a).value, null, 'a lane with no battery must not score');
});

test('volume anchors the index at every rung, not just the entity one', () => {
  /* Without this, a niche the audience indexes hugely on outranks a
     mainstream passion — and three of the four boards came out led by the
     same block of releases. */
  const a = AUD.search26;
  const f = fandomOf(MOMENTS.find(x => x.cat === 'Gaming' && !entityFor(x)), a);
  assert.ok(f.part > 0, 'a category-rung read came back with no participation term');
  assert.ok(['category', 'sub-topic'].includes(f.partRung));
});

test('reachability is crossed with how many are really on the channel', () => {
  const a = AUD.search26;
  const r = reachabilityOf(m('NBA Finals'), a);
  assert.ok(r.share > 0 && r.share < 1);
  assert.equal(r.crossed, false, 'this cut cannot cross by fandom and must say so');
});

test('receptivity is a property of the audience, not of the moment', () => {
  const a = AUD.yttv2544;
  assert.equal(receptivityOf(a).value, receptivityOf(a).value);
  const one = scoreMomentsResponse([m('NBA Finals')], [a], 'blend')[0];
  const two = scoreMomentsResponse([m('The Masters')], [a], 'blend')[0];
  assert.equal(one.parts.rcp, two.parts.rcp);
});

test('feasibility carries the moment-side terms and nothing else', () => {
  const f = feasibilityOf(m('NBA Finals'), 0);
  assert.ok(f.tim > 0 && f.act > 0 && f.quiet === 100);
  assert.ok(feasibilityOf(m('NBA Finals'), 100).value < f.value, 'a loud week must cost something');
});

test('high relevance with no way in reads as find a door', () => {
  assert.equal(quadrantOf(80, 30).id, 'door');
  assert.equal(quadrantOf(80, 90).id, 'anchor');
  assert.equal(quadrantOf(20, 90).id, 'easy');
  assert.equal(quadrantOf(20, 30).id, 'skip');
});

/* ---------- the score ---------- */

test('a missing term redistributes its weight rather than scoring zero', () => {
  /* A national day has no fandom reading in this cut. Scoring it as though
     the audience were indifferent would be a finding nobody made. */
  const a = AUD.search26;
  const s = scoreMomentsResponse([MOMENTS.find(x => x.cat === 'National Days')], [a], 'blend')[0];
  assert.equal(s.parts.fan, null);
  assert.ok(s.score > 0, 'the moment dropped to nothing instead of scoring on what there is');
  const byHand = (s.parts.rch * RESPONSE_WEIGHTS.rch + s.parts.rcp * RESPONSE_WEIGHTS.rcp)
               / (RESPONSE_WEIGHTS.rch + RESPONSE_WEIGHTS.rcp);
  assert.equal(s.score, Math.round(byHand));
});

test('an audience with no research cut is not scored at par', () => {
  /* Par would look exactly like an answer. This is the failure the whole
     "no cut" marking exists to prevent, carried over to the new model. */
  const est = AUDIENCES[0];
  assert.equal(hasResponseData(est), false);
  const s = scoreMomentsResponse([m('NBA Finals')], [est], 'blend')[0];
  assert.equal(s.score, null);
  assert.equal(s.noData, true);
});

test('two audiences blend on size, and say whether they did', () => {
  const s = scoreMomentsResponse([m('NBA Finals')], [AUD.search26, AUD.yttv2544], 'blend')[0];
  assert.equal(s.affWeighted, true);
  assert.equal(s.affBy.length, 2);
  const solo = [AUD.search26, AUD.yttv2544].map(a =>
    scoreMomentsResponse([m('NBA Finals')], [a], 'blend')[0].score);
  assert.ok(s.score >= Math.min(...solo) && s.score <= Math.max(...solo),
    'a blend landed outside both of the things it blended');
});

test('overlap takes the lowest and any takes the highest', () => {
  const pair = [AUD.gemini26, AUD.yttv2544];
  const lo = scoreMomentsResponse([m('NBA Finals')], pair, 'overlap')[0].score;
  const hi = scoreMomentsResponse([m('NBA Finals')], pair, 'any')[0].score;
  assert.ok(hi > lo, `overlap ${lo} should sit below any ${hi}`);
});

/* ---------- the registry ---------- */

test('the default model can score every audience on the rail', () => {
  const def = modelById(DEFAULT_MODEL);
  for (const a of [...OFFICIAL, ...AUDIENCES]) {
    assert.ok(def.supports(a), `${a.id} cannot be scored by the default model`);
  }
});

test('coverage counts what the model can actually speak for', () => {
  const resp = modelById('response');
  const c = coverage(resp, [AUD.search26, AUDIENCES[0]]);
  assert.equal(c.ok, 1);
  assert.equal(c.total, 2);
  assert.equal(c.missing[0].id, AUDIENCES[0].id);
});

test('every model declares a full set of parts, bands and shades', () => {
  for (const model of MODELS) {
    assert.ok(model.parts.length >= 3, `${model.id} has too few parts`);
    const weighted = model.parts.filter(p => p.weight);
    const sum = weighted.reduce((s, p) => s + p.weight, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9, `${model.id} weights sum to ${sum}`);
    for (const p of model.parts.filter(p => !p.weight)) {
      assert.ok(p.note, `${model.id}: unweighted part "${p.name}" has no note to draw instead`);
    }
    assert.ok(model.parts.some(p => p.key === model.driver), `${model.id}: driver is not one of its parts`);
    /* The ramp has to descend and reach the floor, or a low-scoring moment
       falls through it and gets drawn at whatever the last step was. */
    const mins = model.shades.map(s => s.min);
    assert.deepEqual(mins, [...mins].sort((a, b) => b - a), `${model.id}: shade ramp is out of order`);
    assert.equal(mins[mins.length - 1], 0, `${model.id}: shade ramp has no floor`);
    const cuts = model.bands.map(b => b.min);
    assert.deepEqual(cuts, [...cuts].sort((a, b) => b - a), `${model.id}: bands are out of order`);
    assert.equal(cuts[cuts.length - 1], 0, `${model.id}: bands have no floor`);
  }
});
