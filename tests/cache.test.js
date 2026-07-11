// Cache coherence (see tools/version-assets.js).
//
// GitHub Pages caches every file for a day on its own clock, so a browser can
// pair a cached old index.html with a freshly fetched map.js. They then
// disagree about element ids, the JS throws, and the page renders without its
// chips and buttons — a failure that never appears in incognito. Every URL a
// page loads therefore carries that page's version, propagated to nested
// imports by an import map.
//
// The map is no longer written out as one versioned URL per line; each page
// carries a plain module list and one version, and an inline script builds the
// versioned map from them at load time. These tests reconstruct that map the
// same way the browser will, so they still see exactly what gets imported.
//
// These tests fail if someone adds a module, or a page, and forgets to
// regenerate the maps: `node tools/version-assets.js <n>`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const abs = (p) => fileURLToPath(new URL(p, root));
const read = (p) => readFileSync(abs(p), "utf8");

// Discovered, not listed: a new root page must be covered by these tests the
// moment it exists, not when someone remembers to add it here.
const ROOT_PAGES = readdirSync(abs(".")).filter((f) => f.endsWith(".html")).sort();
const PAGES = [
  ...ROOT_PAGES,
  ...readdirSync(abs("games")).map((g) => `games/${g}/index.html`),
];

// The map the page's inline builder will produce: its module list, each key
// stamped with its one version — the same {spec: spec?v=N} the browser ends up
// with. Reconstructing it here keeps every assertion below unchanged.
function builderOf(page) {
  const m = read(page).match(
    /<!-- cache coherence[\s\S]*?<script>([\s\S]*?)<\/script>/,
  );
  assert.ok(m, `${page}: no import-map builder — nested imports would go unversioned`);
  const body = m[1];
  const v = body.match(/var v = "([^"]+)"/)?.[1];
  const mods = JSON.parse(body.match(/var mods = (\[[\s\S]*?\]);/)[1]);
  return { v, mods };
}

function importMapOf(page) {
  const { v, mods } = builderOf(page);
  assert.ok(v, `${page}: the import-map builder carries no version`);
  return Object.fromEntries(mods.map((s) => [s, `${s}?v=${v}`]));
}

// Resolve a specifier the way the browser does, against the importing file,
// and return it as a repo-relative path.
const resolve = (fromDir, spec) => new URL(spec, new URL(fromDir, root)).href.slice(root.href.length);

// Every module reachable from a page, followed transitively through imports.
function reachableFrom(page) {
  const entry = read(page).match(/<script type="module" src="([^"?]+)/)?.[1];
  const inline = [...read(page).matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
  const pageDir = page.replace(/[^/]+$/, "");

  const seen = new Set();
  const queue = [
    ...(entry ? [resolve(pageDir, entry)] : []),
    ...inline.map((s) => resolve(pageDir, s)),
  ];
  while (queue.length) {
    const path = queue.pop();
    if (seen.has(path)) continue;
    seen.add(path);
    const src = read(path);
    const dir = path.replace(/[^/]+$/, "");
    for (const [, spec] of src.matchAll(/from "(\.[^"]+)"/g)) {
      queue.push(resolve(dir, spec));
    }
  }
  return seen;
}

test("every page carries an import map", () => {
  for (const page of PAGES) assert.ok(Object.keys(importMapOf(page)).length > 0, page);
});

