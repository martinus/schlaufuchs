// The about page (§3.6). It is the one page that publishes a real-world
// identity and four outbound links, so what it must never do is rot: a dead
// link or an unreachable page is worse than no page.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import de from "../assets/i18n/de.js";
import en from "../assets/i18n/en.js";
import { abs, read, PAGES, hasFoxBar } from "./pages.js";

test("the about page exists and is bilingual", () => {
  assert.ok(existsSync(abs("about.html")));
  const keys = Object.keys(de).filter((k) => k.startsWith("about"));
  assert.ok(keys.length >= 10, `only ${keys.length} about strings`);
  for (const k of keys) assert.equal(typeof en[k], "string", `en.js is missing ${k}`);
});

test("it names its author and a way to reach him", () => {
  const html = read("about.html");
  assert.match(html, /mailto:martin\.ankerl@gmail\.com/, "the contact address must be a mailto:");
  assert.match(de.aboutWhoBody, /Martin Leitner-Ankerl/);
  assert.match(en.aboutWhoBody, /Martin Leitner-Ankerl/);
  assert.match(de.aboutWhoBody, /Softwareentwickler/);
});

// Every outbound link was checked by hand once. What a test can hold is that
// they stay https and that none of them silently becomes a relative path.
// Anchors only: the page's canonical/OG URLs are absolute site metadata, not
// outbound links the reader clicks.
test("every outbound link is absolute and https", () => {
  const html = read("about.html");
  const external = [...html.matchAll(/<a [^>]*href="(https?:[^"]+)"/g)].map((m) => m[1]);
  assert.equal(external.length, 4, `expected four project links, found ${external.length}`);
  for (const url of external) assert.match(url, /^https:\/\//, `${url} is not https`);
  for (const host of ["keto-calculator.ankerl.com", "martin.ankerl.com", "github.com/martinus", "ankerl.com/"]) {
    assert.ok(external.some((u) => u.includes(host)), `missing link to ${host}`);
  }
});

// No page may be a dead end for About. About left the gear (it lives on the
// footers now), so a gear page reaches it through the gear's one link out — the
// parents' view — whose footer carries the About link. Footer pages carry it
// themselves.
test("every page can reach the about page", () => {
  assert.match(
    read("assets/js/chrome.js"),
    /<a[^>]*\bcx-parents\b[^>]*href="\$\{PARENTS_URL\}"/,
    "the gear links the parents' view — its one route to the footer pages",
  );
  assert.ok(
    read("parents.html").includes('href="about.html"'),
    "the parents' view footers the About page, so the gear reaches it in two hops",
  );

  for (const page of PAGES) {
    if (page === "about.html") continue;
    const html = read(page);
    assert.ok(hasFoxBar(page) || html.includes('href="about.html"'), `${page} has no route to the about page`);
    assert.ok(!html.includes('href="/about'), `${page}: absolute path`);
  }
});
