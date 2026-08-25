/* WHERE A MOMENT IS ACTUALLY WATCHED.

   The response model's second term asks a question the affinity model never
   did: not "do they care" but "can we reach them there". That needs a channel
   mix per moment — which networks, services and platforms this moment lives
   on — crossed with how heavily the audience uses each one.

   Nothing in the calendar states that outright. The sheet gives a distributor
   ("Disney", "NBCU", "UMG") and a category, and this table turns those into a
   mix. It is DECLARED JUDGEMENT, not measurement, and it is written out here
   rather than buried so that a planner who disagrees can point at the line
   they disagree with.

   THREE RUNGS, MOST SPECIFIC FIRST, AND THE RUNG IS REPORTED.

     property     the moment is a sports property with a known broadcast home
     distributor  the sheet names who is putting it out
     category     nothing but the lane it sits in

   A score built on the third rung is a much weaker claim than one built on
   the first, so `channelsFor` returns the rung alongside the mix and the UI
   says which one it used. A model that will not admit how it got a number is
   a model that cannot be argued with.

   Weights inside a mix are relative and are renormalised at score time, so
   they only have to be right about each other. */

/* Channel names must match a row in the YouGov cut exactly — a network from
   the extended list, a streaming service, or a social network. The build
   fails loudly on a name that is not in the sheet, because a silently dropped
   channel makes a moment look narrowly distributed rather than mis-typed. */

/* Rung one: sports properties, keyed by the ENTITY_MAP key the moment
   resolved to. US rights as they stand for the 2026-27 seasons. */
