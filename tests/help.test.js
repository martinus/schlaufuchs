// The help overlay (§3.3): the ❔ button in the bar and the parent's guide it
// opens. A grown-up who has never seen a game — the Rechenberg's "? ? ?" over
// "4 3 2" — had nothing to read; this is that page. These tests hold the wiring
// (every child page asks for a guide, no reader page does), the button's place
// in the bar, and the content (every topic builds, every string is real, every
// little picture is a self-contained SVG).

import { test } from "node:test";
import assert from "node:assert/strict";
import { HELP_TOPICS, helpButtonHTML, helpSheetHTML } from "../assets/js/help.js";
import { topBarHTML } from "../assets/js/chrome.js";
import de from "../assets/i18n/de.js";
import en from "../assets/i18n/en.js";
import { PAGES, read, sourcesOf, hasFoxBar } from "./pages.js";

// The topic a page passes to initTopBar({help}), or null. It rides in the
// page's entry module (stub.js for the unbuilt games), so read the sources.
const helpTopicOf = (page) => sourcesOf(page).match(/\bhelp:\s*["']([a-z]+)["']/)?.[1] ?? null;

test("every child page asks for a help guide; no reader page does", () => {
  for (const page of PAGES) {
    const topic = helpTopicOf(page);
    if (hasFoxBar(page)) {
      assert.ok(topic, `${page}: a child page must offer a help guide`);
      assert.ok(HELP_TOPICS.includes(topic), `${page}: unknown help topic "${topic}"`);
    } else {
      // The reader's pages (privacy, about, parents) ARE the grown-up's side
      // already; a second parent guide on them would be a button to nowhere.
      assert.equal(topic, null, `${page}: a reader page must not carry a help button`);
    }
  }
});

test("the help button sits before the gear, and only the child's bar has it", () => {
  const bar = topBarHTML({ back: "../../", help: "einmaleins" });
  assert.match(bar, /id="helpbtn"/, "the help button is missing");
  assert.ok(bar.indexOf("helpbtn") < bar.indexOf("gearbtn"), "help must come before the gear");
  // exactly three buttons now: map, help, gear (the fox chip is not a button)
  assert.equal((bar.match(/class="iconbtn/g) ?? []).length, 3, "map · help · gear");

  // opt-in: a bar built without a topic carries no help button
  assert.ok(!topBarHTML({ back: "../../" }).includes("helpbtn"), "help must be opt-in");
  // the reader's bar never carries it, even if a topic were passed by mistake
  assert.ok(!topBarHTML({ back: "./", title: "aboutTitle", help: "map" }).includes("helpbtn"));
});

// Same contract as every other bar string: a language switch must reach it, and
// it finds the button only through data-i18n-label (regression that froze the
// bar in the opening language, tests/topbar.test.js).
test("the help button carries a translatable spoken label", () => {
  const html = helpButtonHTML();
  const label = html.match(/aria-label="([^"]*)"/)?.[1];
  assert.ok(label && label.length > 0 && !label.includes("{"), "no spoken label");
  assert.match(html, /data-i18n-label="helpTitle"/, "no data-i18n-label");
});

test("every topic builds a complete guide with no unresolved strings", () => {
  for (const topic of HELP_TOPICS) {
    const sheet = helpSheetHTML(topic);
    assert.ok(sheet.length > 0, `${topic}: empty sheet`);
    assert.match(sheet, /class="help-forparents"/, `${topic}: no "for parents" note`);
    assert.match(sheet, /id="help-close"/, `${topic}: no way to close`);
    assert.match(sheet, /<h3>[^<]+<\/h3>/, `${topic}: a heading did not resolve`);
    assert.match(sheet, /<li>/, `${topic}: no steps`);
    // an unresolved t() renders as the bare key; none must leak through
    assert.ok(!/>help[A-Za-z]+</.test(sheet), `${topic}: a raw help key leaked into the text`);
    // §6.1 templates: no stray placeholder brace survived into the markup
    assert.ok(!sheet.includes("{"), `${topic}: an unfilled placeholder`);
  }
});

// The pictures are illustrations, not registry icons: inline SVG built in
// help.js, so a subpath deploy must not depend on any external file (the icon
// rule, graphics.js). And no scripts — this is content, not behaviour.
test("every illustration is a self-contained, script-free SVG", () => {
  for (const topic of HELP_TOPICS) {
    const sheet = helpSheetHTML(topic);
    for (const [, openTag] of sheet.matchAll(/<svg\b([^>]*)>/g)) {
      assert.match(openTag, /viewBox="0 0 \d+ \d+"/, `${topic}: an SVG has no viewBox`);
    }
    assert.ok(!/<script/i.test(sheet), `${topic}: an illustration carries a script`);
    assert.ok(!/\b(?:href|src)="https?:/i.test(sheet), `${topic}: an illustration reaches offsite`);
    assert.ok(!/url\(/i.test(sheet), `${topic}: an illustration pulls an external url`);
  }
});

// Belt and braces on the i18n side: the topics lean on shared help keys and on
// region_/game_ titles, so the keys they name must live in BOTH languages
// (tests/i18n.test.js covers parity generally; this pins the help set).
test("the shared help strings exist in both languages", () => {
  const keys = ["helpTitle", "helpForParents", "helpGoalH", "helpStepsH", "helpStars", "helpAid"];
  for (const k of keys) {
    assert.equal(typeof de[k], "string", `de.js is missing ${k}`);
    assert.equal(typeof en[k], "string", `en.js is missing ${k}`);
  }
});

// Regression guard for the reason the feature exists: the Rechenberg guide must
// actually explain the number wall's rule, in words a parent can act on.
test("the Rechenberg guide explains the number wall", () => {
  for (const [lang, dict] of [["de", de], ["en", en]]) {
    assert.ok(dict.helpReMauer.length > 40, `${lang}: the wall explanation is too thin`);
  }
  assert.match(helpSheetHTML("rechnungen"), /help-mode/, "the modes are not called out");
});
