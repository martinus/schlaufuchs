import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import de from "../assets/i18n/de.js";
import en from "../assets/i18n/en.js";
import einmaleins from "../games/einmaleins/i18n.js";
import lesen from "../games/lesen/i18n.js";
import rechnungen from "../games/rechnungen/i18n.js";
import { t, LANGUAGES, isLang } from "../assets/js/i18n.js";

const abs = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));

function assertKeyParity(a, b, label) {
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  assert.deepEqual(ka, kb, `${label}: key sets differ`);
  for (const k of ka) {
    assert.ok(String(a[k]).length > 0, `${label}: empty de value for ${k}`);
    assert.ok(String(b[k]).length > 0, `${label}: empty en value for ${k}`);
  }
}

test("shared dictionaries: every key exists in every language (§6.3)", () => {
  assertKeyParity(de, en, "shared");
});

test("game dictionaries: every key exists in every language (§6.3)", () => {
  assertKeyParity(einmaleins.de, einmaleins.en, "einmaleins");
  assertKeyParity(lesen.de, lesen.en, "lesen");
  assertKeyParity(rechnungen.de, rechnungen.en, "rechnungen");
});

test("t(): placeholder substitution and fallback to key", () => {
  assert.equal(t("starsOwned", { n: 3 }), de.starsOwned.replace("{n}", "3"));
  assert.equal(t("nonexistent-key"), "nonexistent-key");
});

test("no naked concatenation markers in strings (§6.1 templates rule)", () => {
  // placeholders must be {name}, and any brace must be part of one
  for (const [lang, dict] of [["de", de], ["en", en]]) {
    for (const [k, v] of Object.entries(dict)) {
      const braces = String(v).match(/\{[^}]*\}/g) ?? [];
      for (const b of braces) {
        assert.match(b, /^\{[a-zA-Z0-9]+\}$/, `${lang}.${k}: malformed placeholder ${b}`);
      }
    }
  }
});