export const PROPERTY_CHANNELS = {
  'Super Bowl':        [['NBC', 3], ['ESPN', 1], ['NFL Network', 1]],
  'NFL':               [['NFL Network', 2], ['ESPN', 2], ['FOX', 2], ['CBS', 2], ['NBC', 2], ['Amazon Prime Video', 1]],
  'NFL Draft':         [['NFL Network', 3], ['ESPN', 2], ['ABC', 1]],
  'NFL Combine':       [['NFL Network', 3], ['ESPN', 1]],
  'NFL Pro Bowl':      [['ESPN', 2], ['ABC', 1]],
  'NFL Honors':        [['CBS', 2], ['NFL Network', 1]],
  'NFL Kickoff':       [['NBC', 2], ['NFL Network', 1]],
  'NBA':               [['NBA TV', 2], ['ESPN', 3], ['TNT', 2], ['ABC', 2], ['Amazon Prime Video', 1]],
  'NBA Finals':        [['ABC', 3], ['ESPN', 2], ['NBA TV', 1]],
  'NBA All Star':      [['TNT', 2], ['NBA TV', 2], ['ESPN', 1]],
  'NBA Draft':         [['ESPN', 2], ['ABC', 1], ['NBA TV', 1]],
  'MLB':               [['MLB Network', 2], ['ESPN', 2], ['FOX', 2], ['TBS', 2]],
  'MLB World Series':  [['FOX', 3], ['MLB Network', 1]],
  'MLB All Star':      [['FOX', 3], ['MLB Network', 1]],
  'MLB Draft':         [['MLB Network', 3], ['ESPN', 1]],
  'NHL':               [['NHL Network', 2], ['ESPN', 3], ['TNT', 3]],
  'NHL Stanley Cup':   [['ESPN', 2], ['ABC', 2], ['TNT', 2], ['NHL Network', 1]],
  'NHL All Star':      [['ESPN', 2], ['NHL Network', 1]],
  'NHL Draft':         [['ESPN', 2], ['NHL Network', 2]],
  'WNBA':              [['ESPN', 3], ['ABC', 2], ['CBS', 1], ['NBA TV', 1]],
  'College Football Playoff':  [['ESPN', 4], ['ABC', 2], ['TNT', 1]],
  'Division 1 Football':       [['ESPN', 3], ['SEC Network', 2], ['FOX', 2], ['ABC', 2], ['CBS', 1]],
  'March Madness':             [['CBS', 3], ['TBS', 2], ['TNT', 2], ['truTV', 1]],
  "Division 1 Men's College Basketball":   [['ESPN', 3], ['CBS', 2], ['FOX', 1], ['SEC Network', 1]],
  "Division 1 Women's College Basketball": [['ESPN', 3], ['ABC', 2], ['SEC Network', 1]],
  'College World Series Baseball': [['ESPN', 4], ['SEC Network', 1]],
  'PGA Championship':  [['The Golf Channel', 2], ['CBS', 3]],
  "PGA Men's Golf Tour": [['The Golf Channel', 3], ['CBS', 2], ['NBC', 1]],
  "LPGA Women's Golf Tour": [['The Golf Channel', 3], ['NBC', 1]],
  'The Masters':       [['CBS', 3], ['ESPN', 2]],
  'The British Open':  [['NBC', 2], ['The Golf Channel', 2]],
  'US Open (Golf)':    [['NBC', 2], ['The Golf Channel', 2]],
  'European Tour (golf)': [['The Golf Channel', 3], ['NBC', 1]],
  'Wimbledon':         [['ESPN', 3], ['Tennis Channel', 2], ['ABC', 1]],
  'US Open':           [['ESPN', 3], ['Tennis Channel', 2]],
  'Australian Open':   [['ESPN', 3], ['Tennis Channel', 2]],
  'French Open':       [['Tennis Channel', 3], ['NBC', 2]],
  "ATP Men's Tennis":  [['Tennis Channel', 3], ['ESPN', 2]],
  "WTA Women's Tennis": [['Tennis Channel', 3], ['ESPN', 2]],
  'English Premier League': [['USA Network', 3], ['NBC', 2], ['Telemundo', 1]],
  'UEFA Champions League':  [['Paramount+ with Showtime', 3], ['CBS', 2], ['Univision', 1]],
  'Major League Soccer':    [['FOX', 2], ['Apple TV+', 3], ['FS1', 1]],
  'MLS Cup':                [['FOX', 2], ['Apple TV+', 3]],
  'Liga MX':           [['Univision', 3], ['Telemundo', 2], ['FOX Deportes', 1]],
  'La Liga (soccer)':  [['ESPN Deportes', 2], ['ESPN', 2], ['Univision', 1]],
  'Serie A (soccer)':  [['Paramount+ with Showtime', 2], ['CBS Sports Network', 1]],
  'Bundesliga (soccer)': [['ESPN', 2], ['ESPN Deportes', 1]],
  'Ligue 1':           [['FOX', 1], ['FS1', 1]],
  'FA Cup':            [['ESPN', 2], ['ESPN Deportes', 1]],
  'FIFA Football World Cup':  [['FOX', 3], ['Telemundo', 3], ['FS1', 1]],
  "FIFA Women's World Cup":   [['FOX', 3], ['Telemundo', 2]],
  'Copa Libertadores': [['FOX Deportes', 3], ['Univision', 1]],
  'Copa Sudamericana': [['FOX Deportes', 3], ['Univision', 1]],
  "National Women's Soccer League": [['ESPN', 2], ['CBS', 1], ['Amazon Prime Video', 1]],
  'Olympic Games (Summer)':   [['NBC', 4], ['Peacock', 3], ['USA Network', 1]],
  'Olympic Winter Games':     [['NBC', 4], ['Peacock', 3], ['USA Network', 1]],
  'NASCAR':            [['FOX', 2], ['FS1', 2], ['NBC', 2], ['Amazon Prime Video', 1]],
  'Daytona 500':       [['FOX', 4], ['FS1', 1]],
  'Formula 1':         [['ESPN', 3], ['ABC', 1]],
  'IndyCar (IRL)':     [['FOX', 3], ['FS1', 1]],
  'Indy 500':          [['FOX', 4]],
  'World Wrestling Entertainment (WWE)': [['WWE Network', 2], ['USA Network', 3], ['Netflix', 2]],
  'WWE Wrestlemania':  [['Netflix', 3], ['WWE Network', 1]],
  'All Elite Wrestling': [['TBS', 2], ['TNT', 2]],
  'Ultimate Fighting Championships': [['ESPN', 3], ['Paramount+ with Showtime', 2]],
  'Espy Awards':       [['ABC', 3], ['ESPN', 2]],
  'Esports':           [['Twitch', 4], ['YouTube', 3], ['Discord', 1]]
};

