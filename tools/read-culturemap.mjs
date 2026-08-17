/* The 2027 Culture Map, read into the same record shape the CSV produces.

   A second source, not a second calendar. The map covers a layer the working
   sheet barely touches — public holidays, heritage and awareness months,
   national days, the civic year — while the sheet covers the supply side:
   tours, premieres, release dates, rights. Merged, they are one year.

   THE MAP IS PROVISIONAL AND SAYS SO. Its own footer: fixed-calendar holidays
   and known 2027 confirmations are accurate, everything else carries 2026
   dates as placeholders and is flagged `tba`. Two consequences drive this
   file:

     · a flagged date is imported as `conf: 'TBD'`, which the relevance model
       already scores at 15 against 100 for a confirmed one. A provisional
       date can then never pass itself off as a plannable one, and

     · for anything that is not annual, a 2026 date carried into 2027 does not
       describe a real event at all. The Winter Olympics do not happen in
       2027. Those are excluded by name below, and the near misses are
       reported for a human rather than guessed at.                          */

import { readFileSync } from 'node:fs';

/* Events the map lists for 2027 that will not happen in 2027. Each one is its
   2026 (or 2025) dates carried forward by the placeholder rule. This list is
   the reason the import is not a straight copy. */
const NOT_IN_2027 = {
  'Winter Olympics': 'Milano-Cortina was Feb 2026; next Winter Games 2030',
  'Winter Paralympics': 'Mar 2026; next 2030',
  'World Baseball Classic': 'Mar 2026; runs every four years, next 2030',
  'NHL 4 Nations Face-Off': 'a Feb 2025 one-off, not an annual fixture',
  /* Its 6/11–7/19 is the 2026 tournament to the day. The sheet already holds
     that one, correctly dated to 2026. */
  'FIFA World Cup': 'Jun–Jul 2026 in North America; next 2030'
};

/* One event, two names. The generic rule that merges these — "the shorter name
   is contained in the longer" — also merges Christmas into NBA Christmas Games
   and the Grammys into the D.I.C.E Awards, so the asymmetric cases are named
   here instead. Each was checked by hand against the sheet.

   The right-hand side is the name already in the calendar, whether it came from
   the sheet or from an earlier row of the map itself. */
const SAME_AS = {
  'Masters Golf': 'The Masters',
  'Oscars': 'Oscars / Academy Awards',
  'WNBA Draft Broadcast': 'WNBA Draft',
  'Final Four Women': "NCAA Women's Final Four",
  'CMA Music Festival': 'CMA Fest',
  /* Both of these are the map's own rows, filed under two pillars. */
  'Columbus/Indigenous Peoples Day': 'Indigenous Peoples Day'
};

/* Anything cyclical enough that a carried-over date deserves a second look.
   Reported, never dropped on a guess — the four above were checked by hand and
   this is how the next one gets found. */
const CYCLE_WATCH = /olympic|paralympic|world cup|world classic|ryder cup|commonwealth|pan am|asian games|solheim|presidents cup|america'?s cup/i;

const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const lastDay = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
const pad = n => String(n).padStart(2, '0');

/* The map writes dates for people, not machines: "1/1", "4/21–4/29",
   "12/31/26", "1/9 TBA", "Sep TBA", "All Feb". Everything without its own year
   is 2027, which is the year the map is for. */
export function readDate(raw) {
  const t = String(raw || '').replace(/\bTB[AC]\b/gi, '').trim();
  if (!t) return null;

  /* A whole month — an awareness month, or an event known to the month only.
     That is a window, and it is imported as one. */
  const mo = /^(?:all\s+)?([a-z]{3,9})$/i.exec(t);
  if (mo) {
    const i = MON.indexOf(mo[1].slice(0, 3).toLowerCase());
    if (i < 0) return null;
    return { start: `2027-${pad(i + 1)}-01`, end: `2027-${pad(i + 1)}-${lastDay(2027, i)}`, month: true };
  }

  const parts = t.split(/[–—]|(?<=\d)-(?=\d)/).map(s => s.trim()).filter(Boolean);
  const one = p => {
    const m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(p);
    if (!m) return null;
    const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : 2027;
    return `${y}-${pad(+m[1])}-${pad(+m[2])}`;
  };

  const start = one(parts[0]);
  if (!start) return null;
  let end = parts[1] ? one(parts[1]) : null;
  /* "4/21–29" — the second half drops the month it shares with the first. */
  if (!end && parts[1] && /^\d{1,2}$/.test(parts[1])) end = `${start.slice(0, 8)}${pad(+parts[1])}`;
  if (end && end < start) end = start;      // "12/31–1/2" crosses a year end
  return { start, end: end || start, month: false };
}

