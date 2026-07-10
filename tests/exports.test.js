// Export liveness. Dead exports accumulate the way dead strings do: a symbol
// stays `export`ed after its last caller goes, and the next reader treats it
// as API that must not change. Same deal as the i18n liveness test — every
// exported name must be referenced somewhere outside the module that exports
// it. A test file counts: "pure functions are exported for tests" is this
// repo's convention, but exported-and-untested-and-unused is just dead.
//
// This found four on the day it was written: heatCounts (a subset of
// cellCounts), HEAT and STREAK_MILESTONES (internal), and showcaseSizes
// (exported for tests that did not exist).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PAGES, read } from "./pages.js";

const root = new URL("../", import.meta.url);
const abs = (p) => fileURLToPath(new URL(p, root));

// Every runtime module: the shared ones, and each game's own.
const MODULES = [
  ...readdirSync(abs("assets/js")).map((f) => `assets/js/${f}`),
  ...readdirSync(abs("games")).flatMap((g) =>
    readdirSync(abs(`games/${g}`)).filter((f) => f.endsWith(".js")).map((f) => `games/${g}/${f}`)),
].filter((p) => p.endsWith(".js"));

// Where a reference may live: every other module, every page, every test —
// except this file, whose own comments name the exports it once buried.
const CORPUS = [
  ...MODULES,
  ...PAGES,
  ...readdirSync(abs("tests")).filter((f) => f.endsWith(".js")).map((f) => `tests/${f}`),
  ...readdirSync(abs("tools")).filter((f) => f.endsWith(".js") || f.endsWith(".mjs")).map((f) => `tools/${f}`),
].filter((p) => p !== "tests/exports.test.js");

function exportsOf(src) {
  const names = [];
  for (const m of src.matchAll(/^export (?:async )?(?:function|const|let|class) ([A-Za-z_$][\w$]*)/gm)) {
    names.push(m[1]);
  }
  for (const m of src.matchAll(/^export \{([^}]*)\}/gm)) {
    for (const part of m[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/).pop();
      if (name) names.push(name);
    }
  }
  return names; // default exports are the module itself; they cannot go stale alone
}

test("every export is referenced outside the module that exports it", () => {
  const texts = new Map(CORPUS.map((p) => [p, readFileSync(abs(p), "utf8")]));
  const dead = [];
  for (const mod of MODULES) {
    for (const name of exportsOf(texts.get(mod) ?? read(mod))) {
      const ref = new RegExp(`\\b${name}\\b`);
      const used = [...texts].some(([p, src]) => p !== mod && ref.test(src));
      if (!used) dead.push(`${mod} → ${name}`);
    }
  }
  assert.deepEqual(dead, [], `dead exports:\n${dead.join("\n")}`);
});
