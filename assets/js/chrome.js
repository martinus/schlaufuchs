// Shared page chrome (§3.3): the one top bar and the settings overlay.
//
// The bar used to be markup, copied into seven pages, and every page then wired
// its own gear and rendered its own chip. Copy number eight would have differed
// from the other seven — the Trophy Room's did, for a year. It is one function
// now, and a page contributes an empty `<header id="topbar">` and says which
// of the two shapes it wears:
//
//   the child's bar   map button · fox chip · gear      (map, games, Pokalraum)
//   the reader's bar  map button · page title           (privacy, about, parents)
//
// The bar is built, not translated in place — but every string in it still
// carries its `data-i18n` attribute, so `setLang()` reaches the parts that stay.

import { t, getLang, setLang, LANGUAGES } from "./i18n.js";
import {
  getSettings, setSettings, resetAll, resetGame, hasGameData, loadState,
  exportState, parseBackup, replaceState,
} from "./storage.js";
import { foxInfo, TOTAL_TROPHIES, GAMES } from "./rewards.js";
import { foxSVG } from "./fox.js";
import { iconHTML } from "./graphics.js";
import { createOverlay } from "./overlay.js";
import { sfx } from "./audio.js";

// The settings overlay links the parents' view (the one adult screen reachable
// from every gear). Privacy and About are not in the gear — they hang off the
// footers (map, album, parents, …) — so the parents' view is the gear's route to
// them. Resolved from this module's own URL: an absolute "/parents" would break
// a subpath deploy, and "../parents.html" is wrong from the map.
const PARENTS_URL = new URL("../../parents.html", import.meta.url).href;

// The fox chip: the mascot, the star count, the trophy count. Nothing else, and
// the same three things on every page that has it (§3.3). It is a status
// readout, not a control — it carries no panel and no shadow, because a chip
// that looks like the buttons beside it and does nothing when tapped is a small
// lie told on every screen.
//
// The icons are decorative, so each counter carries the sentence a screen
// reader should hear instead of a bare number.
export function renderFoxChip(el) {
  if (!el) return;
  const { stars, trophies } = foxInfo();
  el.innerHTML = `
    ${foxSVG({ pose: "neutral", size: 40 })}
    <span class="lbl" role="img" aria-label="${t("starsTotal", { n: stars })}">
      ${iconHTML("ui-star", { size: 16 })}${stars}</span>
    <span class="lbl" role="img" aria-label="${t("trophyCount", { n: trophies, total: TOTAL_TROPHIES })}">
      ${iconHTML("deco-trophy", { size: 16 })}${trophies}</span>`;
}

// The bar's markup, as a string, so `node --test` can read what every page
// wears without a browser. `back` is the href of the map, or null on the map
// itself — there the button stays, flat and unpressable, because the shape of
// the bar must not shift between the map and the place it sends you.
// `title` swaps the chip and the gear for a heading (the reader's pages).
export function topBarHTML({ back = "./", title = null } = {}) {
  const map = back === null
    ? `<span class="iconbtn flat" aria-hidden="true">${iconHTML("ui-map", { size: 22 })}</span>`
    : `<a class="iconbtn" href="${back}" aria-label="${t("back")}" data-i18n-label="back">${iconHTML("ui-map", { size: 22 })}</a>`;

  if (title) return `${map}<h1 class="roomtitle" data-i18n="${title}">${t(title)}</h1>`;

  return `${map}<div class="foxchip" id="foxchip"></div>
    <button class="iconbtn" id="gearbtn" aria-label="${t("settings")}" data-i18n-label="settings">
      ${iconHTML("ui-gear", { size: 22 })}</button>`;
}

