/* TWO MODELS, ONE BOARD.

   The board can be read two ways and the difference is not cosmetic — it is a
   different answer to "what makes a moment relevant". Which is why this is a
   toggle at the top of the rail rather than a setting somewhere: it belongs
   next to the audience because it changes what the audience means.

     AFFINITY MODEL   what the tool has always run. Five components, one of
                      which varies by audience, four of which are facts about
                      the moment. Works for EVERY audience on the rail,
                      including the six estimated ones and anything a user
                      defines, so it is the model that keeps a board
                      comparable end to end. It is the default for that
                      reason and no other.

     RESPONSE MODEL   three components, every one of them a measured survey
                      response, with everything moment-side moved onto a
                      second feasibility axis. Sharper and better grounded —
                      and only available for the four audiences that have a
                      research cut behind them. On the other audiences it has
                      nothing to say and says so.

   This file is the registry the UI draws from. Everything here — the part
   names, the weights, the colours — is READ FROM THE MODELS THEMSELVES, so a
   weight changed in relevance.js or response.js moves the methodology note
   and the score panel with it. A methodology that is retyped is a methodology
   that starts describing a formula the board is not running.                */

import { WEIGHTS, CONGESTION_MAX, BANDS, scoreMoments as scoreAffinity } from './relevance.js';
import {
  RESPONSE_WEIGHTS, FEASIBILITY_WEIGHTS, RESPONSE_BANDS, QUADRANTS,
  scoreMomentsResponse, hasResponseData
} from './response.js';

/* THE SHADE RAMP — how a score turns into how solid a bar is drawn.

   Seven steps rather than four, because the bands are a decision and the
   shading is a reading aid: a planner scanning a year of 664 bars is asking
   "where is this dense" long before they ask "is this an Anchor". Hue says
   which category, shade says how relevant.

   IT IS PER MODEL, AND IT HAS TO BE. The steps are anchored on the band cuts,
   and the two models do not band alike — but more than that, they do not
   DISTRIBUTE alike. The response model has a floor under it that the affinity
   model does not: receptivity and reachability are largely constant for an
   audience, so a receptive, reachable audience starts every moment in the
   sixties. Read through the affinity ramp, YTTV's whole year came out in the
   top two shades and the encoding said nothing at all.

   What it is NOT is per audience. A ramp that restretched to each audience's
   own range would make two boards look alike that are not, and comparing two
   audiences is most of what this rail is for.                                */
