// One top bar (§3.3), built by one function.
//
// It used to be markup, copied into seven pages, and no test could see the
// copies drift — the Trophy Room's bar had a title chip, a spacer and no gear,
// and it took a screenshot to notice. `topBarHTML` is a pure function now, so
// what every page wears is a string this file can read.

import { test } from "node:test";
import assert from "node:assert/strict";
import { topBarHTML } from "../assets/js/chrome.js";
import { PLAYABLE } from "../assets/js/rewards.js";
import { PAGES, read, sourcesOf, hasFoxBar } from "./pages.js";

test("the child's bar is a map button, the fox chip and the gear", () => {
  const bar = topBarHTML({ back: "../../" });
  assert.match(bar, /href="\.\.\/\.\.\/"/, "the map button goes to the map");
  assert.match(bar, /id="foxchip"/);
  assert.match(bar, /id="gearbtn"/);
  // and nothing else: no spacer, no second chip, no title
  assert.ok(!bar.includes("spacer"), "the bar grew a spacer");
  assert.ok(!bar.includes("<h1"), "the bar grew a heading");
  assert.equal((bar.match(/class="iconbtn/g) ?? []).length, 2, "exactly two buttons");
});

test("on the map the map button is flat, and it is not a link", () => {
  // A link back to the page you are on is a lie; a bar that drops the button
  // instead would shift the fox chip sideways between the map and the games.
  const bar = topBarHTML({ back: null });
  assert.match(bar, /class="iconbtn flat"/);
  assert.ok(!bar.includes("<a "), "the map must not link to itself");
  assert.match(bar, /id="foxchip"/);
  assert.match(bar, /id="gearbtn"/);
});

test("the reader's bar is a map button and a heading, with no gear", () => {
  const bar = topBarHTML({ back: "./", title: "privacyTitle" });
  assert.match(bar, /<h1 class="roomtitle" data-i18n="privacyTitle">/);
  assert.ok(!bar.includes("foxchip"), "an adult page shows no child's star count");
  assert.ok(!bar.includes("gearbtn"), "and offers no settings");
});

// Regression: `translateDOM()` runs inside `initI18n()`, before the bar exists.
// Every string the bar builds must therefore be translated at build time AND
// carry the attribute that a later `setLang()` looks for — miss the attribute
// and the bar freezes in the language the page opened with.
test("every string in the bar survives a language switch", () => {
  for (const bar of [topBarHTML({ back: "./" }), topBarHTML({ back: "./", title: "aboutTitle" })]) {
    for (const [tag] of bar.matchAll(/<[a-z][^>]*>/g)) {
      const label = tag.match(/aria-label="([^"]*)"/)?.[1];
      if (label === undefined) continue;
      assert.ok(label.length > 0, `an empty aria-label: ${tag}`);
      assert.ok(!label.includes("{"), `unresolved placeholder in "${label}"`);
      // Translated once at build time — and again by setLang(), which finds an
      // element only through this attribute.
      assert.match(tag, /data-i18n-label="[a-zA-Z0-9_]+"/, `no data-i18n-label: ${tag}`);
    }
  }
  // the heading is text, so it needs the other attribute
  assert.match(topBarHTML({ back: "./", title: "aboutTitle" }), /data-i18n="aboutTitle"/);
});

test("every page contributes an empty top bar and asks for one shape", () => {
  for (const page of PAGES) {
    const html = read(page);
    assert.match(html, /<header class="topbar" id="topbar"><\/header>/, `${page}: no empty top bar`);
    assert.ok(!html.includes("gearbtn"), `${page}: the gear is markup again`);
    assert.ok(!html.includes('id="foxchip"'), `${page}: the chip is markup again`);
    assert.match(sourcesOf(page), /initTopBar\(/, `${page}: nothing ever builds its bar`);
  }
});

test("the child's pages get the child's bar, the reader's pages the reader's", () => {
  const child = ["index.html", "album.html", ...PAGES.filter((p) => p.startsWith("games/"))];
  const reader = ["privacy.html", "about.html", "parents.html"];
  assert.deepEqual([...child, ...reader].sort(), [...PAGES].sort(), "a page belongs to neither");

  for (const page of child) assert.ok(hasFoxBar(page), `${page} lost the fox chip`);
  for (const page of reader) assert.ok(!hasFoxBar(page), `${page} shows a child's chip`);
});

// The unbuilt games were four copies of one script. One word differed.
test("the stub pages carry no script of their own", () => {
  const stubs = PAGES.filter((p) => p.startsWith("games/") && !PLAYABLE.some((g) => p.includes(`/${g}/`)));
  for (const page of stubs) {
    const html = read(page);
    assert.match(html, /<body class="stubpage" data-game="([a-z]+)">/, `${page}: no game named on the body`);
    assert.match(html, /src="\.\.\/\.\.\/assets\/js\/stub\.js/, `${page}: does not use the shared stub`);
    // The shared cache-coherence builder (every page has one) mentions "import"
    // in a comment; strip it so this stays a question about the stub's own code.
    const own = html.replace(/<!-- cache coherence[\s\S]*?<\/script>/, "");
    assert.ok(!own.includes("import "), `${page}: still carries its own module`);
    const game = html.match(/data-game="([a-z]+)"/)[1];
    assert.ok(page.includes(`games/${game}/`), `${page}: says it is "${game}"`);
  }
});

// The stub's sentence points at the one game that exists; the chip is that
// sentence made pressable. Without it the page named a game ready to play and
// then offered only the way back.
test("a stub offers the game that exists, not only the way back", () => {
  const js = read("assets/js/stub.js");
  assert.match(js, /href="\.\.\/einmaleins\/"/, "the chip must lead to the playable game");
  assert.match(js, /t\("stubPlay"\)/, "…and say so in both languages");
  assert.ok(js.indexOf("stubPlay") < js.indexOf('data-i18n="back"'),
    "the game she can play comes before the way back");
});

// One gear, one sheet. It used to take a `resetKind`: "all" on the map, "game"
// inside a game, and *nothing at all* in the Pokalraum — so the same button
// opened three different screens, and in the room a parent looking for the reset
// found a row that simply was not there.
// The comments in these files explain what was removed, so they name it. The
// tests below read the code, not the prose around it.
const codeOf = (p) => read(p).replace(/^\s*\/\/.*$/gm, "");

test("every gear on this site opens the same settings sheet", () => {
  const chrome = codeOf("assets/js/chrome.js");
  // no branching: the sheet is built once and is identical on every gear page
  assert.ok(!chrome.includes("resetKind"), "chrome.js still branches on resetKind");
  assert.ok(!/\$\{resetKind \?/.test(chrome));

  // reset is a per-game list in that one sheet (§3.4): a row per game the cookie
  // holds progress for, plus an "everything" row, each a two-step confirm
  assert.match(chrome, /<div class="resetlist" id="cx-resetlist">/, "the reset list is unconditional markup");
  assert.match(chrome, /resetList\.addEventListener\("click"/, "…and it is always wired");
  assert.match(chrome, /resetGame\(id\)/, "a game row resets that one game");
  assert.match(chrome, /=== "__all__"[\s\S]*?resetAll\(\)/, "the everything row resets the whole site");
  assert.match(chrome, /location\.reload\(\)/, "…and reloads onto the cleared state");

  // …and no page asks its gear for a special per-page reset: the sheet is the
  // same everywhere, so a page never customises it.
  for (const page of PAGES) {
    const src = sourcesOf(page).replace(/^\s*\/\/.*$/gm, "");
    assert.ok(!src.includes("resetKind"), `${page} asks its gear for a special reset`);
  }
  assert.ok(codeOf("assets/js/storage.js").includes("resetGame"), "storage.js provides the per-game reset the gear calls");
});

// A reader's page has no gear at all, so it must never build the sheet: it has
// no fox chip either, and the sheet's reset would wipe a child's progress from
// a page written for adults.
test("the reader's bar builds no settings sheet", () => {
  const chrome = codeOf("assets/js/chrome.js");
  const init = chrome.slice(chrome.indexOf("export function initTopBar"));
  const early = init.indexOf("if (title) return");
  assert.ok(early > -1 && early < init.indexOf("initSettingsOverlay("), "the title bar must return first");
});
