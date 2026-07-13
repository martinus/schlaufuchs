// The parents' view (§20). It is the only page that reads the child's whole
// record, so the risks are different from every other page: it could write to
// the state it reports on, it could reach the child, and it could tell a parent
// something that is not true.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import de from "../assets/i18n/de.js";
import en from "../assets/i18n/en.js";

const root = new URL("../", import.meta.url);
const abs = (p) => fileURLToPath(new URL(p, root));
const read = (p) => readFileSync(abs(p), "utf8");

const PAGES = [
  ...readdirSync(abs(".")).filter((f) => f.endsWith(".html")),
  ...readdirSync(abs("games")).map((g) => `games/${g}/index.html`),
];

test("the page exists and is bilingual", () => {
  assert.ok(existsSync(abs("parents.html")));
  const keys = Object.keys(de).filter((k) => k.startsWith("parents"));
  assert.ok(keys.length >= 15, `only ${keys.length} parent strings`);
  for (const k of keys) assert.equal(typeof en[k], "string", `en.js is missing ${k}`);
});

// A page that reports on the child's progress must not be able to change it.
// One stray setGame() while rendering a heat grid would rewrite the boxes it is
// drawing, and nothing else in the suite would notice. Resetting progress is not
// here at all — it is a per-game reset in the settings gear (§3.4) — so this
// page imports no writer of any kind.
test("the parents' view never writes state", () => {
  const src = read("assets/js/parents.js");
  // word-boundaried: `resetGame` would otherwise be missed by a plain search for
  // "setGame" (it contains that substring), and it must be absent here too.
  for (const setter of ["setGame", "setRewards", "setSettings", "resetAll", "resetGame", "recordRound", "addPractice"]) {
    assert.ok(!new RegExp(`\\b${setter}\\b`).test(src), `parents.js must not import or call ${setter}`);
  }
  assert.ok(src.includes("getGame") && src.includes("getRewards"), "it does have to read");
  // and parentstats.js is pure: no storage, no DOM
  const stats = read("assets/js/parentstats.js");
  assert.ok(!/storage\.js|document|window/.test(stats), "parentstats.js must stay pure");
});

test("every page can reach the parents' view, and no round links to it", () => {
  const chrome = read("assets/js/chrome.js");
  // Für Eltern is a button now (an <a> styled as one), but still the same anchor
  // the gear fills and points at the parents' view.
  assert.match(chrome, /<a[^>]*\bcx-parents\b[^>]*href="\$\{PARENTS_URL\}"/);
  assert.match(chrome, /\.cx-parents"\)\.textContent = t\("parentsLink"\)/);
  assert.match(
    chrome,
    /new URL\("\.\.\/\.\.\/parents\.html", import\.meta\.url\)/,
    "an absolute path breaks a subpath deploy",
  );
  for (const page of PAGES) assert.ok(!read(page).includes('href="/parents'), `${page}: absolute path`);

  // it hangs off the settings overlay, never off the round summary — the
  // summary is what a child looks at, and this page is not for them
  const game = read("games/einmaleins/index.html");
  assert.ok(!game.includes("parents.html"), "a game page must not link the parents' view directly");
});

// Regression risk of the whole design: a beginner has every fact in box 2 by
// default, and box 2 must never be reported as a mistake.
test("the copy never calls an unpractised fact a mistake", () => {
  assert.match(de.parentsLegendOpen, /noch nicht geübt/);
  assert.match(en.parentsLegendOpen, /not practised yet/);
  // and the page says out loud that time is not a goal (§10.3)
  assert.match(de.parentsPace1, /Zeit ist kein Ziel/);
  assert.match(en.parentsPace1, /Time is not a goal/);
});

// Three games report now (§20): each game's block stands on its own, and a child
// who has only read (or only done sums) must not see her page claim she has done
// nothing.
test("every game section is wired, and any one alone defeats the empty state", () => {
  const html = read("parents.html");
  for (const id of ["p-em-sec", "p-lesen-sec", "p-lesen", "p-rechnen-sec", "p-rechnen", "p-toc"]) {
    assert.ok(html.includes(`id="${id}"`), `parents.html lost #${id}`);
  }
  assert.ok(html.includes('data-i18n="parentsLesenIntro"'));
  assert.ok(html.includes('data-i18n="parentsRechnenHint"'));
  // the reading heading is the map's own name for the region, "Lesewiese"
  assert.ok(html.includes('data-i18n="region_lesen"'));
  assert.ok(html.includes('data-i18n="region_rechnungen"'));

  const src = read("assets/js/parents.js");
  assert.match(src, /const played = emPlayed \|\| lesenPlayed \|\| rechnenPlayed/, "one game played must unhide the page");
  assert.match(src, /"p-em-sec"\)\.hidden = !emPlayed/);
  assert.match(src, /"p-lesen-sec"\)\.hidden = !lesenPlayed/);
  assert.match(src, /"p-rechnen-sec"\)\.hidden = !rechnenPlayed/);
  // the words come from the content module, and the skills from rechnungen logic
  assert.match(src, /games\/lesen\/content\.js/);
  assert.match(src, /games\/rechnungen\/logic\.js/);
  // the tier line merges "fast" into solid: the top box is "sits" for every
  // reading skill, and a tally that dropped a state would miscount
  assert.match(src, /s\.solid \+ s\.fast/);
});

// The "undefined" wall (§20): the old report treated poolFor(0)+poolFor(1) as
// the words, but Mittel became whole Stimmt/Quatsch sentences with no `.w`
// field — so every Mittel item rendered its missing word as the literal
// "undefined". Words are difficulty 0 alone now, and each tier is reported apart.
test("the reading report reads only difficulty-0 items as words", () => {
  const src = read("assets/js/parents.js");
  assert.match(src, /lesenWordIds = lesenPoolFor\(0,/, "words are Leicht only");
  assert.match(src, /lesenSentIds = lesenPoolFor\(1,/);
  assert.match(src, /lesenTextIds = lesenPoolFor\(2,/);
  // and only weak words become chips — never the whole set as a wall
  assert.match(src, /weakSightIds\(lesenBoxes, lesenWordIds\)/);
  assert.match(src, /\$\{item\.w\}/, "a word chip resolves to the item's word");
});
