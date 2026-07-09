import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import de from "../assets/i18n/de.js";
import en from "../assets/i18n/en.js";
import einmaleins from "../games/einmaleins/i18n.js";
import { t } from "../assets/js/i18n.js";

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
  assert.equal(t("roundStat", { ok: 9, total: 10, s: 46 }), "9/10 · 46 s");
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
        for (const [, k] of src.matchAll(/["'`](region_|game_|diff)[a-zA-Z]*["'`]/g)) used.add(k);
      }
    }
  };
  walk("assets/js");
  walk("games");
  for (const page of ["index.html", "album.html"]) {
    const src = readFileSync(abs(page), "utf8");
    for (const [, k] of src.matchAll(/data-i18n(?:-label)?="([a-zA-Z0-9_]+)"/g)) used.add(k);
  }
  used.add("region_pokalraum");

  const dynamic = /^(region_|game_|diff)/;
  const dead = Object.keys(de).filter((k) => !used.has(k) && !dynamic.test(k));
  assert.deepEqual(dead, [], `dead strings in de.js/en.js: ${dead.join(", ")}`);
});
