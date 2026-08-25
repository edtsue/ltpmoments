/* THE RESPONSE MODEL — relevance as measured audience response, and nothing
   else.

   The affinity model in relevance.js scores a moment on five things, one of
   which varies by audience and four of which are facts about the moment. It
   works, and for a board built on estimated audiences it is the honest shape.
   But it answers a slightly different question than the one a planner asks at
   stage 6.2, and it took a real research cut landing to make that visible.

   THE RULE THIS MODEL IS BUILT ON: every scored quantity is a measured survey
   response. Moment-side data selects WHICH responses to read; it never adds
   or subtracts points of its own. That single line is what makes the model
   coherent, and it is the test for whether a new term belongs — if a term
   would move the score without anybody having answered a question
   differently, it does not go in the score.

     FANDOM        Do they follow this?         weight .50
     REACHABILITY  Can we get to them there?    weight .30
     RECEPTIVITY   Will they welcome a brand?   weight .20

   WHAT CAME OUT OF THE SCORE, AND WHY THAT IS AN IMPROVEMENT. Timing,
   inventory and week congestion are not audience responses — nobody was asked
   about them — so under the rule above they cannot be terms. They become a
   second axis, FEASIBILITY, and the two cross into a matrix. The moment an
   audience loves with no way in stops quietly sinking to the middle of the
   board and starts reading as "find a door", which is a partnership brief for
   stage 6.3 rather than a moment you never noticed you had dropped.

   WHY THE AVERAGES ARE GEOMETRIC AND THE MIXES ARE ARITHMETIC. An index is
   ratio data: 200 is twice as much as 100 and par has to map to par exactly,
   which only a geometric mean guarantees. Reach is not — two channels that
   each reach a third of the audience genuinely add up, so the channel mix is
   an ordinary weighted mean before the curve is applied.

   WHAT THIS CUT CANNOT DO, SAID OUT LOUD. The design asks for reachability
   among the people who are FANS of the moment, not among the whole audience.
   That needs a conditional cross the export does not carry, so reachability
   here is channel usage across the whole audience. It over-credits a moment
   whose channel is popular with the audience generally and unpopular with the
   part of it that cares. `crossed: false` travels with every result rather
   than living in a footnote.                                                 */

import { YOUGOV } from './yougov.js';
import { entityFor } from './entity-map.js';
import { topicFor } from './topic-map.js';
import { channelsFor } from './channel-map.js';
import { timingOf, actionabilityOf, congestionIndex, sizeOf, combineAffinity } from './relevance.js';

export const RESPONSE_WEIGHTS = { fan: 0.50, rch: 0.30, rcp: 0.20 };

/* Feasibility is a second axis, not a fourth term. Its shares are its own and
   deliberately do not sum with the three above. */
export const FEASIBILITY_WEIGHTS = { tim: 0.45, act: 0.40, quiet: 0.15 };

/* The curve every index passes through. Logistic on the log of the index,
   centred so that 100 — "no different from the population" — lands on exactly
   50. Monotonic, saturating at both ends, and steepest where real indices
   actually sit. Shared with the affinity model on purpose: two models that
   disagree about what an index of 140 is worth cannot be compared at all. */
export function curve(idx) {
  const t = Math.log(Math.max(20, idx) / 100) / Math.log(2);
  return Math.max(0, Math.min(100, 100 / (1 + Math.exp(-2.1 * t))));
}

/* Participation, on the same 0-100 scale. Half the audience taking part is
   full marks and the 0.6 exponent lifts the middle, exactly as the sports
   reach term does — a share is a long thin distribution and a score is not. */
const P_FULL = 0.5;
export function participationScore(p) {
  if (!(p > 0)) return 0;
  return Math.max(0, Math.min(100, 100 * Math.pow(Math.min(1, p / P_FULL), 0.6)));
}

/* Which audiences this model can speak for. An audience with no YouGov cut
   has no measured responses, so it cannot be scored here at all — and the
   right answer is to say so, not to fall back to par. A par board looks like
   an answer, which is the worst thing an empty one can look like. */
const BY_ID = new Map(YOUGOV.map(a => [a.id, a]));
export const hasResponseData = a => !!(a && BY_ID.has(a.id));
export const responseDataFor = a => BY_ID.get(a && a.id) || null;

/* ---------- fandom ---------- */

/* THREE RUNGS, BLENDED RATHER THAN SWITCHED BETWEEN.

     entity     the survey asked about this exact property — "NFL Draft"
     sub-topic  it asked about this kind of thing — "Fighting", "Horror"
     category   it asked about the lane — Gaming, Movies

   The category is the reliable read and carries the majority; the sharper
   rung adjusts it. Switching outright to the sharp rung would make the score
   lurch between two moments that differ only in whether somebody thought to
   put one of them on a questionnaire.

   THE MIDDLE RUNG IS NOT OPTIONAL, AND LEAVING IT OUT PROVED IT. With only
   entity and category, every unmatched moment in a category scored exactly
   the same — two hundred films on one number — and the top of the board
   became whichever category the audience indexed highest. Search '26 and
   Gemini '26 then returned the SAME TOP TEN, sixty index points apart, which
   is the one failure this tool exists to prevent. See data/topic-map.js.

   The rung is REPORTED on every result. A moment scored on its category alone
   is a much weaker claim than one scored on a named property, and a model
   that will not say which it did cannot be argued with. */
