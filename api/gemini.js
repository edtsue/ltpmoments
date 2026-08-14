/* Two jobs, one function.
 *
 *   read-cut     turn a messy research extract into label/value pairs
 *   read-moment  turn five computed components into a paragraph for a deck
 *
 * THE RULE THIS FILE EXISTS TO ENFORCE: Gemini writes language, the model
 * asserts numbers. If a generated number could reach a score, the tool loses
 * the one property that makes it defensible — that a planner can argue with a
 * number and say which component is wrong.
 *
 * So neither action is trusted on its word:
 *
 *   read-cut is EXTRACTION, never estimation. Every pair it returns must carry
 *   a verbatim quote from the submitted source, and both the number and the
 *   quote must actually appear in that source or the pair is dropped here.
 *   Gemini's entire job is to find the two columns hiding in the prose; the
 *   client then feeds those columns through the same tested parser a pasted
 *   CSV goes through, so there is exactly one path from a pair to a saved
 *   audience and Gemini cannot route around any of its checks.
 *
 *   read-moment gets its numbers in the prompt and is allowed to use those and
 *   no others. Every digit run in the reply is checked against the set we
 *   supplied; a stray one fails the call rather than reaching a deck.
 *
 * No dependencies, deliberately. A CJS module requiring an ESM subdependency
 * passes every local test and then 500s in production.
 *
 * Auth: middleware.js gates /api/* already, so a request without a valid
 * session never arrives here.
 */

'use strict';

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';
const API_KEY = process.env.GEMINI_KEY || process.env.GEMINI_API_KEY;

/* Extraction is a transcription task — it wants the lowest temperature the
   model will take and no thinking budget, because there is nothing to reason
   about. The read is prose a human will paste into a deck, so it gets room. */
const PLAN = {
  'read-cut':    { temperature: 0,    cap: 2200, think: false },
  'read-moment': { temperature: 0.45, cap: 320,  think: false }
};

const MAX_SOURCE = 24000;   // a bad paste should cost a 400, not a bill

const CATEGORIES = [
  'Sports', 'Music', 'Tours & Concerts', 'TV & Streaming', 'Movies',
  'Gaming', 'Holidays', 'Fashion & Awards', 'Tech', 'Culture'
];

/* ---------- schemas ---------- */

const CUT_SCHEMA = {
  type: 'object',
  properties: {
    pairs: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          value: { type: 'number' },
          quote: { type: 'string' }
        },
        required: ['label', 'value', 'quote']
      }
    },
    notes: { type: 'string' }
  },
  required: ['pairs']
};

const READ_SCHEMA = {
  type: 'object',
  properties: { read: { type: 'string' } },
  required: ['read']
};

/* ---------- prompts ---------- */

function cutPrompt(source) {
  return `You are reading a media research extract and pulling out the affinity numbers that are ALREADY IN IT.

You are transcribing, not estimating. This is the whole job.

RULES, in order of importance:
1. Return a number ONLY if that exact number appears in the source text. Never calculate one, never average, never infer from a description, never convert units. If the source says an audience "skews heavily to sport" with no number, that is NOT a pair — leave it out.
2. Every pair must carry a "quote": a verbatim, character-for-character substring of the source that contains the number. Do not tidy it, do not paraphrase it, do not fix its spelling. Maximum 140 characters.
3. Return the number exactly as written in the source. Do not turn 1.45 into 145, do not turn 62% into 62. The number goes back in the form it was found.
4. Omitting a category is correct and expected. A source that covers three categories should return three pairs. Never pad the list.

WHAT COUNTS AS A LABEL:
- One of these ten categories, if the source is talking about it: ${CATEGORIES.join(', ')}. Use the category name exactly as written here.
- Or the name of a specific thing with an affinity number beside it — an artist, a league, a franchise, a platform, a brand ("Taylor Swift", "NFL", "Nintendo"). Keep the name as the source writes it, five words maximum.

Ignore anything that is not an affinity or index figure: sample sizes, dates, page numbers, respondent counts, percentages of the total population, budget figures.

"notes" is one short sentence for the reader about what the source did or did not cover. Plain English, no numbers.

SOURCE TEXT:
"""
${source}
"""`;
}

