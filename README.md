# LTP Moments

Pick a target audience in the left rail; the year's cultural moments re-order
themselves around what that audience actually cares about.

Currently at the **mockup** stage — five UI directions over one shared state,
so they can be compared on drawing rather than on data. Nothing is deployed.

## Layout

```
mockups/
  index.html      shell — rail, header, body
  style.css       the Atlas light family, tokens lifted from ltpstrategy
  app.js          state, the five draw functions, one delegated listener
  data/
    moments.js    generated — do not edit by hand
    audiences.js  PLACEHOLDER audiences and category affinity indices
    relevance.js  the scoring model. Real logic, placeholder inputs.
tools/
  build-moments.mjs   cultural calendar CSV -> data/moments.js
  bundle.mjs          the four modules -> dist/mockups.html, self-contained
  smoke.mjs           renders all 5 directions x 6 audiences under a DOM stub
```

## Running it

```sh
npx serve mockups            # any static server; it is ES modules, so file:// will not do
node tools/smoke.mjs         # 30 renders, no browser
node tools/bundle.mjs        # one self-contained page in dist/
```

Direction and audience live in the hash — `#/3/sports` opens The Ribbon on
Sports Superfans — so a link carries what you were looking at.

## Rebuilding the data

```sh
node tools/build-moments.mjs "path/to/MFG _ Cultural Calendar - Cultural Moments.csv"
```

The sheet is a working document, so the build absorbs its quirks rather than
asking anyone to clean it: two rows of instructions above the real header,
trailing spaces on category names, fifteen categories that are really ten.

It also collapses exact duplicates — the same moment entered several times by
different people — on normalised name plus launch date. **Near**-duplicates are
reported and left in, because deciding whether `MTV Video Music Awards (VMAs)`
and `VMAs (Video Music Awards)` are one entry or two needs a person.

## What "high relevance" means

Five named components, never a bare number, because a planner has to be able to
say *which part* of a score is wrong.

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
fault in it. A moment that is perfect on the other four and lands in the
loudest week of the year is worth less than the same moment in a quiet one, but
it never drops out of the running.

Four bands, because nobody acts on 71 versus 68 — **Anchor** (build a beat on
it) / **Play** (buy in with what exists) / **Watch** (no line item) / **Skip**
(say out loud we are not doing it).

### What still has to be supplied

- **Audience roster and category affinity indices.** The six in `audiences.js`
  are invented. Replace `aff` with a real cut — MRI, GWI, Nielsen, first-party
  panel — and the mockups become an instrument without a line of UI changing.
- **Scale.** Currently a keyword ladder over the moment name. In production this
  is one number per moment from a reach model, and `scaleOf` deletes itself.
- **Entity-level affinity**, where category is too blunt to separate two moments.

Two traps worth knowing about before that data lands, both already hit here:

- Entity keys must match **whole words**. `CES` matched the `ces` inside
  *Academy of Motion Picture Ar<b>t</b>s and Scien**ces***, which handed the
  Oscars a 190 tech index and made them the most relevant moment of the year for
  an audience that does not watch them.
- The audience-varying term has to carry the **majority** of the weight. At .40
  it did not, and the Oscars came top for Gen Z, families *and* tech buyers,
  because a big, firmly dated, buyable moment wins three terms out of four no
  matter who is watching. An audience switch that returns the same answer is not
  an audience switch.

## Where this sits

Stage **6.2 Moments**, under Cultural Playground Definition, in step 02 of the
long-term planning process. It produces a **Calendar**, and feeds 6.3 Big Ideas
& Partnerships and step 03's Flighting.