const DEEP = 0.35;

export function fandomOf(m, aud) {
  const d = responseDataFor(aud);
  if (!d) return null;

  const broad = d.aff[m.cat];
  const key = entityFor(m);
  const top = key ? d.ent[key] : null;
  const topP = key ? d.entP[key] : null;

  const tKey = top == null ? topicFor(m) : null;
  const mid = tKey && d.topic ? d.topic[tKey] : null;
  const midP = tKey && d.topicP ? d.topicP[tKey] : null;

  const deep = top != null ? top : mid;
  const rungName = top != null ? 'entity' : (mid != null ? 'sub-topic' : 'category');

  /* Volume comes from the deepest rung that measured it, and the CATEGORY
     rung measures it too — so there is always a volume term unless the cut
     has nothing on the lane at all. This is the half of the spec that got
     dropped in the first cut, and dropping it let a niche the audience loves
     outrank a mainstream one it merely likes, on every board at once. */
  const part = topP != null ? topP : (midP != null ? midP : d.affP && d.affP[m.cat]);

  /* No rung has anything to say. Holidays, National Days and Heritage &
     Identity have no battery in this cut, and if the moment is not a named
     property or a recognised sub-topic either, then there is genuinely no
     measured response to read. */
  if (broad == null && deep == null) {
    return { value: null, rung: 'none', broad: null, deep: null, entity: key, topic: tKey };
  }

  const idx = (broad != null && deep != null) ? Math.pow(broad, 1 - DEEP) * Math.pow(deep, DEEP)
            : (deep != null ? deep : broad);

  /* Participation is only measured at the entity rung — the genre batteries
     say how an audience indexes, not how many of them turn up to a given
     moment. Without it the term falls back to the index alone rather than
     guessing a share, and says so through the rung. */
  const value = part != null && part > 0
    ? Math.pow(curve(idx), 1 - DEEP) * Math.pow(participationScore(part), DEEP)
    : curve(idx);

  return {
    value: Math.max(0, Math.min(100, value)),
    rung: broad != null && deep != null ? `${rungName} + category` : rungName,
    broad, deep, part, partRung: topP != null ? 'entity' : (midP != null ? 'sub-topic' : 'category'),
    entity: key, topic: tKey
  };
}

/* ---------- reachability ---------- */

export function reachabilityOf(m, aud) {
  const d = responseDataFor(aud);
  if (!d) return null;
  const { mix, rung } = channelsFor(m, entityFor(m));

  let num = 0, den = 0, pen = 0; const used = [];
  for (const [ch, w] of mix) {
    const i = d.reach[ch];
    if (i == null || !(w > 0)) continue;
    num += i * w; den += w;
    pen += ((d.reachP && d.reachP[ch]) || 0) * w;
    used.push([ch, i, (d.reachP && d.reachP[ch]) || 0]);
  }
  if (!den) return { value: null, rung: 'none', channels: [] };

  /* Arithmetic, then curved. Reach mixes arithmetically — see the note at the
     top — so the mean is taken on the indices and the curve is applied once
     to the result rather than to each channel in turn.

     AND THEN CROSSED WITH HOW MANY OF THEM ARE ACTUALLY THERE. An index of
     205 on a platform a fifth of the audience opens is not more reach than an
     index of 110 on one that two thirds of them open, and scoring on the
     index alone said it was — which put niche-but-fervent channels at the top
     of three boards out of four and made a moment's channel mix a popularity
     contest between subcultures. Same shape as the fandom term above, for the
     same reason: index leads, volume anchors. */
  const idx = num / den, share = pen / den;
  used.sort((a, b) => b[1] - a[1]);
  return {
    value: share > 0 ? Math.pow(curve(idx), 1 - DEEP) * Math.pow(participationScore(share), DEEP) : curve(idx),
    rung, index: idx, share, channels: used.slice(0, 4), crossed: false
  };
}

/* ---------- receptivity ---------- */

/* The one term with no moment in it. Whether an audience welcomes a brand
   turning up, and whether they do anything about it, are facts about the
   audience — so this shifts a whole board up or down rather than reordering
   it. That is not a bug to be engineered away: it is what makes two audiences'
   boards comparable, and it is why an audience that indexes 145 on responding
   to sponsorship is worth more per moment than one that indexes 104. */
export function receptivityOf(aud) {
  const d = responseDataFor(aud);
  if (!d || d.recep.value == null) return null;
  return {
    value: curve(d.recep.value),
    welcome: d.recep.welcome, respond: d.recep.respond, index: d.recep.value
  };
}

/* ---------- feasibility ---------- */

/* Everything that is true of the moment rather than of the audience. Same
   three inputs the affinity model folds into its score, doing a different job
   here: they no longer compete with relevance, they qualify it. */
