/* THE MIDDLE RUNG.

   The response model resolves a moment to a survey row at whichever of three
   rungs it can reach: the named property, the sub-topic, or the category. The
   first and the last were easy. This file is the one in between, and leaving
   it out for a first cut made a fault visible that is worth writing down.

   WITHOUT A MIDDLE RUNG, A WHOLE CATEGORY TIES. Fandom at category level is
   one number per category per audience, so every gaming moment in the year
   scored identically, and so did every film. Two hundred moments on the same
   score is not an ordering. Worse, the top of the board became whichever
   category the audience indexed highest on — so Search '26 and Gemini '26,
   who happen to peak on the same category, returned THE SAME TOP TEN despite
   being 60 index points apart on it. An audience switch that returns the same
   answer is the one failure this tool is built to prevent, and a coarse
   resolution reintroduces it by a side door.

   The survey has the answer already: fourteen video game genres, sixteen film
   genres, sixteen television genres, sixteen music genres. A moment is a
   fighting game or a horror film, and those index very differently — Search
   '26 runs 175 on fighting games and 93 on puzzle.

   WHAT THIS TABLE IS NOT. It is not a classifier. It matches on words in the
   moment's name, it gets a bit under half of them, and the rest fall through
   to the category rung and SAY SO. A moment tagged with the wrong genre would
   be worse than one tagged with none, so the patterns are deliberately narrow
   — "Onimusha" is not matched to anything, because guessing from a title is
   how a model starts inventing.                                             */

/* [category, [[survey row label, pattern], ...]]
   Row labels must exist in the bank named for the category in
   tools/build-yougov.mjs, which asserts them at build time. */
export const TOPIC_BANKS = {
  'Gaming':           'Video game genres preferred',
  'Movies':           'Movies - genres watched',
  'TV & Streaming':   'TV - genres watched',
  'Music':            'Music genres preferred',
  'Tours & Concerts': 'Music genres preferred'
};

