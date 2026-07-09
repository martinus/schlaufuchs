// Translation runtime (§6.1). One HTML page serves all languages; static text
// carries data-i18n attributes, dynamic text goes through t(key, params).

import de from "../i18n/de.js";
import en from "../i18n/en.js";
import { getSettings, setSettings } from "./storage.js";

// The one place a language is declared. Adding Spanish means: write es.js,
// import it, add a row here, and register "flag-es" in graphics.js. Everything
// else — the settings picker, validation, the fallback chain — follows.
export const LANGUAGES = [
  { code: "de", name: "Deutsch", flag: "flag-de" },
  { code: "en", name: "English", flag: "flag-en" },
];

const dicts = { de: { ...de }, en: { ...en } };
const CODES = LANGUAGES.map((l) => l.code);
const DEFAULT_LANG = CODES[0];
let lang = DEFAULT_LANG;

export function isLang(l) {
  return CODES.includes(l);
}

// Resolution order (§6.1): ?lang= param (persisted) → saved setting →
// navigator.language → "de".
export function initI18n(gameStrings) {
  if (gameStrings) {
    for (const l of CODES) Object.assign(dicts[l], gameStrings[l] ?? {});
  }
  let resolved = null;
  if (typeof location !== "undefined") {
    const p = new URLSearchParams(location.search).get("lang");
    if (isLang(p)) {
      resolved = p;
      setSettings({ lang: p });
    }
  }
  if (!resolved) resolved = getSettings().lang;
  if (!resolved && typeof navigator !== "undefined" && navigator.language) {
    const prefix = navigator.language.toLowerCase().split("-")[0];
    if (isLang(prefix)) resolved = prefix;
  }
  lang = isLang(resolved) ? resolved : DEFAULT_LANG;
  translateDOM();
}

// Fallback chain (§6.1): active language → the default language → the key.
export function t(key, params) {
  let s = dicts[lang][key] ?? dicts[DEFAULT_LANG][key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, v);
  }
  return s;
}

export function getLang() {
  return lang;
}

export function setLang(l) {
  if (!isLang(l)) return;
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
