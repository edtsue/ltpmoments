/* node --test tools/gemini.test.mjs

   These test the only part of the Gemini layer that has to be right: the
   checks that stand between a generated number and a client deck. The prompts
   are not tested here — a prompt is an intention, and the whole point of this
   file is that the intention is not what the tool relies on. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { verifyPairs, verifyRead, numberInSource } = require('../api/gemini.js');

const SOURCE = `Cultural affinity, Women 18-34, urban.
Sports indexes at 82 against the general population.
Live music is the standout: Tours & Concerts reaches 168.
Gaming sits at 121, and TV & Streaming at 104.
Sample size 2,400 respondents fielded March 2026.`;

/* ---------- numberInSource ---------- */

test('finds a number that is written in the source', () => {
  assert.equal(numberInSource(82, SOURCE), true);
  assert.equal(numberInSource(168, SOURCE), true);
});

test('rejects a number that is not written in the source', () => {
  assert.equal(numberInSource(145, SOURCE), false);
  assert.equal(numberInSource(99, SOURCE), false);
});

test('does not find a number inside a longer number', () => {
  // "12" must not be found by matching inside "121".
  assert.equal(numberInSource(12, SOURCE), false);
  assert.equal(numberInSource(121, SOURCE), true);
});

test('matches a thousands-separated figure', () => {
  assert.equal(numberInSource(2400, SOURCE), true);
});

test('a decimal is matched as written, not by its digits', () => {
  const src = 'Sports over-indexes at 1.45x.';
  assert.equal(numberInSource(1.45, src), true);
  assert.equal(numberInSource(145, src), false);   // the digits are there; the number is not
});

/* ---------- verifyPairs ---------- */

const pair = (label, value, quote) => ({ label, value, quote });

test('keeps a pair whose number and quote are both in the source', () => {
  const { kept, rejected } = verifyPairs(
    [pair('Sports', 82, 'Sports indexes at 82 against the general population')], SOURCE);
  assert.equal(kept.length, 1);
  assert.equal(rejected.length, 0);
  assert.equal(kept[0].value, 82);
});

test('drops a number that is not in the source, however plausible', () => {
  const { kept, rejected } = verifyPairs(
    [pair('Movies', 115, 'Sports indexes at 82 against the general population')], SOURCE);
  assert.equal(kept.length, 0);
  assert.match(rejected[0].why, /number is not in the source/);
});

test('drops a paraphrased quote — a reworded quote is the model talking', () => {
  const { kept, rejected } = verifyPairs(
    [pair('Sports', 82, 'Sports index is 82 versus the general population')], SOURCE);
  assert.equal(kept.length, 0);
  assert.match(rejected[0].why, /quote is not in the source/);
});

test('tolerates whitespace and case differences in a quote', () => {
  const { kept } = verifyPairs(
    [pair('Gaming', 121, '  gaming   SITS at 121  ')], SOURCE);
  assert.equal(kept.length, 1);
});

test('drops a pair with no quote at all', () => {
  const { kept, rejected } = verifyPairs([pair('Sports', 82, '')], SOURCE);
  assert.equal(kept.length, 0);
  assert.match(rejected[0].why, /no quote/);
});

test('drops an incomplete pair rather than throwing', () => {
  const { kept, rejected } = verifyPairs(
    [{ label: 'Sports' }, { value: 82 }, null, 'nonsense'], SOURCE);
  assert.equal(kept.length, 0);
  assert.ok(rejected.length >= 2);
});

test('a non-array comes back empty, not thrown', () => {
  assert.deepEqual(verifyPairs(undefined, SOURCE).kept, []);
  assert.deepEqual(verifyPairs(null, '').kept, []);
});

test('de-duplicates on label, first mention winning', () => {
  const { kept } = verifyPairs([
    pair('Gaming', 121, 'Gaming sits at 121'),
    pair('gaming', 104, 'TV & Streaming at 104')
  ], SOURCE);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].value, 121);
});

test('reads a whole realistic extract end to end', () => {
  const { kept, rejected } = verifyPairs([
    pair('Sports', 82, 'Sports indexes at 82'),
    pair('Tours & Concerts', 168, 'Tours & Concerts reaches 168'),
    pair('Gaming', 121, 'Gaming sits at 121'),
    pair('TV & Streaming', 104, 'TV & Streaming at 104'),
    pair('Movies', 97, 'Movies index at 97')          // invented — not in the source
  ], SOURCE);
  assert.equal(kept.length, 4);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].label, 'Movies');
});

/* ---------- verifyRead ---------- */

test('passes a read that only uses the numbers it was given', () => {
  const allowed = [88, 91, 86, 74, 100, 12];
  assert.deepEqual(verifyRead('Scores 88 overall, carried by affinity at 91.', allowed), []);
});

test('catches a number nobody supplied', () => {
  const allowed = [88, 91];
  const stray = verifyRead('Scores 88, reaching 4.2 million viewers.', allowed);
  assert.deepEqual(stray, ['4.2']);
});

test('allows digits that are part of the moment name or its date', () => {
  // The handler builds this set by scraping the moment's own name and dates,
  // so "2027", "02" and "14" are legitimate in a sentence about Super Bowl LXI.
  const allowed = ['87', '91', '2027', '02', '14'];
  assert.deepEqual(verifyRead('Super Bowl LXI on 2027-02-14 scores 87.', allowed), []);
});

test('a read with no numbers at all is fine', () => {
  assert.deepEqual(verifyRead('Strong on affinity, weak on timing.', [88]), []);
});
