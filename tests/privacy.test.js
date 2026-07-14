// The privacy page (§3.5). Two things can quietly break it: a page that has no
// way to reach it, and a link that only resolves from the site root.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import de from "../assets/i18n/de.js";
import en from "../assets/i18n/en.js";
import { abs, read, PAGES, hasFoxBar } from "./pages.js";

test("the privacy page exists and says the things it must say", () => {
  assert.ok(existsSync(abs("privacy.html")));
  for (const k of ["privacyTitle", "privacyStorageH", "privacyNoTrackH", "privacyHostingH",
    "privacyDeleteH", "privacyLink"]) {
    assert.equal(typeof de[k], "string", `de.js is missing ${k}`);
    assert.equal(typeof en[k], "string", `en.js is missing ${k}`);
  }
  // it names the store, in both languages — and what it promises must be true:
  // localStorage is never transmitted, so the state may not live in a cookie
  assert.match(de.privacyStorageBody, /schlaufuchs/);
  assert.match(en.privacyStorageBody, /schlaufuchs/);
  assert.match(read("assets/js/storage.js"), /localStorage/, "the promise is only true over localStorage");
});

// No page is a dead end for privacy. Privacy left the gear (it lives on the
// footers now), so a gear page reaches it through the gear's one link out — the
// parents' view — whose footer carries the privacy link. Footer pages carry it
// themselves.
test("every page can reach the privacy page", () => {
  assert.match(
    read("assets/js/chrome.js"),
    /<a[^>]*\bcx-parents\b[^>]*href="\$\{PARENTS_URL\}"/,
    "the gear links the parents' view — its one route to the footer pages",
  );
  assert.ok(
    read("parents.html").includes('href="privacy.html"'),
    "the parents' view footers the privacy page, so the gear reaches it in two hops",
  );

  for (const page of PAGES) {
    if (page === "privacy.html") continue;
    const viaFoot = read(page).includes('href="privacy.html"');
    assert.ok(hasFoxBar(page) || viaFoot, `${page} has no route to the privacy page`);
  }
});

// Regression risk: `/privacy.html` works on schlaufuchs.ankerl.com and 404s on
// any subpath deploy. The footer links are relative, so they resolve either way.
test("the privacy link never roots at / (subpath deploys)", () => {
  for (const page of PAGES) assert.ok(!read(page).includes('href="/privacy'), `${page}: absolute path`);
  assert.ok(!/href="\/privacy/.test(read("assets/js/chrome.js")), "chrome.js must not root the path either");
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
