# LTP Moments

Pick a target audience in the left rail; the year's cultural moments re-order
themselves around what that audience actually cares about.

Live behind the house gate. One view — the Ribbon — over one shared state,
and **two relevance models you can switch between at the top of the rail**.

## Layout

```
index.html      shell — rail, header, body
style.css       the Atlas light family, tokens lifted from ltpstrategy
strip.js        the module bar's fold — shared, copied between modules
strip.css       the fold's styling — shared, copied between modules
app.js          state, the draw functions, one delegated listener
data/
  moments.js    generated — do not edit by hand
  audiences.js  the rail's roster. OFFICIAL is built from yougov.js;
                the six "popular" ones are still invented placeholders.
                Also CRITERIA — each official target's panel filter, verbatim,
                shown on hover. It lives here rather than in yougov.js
                because that file is regenerated whole.
  yougov.js     generated — the research cut, four PA targets
  relevance.js  the affinity model. Five components.
  response.js   the response model. Three components + a feasibility axis.
  models.js     the registry the toggle draws from
  entity-map.js which survey row speaks for which moment
  topic-map.js  the middle rung — sub-topic when there is no named property
  channel-map.js where a moment is watched, for the reachability term
  parse.js      reads a pasted or uploaded audience cut
tools/
  build-moments.mjs   cultural calendar CSV -> data/moments.js
  build-yougov.mjs    the YouGov cut -> data/yougov.js
  bundle.mjs          everything -> dist/mockups.html, self-contained
  smoke.mjs           renders every audience under both models, no browser
```

## Running it

```sh
npx serve .                  # any static server; it is ES modules, so file:// will not do
node tools/smoke.mjs         # every audience under both models, no browser
node --test tools/*.test.mjs # 111 unit tests
node tools/bundle.mjs        # one self-contained page in dist/
```

## The module bar

Top right of the header, and three things: the plan chip, the module row, and
the button that folds the row away.

The row, Kessel and the theme travel together on `#hdStrip`, which **slides
shut when the width is wanted and is open until somebody shuts it**. The zoom
and the Watch band stay outside it — those are about the calendar in front of
you; these three are not. The plan chip is outside the fold too, and hidden
until there is a plan to name.

⚠️ **`strip.js` and `strip.css` are a copy, not a fork.** They came out of LTP
Strategy and are copied between the planning modules the way `api/_gate.js` is.
Neither file knows anything about this one: it takes a box, a button, a key
prefix (`ltpm`) and an optional `hold`, and the stylesheet asks for four
`--strip-*` variables that `style.css` maps. **Fix a fold bug in one repo and
carry the file across whole** — an edit made on the way in is how two copies
stop being the same file.

`strip.js` is a **classic script**, not a module, because that is what the
copies in the other repos are. It puts `Strip` on the global that `app.js`
reads, and both `tools/bundle.mjs` and `tools/smoke.mjs` evaluate it the same
way the browser does.

**Strategy Discovery's tile is ringed and still a link.** Moments is stage 6.2
*of* step 02, so the ring says which step you are standing in — but you are not
on that page, and a dead tile would make this the one tool in the family you
cannot reach Strategy Discovery from. `aria-current="step"`, not `"page"`.

**The demonstration runs at boot here, and that is safe only because the gate is
at the edge.** The other modules overlay a lock screen on a page that was served
anyway, so a fold performed at boot happens behind it and is spent unseen.
`middleware.js` 307s to `gate.html`, so this page is never served until the
cookie is valid.

Audience, combine mode and model live in the hash — `#/yttv2544/response` —
so a link carries what you were looking at. A leading direction digit from the
five-mockup era is still read.

## Rebuilding the data

```sh
node tools/build-moments.mjs "path/to/MFG _ Cultural Calendar - Cultural Moments.csv" \
                             "path/to/2027_CultureMap.html"
```

Two sources, one calendar. The sheet is primary — it carries the supply side,
with rights holder, platform and PA tagging on every row. The Culture Map is
second, and covers what the sheet barely touches: public holidays, heritage and
awareness months, national days, the civic year. Where both hold the same
moment the sheet's record survives and the map only fills an empty note.

The map is explicitly **provisional**: outside fixed-calendar holidays and
confirmed 2027 dates, it carries 2026 dates forward as placeholders. Those
import as `conf: 'TBD'`, which the relevance model already scores at 15 against
100 for a confirmed date, so a placeholder can never read as plannable.

Where that placeholder rule breaks down is anything that is not annual — it
invents an event. The Winter Olympics, Winter Paralympics, World Baseball
Classic, the NHL 4 Nations Face-Off and the FIFA World Cup are all listed for
2027 and none of them happen in 2027; they are excluded by name in
`tools/read-culturemap.mjs`, and near misses are printed for a human rather
than guessed at.

The sheet is a working document, so the build absorbs its quirks rather than
asking anyone to clean it: two rows of instructions above the real header,
trailing spaces on category names, fifteen categories that are really ten.

It also collapses exact duplicates — the same moment entered several times by
different people — on normalised name plus launch date. **Near**-duplicates are
reported and left in, because deciding whether `MTV Video Music Awards (VMAs)`
and `VMAs (Video Music Awards)` are one entry or two needs a person.

## Two models, one board

There is a toggle at the top of the rail. It is there rather than in a setting
because the model decides what a score *means*, and that belongs next to the
audience — read downward, "response model, YTTV Sport 25–44" is the sentence.
The link under it opens a side-by-side comparison written for somebody who
does not want the algebra.

