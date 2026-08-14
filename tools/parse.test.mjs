/* node --test tools/parse.test.mjs
   The parser is the one piece a user hands untrusted data to, so it gets real
   tests rather than a smoke render. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAudienceData, matchCategory, CATEGORIES } from '../data/parse.js';

test('matches the obvious names', () => {
  assert.equal(matchCategory('Sports'), 'Sports');
  assert.equal(matchCategory('TV & Streaming'), 'TV & Streaming');
  assert.equal(matchCategory('  movies  '), 'Movies');
  assert.equal(matchCategory('Video Games'), 'Gaming');
  assert.equal(matchCategory('Award Shows'), 'Fashion & Awards');
});

test('longest alias wins, so live music is not Music', () => {
  assert.equal(matchCategory('Live Music'), 'Tours & Concerts');
  assert.equal(matchCategory('Music'), 'Music');
});

test('a label matches on whole words, never a substring', () => {
  // "tech" inside "biotech" must not reach Tech, the same rule the relevance
  // model's entity keys are held to.
  assert.equal(matchCategory('Biotechnology'), null);
  assert.equal(matchCategory('Consumer Tech'), 'Tech');
});

test('reads a comma-separated export', () => {
  const r = parseAudienceData('Sports,145\nMusic,88\nGaming,162');
  assert.deepEqual(r.aff, { Sports: 145, Music: 88, Gaming: 162 });
  assert.equal(r.missing.length, CATEGORIES.length - 3);
});

test('reads a tab-separated paste out of a spreadsheet', () => {
  const r = parseAudienceData('Sports\t145\nTV & Streaming\t110');
  assert.equal(r.aff['Sports'], 145);
  assert.equal(r.aff['TV & Streaming'], 110);
});

test('reads colons, pipes and dashes', () => {
  const r = parseAudienceData('Sports: 145\nMovies | 92\nGaming — 130');
  assert.deepEqual(r.aff, { Sports: 145, Movies: 92, Gaming: 130 });
});

test('keeps the separators inside a category name', () => {
  const r = parseAudienceData('Tours / Concerts, 150\nFashion & Awards: 121');
  assert.equal(r.aff['Tours & Concerts'], 150);
  assert.equal(r.aff['Fashion & Awards'], 121);
});

test('strips a percent sign and thousands separators', () => {
  const r = parseAudienceData('Sports, 145%\nMovies, 1,020');
  assert.equal(r.aff['Sports'], 145);
  assert.equal(r.aff['Movies'], 1020);
});

test('a column of multipliers is read as a multiplier of par', () => {
  const r = parseAudienceData('Sports,1.45\nMusic,0.88\nGaming,1.62');
  assert.equal(r.asMultiplier, true);
  assert.deepEqual(r.aff, { Sports: 145, Music: 88, Gaming: 162 });
});

test('a column with a real index in it is not rescaled', () => {
  const r = parseAudienceData('Sports,145\nMusic,0.9');
  assert.equal(r.asMultiplier, false);
  assert.equal(r.aff['Sports'], 145);
});

test('an unmatched label with a number becomes an entity override', () => {
  const r = parseAudienceData('Sports,145\nTaylor Swift,182\nFIFA,170');
  assert.equal(r.aff['Sports'], 145);
  assert.deepEqual(r.entities, { 'Taylor Swift': 182, FIFA: 170 });
  assert.equal(r.unmatched.length, 2);
});

test('the first mention of a category wins', () => {
  const r = parseAudienceData('Sports,145\nSports,90');
  assert.equal(r.aff['Sports'], 145);
});

test('lines with no number are reported, not silently dropped', () => {
  const r = parseAudienceData('Audience: women 18-34\nSports,145');
  assert.equal(r.aff['Sports'], 145);
  assert.ok(r.ignored.length >= 1);
});

test('a category the input never mentions is missing, not defaulted', () => {
  const r = parseAudienceData('Sports,145');
  assert.ok(r.missing.includes('Movies'));
  assert.equal(r.aff['Movies'], undefined);
});

test('empty input is empty, not a crash', () => {
  const r = parseAudienceData('');
  assert.deepEqual(r.aff, {});
  assert.equal(r.missing.length, CATEGORIES.length);
  assert.equal(r.asMultiplier, false);
});

test('handles negative and malformed numbers without throwing', () => {
  const r = parseAudienceData('Sports,-12\nMusic,abc\nGaming,');
  assert.equal(r.aff['Sports'], -12);
  assert.equal(r.aff['Music'], undefined);
});

/* ---------- buildAudience ---------- */
import { buildAudience } from '../data/parse.js';