// Fill `#topbar`, render the chip, wire the gear to a settings overlay.
// Returns { refresh, settings }: `refresh()` repaints the chip after a round.
//
// A language or sound change always repaints the chip before the page's own
// onChange runs — three pages used to remember that, and one of them forgot.
//
// `onLeave` is handed the map button once, for a page that has something to
// lose when it is pressed (einmaleins: a round that is not saved yet, §10.7).
// The bar does not know what that is and does not ask; it only offers the link.
export function initTopBar({ back = "./", title = null, onChange, onClose, onLeave } = {}) {
  const bar = document.getElementById("topbar");
  if (!bar) return { refresh() {}, settings: null };
  bar.innerHTML = topBarHTML({ back, title });
  if (back !== null) onLeave?.(bar.querySelector("a.iconbtn"));

  if (title) return { refresh() {}, settings: null };

  const chip = bar.querySelector("#foxchip");
  const refresh = () => renderFoxChip(chip);
  refresh();

  const settings = initSettingsOverlay({
    onChange() {
      refresh();
      onChange?.();
    },
    onClose,
  });
  bar.querySelector("#gearbtn")?.addEventListener("click", settings.open);
  return { refresh, settings };
}

// Build the settings overlay and return its handle (§3.4).
//
// **The same rows on every page that has a gear.** The overlay used to take a
// `resetKind` and open three different sheets; it is one sheet now, identical
// everywhere. Reset is per game: one row per game the cookie holds progress for,
// plus an "everything" row — each a named, two-step confirm. (This is where the
// reset lives; the parents' view is read-only information, §20.)
export function initSettingsOverlay({ onChange, onClose } = {}) {
  const overlay = createOverlay({
    onClose,
    sheet: `<h2 class="cx-title"></h2>
      <div class="setrow"><span class="cx-l-sound"></span><button class="iconbtn" id="cx-sound"></button></div>
      <div class="setrow setrow-lang">
        <span class="cx-l-lang"></span>
        <div class="langpick" id="cx-lang" role="group"></div>
      </div>
      <div class="setrow setrow-reset"><span class="cx-l-reset"></span></div>
      <div class="resetlist" id="cx-resetlist"></div>
      <hr class="cx-sep">
      <div class="backuprow">
        <button class="btn-menu" id="cx-export"></button>
        <button class="btn-menu" id="cx-import" data-armable></button>
        <input type="file" id="cx-import-file" accept=".json,application/json" hidden>
      </div>
      <p class="backupbad" id="cx-backup-bad" hidden></p>
      <a class="cx-parents btn-menu" href="${PARENTS_URL}"></a>
      <button class="primary" id="cx-close"></button>`,
    onOpen: renderRows,
  });
  const el = overlay.el;

  const soundBtn = el.querySelector("#cx-sound");
  const langPick = el.querySelector("#cx-lang");
  const resetList = el.querySelector("#cx-resetlist");
  const closeBtn = el.querySelector("#cx-close");

  function renderRows() {
    el.querySelector(".cx-title").textContent = t("settings");
    el.querySelector(".cx-l-sound").textContent = t("sound");
    el.querySelector(".cx-l-lang").textContent = t("language");
    soundBtn.innerHTML = iconHTML(getSettings().sound !== false ? "ui-sound-on" : "ui-sound-off", { size: 22 });
    renderLangPick();
    el.querySelector(".cx-l-reset").textContent = t("resetAll");
    renderResetList();
    el.querySelector("#cx-export").textContent = t("backupSave");
    el.querySelector("#cx-import").textContent = t("backupLoad");
    el.querySelector("#cx-backup-bad").hidden = true;
    el.querySelector(".cx-parents").textContent = t("parentsLink");
    closeBtn.textContent = t("close");
  }

  // One reset row per game the cookie actually holds progress for (real or a
  // stale entry alike), then an "everything" row. Rebuilt on every open, so a
  // game played since last time appears, and a game just cleared drops off.
  function renderResetList() {
    const state = loadState();
    const rows = GAMES.filter((g) => hasGameData(state, g)).map((g) => resetRowHTML(g, t(`game_${g}`)));
    rows.push(resetRowHTML("__all__", t("resetEverything")));
    resetList.innerHTML = rows.join("");
  }
  const resetRowHTML = (id, label) =>
    `<div class="resetrow"><span>${label}</span>`
    + `<button class="resetbtn" type="button" data-reset="${id}">${t("resetBtn")}</button></div>`;

  soundBtn.addEventListener("click", () => {
    setSettings({ sound: getSettings().sound === false });
    sfx.click();
    renderRows();
    onChange?.();
  });

  // Every language is on screen and the active one is marked. A single button
  // showing the *other* language never says which one you are reading now.
  function renderLangPick() {
    const active = getLang();
    langPick.innerHTML = LANGUAGES.map((l) => `
      <button class="langbtn" data-lang="${l.code}" lang="${l.code}"
              aria-pressed="${l.code === active}">
        <span class="flag">${iconHTML(l.flag, { size: 20 })}</span>
        <span>${l.name}</span>
      </button>`).join("");
  }

  langPick.addEventListener("click", (e) => {
    const btn = e.target.closest(".langbtn");
    if (!btn || btn.dataset.lang === getLang()) return;
    setLang(btn.dataset.lang); // re-translates [data-i18n] on the page
    sfx.click();
    renderRows();
    onChange?.();
  });

  // Two-step confirm for every reset row (§3.4): the first tap arms the row and
  // names the stakes, a second within a few seconds does it. Arming one row
  // disarms the others, so two half-pressed buttons can never both fire.
  let armTimer = null;
  function disarmReset() {
    clearTimeout(armTimer);
    for (const b of resetList.querySelectorAll("[data-reset]")) {
      delete b.dataset.armed;
      b.classList.remove("armed");
      b.textContent = t("resetBtn");
    }
  }
  resetList.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-reset]");
    if (!btn) return;
    if (btn.dataset.armed !== "1") {
      disarmReset();
      btn.dataset.armed = "1";
      btn.classList.add("armed");
      btn.textContent = t("resetConfirm");
      sfx.click();
      armTimer = setTimeout(disarmReset, 4000);
      return;
    }
    const id = btn.dataset.reset;
    if (id === "__all__") resetAll();
    else resetGame(id);
    location.reload();
  });
  // --- backup (§9.3): the cookie as a file, and the file back as the cookie ---
  // Export is harmless and fires at once. Import REPLACES a child's whole
  // progress, so its button arms first, exactly like the reset rows above.
  el.querySelector("#cx-export").addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([exportState()], { type: "application/json" }));
    a.download = "schlaufuchs-fortschritt.json";
    a.click();
    URL.revokeObjectURL(a.href);
    sfx.click();
  });

  const importBtn = el.querySelector("#cx-import");
  const importFile = el.querySelector("#cx-import-file");
  const backupBad = el.querySelector("#cx-backup-bad");
  let importArmTimer = null;
  importBtn.addEventListener("click", () => {
    backupBad.hidden = true;
    if (importBtn.dataset.armed !== "1") {
      importBtn.dataset.armed = "1";
      importBtn.classList.add("armed");
      importBtn.textContent = t("resetConfirm");
      sfx.click();
      clearTimeout(importArmTimer);
      importArmTimer = setTimeout(() => {
        delete importBtn.dataset.armed;
        importBtn.classList.remove("armed");
        importBtn.textContent = t("backupLoad");
      }, 4000);
      return;
    }
    importFile.click();
  });

  async function importFrom(file) {
    // Total-or-nothing (storage.js): junk never reaches the cookie, and a
    // GOOD file replaces it whole — then the page must start over, because
    // everything in memory (chips, boxes, the round) is now about the old one.
    const state = file ? parseBackup(await file.text()) : null;
    if (state === null) {
      backupBad.hidden = false;
      backupBad.textContent = t("backupBad");
      return;
    }
    replaceState(state);
    location.reload();
  }
  importFile.addEventListener("change", () => {
    const file = importFile.files?.[0];
    importFile.value = ""; // the same file, chosen twice, must fire twice
    importFrom(file);
  });

  closeBtn.addEventListener("click", overlay.close);

  return overlay;
}
