/* node --test tools/calendar-rules.test.mjs

   The arithmetic Gemini is not allowed to do. Every case here is a date that
   can be checked against a real calendar, which is the whole argument for
   asking the model for a rule instead of a date. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nthWeekday, thanksgiving, evaluateRule } from './calendar-rules.mjs';

/* ---------- nthWeekday ---------- */

test('the nth weekday of a month', () => {
  // 1 December 2026 is a Tuesday, so the first Saturday is the 5th.
  assert.equal(nthWeekday(2026, 'december', 'saturday', 1), '2026-12-05');
  assert.equal(nthWeekday(2026, 'december', 'saturday', 2), '2026-12-12');
});

test('counts back from the end of the month for a negative n', () => {
  // Memorial Day 2027: the last Monday in May.
  assert.equal(nthWeekday(2027, 'may', 'monday', -1), '2027-05-31');
  assert.equal(nthWeekday(2027, 'may', 'monday', -2), '2027-05-24');
});

test('returns null rather than spilling into the next month', () => {
  // February 2027 has only four Mondays; a fifth does not exist.
  assert.equal(nthWeekday(2027, 'february', 'monday', 5), null);
});

test('takes a month number as readily as a name', () => {
  assert.equal(nthWeekday(2026, 12, 'saturday', 2), nthWeekday(2026, 'december', 'saturday', 2));
});

test('US Thanksgiving is the fourth Thursday of November', () => {
  assert.equal(thanksgiving(2026), '2026-11-26');
  assert.equal(thanksgiving(2027), '2027-11-25');
});

/* ---------- evaluateRule ---------- */

const AT = { year: 2026, anchors: { 'super bowl': '2027-02-14' } };

test('a fixed date resolves and says so', () => {
  const r = evaluateRule({ kind: 'fixed', month: 'january', day: 1 }, { year: 2027 });
  assert.equal(r.date, '2027-01-01');
});

test('a fixed date that does not exist is refused', () => {
  const r = evaluateRule({ kind: 'fixed', month: 'february', day: 30 }, { year: 2027 });
  assert.equal(r.date, null);
});

test('Army-Navy: the second Saturday of December', () => {
  const r = evaluateRule({ kind: 'nth-weekday', month: 'december', weekday: 'saturday', n: 2 }, AT);
  assert.equal(r.date, '2026-12-12');
});

test('rivalry Saturday: two days after Thanksgiving', () => {
  const r = evaluateRule({ kind: 'relative-to-thanksgiving', days: 2 }, AT);
  assert.equal(r.date, '2026-11-28');
});

test('NFL conference championships: three Sundays before the Super Bowl', () => {
  // Super Bowl LXI is a confirmed 2027-02-14. The championship games are two
  // Sundays before it — the week between is the bye.
  const r = evaluateRule({ kind: 'relative-to-date', anchor: 'Super Bowl', weeks: -3 }, AT);
  assert.equal(r.date, '2027-01-24');
});

test('an anchor the calendar does not confirm is refused', () => {
  const r = evaluateRule({ kind: 'relative-to-date', anchor: 'The Big Game', weeks: -3 }, AT);
  assert.equal(r.date, null);
  assert.match(r.why, /no confirmed anchor/);
});

test('a weekday snaps the result backwards to that day', () => {
  // Two weeks before the Super Bowl, on the Saturday.
  const r = evaluateRule({ kind: 'relative-to-date', anchor: 'Super Bowl', weeks: -2, weekday: 'saturday' }, AT);
  assert.equal(r.date, '2027-01-30');
});

test('an unknown rule kind is refused, never guessed', () => {
  const r = evaluateRule({ kind: 'sometime in october' }, AT);
  assert.equal(r.date, null);
});

test('a rule with no kind at all is refused', () => {
  assert.equal(evaluateRule(null, AT).date, null);
  assert.equal(evaluateRule({}, AT).date, null);
});

test('a wild offset is refused rather than resolved', () => {
  assert.equal(evaluateRule({ kind: 'relative-to-date', anchor: 'Super Bowl', weeks: 900 }, AT).date, null);
  assert.equal(evaluateRule({ kind: 'relative-to-thanksgiving', days: 400 }, AT).date, null);
});