// The builder is only correct if the map it injects is in place before the
// first module loads. It runs inline in <head>; the one thing that can break
// that is a module script parsed before it — its imports would resolve against
// no map and be fetched unversioned, the exact incoherence this whole file
// guards. So: the builder must come first, and it must inject a real importmap.
test("the import map is injected before any module the page loads", () => {
  for (const page of PAGES) {
    const html = read(page);
    const builder = html.indexOf("<!-- cache coherence");
    assert.notEqual(builder, -1, `${page}: no import-map builder`);

    const firstModule = html.indexOf('<script type="module"');
    if (firstModule !== -1) {
      assert.ok(
        builder < firstModule,
        `${page}: a module script is parsed before the import map is built`,
      );
    }

    // and what it injects is an import map, put in place synchronously (before
    // the parser reaches that module), not appended after the fact
    const body = html.slice(builder, html.indexOf("</script>", builder));
    assert.match(body, /s\.type = "importmap"/, `${page}: the builder injects no importmap`);
    assert.match(body, /currentScript\.after\(/, `${page}: the map is not inserted before the entry`);
  }
});

test("every module a page can reach is versioned by its import map", () => {
  // Regression: an unversioned nested import (storage.js, pulled in by
  // rewards.js, pulled in by map.js) could come from a different deploy than
  // the page that loaded it.
  for (const page of PAGES) {
    const imports = importMapOf(page);
    const pageDir = page.replace(/[^/]+$/, "");
    const mapped = new Set(Object.keys(imports).map((k) => resolve(pageDir, k)));

    for (const path of reachableFrom(page)) {
      assert.ok(
        mapped.has(path),
        `${page}: ${path} is reachable but not in the import map — it would be fetched unversioned`,
      );
    }
  }
});

test("a page's stylesheet, entry script and import map agree on one version", () => {
  // Regression: the CSS was versioned and the JS was not, so a page could load
  // a stylesheet from one deploy and its scripts from another.
  for (const page of PAGES) {
    const html = read(page);
    const versions = new Set();

    versions.add(html.match(/schlaufuchs\.css\?v=([^"]+)/)?.[1]);
    const entry = html.match(/<script type="module" src="[^"]+\?v=([^"]+)"/)?.[1];
    if (entry) versions.add(entry);
    for (const url of Object.values(importMapOf(page))) {
      versions.add(url.match(/\?v=(.+)$/)?.[1]);
    }

    assert.equal(versions.size, 1, `${page}: mixed versions ${[...versions].join(", ")}`);
    assert.notEqual([...versions][0], undefined, `${page}: unversioned asset`);
  }
});

test("all pages ship the same version", () => {
  const versions = PAGES.map((p) => read(p).match(/schlaufuchs\.css\?v=([^"]+)/)[1]);
  assert.equal(new Set(versions).size, 1, `pages disagree: ${versions.join(", ")}`);
});

test("no page-scripted element lookup can throw on a stale page", () => {
  // Regression: `document.getElementById("gearbtn").addEventListener(...)`
  // threw a TypeError when an older cached page had no gear button, which
  // killed the module before render() ever ran. Optional chaining turns that
  // fatal into a degraded page. This only covers direct getElementById calls
  // on shared chrome; a game's own `$("…")` lookups are not guarded, because a
  // game page without its own question box is broken either way.
  const files = [
    ...readdirSync(abs("assets/js")).map((f) => `assets/js/${f}`),
    ...PAGES,
    ...readdirSync(abs("games")).flatMap((g) =>
      readdirSync(abs(`games/${g}`))
        .filter((f) => f.endsWith(".js"))
        .map((f) => `games/${g}/${f}`),
    ),
  ];
  for (const file of files) {
    const bad = [...read(file).matchAll(/getElementById\((["'`][^)]*)\)\s*\./g)];
    for (const m of bad) {
      assert.fail(`${file}: getElementById(${m[1]}). must use ?. — a stale page has no such element`);
    }
  }
});

// Regression risk: the deploy step used to copy a hard-coded list of pages, so
// a new root page was perfect on localhost and a 404 in production. Nothing in
// the test suite could see it — deploy.yml is not JavaScript.
test("the deploy workflow ships every page this repo builds", () => {
  const yml = read(".github/workflows/deploy.yml");
  const cp = yml.split("\n").find((l) => l.trim().startsWith("cp -r"));
  assert.ok(cp, "deploy.yml must still assemble _site with cp -r");
  assert.ok(
    /(\.\/)?\*\.html/.test(cp),
    `deploy copies a fixed list of pages, so a new one would 404: ${cp.trim()}`,
  );
  for (const dir of ["assets", "games"]) assert.ok(cp.includes(dir), `deploy must ship ${dir}/`);
  assert.ok(ROOT_PAGES.includes("index.html"), "sanity: pages are discovered");
});
