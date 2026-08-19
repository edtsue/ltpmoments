/* One self-contained page out of the modular source.

   The mockups are written as modules because that is how the real thing will
   be written. A published page cannot fetch a sibling file, so this inlines
   the stylesheet and flattens the four modules into a single module scope —
   which works precisely because the imports form a straight line with no
   cycles and no name collisions. The assertion below is what keeps that true.

   Run: node tools/bundle.mjs                                                 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = p => readFileSync(new URL(p, root), 'utf8');

/* Dependency order, hand-declared. Four files with a linear graph do not need
   a resolver, and a resolver would be the more likely thing to be wrong. */
const ORDER = [
  'data/moments.js',
  'data/audiences.js',
  /* Before relevance.js, which imports from it. It was missing entirely, which
     is half of why this build had been failing. */
  'data/sports-reach.js',
  'data/relevance.js',
  'data/parse.js',
  /* Not a module — a classic script shared with the other planning modules and
     copied between them. It flattens in anyway: its only top-level name is
     `Strip`, everything else lives inside its own closure, and it carries no
     import or export for the strip below to remove. It has to be here because
     `app.js` calls `Strip.init` at the top level, and the body's script tags
     are dropped further down. */
  'strip.js',
  'app.js'
];

const strip = src => src
  .replace(/^\s*import[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')   // the imports become scope
  .replace(/^export\s+(const|function|let|class)\b/gm, '$1')
  /* A bare re-export — `export { NAME };` — names something already declared
     in this file or imported into it. Flattened, both are simply in scope, so
     the line has nothing left to do and is dropped whole. Missing this is the
     other half of why this build had been failing: relevance.js grew one and
     the two rules above only ever matched a declaration. */
  .replace(/^export\s*\{[^}]*\}\s*;?\s*$/gm, '');

const parts = ORDER.map(p => `/* ── ${p} ── */\n${strip(read(p)).trim()}`);
const js = parts.join('\n\n');

/* A flattened scope only works if nothing is declared twice. Catch it here
   rather than as a blank page. */
const decls = [...js.matchAll(/^(?:const|let|function|class)\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]);
const dupes = decls.filter((d, i) => decls.indexOf(d) !== i);
if (dupes.length) {
  console.error('top-level name collision when flattened:', [...new Set(dupes)].join(', '));
  process.exit(1);
}
/* ⚠️ ANCHORED TO A LINE START, because the words are ordinary English. This
   matched "a JSON import needs import attributes" inside a comment and failed
   the build over prose. A statement is at the head of its line; a sentence
   about one is not. */
if (/^[ \t]*(?:import|export)[\s{]/m.test(js)) {
  console.error('an import or export survived the strip — the bundle would not parse');
  process.exit(1);
}

/* Two stylesheets on the page, so two here. `strip.css` is copied between the
   planning modules and stays out of style.css; a bundle that inlined only the
   first would draw the module bar with no fold. */
const css = read('style.css') + '\n' + read('strip.css');
const html = read('index.html');

/* The page body, between </head> and </body>, minus the tags the publisher
   supplies itself. */
let body = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>'))
  .replace(/<script[\s\S]*?<\/script>/g, '')
  .trim();
/* Say what this copy is, rather than leaving a reader wondering why the Gemini
   controls they were told about are not on the page. Appended to the rail's
   foot, which is the one place on the board that is already metadata. */
body = body.replace('<div class="rl-foot" id="railFoot"></div>',
  '<div class="rl-foot" id="railFoot"></div>' +
  '<p class="rl-static">Static copy \u2014 the Gemini reader needs the live site.</p>');

/* The flattened page has no server behind it, so the two Gemini controls would
   offer something that can only fail. They are hidden rather than removed: the
   bundle stays a byte-for-byte flatten of the real files, and the one thing
   that is genuinely different about it is stated on the page. */
const STATIC_NOTE = `<style>
  .gem-row, .pop-read { display: none; }
  .rl-static {
    margin: 8px 3px 0; font-size: 10px; line-height: 1.45;
    color: var(--shell-ink3); font-family: var(--mono);
  }
</style>`;

const out = `<title>LTP Moments</title>
<style>
${css}
</style>
${STATIC_NOTE}

${body}

<script type="module">
${js}
</script>
`;

mkdirSync(new URL('dist/', root), { recursive: true });
writeFileSync(new URL('dist/mockups.html', root), out);
console.log(`dist/mockups.html — ${(out.length / 1024).toFixed(0)} KB, ${decls.length} top-level names, no collisions`);
