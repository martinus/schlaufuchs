// The about page (§3.6). It is the one page that publishes a real-world
// identity and four outbound links, so what it must never do is rot: a dead
// link or an unreachable page is worse than no page.

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
test("every outbound link is absolute and https", () => {
  const html = read("about.html");
  const external = [...html.matchAll(/href="(https?:[^"]+)"/g)].map((m) => m[1]);
  assert.equal(external.length, 4, `expected four project links, found ${external.length}`);
  for (const url of external) assert.match(url, /^https:\/\//, `${url} is not https`);
  for (const host of ["keto-calculator.ankerl.com", "martin.ankerl.com", "github.com/martinus", "ankerl.com/"]) {
    assert.ok(external.some((u) => u.includes(host)), `missing link to ${host}`);
  }
});

// The gear covers the map, the games and the stubs. The two text pages and the
// Trophy Room have no gear, so they carry links. No page may be a dead end.
test("every page can reach the about page", () => {
  const chrome = read("assets/js/chrome.js");
  assert.match(chrome, /<a class="cx-about" href="\$\{ABOUT_URL\}"><\/a>/);
  assert.match(chrome, /\.cx-about"\)\.textContent = t\("aboutLink"\)/);
  assert.match(
    chrome,
    /new URL\("\.\.\/\.\.\/about\.html", import\.meta\.url\)/,
    "an absolute path breaks a subpath deploy",
  );

  for (const page of PAGES) {
    if (page === "about.html") continue;
    const html = read(page);
    const viaGear = html.includes('id="gearbtn"');
    const viaLink = html.includes('href="about.html"');
    assert.ok(viaGear || viaLink, `${page} has no route to the about page`);
    assert.ok(!html.includes('href="/about'), `${page}: absolute path`);
  }
});
