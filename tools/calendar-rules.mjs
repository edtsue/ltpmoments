/* Turning a calendar RULE into a date.

   This file is the whole reason the sports fill is allowed to use Gemini at
   all. The rule in this codebase is that Gemini writes language and the model
   asserts numbers, and a date is a number — the most consequential one on a
   planning calendar, since everything downstream is positioned by it.

   So Gemini is never asked for a date. It is asked which milestone exists and
   what the RULE for it is: "the second Saturday of December", "two Sundays
   before the Super Bowl". A rule is language. This file turns it into a date,
   and because the arithmetic happens here it can be tested, which a model's
   arithmetic cannot.

   A milestone whose date cannot be reduced to one of these rules is dropped
   rather than guessed at. That is the point: the 2027 NFL schedule is not
   published until May 2027, so anything depending on it is not knowable, and a
   plausible-looking guess is worse on a planning board than an absence.       */

const DAY = 86400000;
const iso = d => d.toISOString().slice(0, 10);
const utc = (y, m, d) => new Date(Date.UTC(y, m, d));

export const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july',
                'august', 'september', 'october', 'november', 'december'];

const asWeekday = v => {
  if (typeof v === 'number') return v >= 0 && v <= 6 ? v : null;
  const i = WEEKDAYS.indexOf(String(v || '').toLowerCase().trim());
  return i < 0 ? null : i;
};
const asMonth = v => {
  if (typeof v === 'number') return v >= 1 && v <= 12 ? v - 1 : null;
  const i = MONTHS.indexOf(String(v || '').toLowerCase().trim());
  return i < 0 ? null : i;
};

/** The nth given weekday of a month. n < 0 counts back from the end, so -1 is
 *  "the last Monday in May". Returns null when the month has no nth such day —
 *  a fifth Saturday does not always exist, and inventing one would silently
 *  move the date into the following month. */
export function nthWeekday(year, month, weekday, n) {
  const m = asMonth(month), w = asWeekday(weekday);
  if (m === null || w === null || !Number.isInteger(n) || n === 0) return null;

  if (n > 0) {
    const first = utc(year, m, 1);
    const shift = (w - first.getUTCDay() + 7) % 7;
    const day = 1 + shift + (n - 1) * 7;
    const last = new Date(Date.UTC(year, m + 1, 0)).getUTCDate();
    return day > last ? null : iso(utc(year, m, day));
  }
  const lastDay = new Date(Date.UTC(year, m + 1, 0)).getUTCDate();
  const last = utc(year, m, lastDay);
  const back = (last.getUTCDay() - w + 7) % 7;
  const day = lastDay - back + (n + 1) * 7;
  return day < 1 ? null : iso(utc(year, m, day));
}

/** US Thanksgiving: the fourth Thursday of November. Named because so much of
 *  the American sporting and retail calendar is defined relative to it. */
export const thanksgiving = year => nthWeekday(year, 11, 'thursday', 4);

/* The rule shapes that can be evaluated. Anything else is refused. */
const KINDS = new Set(['fixed', 'nth-weekday', 'relative-to-thanksgiving', 'relative-to-date']);

/**
 * @param {object} rule  as returned by the model, never trusted
 * @param {object} opts  { year, anchors }  anchors maps a name -> ISO date,
 *                       and only dates already CONFIRMED in the calendar
 *                       should be passed in as anchors.
 * @returns {{date: string|null, why: string}}
 */
export function evaluateRule(rule, opts) {
  const { year, anchors = {} } = opts || {};
  if (!rule || !KINDS.has(rule.kind)) {
    return { date: null, why: `unknown rule kind ${JSON.stringify(rule && rule.kind)}` };
  }

  if (rule.kind === 'fixed') {
    const m = asMonth(rule.month);
    const d = Number(rule.day);
    if (m === null || !Number.isInteger(d) || d < 1 || d > 31) {
      return { date: null, why: 'fixed rule needs a real month and day' };
    }
    const last = new Date(Date.UTC(year, m + 1, 0)).getUTCDate();
    if (d > last) return { date: null, why: `${MONTHS[m]} has no day ${d}` };
    return { date: iso(utc(year, m, d)), why: `${MONTHS[m]} ${d}, fixed every year` };
  }

  if (rule.kind === 'nth-weekday') {
    const n = Number(rule.n);
    const date = nthWeekday(year, rule.month, rule.weekday, n);
    if (!date) return { date: null, why: 'that weekday does not occur that many times in the month' };
    const ord = n < 0 ? (n === -1 ? 'last' : `${-n}th from last`) : ['', '1st', '2nd', '3rd', '4th', '5th'][n] || `${n}th`;
    return { date, why: `the ${ord} ${String(rule.weekday).toLowerCase()} of ${MONTHS[asMonth(rule.month)]}` };
  }

  if (rule.kind === 'relative-to-thanksgiving') {
    const t = thanksgiving(year);
    const off = Number(rule.days);
    if (!Number.isInteger(off) || Math.abs(off) > 30) {
      return { date: null, why: 'offset from Thanksgiving must be a whole number of days within a month' };
    }
    return {
      date: iso(new Date(Date.parse(t + 'T00:00:00Z') + off * DAY)),
      why: `${off === 0 ? 'on' : `${Math.abs(off)} day${Math.abs(off) === 1 ? '' : 's'} ${off > 0 ? 'after' : 'before'}`} Thanksgiving (${t})`
    };
  }

  /* relative-to-date: an offset in whole weeks from a date ALREADY CONFIRMED in
     the calendar. This is how the NFL playoff rounds are derived — the Super
     Bowl is a confirmed date in the sheet, and the rounds before it sit at a
     fixed number of weeks back. If the anchor is not one we hold as confirmed,
     the rule is refused rather than resolved against a guess. */
  const anchor = anchors[String(rule.anchor || '').toLowerCase().trim()];
  if (!anchor) {
    return { date: null, why: `no confirmed anchor called ${JSON.stringify(rule.anchor)}` };
  }
  const weeks = Number(rule.weeks);
  if (!Number.isInteger(weeks) || Math.abs(weeks) > 52) {
    return { date: null, why: 'offset from an anchor must be a whole number of weeks' };
  }
  let out = new Date(Date.parse(anchor + 'T00:00:00Z') + weeks * 7 * DAY);
  /* An optional weekday snaps the result, so "three weeks before the Super
     Bowl, on the Saturday" resolves without a second rule shape. */
  const w = rule.weekday == null ? null : asWeekday(rule.weekday);
  if (rule.weekday != null && w === null) return { date: null, why: 'unknown weekday' };
  if (w !== null) out = new Date(out.getTime() - ((out.getUTCDay() - w + 7) % 7) * DAY);
  return {
    date: iso(out),
    why: `${Math.abs(weeks)} week${Math.abs(weeks) === 1 ? '' : 's'} ${weeks < 0 ? 'before' : 'after'} ${rule.anchor} (${anchor})`
  };
}