const CATS = CATEGORIES;

test('fills unmentioned categories with par and says which', () => {
  const a = buildAudience({ name: 'Test', aff: { Sports: 145 } }, CATS, []);
  assert.equal(a.aff['Sports'], 145);
  assert.equal(a.aff['Movies'], 100);
  assert.equal(a.atPar.length, CATS.length - 1);
  assert.match(a.read, /1 of 10 categories set/);
});

test('every category present, always', () => {
  const a = buildAudience({ name: 'Test', aff: {} }, CATS, []);
  assert.deepEqual(Object.keys(a.aff).sort(), [...CATS].sort());
});

test('makes a slug id and avoids collisions', () => {
  const a = buildAudience({ name: 'Women 18–34' }, CATS, []);
  assert.equal(a.id, 'women1834');
  const b = buildAudience({ name: 'Women 18–34' }, CATS, ['women1834']);
  assert.equal(b.id, 'women18342');
  const c = buildAudience({ name: 'Women 18–34' }, CATS, ['women1834', 'women18342']);
  assert.equal(c.id, 'women18343');
});

test('a name with no usable characters still yields an id', () => {
  const a = buildAudience({ name: '???' }, CATS, []);
  assert.equal(a.id, 'audience');
});

test('refuses an unnamed audience', () => {
  assert.throws(() => buildAudience({ name: '   ' }, CATS, []), /needs a name/);
});

test('a zero index is kept, not treated as missing', () => {
  const a = buildAudience({ name: 'T', aff: { Sports: 0 } }, CATS, []);
  assert.equal(a.aff['Sports'], 0);
  assert.ok(!a.atPar.includes('Sports'));
});

test('parse then build round-trips', () => {
  const p = parseAudienceData('Sports,145\nGaming,162\nTaylor Swift,180');
  const a = buildAudience({ name: 'Cut A', aff: p.aff, ent: p.entities }, CATS, []);
  assert.equal(a.aff['Sports'], 145);
  assert.equal(a.aff['Gaming'], 162);
  assert.equal(a.aff['Holidays'], 100);
  assert.deepEqual(a.ent, { 'Taylor Swift': 180 });
  assert.equal(a.custom, true);
});

/* ---------- combining several audiences ---------- */
import { combineAffinity, sizeOf, MODES } from '../data/relevance.js';

test('reads a size the way a rail writes one', () => {
  assert.equal(sizeOf({ size: '31.4M' }), 31400000);
  assert.equal(sizeOf({ size: '2.4K' }), 2400);
  assert.equal(sizeOf({ size: '1,200' }), 1200);
  assert.equal(sizeOf({ size: '48.9m' }), 48900000);
});

test('an unreadable or missing size is null, never a guess', () => {
  assert.equal(sizeOf({ size: '' }), null);
  assert.equal(sizeOf({}), null);
  assert.equal(sizeOf({ size: 'lots' }), null);
  assert.equal(sizeOf({ size: '0' }), null);
});

test('one audience combines to itself whatever the mode', () => {
  for (const m of MODES) assert.equal(combineAffinity([72], [1e6], m.id).value, 72);
});

test('overlap takes the lowest — only what works for all of them', () => {
  assert.equal(combineAffinity([80, 40, 60], null, 'overlap').value, 40);
});

test('any takes the highest — what works for at least one', () => {
  assert.equal(combineAffinity([80, 40, 60], null, 'any').value, 80);
});

test('blend weights by size', () => {
  // 90 at 3x the weight of 50 sits at 80, not at the midpoint 70.
  const r = combineAffinity([90, 50], [3e6, 1e6], 'blend');
  assert.equal(r.value, 80);
  assert.equal(r.weighted, true);
});

test('blend falls back to an unweighted mean when a size is missing, and says so', () => {
  const r = combineAffinity([90, 50], [3e6, null], 'blend');
  assert.equal(r.value, 70);
  assert.equal(r.weighted, false);   // the UI reports this rather than implying precision
});

test('no audiences is zero, not a crash', () => {
  assert.equal(combineAffinity([], [], 'blend').value, 0);
});

test('the three modes genuinely disagree', () => {
  const v = [88, 41];
  const got = MODES.map(m => combineAffinity(v, null, m.id).value);
  assert.equal(new Set(got).size, 3);
});