export const MODELS = [
  {
    id: 'affinity',
    label: 'Affinity model',
    short: 'Affinity',
    tag: 'Works for every audience',
    /* One line, on the rail, under the toggle. It has to say what the model
       asks — not what it is called. */
    gist: 'Scores how much an audience cares, then discounts for how buyable and how crowded the moment is.',
    bands: BANDS,
    /* `driver` is the component the rest of the UI treats as "the audience's
       pull" — the congestion ribbon plots it, and the Gemini rail reports it.
       Naming it here rather than hard-coding `aff` is what lets the same
       drawing code serve both models. */
    driver: 'aff',
    weights: WEIGHTS,
    /* Unchanged from the single-model tool. These cuts were set by looking at
       a real board and are not derived from the bands — do not "tidy" them
       into the band numbers without looking at a board again. */
    shades: [
      { min: 76, fill: 100, dark: 34, lit: true,  label: '76+' },
      { min: 68, fill: 100, dark: 10, lit: true,  label: '68–75' },
      { min: 63, fill: 74,  dark: 0,  lit: false, label: '63–67' },
      { min: 59, fill: 50,  dark: 0,  lit: false, label: '59–62' },
      { min: 56, fill: 31,  dark: 0,  lit: false, label: '56–58' },
      { min: 48, fill: 18,  dark: 0,  lit: false, label: '48–55' },
      { min: 0,  fill: 9,   dark: 0,  lit: false, label: 'under 48' }
    ],
    parts: [
      { key: 'aff',   name: 'Affinity',      color: '#1A67D2', weight: WEIGHTS.aff,
        q: 'Does this audience care?',
        why: 'Category index for this audience, sharpened by any entity read.' },
      { key: 'scale', name: 'Scale',         color: '#0B7A67', weight: WEIGHTS.scale,
        q: 'How many of them show up?',
        why: 'How many of them actually show up.' },
      { key: 'act',   name: 'Actionability', color: '#946200', weight: WEIGHTS.act,
        q: 'Is there a door in?',
        why: 'Whether there is a door in — a distributor, a sponsorship.' },
      { key: 'tim',   name: 'Timing',        color: '#6D5DE0', weight: WEIGHTS.tim,
        q: 'Is the date firm enough to plan against?',
        why: "The sheet's own date confirmation." },
      { key: 'cong',  name: 'Congestion',    color: '#C5221F', weight: null,
        q: 'How loud is everything else that week?',
        why: 'Everything else fighting for the same week. A tax, not a term.',
        note: `−${Math.round(CONGESTION_MAX * 100)}% max` }
    ],
    score: (moments, auds, mode) => scoreAffinity(moments, auds, mode),
    /* Every audience on the rail can be scored, which is the whole argument
       for this model being the default. */
    supports: () => true
  },
  {
    id: 'response',
    label: 'Response model',
    short: 'Response',
    tag: 'Needs a research cut',
    gist: 'Scores only things the audience was actually asked — do they follow it, can we reach them there, will they welcome a brand.',
    bands: RESPONSE_BANDS,
    driver: 'fan',
    weights: RESPONSE_WEIGHTS,
    quadrants: QUADRANTS,
    feasWeights: FEASIBILITY_WEIGHTS,
    /* Shifted up and spread wider than the affinity ramp, because this model's
       scores sit higher and closer together — see the note above. */
    shades: [
      { min: 78, fill: 100, dark: 34, lit: true,  label: '78+' },
      { min: 72, fill: 100, dark: 10, lit: true,  label: '72–77' },
      { min: 67, fill: 74,  dark: 0,  lit: false, label: '67–71' },
      { min: 62, fill: 50,  dark: 0,  lit: false, label: '62–66' },
      { min: 56, fill: 31,  dark: 0,  lit: false, label: '56–61' },
      { min: 46, fill: 18,  dark: 0,  lit: false, label: '46–55' },
      { min: 0,  fill: 9,   dark: 0,  lit: false, label: 'under 46' }
    ],
    parts: [
      { key: 'fan',  name: 'Fandom',       color: '#1A67D2', weight: RESPONSE_WEIGHTS.fan,
        q: 'Do they follow this?',
        why: 'Measured interest in the property, blended with the category, weighted by how many of them take part.' },
      { key: 'rch',  name: 'Reachability', color: '#0B7A67', weight: RESPONSE_WEIGHTS.rch,
        q: 'Can we get to them there?',
        why: 'How heavily this audience uses the channels the moment actually lives on.' },
      { key: 'rcp',  name: 'Receptivity',  color: '#B3451E', weight: RESPONSE_WEIGHTS.rcp,
        q: 'Will they welcome a brand?',
        why: 'Whether they welcome advertising and whether they act on sponsorship. A fact about the audience, so it lifts a whole board rather than reordering one.' },
      { key: 'feas', name: 'Feasibility',  color: '#6D5DE0', weight: null,
        q: 'Is there a way in, and is the date real?',
        why: 'Date confirmation, inventory and week congestion. The second axis — it qualifies relevance rather than competing with it.',
        note: 'second axis' }
    ],
    score: (moments, auds, mode) => scoreMomentsResponse(moments, auds, mode),
    supports: hasResponseData
  }
];

export const DEFAULT_MODEL = 'affinity';
export const modelById = id => MODELS.find(m => m.id === id) || MODELS[0];

/* How many of the selected audiences a model can actually speak for. The
   toggle uses this to warn BEFORE the switch rather than drawing an empty
   board and leaving the reader to work out why. */
export function coverage(model, auds) {
  const list = (Array.isArray(auds) ? auds : [auds]).filter(Boolean);
  const ok = list.filter(a => model.supports(a));
  return { ok: ok.length, total: list.length, missing: list.filter(a => !model.supports(a)) };
}
