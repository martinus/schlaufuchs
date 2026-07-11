#!/usr/bin/env node
// Cache coherence for a static site with no build step.
//
// GitHub Pages serves every file with `Cache-Control: max-age=86400`, and each
// file's cache entry expires on its own clock. A browser can therefore hold a
// cached `index.html` from one deploy while re-fetching `map.js` from the next
// one. The two disagree about element ids, the JS throws, and the page renders
// without its chips and buttons. Incognito never sees this because its cache
// is empty, so every file comes from the same deploy.
//
// The fix: every URL a page loads carries the page's version. A cached old page
// keeps asking for the old URLs (and gets them from its own cache); a new page
// asks for new URLs. The two deploys never mix. `index.html` itself stays
// unversioned — it is the one file allowed to go stale, and it goes stale
// whole.
//
// Nested imports are covered by an import map: `rewards.js` importing
// "./storage.js" resolves to the same URL as the map key, so it is rewritten to
// the versioned URL too. That is why the import map must list EVERY module, not
// just the entry point.
//
// Usage: node tools/version-assets.js <version>
// Run this before committing whenever any file under assets/ or games/ changed.

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const version = process.argv[2];
if (!version) {
  console.error("usage: node tools/version-assets.js <version>");
  process.exit(1);
}

// Every module that any page may pull in, directly or transitively. A game's
// `logic.js` is pure and belongs here too: the parents' view reads the times
// tables through it rather than copying `pairOf` and letting the two drift —
// and its `content.js` with it, because the parents' view names lesen's words.
const shared = [
  ...readdirSync(join(ROOT, "assets/js")).map((f) => `assets/js/${f}`),
  ...readdirSync(join(ROOT, "assets/i18n")).map((f) => `assets/i18n/${f}`),
  ...readdirSync(join(ROOT, "games")).flatMap((g) => [`games/${g}/logic.js`, `games/${g}/content.js`]),
].filter((p) => p.endsWith(".js") && existsSync(join(ROOT, p)));

// Every root-level page, discovered — a page added to a hard-coded list only
// when someone remembers is a page that ships unversioned.
const pages = [
  ...readdirSync(ROOT).filter((f) => f.endsWith(".html")).sort(),
  ...readdirSync(join(ROOT, "games")).map((g) => `games/${g}/index.html`),
];

// Turn "assets/js/map.js" into the specifier a page at `pageDir` would use.
function rel(pageDir, target) {
  const r = relative(pageDir, target).split("\\").join("/");
  return r.startsWith(".") ? r : `./${r}`;
}

const MAP_START = "  <!-- cache coherence: see tools/version-assets.js -->";

for (const page of pages) {
  const abs = join(ROOT, page);
  const pageDir = dirname(page) === "." ? "" : dirname(page);
  let html = readFileSync(abs, "utf8");

  // every module this page can reach: the shared ones plus its own siblings
  const local = readdirSync(join(ROOT, pageDir || "."))
    .filter((f) => f.endsWith(".js"))
    .map((f) => (pageDir ? `${pageDir}/${f}` : f));

  const imports = Object.fromEntries(
    [...shared, ...local].map((m) => {
      const spec = rel(pageDir, m);
      return [spec, `${spec}?v=${version}`];
    }),
  );

  const block =
    `${MAP_START}\n` +
    `  <script type="importmap">\n` +
    `${JSON.stringify({ imports }, null, 2)
      .split("\n")
      .map((l) => `  ${l}`)
      .join("\n")}\n` +
    `  </script>`;

  // replace an existing block, or insert one before the first module script
  const existing = new RegExp(
    `${MAP_START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n\\s*<script type="importmap">[\\s\\S]*?</script>`,
  );
  if (existing.test(html)) {
    html = html.replace(existing, block);
  } else {
    html = html.replace(/^(\s*)<\/head>/m, `${block}\n$1</head>`);
  }

  // the entry script and the stylesheet carry the version directly
  html = html.replace(/(<script type="module" src="[^"?]+)(\?v=[^"]*)?"/g, `$1?v=${version}"`);
  html = html.replace(/(schlaufuchs\.css)(\?v=[^"]*)?"/g, `$1?v=${version}"`);

  writeFileSync(abs, html);
  console.log(`versioned ${page} (${Object.keys(imports).length} modules)`);
}
