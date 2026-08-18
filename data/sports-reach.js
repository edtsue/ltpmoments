/* WPP MEDIA SPORTS REACH — the measured half of the scale term.

   WPP Media Sports Reach — 2026 (August). Research's fifth Sports Reach analysis.

   WHAT THE NUMBER IS: Average 1-month P18-49 reach, %, of national telecasts on Nielsen-measured platforms.
   BASIS: Nielsen Updated Big Data+Panel, Live+7, Jul'25 - Jun'26. Includes out-of-home viewing.
   EXCLUDES: No local, regional, or unmeasured streaming-exclusive airings.

   Months are the deck's own season months; a month absent for a sport is out of season, not zero-reach.

   Generated from the deck by reading each sport table positionally — the
   off-season months are blank, so values are matched to months by column
   rather than by order. Do not hand-edit; correct the source and re-extract.

   A JS module rather than JSON on purpose: this site has no build step, and a
   JSON import needs import attributes the older browsers in a client meeting
   may not have. */

export const REACH_SOURCE = {
  name: "WPP Media Sports Reach",
  edition: "2026 (August)",
  measure: "Average 1-month P18-49 reach, %, of national telecasts on Nielsen-measured platforms.",
  basis: "Nielsen Updated Big Data+Panel, Live+7, Jul'25 - Jun'26. Includes out-of-home viewing.",
  excludes: "No local, regional, or unmeasured streaming-exclusive airings."
};

export const SPORTS_REACH = {
  "NFL": { Aug: 18.7, Sep: 47.7, Oct: 47.1, Nov: 54.6, Dec: 51.1, Jan: 49.2, Feb: 47.5 },
  "College Football": { Aug: 22.5, Sep: 34.7, Oct: 35.1, Nov: 39.8, Dec: 33.7, Jan: 24.7 },
  "NBA": { Oct: 13.7, Nov: 16, Dec: 21.7, Jan: 20, Feb: 24.3, Mar: 21.8, Apr: 31.4, May: 35.4, Jun: 27.5 },
  "Men's College Basketball": { Nov: 23.4, Dec: 15.2, Jan: 22.7, Feb: 22.3, Mar: 37.6, Apr: 16.3 },
  "Women's College Basketball": { Nov: 4.5, Dec: 4.4, Jan: 6.1, Feb: 8.6, Mar: 14.1, Apr: 7 },
  "WNBA": { Jul: 5.3, Aug: 5.6, Sep: 6.6, Oct: 3, May: 6.9, Jun: 8.7 },
  "MLB": { Jul: 10.9, Aug: 13.5, Sep: 14.2, Oct: 33.2, Nov: 15.1, Mar: 10.5, Apr: 11.4, May: 12.7, Jun: 13.7 },
  "NHL": { Oct: 5.1, Nov: 2.1, Dec: 3.5, Jan: 6.7, Feb: 4.6, Mar: 8.5, Apr: 16.3, May: 15, Jun: 12.6 },
  "MLS": { Jul: 1.7, Aug: 3.4, Sep: 0.2, Oct: 0.7, Nov: 0.4, Dec: 1, Feb: 0.6, Mar: 1.7, Apr: 0.9, May: 2.1 },
  "NWSL": { Aug: 2.8, Sep: 1.2, Oct: 1.3, Nov: 2.6, Mar: 2.2, Apr: 1.5, May: 1.7 },
  "Premier League": { Aug: 6, Sep: 3.8, Oct: 4.4, Nov: 4.8, Dec: 5.4, Jan: 4.7, Feb: 3.6, Mar: 4, Apr: 5.3, May: 5.6 },
  "Liga MX": { Jul: 3.8, Aug: 5.3, Sep: 3.1, Oct: 3.1, Nov: 3.6, Dec: 3.1, Jan: 2.7, Feb: 3.5, Mar: 3.4, Apr: 4.5, May: 4.2 },
  "NASCAR Cup Series": { Jul: 2.2, Aug: 2.3, Sep: 1, Oct: 2, Nov: 1, Feb: 4.7, Mar: 3, Apr: 2.5, May: 4.9, Jun: 3.5 },
  "NASCAR Xfinity Series": { Jul: 0.8, Aug: 1.1, Sep: 0.8, Oct: 0.9, Nov: 0.3, Feb: 1.2, Mar: 1.3, Apr: 1.3, May: 1.5, Jun: 1 },
  "IndyCar": { Jul: 1.8, Aug: 1.4, Mar: 1.9, Apr: 0.8, May: 3.5, Jun: 1.8 },
  "PGA Golf": { Jul: 6.7, Aug: 7.6, Sep: 5.9, Oct: 0.6, Nov: 0.8, Dec: 2.5, Jan: 2.7, Feb: 8.1, Mar: 8.6, Apr: 13.5, May: 11.5, Jun: 10.7 },
  "LPGA Golf": { Jul: 0.7, Aug: 1.9, Sep: 0.3, Oct: 0.5, Nov: 0.6, Jan: 0.2, Feb: 0.8, Mar: 0.6, Apr: 1.7, May: 1.4, Jun: 3.7 },
  "Tennis": { Jul: 9.5, Aug: 8.9, Sep: 8.6, Oct: 1, Nov: 1.2, Dec: 0.9, Jan: 5.8, Feb: 1.9, Mar: 2.2, Apr: 1.5, May: 4.4, Jun: 4.4 },
  "Horse Racing": { Jul: 0.7, Aug: 2.4, Sep: 0.2, Oct: 1, Nov: 1.2, Dec: 0.2, Jan: 0.7, Feb: 0.2, Mar: 0.6, Apr: 0.7, May: 6, Jun: 1.6 },
  "UFL": { Mar: 2.5, Apr: 6.7, May: 7.1, Jun: 2.6 },
  "College Softball": { Feb: 0.6, Mar: 1.1, Apr: 3.5, May: 11.2, Jun: 3.3 },
  "Women's College Volleyball": { Aug: 3.4, Sep: 3.5, Oct: 3, Nov: 1.5, Dec: 3.8 },
  "WWE": { Jul: 3.4, Aug: 2.8, Sep: 2.7, Oct: 2.1, Nov: 1.9, Dec: 2.1, Jan: 2.4, Feb: 2.5, Mar: 2.7, Apr: 3.9, May: 3.1, Jun: 2.7 },
  "Unrivaled": { Jan: 1.5, Feb: 1.6 },
};