### The affinity model — the default

Five named components, never a bare number, because a planner has to be able
to say *which part* of a score is wrong.

| | | |
|---|---|---|
| **Affinity** | Does this audience care? | .50 |
| **Scale** | How many of them show up? | .20 |
| **Actionability** | Is there a door in — a distributor, a sponsorship? | .15 |
| **Timing** | Is the date firm enough to plan against? | .15 |
| **Congestion** | How loud is everything else that week? | ×, up to −25% |

Affinity is the only term that varies by audience; the other four are facts
about the moment. That is what keeps the rail honest — switching audience
re-orders the year because the audience cares about different things, not
because the model quietly re-weighted itself.

Congestion multiplies rather than subtracts: it is a tax on a moment, not a
fault in it.

**It is the default because it works for every audience on the rail** —
official, estimated, and anything a user defines — so one board can hold them
all and stay comparable. Nothing else about it is better.

### The response model — needs a research cut

Every scored quantity is a measured survey response. Moment-side data selects
*which* responses to read; it never adds or subtracts points of its own.

| | | |
|---|---|---|
| **Fandom** | Are they into it, and more than most people are? | .50 |
| **Reachability** | Can we get to them there? | .30 |
| **Receptivity** | Will they welcome a brand? | .20 |
| **Feasibility** | Is there a way in, and is the date real? | *second axis* |

Timing, inventory and week congestion are not audience responses, so under
that rule they cannot be terms. They become the second axis, and the two cross
into four squares. The interesting one is **high relevance, no way in** — it
reads as *"find a door"*, a partnership brief for stage 6.3, instead of
quietly sinking down the board.

Fandom is **two measurements, not one**: how many of the audience say they are
interested, and whether that beats the national rate. Either on its own picks
the wrong moment — a small group who are wildly keen is not a big group who
quite like it. The NBA Finals for YTTV Sport 25–44: 62% interested, about
twice the national rate, so 91. For Gemini '26: 17%, below the national rate,
so 35.

It is read at the sharpest rung available and **the rung is reported on every
moment**: the named property (`NFL Draft`), the sub-topic (`Fighting`,
`Horror`), or the lane. Index leads, volume anchors.

## The research cut

`data/yougov.js` is generated from Ed's *Google Audience Playgrounds* export —
YouGov Profiles, 884 rows against four PA targets.

```sh
node tools/build-yougov.mjs "path/to/Google Audience Playgrounds (YouGov data) - Sheet1.csv"
```

| | | |
|---|---|---|
| Search '26 | 78.2M | Broad. Moves the board by weight of numbers. |
| Gemini '26 | 18.6M | Under-indexes on live sport; 207 on education apps, 257 on Discord. |
| Millennial Seekers '26 | 36.1M | Near par on most things; separates on motoring and horror. |
| YTTV Sport 25–44 | 24.3M | Over-indexes on essentially every sport in the study. |

**Not every bank was asked of everyone.** Sport interest went to the whole
panel; "sponsorship actions taken" only to people who had noticed a sponsor.
An index inside a conditional bank is relative to that bank's own universe, so
YTTV reads 235–424 across every radio genre — not because they are radio
superfans but because the few of them who listen are unusual.

The build does not re-centre those banks, because re-centring throws away real
signal with the bias. It **recomputes every index from the projected
population counts** against the panel-wide figures, which cancels the
conditional universe and returns the unconditional rate. Verified both ways: a
panel bank reproduces the sheet's printed index to within 0.2%, and a
conditional one moves (Search on "acknowledged the sponsor": printed 231.3,
rebuilt 154.6).

### What the cut cannot do, said out loud

- **Three lanes have no battery** — Holidays, National Days, Heritage &
  Identity. They come through as `null`, not 100, because par and "not asked"
  are different claims. Under the response model those moments score on reach
  and receptivity with the missing weight redistributed.
- **Reachability is uncrossed.** The design wants channel usage among the
  people who are *fans* of the moment; the export carries no such conditional
  cross, so it is measured across the whole audience. `crossed: false` travels
  with every result rather than living in a footnote.
- **Seasonality dies.** A panel finds the same football fans in June as in
  November.
- **Audience separation is 9 of 10, not the 5 the design note asked for.**
  Two thirds of this calendar is release titles the survey cannot tell apart
  beyond genre, so two audiences with similar genre taste legitimately share a
  top ten. `smoke.mjs` reports it on every run and fails at 10. The affinity
  model comes in at 4.

Two traps worth knowing about, both hit for real here:

- Entity keys must match **whole words**. `CES` matched the `ces` inside
  *Academy of Motion Picture Arts and Scien**ces***, which handed the Oscars a
  190 tech index and made them the most relevant moment of the year for an
  audience that does not watch them.
- **The sharper rung must be the specific one, not the flattering one.** The
  survey holds both `NFL` (80 for Search) and `NFL Draft` (106.5). Taking the
  highest of the matches promotes every moment to whichever reading suits it.
  `entity-map.js` is ordered most-specific-first and the first match wins.

### What is still a placeholder

- **The six "popular" audiences.** Invented indices, right shape, none of it
  true. They are marked `Est.` on the rail and cannot be scored by the
  response model at all.
- **Scale outside sport**, in the affinity model — still a keyword ladder over
  the moment's name.

## Where this sits

Stage **6.2 Moments**, under Cultural Playground Definition, in step 02 of the
long-term planning process. It produces a **Calendar**, and feeds 6.3 Big Ideas
& Partnerships and step 03's Flighting.