/* Rung two: whoever the sheet says is putting it out. */
export const DISTRIBUTOR_CHANNELS = [
  [/disney/i,     [['Disney+', 3], ['ABC', 2], ['Disney Channel', 1], ['Hulu', 2], ['FX', 1], ['Freeform', 1]]],
  [/netflix/i,    [['Netflix', 5]]],
  [/warner|hbo/i, [['HBO Max', 3], ['HBO', 2], ['TNT', 1], ['TBS', 1], ['Cartoon Network', 1]]],
  [/nbcu|nbc/i,   [['Peacock', 3], ['NBC', 3], ['USA Network', 1], ['Bravo', 1], ['SyFy', 1], ['E!', 1]]],
  [/amazon/i,     [['Amazon Prime Video', 5]]],
  [/paramount/i,  [['Paramount+ with Showtime', 3], ['CBS', 2], ['MTV', 1], ['Comedy Central', 1], ['Nickelodeon', 1]]],
  [/\bfox\b/i,    [['FOX', 4], ['FS1', 1], ['Fox News Channel', 1], ['Fox One', 1]]],
  [/apple/i,      [['Apple TV+', 5]]],
  [/^sony$|cine sony/i, [['Cine Sony', 2], ['Netflix', 1]]],
  [/lionsgate|a24|neon|focus features|magnolia|mubi|ifc|vertical|angel studios|trafalgar|ketchup/i,
                  [['Starz', 1], ['AMC', 1], ['IFC', 1], ['Sundance', 1]]],
  [/umg|live nation|aeg|saban/i, [['YouTube', 4], ['Instagram', 2], ['TikTok', 2], ['MTV', 1]]],
  [/xbox|playstation|nintendo|sega|capcom|bandai|rockstar|\bEA\b|remedy|gun interactive|s-game|geoff keighley|gamescom|decal/i,
                  [['Twitch', 4], ['YouTube', 3], ['Discord', 2], ['Reddit', 1]]],
  [/samsung|microsoft|google|salesforce|IEEE|CNCF/i, [['YouTube', 3], ['X', 2], ['LinkedIn', 2], ['Reddit', 1]]],
  [/comic con|vanity fair|CFDA|sundance institute/i, [['Instagram', 3], ['YouTube', 2], ['X', 1], ['E!', 1]]]
];

/* Rung three: nothing but the lane. Weak on purpose — a mix this generic
   should not be able to lift a moment far, and the UI marks it. */
export const CATEGORY_CHANNELS = {
  'Sports':             [['ESPN', 3], ['FOX', 2], ['CBS', 2], ['NBC', 2], ['FS1', 1]],
  'TV & Streaming':     [['Netflix', 3], ['Hulu', 2], ['Disney+', 2], ['HBO Max', 2], ['Amazon Prime Video', 2]],
  'Movies':             [['Netflix', 2], ['HBO Max', 2], ['Amazon Prime Video', 2], ['Hulu', 1], ['YouTube', 1]],
  'Music':              [['YouTube', 4], ['Instagram', 2], ['TikTok', 2], ['MTV', 1]],
  'Tours & Concerts':   [['YouTube', 3], ['Instagram', 3], ['TikTok', 2], ['Facebook', 1]],
  'Gaming':             [['Twitch', 4], ['YouTube', 3], ['Discord', 2], ['Reddit', 2]],
  'Tech':               [['YouTube', 3], ['X', 2], ['Reddit', 2], ['LinkedIn', 2]],
  'Fashion & Awards':   [['Instagram', 3], ['YouTube', 2], ['TikTok', 2], ['E!', 1], ['ABC', 1]],
  'Culture':            [['YouTube', 2], ['Facebook', 2], ['Instagram', 2], ['ABC', 1], ['NBC', 1]],
  'Holidays':           [['Facebook', 3], ['YouTube', 2], ['ABC', 1], ['NBC', 1], ['CBS', 1], ['Hallmark Channel', 1]],
  'National Days':      [['Facebook', 3], ['YouTube', 2], ['X', 1], ['ABC', 1]],
  'Heritage & Identity': [['Facebook', 2], ['YouTube', 2], ['Instagram', 2], ['Univision', 1], ['BET', 1], ['Telemundo', 1]]
};

/* The mix for one moment, and the rung it came from. `entity` is the
   ENTITY_MAP key the moment already resolved to, passed in rather than
   recomputed so the two tables can never disagree about what a moment is. */
export function channelsFor(m, entity) {
  if (entity && PROPERTY_CHANNELS[entity]) {
    return { mix: PROPERTY_CHANNELS[entity], rung: 'property' };
  }
  const hay = `${m.plat || ''} ${m.src || ''}`;
  if (hay.trim()) {
    for (const [re, mix] of DISTRIBUTOR_CHANNELS) {
      if (re.test(hay)) return { mix, rung: 'distributor' };
    }
  }
  const cat = CATEGORY_CHANNELS[m.cat];
  return cat ? { mix: cat, rung: 'category' } : { mix: [], rung: 'none' };
}
