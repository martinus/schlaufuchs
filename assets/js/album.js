// Trophy album page (§3.2): five sections, 12 slots each, earned trophies
// derive from the per-game perfect-round counters. Tapping one holds it up.

import { initI18n, t, getLang } from "./i18n.js";
import { getRewards } from "./storage.js";
import {
  GAMES, TROPHIES, THRESHOLDS, TROPHIES_PER_GAME, trophyCount, nextTrophyInfo,
} from "./rewards.js";
import { iconHTML, applyIcons } from "./graphics.js";
import { trophyCardHTML } from "./trophycard.js";
import { initTopBar } from "./chrome.js";
import { openShowcase } from "./showcase.js";

initI18n();
applyIcons(document); // the room's own symbol, once real SVGs land

// The village is now called after its game, so its two names are one word said
// twice. Every other region still has a place name and a game name.
function sectionTitle(game) {
  // Just the place (user cleanup, 2026-07-13): "Rechenberg · Rechnungen — 1/12"
  // made a child read a subtitle and a fraction; the shelf itself shows how
  // full it is, and the region name is how the map already talks.
  return t(`region_${game}`);
}

// The cup size on the shelf. Three slots to a row (not four) leaves each slot
// ~105px on a phone, and a 34px cup there was the picker's small-symbol problem
// again: a speck in a wide card. `.trophies` and the summary size the same card
// (`trophycard.js`), so this is the shelf's number, passed at the call site.
const SHELF_CUP = 46;

// The shelves are built with innerHTML, not with [data-i18n], so nothing in
// them is re-translated by setLang(). They are rebuilt instead — which is why
// this is a function and not the body of the module (§3.4).
function render() {
  const pr = getRewards().pr ?? {};
  const lang = getLang();

  const main = document.getElementById("album");
  main.textContent = "";
  for (const game of GAMES) {
    const earned = trophyCount(game, pr[game]);
    // How far the next trophy still is. It used to be a sentence above the
    // shelf — "Noch 2 ⭐ bis zum nächsten Pokal" — and the trophy it was talking
    // about was three slots to the right. It is now written into that slot.
    const next = nextTrophyInfo(game, pr[game]);
    const section = document.createElement("section");
    section.className = "album-section";
    const slots = TROPHIES[game]
      .map((s, i) => {
        // An earned trophy is a button: it opens full size, with the noise a
        // child wants to make about it.
        if (i < earned) {
          return trophyCardHTML(s, {
            size: SHELF_CUP, lang, cls: "slot earned", button: true,
            attrs: `data-trophy="${game}:${i}"`,
          });
        }
        // A locked slot shows the trophy as a silhouette: you can see what is
        // missing, which is the whole reason to keep collecting. The name stays
        // hidden — the shape is the tease.
        //
        // What it costs used to hide in a `title` tooltip, which a child on a
        // phone can never see and Mara read as "20×", i.e. twenty of something.
        // Every locked slot answers the same question — how much further? — in
        // the only currency this site has (§8.3). The total threshold read as
        // a price tag a child cannot relate to what she already owns. The next
        // slot to fall additionally wears the progress bar.
        const need = THRESHOLDS[game][i];
        const owed = need - (pr[game] ?? 0);
        let foot = `<span class="sfoot">+${owed} ⭐</span>`;
        let label = `${t("trophyLocked")} — ${owed === 1 ? t("trophyNextIn1") : t("trophyNextIn", { n: owed })}`;
        if (i === earned && next) {
          foot = `<span class="sbar"><i style="width:${Math.min(100, (100 * (pr[game] ?? 0)) / need)}%"></i></span>`
            + `<span class="sfoot snext">+${owed} ⭐</span>`;
        }
        return `<div class="slot locked" aria-label="${label}">
          <span class="silhouette" aria-hidden="true">${iconHTML(s.icon, { size: SHELF_CUP })}</span>${foot}</div>`;
      })
      .join("");
    section.innerHTML = `
      <h2>${sectionTitle(game)}</h2>
      <div class="trophies">${slots}</div>`;
    main.appendChild(section);
  }
}

// Delegated once, on the container that survives every render(): a listener per
// card would be re-added on every language switch.
document.getElementById("album")?.addEventListener("click", (e) => {
  const card = e.target.closest(".slot.earned");
  if (!card) return;
  const [game, i] = card.dataset.trophy.split(":");
  openShowcase(TROPHIES[game][Number(i)]);
});

// The room wears the same bar, and its gear opens the same sheet as every other
// gear on this site — reset included. It used to open a sheet with no reset at
// all, so a parent who came looking for one found a settings screen that was
// missing a row (§3.4).
initTopBar({ back: "./", help: "album", onChange: render });

render();