function readPrompt(b) {
  const m = b.moment || {};
  const a = b.audience || {};
  const p = b.parts || {};
  return `Write the "why this moment" note a media planner will paste into a deck.

THE MOMENT
Name: ${m.name}
Category: ${m.cat}
Date: ${m.start}${m.end && m.end !== m.start ? ` to ${m.end}` : ''}
Date confidence: ${m.conf}
Distributor: ${m.plat || 'not recorded'}

THE AUDIENCE
${a.name}${a.def ? ` — ${a.def}` : ''}

WHAT THE MODEL SCORED, out of 100
Overall: ${b.score} (band: ${b.band})
Affinity ${Math.round(p.aff)} — does this audience care
Scale ${Math.round(p.scale)} — how many of them show up
Actionability ${Math.round(p.act)} — is there a way to buy in
Timing ${Math.round(p.tim)} — is the date firm enough to plan against
Congestion ${Math.round(p.cong)} — how much else lands that week

RULES:
- Two or three sentences. No preamble, no heading, no bullet points.
- You may only use the numbers listed above. Do not calculate new ones, do not add percentages, do not estimate reach or budget. If a sentence needs a number that is not above, write the sentence without it.
- Lead with the component that actually decides this moment — the highest one if it is carrying the score, the lowest one if it is what holds the moment back. Say which, plainly.
- Never invent a fact about the moment: no audience figures, no what-happened-last-year, no competitor names, no partnership suggestions. You know only what is written above.
- Write like a planner briefing a colleague. Flat, specific, no marketing adjectives, no "leverage", no "unlock", no "tap into".`;
}

/* ---------- the call ---------- */

const sleep = ms => new Promise(r => setTimeout(r, ms));
const rejectsThinking = new Set();

async function callGemini(action, prompt, schema) {
  const p = PLAN[action];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

  const gen = {
    temperature: p.temperature,
    maxOutputTokens: p.cap,
    responseMimeType: 'application/json',
    responseSchema: schema
  };
  if (!p.think && !rejectsThinking.has(MODEL)) gen.thinkingConfig = { thinkingBudget: 0 };

  let payload = { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: gen };
  let dropped = false;
  let last;

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await sleep(300 * Math.pow(3, attempt - 1));
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (r.ok) {
      const j = await r.json();
      const text = (j.candidates && j.candidates[0] && j.candidates[0].content &&
        j.candidates[0].content.parts || []).map(x => x.text).join('');
      try { return JSON.parse(text); }
      catch (e) { void e; throw new Error('Gemini returned something that was not JSON'); }
    }
    const body = await r.text().catch(() => '');

    /* Not every model lets you switch thinking off, and the one that refuses
       says only "invalid argument" without naming the field. The budget is an
       optimisation, never a requirement — drop it and try again rather than
       fail the call over it. Remembered, so a cold start pays this once. */
    if (r.status === 400 && !dropped && payload.generationConfig.thinkingConfig) {
      dropped = true;
      rejectsThinking.add(MODEL);
      const gc = Object.assign({}, payload.generationConfig);
      delete gc.thinkingConfig;
      payload = Object.assign({}, payload, { generationConfig: gc });
      console.warn('[gemini] model=%s rejects thinkingConfig; dropped', MODEL);
      continue;
    }
    last = Object.assign(new Error(`Gemini ${r.status}: ${body.slice(0, 240)}`), { status: r.status });
    if (r.status !== 429 && r.status !== 503) throw last;
  }
  throw last;
}

/* ---------- validation ---------- */

/* Whitespace is the only thing normalised. A quote that has been re-worded,
   re-punctuated or re-cased is not the source saying it — it is the model
   saying it, which is exactly what must not get through. */
const flat = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase();

/* The number as the source would have written it. 145 must match "145", and
   1.45 must match "1.45" — but 1.45 must NOT be matched by finding "145"
   somewhere, so the decimal form is tested as written.

   The boundaries are lookarounds rather than character classes, and the
   trailing one is the fiddly half. Written as `[^0-9.]` it rejected every
   number that ended a sentence — "Tours & Concerts reaches 168." failed
   because the character after 168 was a full stop. That is where numbers in
   prose usually sit, so the check would have thrown away most of the pairs it
   was supposed to be confirming, and the panel would have reported the model
   inventing figures it had read correctly. What must actually be excluded is a
   digit, or a decimal point or comma with a digit behind it. */
function numberInSource(value, src) {
  const forms = new Set();
  forms.add(String(value));
  if (Number.isInteger(value)) forms.add(value.toLocaleString('en-US'));   // 1,020
  else forms.add(String(value).replace(/^0\./, '.'));                      // .45
  for (const f of forms) {
    const lit = f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`(?<![0-9.,])${lit}(?![0-9])(?!\\.[0-9])(?!,[0-9])`).test(src)) return true;
  }
  return false;
}

