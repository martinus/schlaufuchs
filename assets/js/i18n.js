// Translation runtime (§6.1). One HTML page serves all languages; static text
// carries data-i18n attributes, dynamic text goes through t(key, params).

import de from "../i18n/de.js";
import en from "../i18n/en.js";
import { getSettings, setSettings } from "./storage.js";

const dicts = { de: { ...de }, en: { ...en } };
let lang = "de";

// Resolution order (§6.1): ?lang= param (persisted) → saved setting →
// navigator.language → "de".
export function initI18n(gameStrings) {
  if (gameStrings) {
    for (const l of ["de", "en"]) Object.assign(dicts[l], gameStrings[l] ?? {});
  }
  let resolved = null;
  if (typeof location !== "undefined") {
    const p = new URLSearchParams(location.search).get("lang");
    if (p === "de" || p === "en") {
      resolved = p;
      setSettings({ lang: p });
    }
  }
  if (!resolved) resolved = getSettings().lang;
  if (!resolved && typeof navigator !== "undefined" && navigator.language) {
    resolved = navigator.language.toLowerCase().startsWith("en") ? "en" : "de";
  }
  lang = resolved === "en" ? "en" : "de";
  translateDOM();
}

// Fallback chain (§6.1): active language → German → the key itself.
export function t(key, params) {
  let s = dicts[lang][key] ?? dicts.de[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, v);
  }
  return s;
}

export function getLang() {
  return lang;
}

export function setLang(l) {
  if (l !== "de" && l !== "en") return;
  lang = l;
  setSettings({ lang: l });
  translateDOM();
}

export function translateDOM() {
  if (typeof document === "undefined") return;
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll("[data-i18n]")) {
    el.textContent = t(el.dataset.i18n);
  }
  for (const el of document.querySelectorAll("[data-i18n-label]")) {
    el.setAttribute("aria-label", t(el.dataset.i18nLabel));
  }
}
