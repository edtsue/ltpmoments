/* WHICH SURVEY ROW SPEAKS FOR WHICH MOMENT.

   The YouGov cut carries 91 entity-level interest rows — 58 sports and 33
   named events. The calendar carries 980 moments written by hand in a
   spreadsheet. Nothing joins them automatically: the survey says
   "NFL - level of interest - Top 2" and the sheet says "NFL Week 10: 49ers At
   Cowboys". This table is that join, written out so it can be argued with.

   THREE RULES, ALL OF THEM LEARNED THE HARD WAY.

   1. WHOLE WORDS, ALWAYS. An earlier cut of this idea tested `RegExp(key)`
      and "CES" matched the "ces" inside "Academy of Motion Picture Arts and
      Sciences", which handed the Oscars a 190 tech index and made them the
      most relevant moment of the year for an audience that does not watch
      them. Every pattern here is anchored. Three-letter league codes are that
      same trap with a bigger surface.

   2. MOST SPECIFIC WINS, AND ORDER IS HOW THAT IS EXPRESSED. The survey holds
      both "NFL" (an 80 index for Search) and "NFL Draft" (106.5). A moment
      called "NFL Draft" is the second thing, not the first, so the specific
      events are listed before the leagues they belong to and the FIRST match
      is taken. Taking the highest of the matches instead would quietly
      promote every moment to whichever of its readings flattered it most,
      which is not a sharper read — it is a thumb on the scale.

   3. NEAR MISSES ARE LEFT UNMATCHED ON PURPOSE. A moment with no row falls
      back to its category index and REPORTS that it did. A wrong join is far
      worse than a missing one: it is invisible, and it survives a demo.

   Order inside a block matters where two patterns overlap — Latin Grammys
   before Grammys, US Open (Golf) before US Open, or the general one swallows
   the specific one. */

/* [survey key, pattern over the moment's name / source / platform]
   The key must match a row title in the YouGov cut exactly as
   tools/build-yougov.mjs normalises it, or the build fails loudly. */
