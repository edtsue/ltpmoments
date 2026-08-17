/* PLACEHOLDER AUDIENCE DATA.

   Every number in this file is invented. It is here so the mockups can be
   driven by something with the right SHAPE, not because any of it is true.
   Six audiences, each carrying a category affinity index on a 100 base — the
   form an MRI / GWI / Nielsen cut arrives in — plus a short list of
   entity-level overrides for the cases where the category is too blunt.

   Replace `aff` with a real cut and the mockups become a real instrument
   without a line of UI changing. That is the whole point of keeping it here.  */

export const AUDIENCES = [
  {
    id: 'genz',
    name: 'Gen Z Culture Shapers',
    def: 'A18–24, index high on social-first discovery; sets the language the rest of the audience borrows six months later.',
    size: '31.4M',
    aff: { 'Culture': 145, 'Fashion & Awards': 160, 'Gaming': 130, 'Holidays': 85,
           'Movies': 105, 'Music': 155, 'Sports': 80, 'TV & Streaming': 110,
           'Tech': 105, 'Tours & Concerts': 150 },
    ent: { 'BTS': 195, 'Olivia Dean': 170, 'Comic-Con': 150, 'VMA': 165, 'Met Gala': 175 }
  },
  {
    id: 'sports',
    name: 'Sports Superfans',
    def: 'A21–49 who watch live, bet, and post through it. The only audience that reliably shows up to an appointment.',
    size: '48.9M',
    aff: { 'Culture': 85, 'Fashion & Awards': 70, 'Gaming': 105, 'Holidays': 105,
           'Movies': 95, 'Music': 90, 'Sports': 195, 'TV & Streaming': 120,
           'Tech': 100, 'Tours & Concerts': 85 },
    ent: { 'NFL': 190, 'Super Bowl': 200, 'World Cup': 185, 'NBA': 175, 'MLB': 165 }
  },
  {
    id: 'music',
    name: 'Music-First Millennials',
    def: 'A25–34 who organise the year around release dates and on-sales rather than around channels.',
    size: '36.2M',
    aff: { 'Culture': 120, 'Fashion & Awards': 125, 'Gaming': 90, 'Holidays': 95,
           'Movies': 100, 'Music': 190, 'Sports': 85, 'TV & Streaming': 105,
           'Tech': 95, 'Tours & Concerts': 180 },
    ent: { 'Grammys': 175, 'Coachella': 180, 'Tour': 165, 'Album Release': 170 }
  },
  {
    id: 'gamers',
    name: 'Gamers & Streamers',
    def: 'A16–34, console and PC. Reached inside the game and the stream, not around them.',
    size: '42.7M',
    aff: { 'Culture': 95, 'Fashion & Awards': 70, 'Gaming': 200, 'Holidays': 80,
           'Movies': 115, 'Music': 100, 'Sports': 95, 'TV & Streaming': 115,
           'Tech': 145, 'Tours & Concerts': 75 },
    ent: { 'Game Awards': 195, 'Comic-Con': 145, 'Nintendo': 180, 'Xbox': 175, 'PlayStation': 175 }
  },
  {
    id: 'families',
    name: 'Multicultural Families',
    def: 'A25–49 with children at home. Co-viewing is the norm, so the moment has to work for two ages at once.',
    size: '27.8M',
    aff: { 'Culture': 130, 'Fashion & Awards': 95, 'Gaming': 95, 'Holidays': 150,
           'Movies': 135, 'Music': 115, 'Sports': 115, 'TV & Streaming': 130,
           'Tech': 85, 'Tours & Concerts': 90 },
    ent: { 'Disney': 165, 'Thanksgiving': 175, 'Halloween': 170, 'Minions': 175, 'Moana': 180 }
  },
  {
    id: 'tech',
    name: 'Tech Early Adopters',
    def: 'A25–44 who buy in the first quarter of a product cycle and are asked for advice by everyone else.',
    size: '19.6M',
    aff: { 'Culture': 105, 'Fashion & Awards': 90, 'Gaming': 125, 'Holidays': 80,
           'Movies': 100, 'Music': 95, 'Sports': 95, 'TV & Streaming': 110,
           'Tech': 200, 'Tours & Concerts': 85 },
    ent: { 'Unpacked': 190, 'Apple': 185, 'CES': 190, 'Pixel': 195, 'Gemini': 185 }
  }
];

/* Category colour. Not decorative — it is the only thing that lets a reader
   scan a year of 508 rows, so each category owns exactly one hue and keeps it
   in every one of the five directions. Drawn from the Google-family palette
   the rest of the LTP tools use. */
export const CAT_COLOR = {
  'Sports':           '#1A67D2',
  'Music':            '#8430CE',
  'Tours & Concerts': '#B0299B',
  'TV & Streaming':   '#0B7A67',
  'Movies':           '#C5221F',
  'Gaming':           '#946200',
  'Gaming ':          '#946200',
  'Holidays':         '#0F7A3D',
  'Fashion & Awards': '#B3451E',
  'Tech':             '#3C4A9E',
  'Culture':          '#6D5DE0',
  /* The civic year, from the 2027 Culture Map. Two hues picked out of the gaps
     the first ten leave — an olive around 72° and a deep cyan around 194° —
     so twelve categories still separate at a glance on a dense board. */
  'Heritage & Identity': '#5B6E00',
  'National Days':       '#0E6C8C'
};