export const TOPIC_MAP = {
  'Gaming': [
    ['Fighting',        /\bfighting\b|street fighter|tekken|mortal kombat|smash bros|\bEVO\b|tokon/i],
    ['Shooter',         /\bshooter\b|\bFPS\b|call of duty|battlefield|halo|doom|counter[\s-]?strike|rainbow six|borderlands/i],
    ['Battle Royale',   /battle royale|fortnite|\bPUBG\b|apex legends|warzone/i],
    ['Racing',          /\bracing\b|forza|gran turismo|need for speed|mario kart|\bF1 2\d/i],
    ['Sports',          /\bmadden\b|\bFIFA \d|\bEA sports\b|\bNBA 2K\b|\bMLB the show\b|\bWWE 2K\b|football manager/i],
    ['Role-Playing (RPG)', /\bRPG\b|final fantasy|persona|elder scrolls|dragon quest|legend of heroes|baldur|witcher|monster hunter|pokemon|pokémon|xenoblade|fire emblem/i],
    ['Simulation',      /\bsimulator\b|\bsims\b|animal crossing|harvest moon|stardew|farming sim/i],
    ['Strategy',        /\bstrategy\b|civilization|total war|starcraft|age of empires|\bXCOM\b/i],
    ['Platformer',      /\bplatformer\b|\bmario\b(?!\s*kart)|sonic|donkey kong|kirby|hollow knight|crash bandicoot/i],
    ['Building',        /minecraft|cities: ?skylines|\bfactorio\b|satisfactory/i],
    ['Action Adventure', /\bzelda\b|god of war|assassin'?s creed|grand theft auto|\bGTA\b|red dead|spider[\s-]?man|wolverine|tomb raider|uncharted|ghost of|resident evil|silent hill|onimusha|\bnioh\b|phantom blade|\bmetro\b|control:|marvel'?s /i],
    ['Multiplayer Online Battle Arena (MOBA)', /\bMOBA\b|league of legends|\bDOTA\b|smite/i]
  ],
  'Movies': [
    ['Horror',          /\bhorror\b|\bscream\b|conjuring|halloween(?!\s*(day|week))|insidious|nosferatu|\bsaw\b|final destination|\bIT chapter\b|resident evil|paranormal activity|blair witch|a quiet place|28 (days|weeks|years) later|\bwerwulf\b|la llorona|other mommy|\bhexed\b|\bthe uprising\b|\bbloodborne\b|whisper man|even dead burn|camp miasma/i],
    ['Animation',       /\banimation\b|\banimated\b|pixar|dreamworks|illumination|minions|shrek|toy story|frozen|moana|zootopia|\bhow to train\b|ice age|angry birds|paw patrol|\bsimpsons\b|ninja turtles|cat in the hat|sonic the hedgehog|super mario|legend of aang|\bhoppers\b|\bgatto\b|\bwildwood\b|\bdonkey\b|magic school bus|sesame|seasame|\bbad fairies\b|forgotten island|lord of the wings/i],
    ['Science Fiction', /\bsci[\s-]?fi\b|science fiction|star wars|star trek|dune\b|blade runner|tron|\balien\b|predator|matrix|avatar|project hail mary|klara and the sun|hunger games|sunrise on the reaping|mandalorian|horizon zero dawn|death stranding|\bapex\b|the dog stars|children of blood and bone/i],
    ['Fantasy',         /\bfantasy\b|lord of the rings|hobbit|narnia|wicked|harry potter|\bdungeons\b|elden ring|legend of zelda|minecraft movie|\bthe odyssey\b|animal friends|\bcoyote vs acme\b/i],
    ['Action',          /\bmarvel\b|\bDC\b|avengers|batman|superman|spider[\s-]?man|x[\s-]?men|mission: ?impossible|john wick|\bfast x\b|\b007\b|james bond|jurassic|godzilla|\bkong\b|transformers|black panther|ghost rider|\bblade\b|\bsupergirl\b|\bclayface\b|dynamic duo|masters of the universe|john rambo|mortal combat|mortal kombat|street ?fighter|call of duty film|\bthe mummy\b|violent night|\bkaroshi\b|\bcliffhanger\b|\bmutiny\b|\bonslaught\b|miami vice/i],
    ['Comedy',          /\bcomedy\b|\bhappy gilmore\b|spinal tap|naked gun|super troopers|scary movie|spaceballs|meet the parents|focker|jumanji|jumaji|\bidiots\b|the comeback king|\bbuds\b|\bsend help\b|the wrong girls|how to rob a bank/i],
    ['Musical',         /\bmusical\b|\bwicked\b|mamma mia|\bmoulin\b/i],
    ['Documentary',     /\bdocumentary\b|\bdocu\b|\bmichael\b|\bkylie\b|\brafa\b|\bhershey\b|\bGOAT\b/i],
    ['Mystery',         /\bmystery\b|enola holmes|the whisper|\bdisclosure\b|the third parent|calabasas confidential|voicemails for/i],
    ['Historical',      /\bhistorical\b|christmas carol|\bebenezer\b/i],
    ['Romance',         /\bromance\b|\bromantic\b|\bit ends with us\b|devil wears prada|pretty woman|the proposal|wuthering heights|practical magic|you me & tuscany|reminders of him|\bverity\b|the housemaid|\bthe bride\b|i want your sex/i],
    ['Family',          /\bfamily film\b|\bpaddington\b|\bpeppa\b|\bbluey\b|\bsmurfs\b/i]
  ],
  'TV & Streaming': [
    ['Animation',       /\banimated\b|\banimation\b|\banime\b|simpsons|south park|rick and morty|bob'?s burgers|family guy|arcane|\bavatar: the last\b|x[\s-]?men '?97|batman.*crusader|\bblue eye samurai\b/i],
    ['Reality',         /\breality\b|\bbachelor\b|survivor|love island|big brother|real housewives|\bdrag race\b|\btop chef\b|dancing with the stars|the voice|\bidol\b|project runway|vanderpump|khloe kardashian|\bthe kardashians\b|house of stassi|streamer games/i],
    ['Crime',           /\bcrime\b|\blaw ?& ?order\b|\bNCIS\b|\bFBI\b|criminal minds|true detective|\bCSI\b|\bmindhunter\b|will trent|the rookie|\bcape fear\b|\bthe savant\b|ride or die/i],
    ['Sci-Fi & Fantasy', /\bstar trek\b|\bstar wars\b|\bstranger things\b|\bwitcher\b|house of the dragon|rings of power|\bfoundation\b|\bsevrance\b|\bseverance\b|\bwheel of time\b|\bdoctor who\b|dune: ?prophecy|\bthe last sunrise\b/i],
    ['Horror',          /\bhorror\b|\bwalking dead\b|\bAHS\b|american horror|\bfrom\b|\byellowjackets\b/i],
    ['Docuseries',      /\bdocuseries\b|\bdocumentary series\b|\b30 for 30\b/i],
    ['Comedy',          /\bcomedy\b|\bsitcom\b|\bSNL\b|saturday night live|\babbott elementary\b|\bthe office\b|ted lasso|always sunny|shifting gears|\badults \(|\bludwig\b|legally blond|\belle \(/i],
    ['Drama',           /\bdrama\b|\bsuccession\b|\bthe last of us\b|\bthe bear\b|\bwhite lotus\b|\byellowstone\b|\bhandmaid\b|outer banks|\bthe shards\b|\bsugar\b|\bcamp rock\b|\bthe hawk\b|sterling point/i],
    ['International',   /\bK[\s-]?drama\b|\bkorean\b|\btelenovela\b|\bsquid game\b|\bmoney heist\b/i],
    ['Soap opera',      /\bsoap\b|general hospital|days of our lives|\byoung and the restless\b/i],
    ['Classic / Cult',  /little house on the prairie|\btwin peaks\b|\bX[\s-]?files\b/i]
  ],
  'Music': [
    ['K-Pop',           /\bK[\s-]?pop\b|\bBTS\b|blackpink|stray kids|\bTWICE\b|\bseventeen\b|\bNewJeans\b/i],
    ['Hip-Hop/Rap',     /\bhip[\s-]?hop\b|\brap\b|\bdrake\b|kendrick|travis scott|\bcardi\b|\bnicki\b|\bmegan thee\b|\bplayboi\b|\btyler, the creator\b|\bDJ khaled\b|\bJ cole\b|lil wayne|don toliver|\b2 chainz\b|tucker wetmore/i],
    ['Country',         /\bcountry\b|morgan wallen|luke combs|zach bryan|\bchris stapleton\b|\bshaboozey\b/i],
    ['Latin',           /\blatin\b|bad bunny|karol g|peso pluma|\brosalia\b|\bshakira\b|\bmaluma\b|\bregg?aeton\b/i],
    ['Electronic/Dance', /\bEDM\b|electronic|\bhouse music\b|\btechno\b|calvin harris|\bskrillex\b|\bfred again\b|\bdeadmau5\b|john summit|head in the clouds/i],
    ['Rock',            /\brock\b|foo fighters|pearl jam|\bmetallica\b|green day|\bAC\/DC\b|\bmy chemical\b|rolling stones|\bweezer\b|\bthe strokes\b|brandon flowers|\bthe killers\b/i],
    ['Metal',           /\bmetal\b|\bslipknot\b|\bghost\b tour|\bgojira\b/i],
    ['R&B/Soul',        /\bR&B\b|\bsoul\b|\bSZA\b|\bthe weeknd\b|\bbeyonc\b|\busher\b|\bbruno mars\b|daniel caesar|\bkehlani\b|jorja smith|steve lacy|\bjungle\b/i],
    ['Jazz',            /\bjazz\b/i],
    ['Classical',       /\bclassical\b|\bsymphony\b|\borchestra\b|\bopera\b|\bphilharmonic\b/i],
    ['Indie',           /\bindie\b|\bboygenius\b|\bphoebe bridgers\b|\bmitski\b|\bclairo\b|\binterpol\b|bloc party|\bbjork\b|\bbj\u00f6rk\b|lana del rey/i],
    ['Pop',             /\bpop\b|taylor swift|sabrina carpenter|olivia rodrigo|dua lipa|\bariana\b|\bbillie eilish\b|\bcharli xcx\b|\bchappell roan\b|harry styles|\bolivia dean\b|\bmadonna\b|lady gaga|carly rae jepsen|ellie goulding|\btyla\b|sam smith|niall horan|jonas brothers|5 seconds of summer|gracie abrams|alex warren|\bKATSEYE\b|\bWILLOW\b|role model|\bjoji\b|dermot kennedy|shania twain|\bblossoms\b|beabadoobee/i],
    ['Folk',            /\bfolk\b|\bmumford\b|\bnoah kahan\b|\bsuki waterhouse\b|kacey musgraves/i],
    ['Reggae',          /\breggae\b|\bbob marley\b/i],
    ['Blues',           /\bblues\b|jack white/i]
  ]
};
/* Tours & Concerts is scored on the same music-genre battery as Music — a
   Sabrina Carpenter tour and a Sabrina Carpenter album are the same taste. */
TOPIC_MAP['Tours & Concerts'] = TOPIC_MAP['Music'];

/* WHO MADE IT, WHERE THE TITLE WILL NOT SAY.

   Half the film lane is a title and nothing else — "Digger", "The Weight",
   "Apex" — and guessing a genre from those would be inventing. The sheet's
   rights-holder column often answers it outright though, because some studios
   only make one thing: everything Blumhouse releases is a horror film and
   everything Pixar releases is animation. Only specialist houses are listed.
   A general studio like Warner or Universal tells you nothing, so it is not
   here, and its films stay on the category rung. */
export const STUDIO_TOPIC = {
  'Movies': [
    ['Horror',    /blumhouse|atomic monster|monkeypaw|boulderlight|\bA24\b.*horror/i],
    ['Animation', /pixar|laika|dreamworks animation|nickelodeon movies|illumination|prime focus/i],
    ['Action',    /marvel studios|DC Studios|87north|87eleven|activision|legendary entertainment/i],
    ['Comedy',    /apatow|broken lizard|point grey|tribeca enterprises/i]
  ],
  'TV & Streaming': [
    ['Animation', /cartoon network|adult swim|nickelodeon|disney (junior|XD)/i],
    ['Reality',   /\bbravo\b|\bTLC\b/i]
  ]
};

/* The sub-topic for a moment, or null. Narrow on purpose: an unmatched
   moment drops to its category and the rung says so, which is a weaker claim
   the reader can see, rather than a wrong one they cannot.

   The title is asked first and the studio second — a Blumhouse comedy is
   still a comedy, and the title is the more direct evidence of the two. */
export function topicFor(m) {
  const rules = TOPIC_MAP[m.cat];
  if (rules) {
    for (const [label, re] of rules) {
      if (re.test(m.name) || re.test(m.notes || '')) return label;
    }
  }
  const studios = STUDIO_TOPIC[m.cat];
  if (studios) {
    const who = `${m.src || ''} ${m.plat || ''}`;
    if (who.trim()) for (const [label, re] of studios) if (re.test(who)) return label;
  }
  return null;
}