export const ENTITY_MAP = [
  /* ---- named events: the survey asks about these by name ---- */
  ['Super Bowl',                  /\bsuper bowl\b/i],
  ['NFL Draft',                   /\bNFL draft\b/i],
  ['NFL Combine',                 /\bNFL combine\b/i],
  ['NFL Pro Bowl',                /\bpro bowl\b/i],
  ['NFL Honors',                  /\bNFL honors\b/i],
  ['NFL Kickoff',                 /\bNFL (season )?kick[\s-]?off\b/i],
  /* Before the MLB row deliberately: "NCAA Men's College World Series" and
     "Little League World Series" both contain "world series", and the general
     pattern would swallow them into a league they have nothing to do with. */
  ['College World Series Baseball', /\bcollege world series\b|\bcollege softball world series\b/i],
  ['MLB World Series',            /(?<!little league )\bworld series\b(?!\s*of\s*poker)/i],
  ['MLB All Star',                /\bMLB all[\s-]?star\b|\bhome run derby\b|\bHR derby\b/i],
  ['MLB Draft',                   /\bMLB draft\b/i],
  ['NBA All Star',                /\bNBA all[\s-]?star\b/i],
  ['NBA Draft',                   /\bNBA draft\b/i],
  ['NBA Finals',                  /\bNBA finals\b/i],
  ['NHL All Star',                /\bNHL all[\s-]?star\b/i],
  ['NHL Draft',                   /\bNHL draft\b/i],
  ['NHL Stanley Cup',             /\bstanley cup\b/i],
  ['MLS Cup',                     /\bMLS cup\b/i],
  /* The survey has one "March Madness" row but two college-basketball rows,
     and the men's and women's tournaments do not index alike. Route the
     women's brackets to the women's row and leave the unmarked ones — which
     in this sheet always mean the men's draw — on March Madness. */
  ["Division 1 Women's College Basketball", /\bmarch madness women\b|\bwomen'?s final four\b|\bwomen'?s college basketball\b|\bWNBA draft\b/i],
  ['March Madness',               /\bmarch madness\b|\bfinal four\b|\bselection sunday\b|\bchamp week\b|\btournament challenge\b/i],
  /* The survey separates the playoff from the regular season, and so does
     the sheet — "CFB Semifinals" is not "College Football Season Kickoff".
     They index a long way apart (YTTV 137 against 201), so the bowl games,
     the bracket and the Heisman route here and everything else falls to the
     Division 1 Football row below. */
  ['College Football Playoff',    /\bcollege football playoff\b|\bCFB (playoffs?|semifinals?|quarterfinals?|first round|national championship|bowl games?|conference championship|rivalry|hall of fame|big 12|ACC|big ten|SEC)\b|\bheisman\b|\brose bowl\b|\borange bowl\b|\bsugar bowl\b|\bfiesta bowl\b|\bpeach bowl\b|\bcotton bowl\b|\barmy\s*navy\b/i],
  ['Daytona 500',                 /\bdaytona\b/i],
  ['Indy 500',                    /\bindy 500\b|\bindianapolis 500\b/i],
  ['The Masters',                 /\bthe masters\b|\bmasters golf\b/i],
  ['PGA Championship',            /\bPGA championship\b/i],
  ['The British Open',            /\bbritish open\b|\bopen championship\b/i],
  ['US Open (Golf)',              /\bUS open\b[^,]*\bgolf\b/i],
  ['WWE Wrestlemania',            /\bwrestlemania\b/i],
  ['Latin Grammys',               /\blatin grammys?\b/i],
  ['Grammy Awards',               /\bgrammys?\b|\bgrammy awards?\b/i],
  ['Academy Awards',              /\boscars?\b|\bacademy awards?\b/i],
  ['Emmy Awards',                 /\bemmys?\b|\bemmy awards?\b/i],
  ['Golden Globes',               /\bgolden globes?\b/i],
  ['Espy Awards',                 /\bespys?\b|\bespy awards?\b/i],

  /* ---- leagues and properties ---- */
  ['WNBA',                        /\bWNBA\b/i],
  ['NFL',                         /\bNFL\b|\bthanksgiving football\b/i],
  ['NBA',                         /\bNBA\b|\binside the NBA\b/i],
  ['MLB',                         /\bMLB\b|\blittle league world series\b/i],
  ['NHL',                         /\bNHL\b|\bwinter classic\b|\bstadium series\b/i],
  ['Division 1 Football',         /\bcollege football\b|\bCFB\b|\bcollege gameday\b/i],
  ["Division 1 Men's College Basketball", /\bmen'?s college basketball\b|\bcollege hockey finals\b/i],
  ['Major League Soccer',         /\bMLS\b/i],
  ["National Women's Soccer League", /\bNWSL\b/i],
  ['English Premier League',      /\bpremier league\b(?!\s*lacrosse)/i],
  ['UEFA Champions League',       /\bchampions league\b|\bUEFA euro\b/i],
  ['La Liga (soccer)',            /\bla liga\b|\bel clasico\b|\bcopa del rey\b|\bcopa de la reina\b/i],
  ['Liga MX',                     /\bliga MX\b|\bCONCACAF\b/i],
  ['Serie A (soccer)',            /\bserie A\b/i],
  ['Bundesliga (soccer)',         /\bbundesliga\b/i],
  ['Ligue 1',                     /\bligue 1\b/i],
  ['FA Cup',                      /\bFA cup\b/i],
  ['Copa Libertadores',           /\bcopa libertadores\b/i],
  ['Copa Sudamericana',           /\bcopa sudamericana?\b/i],
  ["FIFA Women's World Cup",      /\bFIFA women'?s world cup\b|\bwomen'?s world cup\b/i],
  ['FIFA Football World Cup',     /\bFIFA world cup\b|\bworld cup\b(?!\s*of)/i],
  ['FIBA Basketball World Cup',   /\bFIBA\b/i],
  ['World Baseball Classic',      /\bworld baseball classic\b/i],
  ['Olympic Games (Summer)',      /\bsummer olympics?\b|\bsummer paralympics?\b|\bspecial olympics\b/i],
  ['Olympic Winter Games',        /\bwinter olympics?\b|\bwinter paralympics?\b/i],
  ['NASCAR',                      /\bNASCAR\b|\bbrickyard\b|\bcoke zero\b/i],
  ['Formula 1',                   /\bformula 1\b|\bF1\b|\bgrand prix\b/i],
  ['Formula E',                   /\bformula E\b/i],
  ['IndyCar (IRL)',               /\bindycar\b/i],
  ['24 Hours of Le Mans',         /\ble mans\b/i],
  ['IMSA Sports Car Championship', /\bIMSA\b/i],
  ['FIA World Endurance Championship', /\bworld endurance\b/i],
  ['NHRA',                        /\bNHRA\b/i],
  ['Supercross',                  /\bsupercross\b/i],
  ['Pro Motocross',               /\bmotocross\b/i],
  ['MonsterJam',                  /\bmonster jam\b|\bmonsterjam\b|\bmonster truck\b/i],
  ['PBR',                         /\bPBR\b/i],
  ['Wimbledon',                   /\bwimbledon\b/i],
  ['Australian Open',             /\baustralian open\b/i],
  ['French Open',                 /\bfrench open\b|\broland[\s-]?garros\b/i],
  ['US Open',                     /\bUS open\b/i],
  ["ATP Men's Tennis",            /\bATP\b/i],
  ["WTA Women's Tennis",          /\bWTA\b/i],
  ["LPGA Women's Golf Tour",      /\bLPGA\b/i],
  ["PGA Men's Golf Tour",         /\bPGA\b/i],
  ['European Tour (golf)',        /\bDP world tour\b|\bryder cup\b/i],
  ['Ultimate Fighting Championships', /\bUFC\b/i],
  ['All Elite Wrestling',         /\bAEW\b|\ball elite wrestling\b/i],
  ['World Wrestling Entertainment (WWE)', /\bWWE\b|\broyal rumble\b|\bsummerslam\b/i],
  ['United Football League (UFL)', /\bUFL\b|\bunited football league\b/i],
  ['World Surf League',           /\bworld surf\b|\bsurf league\b/i],
  ['Esports',                     /\besports\b|\bgame awards\b|\bleague of legends\b|\bvalorant\b|\boverwatch\b/i],
  ['ICC T20 World Cup (cricket)', /\bcricket\b|\bT20\b/i],
  ['World Armwrestling League',   /\barmwrestling\b/i],
  ['NBA G-League',                /\bG[\s-]?league\b/i]
];

/* The pattern is tested against the moment's name first, then its source and
   its platform — a moment called "Inside the NBA" and a moment sourced from
   "NBA" are both the NBA. Kept as one function so the boundary rule has
   exactly one home. */
export function entityFor(m) {
  for (const [key, re] of ENTITY_MAP) {
    if (re.test(m.name) || re.test(m.src || '') || re.test(m.plat || '')) return key;
  }
  return null;
}
