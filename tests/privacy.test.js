// The privacy page (§3.5). Two things can quietly break it: a page that has no
// way to reach it, and a link that only resolves from the site root.

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

test("the privacy page exists and says the things it must say", () => {
  assert.ok(existsSync(abs("privacy.html")));
  for (const k of ["privacyTitle", "privacyCookieH", "privacyNoTrackH", "privacyHostingH",
    "privacyDeleteH", "privacyLink"]) {
    assert.equal(typeof de[k], "string", `de.js is missing ${k}`);
    assert.equal(typeof en[k], "string", `en.js is missing ${k}`);
  }
  // it explains the cookie by name, in both languages
  assert.match(de.privacyCookieBody, /schlaufuchs/);
  assert.match(en.privacyCookieBody, /schlaufuchs/);
});

// The gear reaches it on the map, the games and the stubs. The Trophy Room has
// no gear — it and the map carry a footer link instead. Every page needs one.
test("every page can reach the privacy page", () => {
  const chrome = read("assets/js/chrome.js");
  // Both halves, named separately. Asserting only that "cx-privacy" appears
  // somewhere passed happily when the anchor was deleted and the line that
  // fills it survived — which is a null dereference, not a missing link.
  assert.match(
    chrome,
    /<a class="cx-privacy" href="\$\{PRIVACY_URL\}"><\/a>/,
    "the settings overlay must render the privacy anchor",
  );
  assert.match(
    chrome,
    /\.cx-privacy"\)\.textContent = t\("privacyLink"\)/,
    "and must give it its translated label",
  );

  for (const page of PAGES) {
    if (page === "privacy.html") continue;
    const html = read(page);
    const viaGear = html.includes('id="gearbtn"');
    const viaFoot = html.includes('href="privacy.html"');
    assert.ok(viaGear || viaFoot, `${page} has no route to the privacy page`);
  }
});

// Regression risk: `/privacy.html` works on schlaufuchs.ankerl.com and 404s on
// any subpath deploy, and `../privacy.html` is wrong from the map.
test("the privacy URL is resolved from the module, never rooted at /", () => {
  const chrome = read("assets/js/chrome.js");
  assert.match(
    chrome,
    /new URL\("\.\.\/\.\.\/privacy\.html", import\.meta\.url\)/,
    "resolve the privacy page against chrome.js's own URL",
  );
  assert.ok(!/href="\/privacy/.test(chrome), "an absolute path breaks subpath deploys");
  for (const page of PAGES) assert.ok(!read(page).includes('href="/privacy'), `${page}: absolute path`);
});

// The footer link must be a sibling of the translated paragraph: translateDOM
// sets textContent, so a link inside it is deleted on the first language switch.
test("the footer link is not swallowed by translateDOM", () => {
  for (const page of ["index.html", "album.html"]) {
    const html = read(page);
    assert.ok(
      !/<p[^>]*data-i18n="[^"]*"[^>]*>[^<]*<a/.test(html),
      `${page}: a link inside a [data-i18n] element is overwritten on setLang()`,
    );
  }
});