export function feasibilityOf(m, cong) {
  const tim = timingOf(m);
  const act = actionabilityOf(m);
  const quiet = 100 - Math.max(0, Math.min(100, cong || 0));
  return {
    value: tim * FEASIBILITY_WEIGHTS.tim + act * FEASIBILITY_WEIGHTS.act + quiet * FEASIBILITY_WEIGHTS.quiet,
    tim, act, quiet
  };
}

/* The four squares. Names are the decision each one asks for, in the same
   spirit as the affinity model's bands — nobody acts on "68 by 54". */
export const QUADRANTS = [
  { id: 'anchor', label: 'Anchor',      color: '#0B7A67', note: 'They care and there is a way in. Build a beat on it.' },
  { id: 'door',   label: 'Find a door', color: '#B3451E', note: 'They care and there is no way in yet. This is a partnership brief, not a pass.' },
  { id: 'easy',   label: 'Easy win',    color: '#1A67D2', note: 'Wide open, moderate pull. Buy in with what already exists.' },
  { id: 'skip',   label: 'Skip',        color: '#5C6279', note: 'Neither. Say out loud we are not doing it.' }
];
export const QUAD_CUT = { rel: 55, feas: 60 };
export function quadrantOf(rel, feas) {
  const hot = rel >= QUAD_CUT.rel, open = feas >= QUAD_CUT.feas;
  return QUADRANTS.find(q => q.id === (hot ? (open ? 'anchor' : 'door') : (open ? 'easy' : 'skip')));
}

/* ---------- the score ---------- */

export const RESPONSE_BANDS = [
  { id: 'anchor', label: 'Anchor', min: 70, color: '#0B7A67', note: 'Build a beat on it.' },
  { id: 'play',   label: 'Play',   min: 54, color: '#1A67D2', note: 'Buy in with what exists.' },
  { id: 'watch',  label: 'Watch',  min: 38, color: '#946200', note: 'Know about it. No line item.' },
  { id: 'skip',   label: 'Skip',   min: 0,  color: '#5C6279', note: 'Say out loud we are not doing it.' }
];
export const responseBandOf = s => RESPONSE_BANDS.find(b => s >= b.min) || RESPONSE_BANDS[RESPONSE_BANDS.length - 1];

/* Only fandom and reachability combine across several audiences —
   receptivity is per-audience by construction, so it combines the same way
   but for a different reason, and a blend of two audiences' receptivity is
   still a meaningful thing to state. Feasibility never combines: it has no
   audience in it. */
export function scoreMomentsResponse(moments, aud, mode) {
  const auds = (Array.isArray(aud) ? aud : [aud]).filter(Boolean);
  const scorable = auds.filter(hasResponseData);
  const weights = scorable.map(sizeOf);
  const cong = congestionIndex(moments);

  return moments.map(m => {
    const feas = feasibilityOf(m, cong.get(m.id) ?? 0);

    if (!scorable.length) {
      /* No cut, no score. Everything is null and the board draws the absence
         rather than a par row that reads like a finding. */
      return {
        ...m, parts: { fan: null, rch: null, rcp: null, feas: feas.value, cong: cong.get(m.id) ?? 0 },
        detail: { feas }, score: null, band: null, quadrant: null,
        noData: true, affBy: null, affWeighted: false
      };
    }

    const each = scorable.map(a => {
      const f = fandomOf(m, a), r = reachabilityOf(m, a), p = receptivityOf(a);
      return { id: a.id, name: a.name, f, r, p, value: f && f.value != null ? f.value : 0 };
    });

    const pick = (get) => combineAffinity(
      each.map(e => { const v = get(e); return v && v.value != null ? v.value : null; })
          .filter(v => v != null),
      weights, mode || 'blend');

    const fan = pick(e => e.f), rch = pick(e => e.r), rcp = pick(e => e.p);
    const anyFandom = each.some(e => e.f && e.f.value != null);

    const parts = {
      fan: anyFandom ? fan.value : null,
      rch: rch.value, rcp: rcp.value,
      feas: feas.value, cong: cong.get(m.id) ?? 0
    };
    /* A moment with no measured fandom is not a zero — it is a moment the
       study did not ask about. It scores on what there is, with the missing
       term's weight redistributed across the terms that do have an answer, so
       the absence cannot be read as a low opinion. */
    let num = 0, den = 0;
    for (const [k, w] of Object.entries(RESPONSE_WEIGHTS)) {
      if (parts[k] == null) continue;
      num += parts[k] * w; den += w;
    }
    const score = den ? Math.round(num / den) : null;

    return {
      ...m, parts, score,
      band: score == null ? null : responseBandOf(score),
      quadrant: score == null ? null : quadrantOf(score, feas.value),
      detail: { feas, each, partial: den > 0 && den < 1 },
      noData: score == null,
      affBy: each.length > 1 ? each.map(e => ({ id: e.id, name: e.name, value: e.f && e.f.value != null ? e.f.value : 0 })) : null,
      affWeighted: fan.weighted
    };
  });
}
