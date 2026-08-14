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
  'data/relevance.js',
  'app.js'
];

const strip = src => src
  .replace(/^\s*import[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')   // the imports become scope
  .replace(/^export\s+(const|function|let|class)\b/gm, '$1');

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
if (/\bimport\s|\bexport\s/.test(js)) {
  console.error('an import or export survived the strip — the bundle would not parse');
  process.exit(1);
}

const css = read('style.css');
const html = read('index.html');

/* The page body, between </head> and </body>, minus the tags the publisher
   supplies itself. */
const body = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>'))
  .replace(/<script[\s\S]*?<\/script>/g, '')
  .trim();

const out = `<title>LTP Moments</title>
<style>
${css}
</style>

${body}

<script type="module">
${js}
</script>
`;

mkdirSync(new URL('dist/', root), { recursive: true });
writeFileSync(new URL('dist/mockups.html', root), out);
console.log(`dist/mockups.html — ${(out.length / 1024).toFixed(0)} KB, ${decls.length} top-level names, no collisions`);
