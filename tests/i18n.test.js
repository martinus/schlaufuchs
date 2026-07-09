import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import de from "../assets/i18n/de.js";
import en from "../assets/i18n/en.js";
import einmaleins from "../games/einmaleins/i18n.js";
import { t, LANGUAGES, isLang } from "../assets/js/i18n.js";
import { COSMETICS } from "../assets/js/rewards.js";

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
});

test("t(): placeholder substitution and fallback to key", () => {
  assert.equal(t("roundStat", { ok: 9, total: 10 }), "9/10");
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
  const gameDicts = { einmaleins: einmaleins.de };

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
        // keys built at runtime, e.g. `region_${game}` or DIFF_KEYS
        for (const [, k] of src.matchAll(/["'`](region_|game_|diff|starGoal|cos_)[a-zA-Z0-9]*["'`]/g)) used.add(k);
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

  const dynamic = /^(region_|game_|diff|starGoal|cos_)/;
  const dead = Object.keys(de).filter((k) => !used.has(k) && !dynamic.test(k));
  assert.deepEqual(dead, [], `dead strings in de.js/en.js: ${dead.join(", ")}`);
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

// `cos_*` is on the dead-key test's dynamic allowlist, which means that test can
// no longer notice one going missing — the same hole `starGoal*` opened. Name
// them from COSMETICS instead of copying the list, so adding a hat to the fox
// and forgetting its translation fails here.
test("every cosmetic the fox can wear has a name in both languages", () => {
  assert.ok(COSMETICS.length >= 6);
  for (const [, name] of COSMETICS) {
    const key = `cos_${name}`;
    assert.equal(typeof de[key], "string", `de.js is missing ${key}`);
    assert.equal(typeof en[key], "string", `en.js is missing ${key}`);
    assert.ok(de[key].length > 0 && en[key].length > 0, `${key} is empty`);
  }
  // and the chip's own two strings
  for (const k of ["foxNext", "foxMax"]) {
    assert.equal(typeof de[k], "string");
    assert.equal(typeof en[k], "string");
  }
  assert.match(de.foxNext, /\{n\}/);
  assert.match(de.foxNext, /\{item\}/);
});
