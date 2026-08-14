/* Turning whatever the user drops in into an audience.

   The data that defines an audience arrives as a two-column thing — a label and
   a number — and it arrives from a dozen places: a CSV export, a cell range
   copied out of Sheets, a block of text typed by hand. So the parser is
   deliberately loose about SHAPE and strict about MEANING: it will take commas,
   tabs, colons, pipes, em-dashes or runs of spaces as a separator, but a line
   only counts once its label has been matched to a real category or kept
   explicitly as an entity.

   What it never does is guess a number. A category the input does not mention
   comes back unmatched and stays at par in the UI, where the user can see the
   gap and fill it. Silently defaulting a missing category to 100 would be the
   same class of mistake as a hallucinated affinity — an invented input that
   drives the whole tool and leaves no trace.                                  */

export const CATEGORIES = [
  'Sports', 'Music', 'Tours & Concerts', 'TV & Streaming', 'Movies',
  'Gaming', 'Holidays', 'Fashion & Awards', 'Tech', 'Culture'
];

/* The names people actually type. Matched on normalised tokens, longest first,
   so "live music" reaches Tours & Concerts rather than Music. */
const ALIASES = {
  'Sports':           ['sports', 'sport', 'live sports', 'athletics'],
  'Music':            ['music', 'album', 'albums', 'album releases', 'music releases', 'recorded music'],
  'Tours & Concerts': ['tours concerts', 'tours', 'concerts', 'touring', 'live music', 'gigs', 'festivals', 'concert'],
  'TV & Streaming':   ['tv streaming', 'tv', 'television', 'streaming', 'svod', 'series', 'shows'],
  'Movies':           ['movies', 'movie', 'film', 'films', 'cinema', 'theatrical', 'box office'],
  'Gaming':           ['gaming', 'games', 'video games', 'game', 'esports', 'egaming'],
  'Holidays':         ['holidays', 'holiday', 'seasonal', 'seasonality'],
  'Fashion & Awards': ['fashion awards', 'fashion', 'awards', 'award shows', 'red carpet', 'awards shows'],
  'Tech':             ['tech', 'technology', 'consumer tech', 'devices', 'gadgets'],
  'Culture':          ['culture', 'cultural', 'events', 'conventions', 'events conventions', 'news']
};

const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/* Longest alias first so "live music" is tested before "music". */
const LOOKUP = Object.entries(ALIASES)
  .flatMap(([cat, list]) => list.map(a => [norm(a), cat]))
  .sort((a, b) => b[0].length - a[0].length);

export function matchCategory(label) {
  const n = norm(label);
  if (!n) return null;
  for (const [alias, cat] of LOOKUP) if (n === alias) return cat;
  for (const [alias, cat] of LOOKUP) {
    /* Whole-word containment, never a bare substring — the same rule the
       relevance model's entity keys are held to, and for the same reason. */
    if (new RegExp(`(^| )${alias}( |$)`).test(n)) return cat;
  }
  return null;
}

/* A line is split on the run of separator characters that still leaves a whole
   number on the right, so "Tours / Concerts, 150" keeps its slash and
   "TV & Streaming: 110" keeps its ampersand.

   A bare hyphen is NOT a separator. It was, and "Sports,-12" came back as
   positive 12 — the hyphen was consumed as punctuation and the minus sign
   vanished, which silently turns an audience that avoids a category into one
   that is merely par on it. Dashes people actually use as separators are the
   em and en dash, and a hyphen with spaces around it; both are normalised to a
   tab first, so the character class never has to contain one. */
const LINE = /^(.*?)[\s,;:|]+(-?\d[\d,]*(?:\.\d+)?)\s*%?$/;
const splitLine = t => LINE.exec(t.replace(/[—–]/g, '\t').replace(/ - /g, '\t'));

/* Prose that happens to end in a number is not a data row. "Audience: women
   18-34" used to arrive as an entity override called "Audience: women 18-" —
   an invented input, which is the same failure as a hallucinated one. An
   entity is a name: a few words, and at least one letter. */
const looksLikeAName = s => /[A-Za-z]/.test(s) && s.trim().split(/\s+/).length <= 5;

export function parseAudienceData(text) {
  const aff = {};
  const entities = {};
  const unmatched = [];
  const ignored = [];
  const seen = new Set();

  const raw = String(text || '').split(/\r?\n/);
  const values = [];

  const rows = [];
  for (const line of raw) {
    const t = line.trim();
    if (!t) continue;
    const m = splitLine(t);
    if (!m) { if (t.length < 120) ignored.push(t); continue; }
    const label = m[1].replace(/^["']|["']$/g, '').trim();
    const value = Number(m[2].replace(/,/g, ''));
    if (!label || !Number.isFinite(value)) { ignored.push(t); continue; }
    rows.push({ label, value });
    values.push(value);
  }

  /* SCALE. An index is on a 100 base, but people paste multipliers (1.45) and
     they paste percentages (14.5%). If nothing in the column exceeds 5 the
     column cannot be an index — an audience that under-indexes at 5 does not
     exist — so it is read as a multiplier of par. Anything else is taken at
     face value. Reported back, so the guess is visible rather than silent. */
  const max = values.length ? Math.max(...values.map(Math.abs)) : 0;
  const asMultiplier = values.length > 0 && max <= 5;
  const scale = v => asMultiplier ? Math.round(v * 100) : Math.round(v);

  for (const { label, value } of rows) {
    const cat = matchCategory(label);
    const v = scale(value);
    if (cat) {
      if (seen.has(cat)) continue;      // first mention wins
      seen.add(cat);
      aff[cat] = v;
    } else if (looksLikeAName(label)) {
      /* Not a category, but a label with a number beside it — a franchise, an
         artist, a league. That is exactly the shape of an entity override, so
         it is offered as one rather than thrown away. */
      entities[label] = v;
      unmatched.push({ label, value: v });
    } else {
      ignored.push(label);
    }
  }

  return {
    aff,
    entities,
    unmatched,
    ignored,
    asMultiplier,
    matched: [...seen],
    missing: CATEGORIES.filter(c => !seen.has(c))
  };
}

/* Turning a filled-in panel into an audience record.

   Pure, and separate from the panel, because this is where the rules live:
   which numbers are real, what fills the gaps, and what the record says about
   its own provenance. A rule that only exists inside a click handler is a rule
   that never gets tested. */
export function buildAudience(draft, categories, takenIds) {
  const name = String(draft.name || '').trim();
  if (!name) throw new Error('an audience needs a name');

  /* Par fills the gaps HERE, at the last moment, rather than at parse time —
     so the panel can go on showing which numbers were read and which were
     never mentioned right up until the audience is saved. */
  const aff = {};
  const atPar = [];
  for (const c of categories) {
    const v = draft.aff ? draft.aff[c] : undefined;
    if (Number.isFinite(v)) aff[c] = v;
    else { aff[c] = 100; atPar.push(c); }
  }

  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 12) || 'audience';
  let id = base, n = 2;
  const taken = new Set(takenIds || []);
  while (taken.has(id)) id = base + (n++);

  const read = categories.length - atPar.length;
  return {
    id,
    name,
    def: String(draft.def || '').trim() || 'Added in this browser. No definition given.',
    size: String(draft.size || '').trim(),
    aff,
    ent: { ...(draft.ent || {}) },
    custom: true,
    /* What the numbers rest on, kept with them. A cut with no provenance is
       exactly what this tool exists to make impossible. */
    read: read === 0
      ? 'no categories set — every one at par'
      : `${read} of ${categories.length} categories set, ${atPar.length} left at par`,
    atPar
  };
}