// Regression: `roundDone` was deleted from both dictionaries while a caller
// still asked for it. A missing key silently renders as the key itself, so the
// UI would have shown the literal text "roundDone" to a child.
test("every key the code asks for exists in both languages", () => {
  const shared = { ...de };
  const gameDicts = { einmaleins: einmaleins.de, lesen: lesen.de, rechnungen: rechnungen.de };

  const files = [
    ...readdirSync(abs("assets/js")).map((f) => [`assets/js/${f}`, null]),
    ...readdirSync(abs("games")).flatMap((g) =>
      readdirSync(abs(`games/${g}`))
        .filter((f) => f.endsWith(".js") && f !== "i18n.js")
        .map((f) => [`games/${g}/${f}`, g]),
    ),
  ];

  for (const [file, game] of files) {
    const src = readFileSync(abs(file), "utf8");
    for (const [, key] of src.matchAll(/\bt\(\s*["'`]([a-zA-Z0-9_]+)["'`]/g)) {
      const known = key in shared || (game && gameDicts[game] && key in gameDicts[game]);
      assert.ok(known, `${file}: t("${key}") has no string in de.js`);
      if (key in shared) assert.ok(key in en, `en.js is missing "${key}"`);
    }
  }
});

// Regression: strings that no caller asks for accumulate and get translated,
// reviewed and carried around for nothing.
test("no dictionary key is dead", () => {
  const used = new Set();
  const walk = (dir) => {
    for (const f of readdirSync(abs(dir), { withFileTypes: true })) {
      if (f.isDirectory()) walk(`${dir}/${f.name}`);
      else if (f.name.endsWith(".js") || f.name.endsWith(".html")) {
        const src = readFileSync(abs(`${dir}/${f.name}`), "utf8");
        for (const [, k] of src.matchAll(/\bt\(\s*["'`]([a-zA-Z0-9_]+)["'`]/g)) used.add(k);
        for (const [, k] of src.matchAll(/data-i18n(?:-label)?="([a-zA-Z0-9_]+)"/g)) used.add(k);
        // the reader's pages name their heading's key when they build the bar
        for (const [, k] of src.matchAll(/\btitle:\s*["']([a-zA-Z0-9_]+)["']/g)) used.add(k);
        // keys held whole in arrays or built at runtime, e.g. DIFF_KEYS,
        // roundrules' TEMPO_KEYS, lesen's verdict pair, `region_${game}` (the
        // runtime-built ones never match whole and ride the `dynamic`
        // exemption below instead)
        for (const [, k] of src.matchAll(/["'`]((?:region_|game_|diff|sumOk|tempo|lesen|mode)[a-zA-Z0-9]*)["'`]/g)) used.add(k);
      }
    }
  };
  walk("assets/js");
  walk("games");
  // discovered, so a new root page's strings are not mistaken for dead ones
  for (const page of readdirSync(abs(".")).filter((f) => f.endsWith(".html"))) {
    const src = readFileSync(abs(page), "utf8");
    for (const [, k] of src.matchAll(/data-i18n(?:-label)?="([a-zA-Z0-9_]+)"/g)) used.add(k);
  }
  used.add("region_pokalraum");

  const dynamic = /^(region_|game_|diff|sumOk)/;
  const dead = Object.keys(de).filter((k) => !used.has(k) && !dynamic.test(k));
  assert.deepEqual(dead, [], `dead strings in de.js/en.js: ${dead.join(", ")}`);

  // The game dictionaries accumulate corpses the same way — emTitle sat in
  // einmaleins' for a year with no caller. lesenPack<Key> keys are built at
  // runtime from content.js and have their own two-way liveness test
  // (tests/lesen-content.test.js).
  const gameDicts = { einmaleins: einmaleins.de, lesen: lesen.de, rechnungen: rechnungen.de };
  for (const [game, dict] of Object.entries(gameDicts)) {
    const deadG = Object.keys(dict)
      .filter((k) => !used.has(k) && !dynamic.test(k) && !k.startsWith("lesenPack"));
    assert.deepEqual(deadG, [], `dead strings in games/${game}/i18n.js: ${deadG.join(", ")}`);
  }
});

// Adding a language must be one declaration, not a hunt through the codebase.
// These fail if LANGUAGES and the dictionaries drift apart.
test("LANGUAGES lists exactly the languages that have a dictionary", () => {
  assert.deepEqual(LANGUAGES.map((l) => l.code).sort(), ["de", "en"]);
  for (const l of LANGUAGES) {
    assert.ok(l.name, `${l.code}: needs a name shown in the picker`);
    assert.ok(l.flag?.startsWith("flag-"), `${l.code}: needs a graphics-registry flag`);
    assert.ok(isLang(l.code));
  }
  assert.equal(isLang("es"), false, "an unknown code must be rejected");
  assert.equal(isLang(undefined), false);
});

test("every language flag is registered in the graphics registry", () => {
  const src = readFileSync(abs("assets/js/graphics.js"), "utf8");
  for (const l of LANGUAGES) {
    assert.ok(src.includes(`"${l.flag}"`), `graphics.js is missing "${l.flag}"`);
  }
});

test("the language picker offers a way back to every language", () => {
  // regression: the settings row was a single button showing the OTHER
  // language, so it never said which one you were currently reading
  const chrome = readFileSync(abs("assets/js/chrome.js"), "utf8");
  assert.ok(chrome.includes("LANGUAGES.map"), "the picker must be built from LANGUAGES");
  assert.ok(chrome.includes('aria-pressed'), "the active language must be marked");
  assert.ok(!/getLang\(\) === "de" \? "EN" : "DE"/.test(chrome), "the old toggle is back");
});

// The tempo ladder's names (§10.6) and the division sign are shared strings —
// every game shows them. Never a number, never a unit of time: the child sees
// an animal or a vehicle, never seconds (§10.3).
test("tempo strings and divSign exist in both languages, and none names a time", () => {
  for (const [lang, dict] of [["de", de], ["en", en]]) {
    assert.ok(dict.divSign, `${lang}.divSign is missing`);
    for (const key of ["tempo1", "tempo2", "tempo3", "tempoBest", "tileTempo"]) {
      const s = dict[key];
      assert.equal(typeof s, "string", `${lang}.${key} is missing`);
      assert.ok(!/\d/.test(s), `${lang}.${key} contains a number: "${s}"`);
      assert.ok(!/\bs\b|sek|\bsec|\bms\b|minut/i.test(s), `${lang}.${key} names a unit of time: "${s}"`);
    }
  }
});

// The chip's icons are aria-hidden, so these two strings are the only thing a
// screen reader has to go on. A placeholder lost in translation would read the
// label out with a literal "{n}" in it.
test("the fox chip's two counters have a spoken label in both languages", () => {
  for (const k of ["starsTotal", "trophyCount"]) {
    for (const [lang, dict] of [["de", de], ["en", en]]) {
      assert.equal(typeof dict[k], "string", `${lang}.js is missing ${k}`);
      assert.match(dict[k], /\{n\}/, `${lang}.js: ${k} must count something`);
    }
  }
  assert.match(de.trophyCount, /\{total\}/);
  assert.match(en.trophyCount, /\{total\}/);
});