/* Twelve pillars into twelve categories. Five of the map's pillars have no
   counterpart, and two of them are not really pillars at all — "Entertainment"
   holds music festivals beside film festivals beside comedy, and "Wellness"
   holds marathons beside fashion week beside awareness months. Those two route
   on the event rather than on its pillar.

   Where the working sheet has already made a call, the call is followed rather
   than re-litigated: it files Sundance under Fashion & Awards, marathons under
   Sports, and music festivals under Tours & Concerts. One calendar should not
   hold two opinions about where a film festival goes. */
const FILM = /film fest|film festival|cannes|sundance|tribeca|glasgow|telluride film/i;
const MUSIC = /edm|electric|coachella|stagecoach|lollapalooza|gov ball|governors ball|bonnaroo|hangout|forest|wonderland|jazz|iheart|cma|country music|music fest|jingle ball|roots picnic|outloud/i;
const FASHION = /fashion week|met gala|frieze|art basel/i;
const RACE = /marathon|half marathon|triathlon|10k|5k|ironman|ragnar/i;
const AWARENESS = /awareness|heritage month|history month|health month|pride month|hobby month/i;
const AWARDS = /awards|premio|premios|oscars|grammys|emmys|globes/i;

function categoryOf(ev) {
  const n = ev.name;

  switch (ev.pillar) {
    case 'Sports': return 'Sports';
    case 'Gaming': return 'Gaming';
    case 'TV': return 'TV & Streaming';
    case 'Movies': return 'Movies';
    case 'Tech': return 'Tech';
    case 'Holidays': return 'Holidays';
    case 'LGBTQ': case 'Multicultural': return 'Heritage & Identity';
    case 'National Days': return AWARENESS.test(n) ? 'Heritage & Identity' : 'National Days';

    case 'Broadcast':
      if (AWARDS.test(n)) return 'Fashion & Awards';
      return 'TV & Streaming';

    case 'Entertainment':
      if (MUSIC.test(n)) return 'Tours & Concerts';
      if (FILM.test(n)) return 'Fashion & Awards';
      if (AWARDS.test(n)) return 'Fashion & Awards';
      return 'Culture';

    case 'Wellness':
      if (FASHION.test(n)) return 'Fashion & Awards';
      if (RACE.test(n)) return 'Sports';
      if (AWARENESS.test(n)) return 'Heritage & Identity';
      if (MUSIC.test(n)) return 'Tours & Concerts';
      return 'Culture';

    default: return 'Culture';
  }
}

/**
 * @param {string} path  the exported Culture Map HTML
 * @returns {{moments: object[], excluded: object[], watch: object[], unparsed: object[]}}
 */
export function readCultureMap(path) {
  const html = readFileSync(path, 'utf8');
  const open = html.indexOf('const EVENTS = [');
  if (open === -1) throw new Error('no EVENTS array in ' + path);
  const close = html.indexOf('\n];', open);
  if (close === -1) throw new Error('EVENTS array is not terminated in ' + path);
  const events = JSON.parse(html.slice(open + 'const EVENTS = '.length, close + 3).trim().replace(/;$/, ''));

  const moments = [], excluded = [], watch = [], unparsed = [];

  for (const ev of events) {
    const name = String(ev.name || '').replace(/\s+/g, ' ').trim();
    if (!name) continue;

    const why = NOT_IN_2027[name];
    if (why) { excluded.push({ name, why }); continue; }

    const d = readDate(ev.date);
    if (!d) { unparsed.push({ name, date: ev.date }); continue; }

    if (ev.tba && CYCLE_WATCH.test(name)) watch.push({ name, date: ev.date });

    moments.push({
      name,
      cat: categoryOf(ev),
      start: d.start,
      end: d.end,
      /* The map's own flag, carried straight through to the timing term. A
         placeholder date scores 15; a month-wide one is a window; only a date
         the map states as fixed for 2027 is treated as fixed. */
      conf: ev.tba ? 'TBD' : (d.month ? 'Confirmed Window' : 'Confirmed Date'),
      /* "Returns every year, so it is known" is exactly what a fixed-calendar
         holiday is — but only where the map is confident of the 2027 date. A
         placeholder is not evidence of anything, least of all recurrence. */
      type: !ev.tba && (d.month || ev.pillar === 'Holidays' || ev.pillar === 'National Days')
        ? 'Evergreen'
        : 'Singular Event',
      src: '',
      plat: '',
      pas: [],
      notes: String(ev.description || '').replace(/\s+/g, ' ').trim(),
      spons: '',
      single: false,
      cc: false,
      from: 'culturemap',
      /* Only set where a human has matched the two names. The merge step reads
         it, and drops it from the record it keeps. */
      sameAs: SAME_AS[name]
    });
  }

  return { moments, excluded, watch, unparsed };
}