function verifyPairs(pairs, source) {
  const src = flat(source);
  const kept = [];
  const rejected = [];
  const seen = new Set();

  for (const p of Array.isArray(pairs) ? pairs : []) {
    /* A schema-constrained reply should never contain a null or a bare string
       here, but "should never" is not a guard — an item that is not an object
       threw and took the whole extraction down with it. */
    if (!p || typeof p !== 'object') { rejected.push({ label: '', why: 'not a pair' }); continue; }
    const label = String(p.label || '').trim().slice(0, 60);
    const value = Number(p.value);
    const quote = String(p.quote || '').trim().slice(0, 200);

    if (!label || !Number.isFinite(value)) { rejected.push({ label, why: 'incomplete' }); continue; }
    if (!quote) { rejected.push({ label, why: 'no quote given' }); continue; }
    if (!flat(quote) || !src.includes(flat(quote))) {
      rejected.push({ label, value, why: 'quote is not in the source' });
      continue;
    }
    if (!numberInSource(value, source)) {
      rejected.push({ label, value, why: 'number is not in the source' });
      continue;
    }
    const k = label.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    kept.push({ label, value, quote });
  }
  return { kept, rejected };
}

/* Every digit run in the reply has to be one we handed it. Dates and the
   moment's own name legitimately carry digits ("Super Bowl LXI", "2027-02-14"),
   so those are allowed too — everything else is invention. */
function verifyRead(text, allowed) {
  const ok = new Set(allowed.map(n => String(n)));
  const found = String(text).match(/\d+(?:\.\d+)?/g) || [];
  return found.filter(n => !ok.has(n));
}

/* ---------- handler ---------- */

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Cookie');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!API_KEY) {
    return res.status(503).json({ error: 'Gemini is not configured on this deployment.' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { void e; body = {}; } }
  body = body || {};
  const action = String(body.action || '');

  try {
    if (action === 'read-cut') {
      const source = String(body.source || '').slice(0, MAX_SOURCE);
      if (source.trim().length < 20) {
        return res.status(400).json({ error: 'Paste the research text first — there is nothing to read yet.' });
      }
      const out = await callGemini(action, cutPrompt(source), CUT_SCHEMA);
      const { kept, rejected } = verifyPairs(out.pairs, source);
      return res.status(200).json({
        ok: true,
        pairs: kept,
        rejected,
        notes: String(out.notes || '').slice(0, 300)
      });
    }

    if (action === 'read-moment') {
      const p = body.parts || {};
      const m = body.moment || {};
      if (!m.name || !Number.isFinite(Number(body.score))) {
        return res.status(400).json({ error: 'No moment given.' });
      }
      /* The numbers it is allowed to say: the ones in the prompt, plus any
         digits already inside the moment's own name and dates. */
      const allowed = [
        Number(body.score),
        ...['aff', 'scale', 'act', 'tim', 'cong'].map(k => Math.round(Number(p[k]) || 0)),
        ...(`${m.name} ${m.start || ''} ${m.end || ''}`.match(/\d+(?:\.\d+)?/g) || [])
      ];

      let text = '';
      let stray = [];
      for (let i = 0; i < 2; i++) {
        const out = await callGemini(action, readPrompt(body), READ_SCHEMA);
        text = String(out.read || '').trim();
        stray = verifyRead(text, allowed);
        if (!stray.length) break;
        console.warn('[gemini] read-moment invented numbers: %s', stray.join(', '));
      }
      if (stray.length) {
        /* Two tries and it is still asserting figures nobody gave it. Say so
           rather than shipping the paragraph — a fabricated number in a client
           deck is the failure this whole file is built to prevent. */
        return res.status(422).json({
          error: 'The read came back with numbers that are not in the model. Not showing it.',
          stray
        });
      }
      return res.status(200).json({ ok: true, read: text });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    console.error('[gemini] %s failed: %s', action, e && e.message);
    return res.status(502).json({ error: String((e && e.message) || e).slice(0, 240) });
  }
};

/* Exported for the tests, which is the only reason they are not inlined. */
module.exports.verifyPairs = verifyPairs;
module.exports.verifyRead = verifyRead;
module.exports.numberInSource = numberInSource;
