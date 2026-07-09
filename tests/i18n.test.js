import { test } from "node:test";
import assert from "node:assert/strict";
import de from "../assets/i18n/de.js";
import en from "../assets/i18n/en.js";
import einmaleins from "../games/einmaleins/i18n.js";
import { t } from "../assets/js/i18n.js";

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
