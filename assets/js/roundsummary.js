// The round summary — the one screen a finished round hands over (§10.1, §10.6,
// §8.3). All three games paint it identically: the stars as the groups they are
// won in, a "new best" line, the tempo verdict as a symbol, and every trophy
// the round paid — each the same card the album shows. This module owns that
// paint, the overlay, and its two buttons (OK → level picker, trophy → showcase);
// only the per-round numbers and the game's own bar/picker come from the caller.
//
// What stays per game: computing those numbers (cookie shapes differ, §12/§14)
// and calling `journey.finish()` before `show()` — the walk that precedes the
// pop belongs to the game's scene, the 700ms wait for it lives here.
import { t, getLang } from "./i18n.js";
import { starSlotsHTML } from "./journey.js";
import { starValue } from "./rewards.js";
import { TEMPO_ICONS, TEMPO_KEYS } from "./roundrules.js";
import { iconHTML } from "./graphics.js";
import { trophyCardHTML } from "./trophycard.js";
import { openShowcase } from "./showcase.js";
import { overlayFrom } from "./overlay.js";
import { confetti } from "./confetti.js";
import { sfx } from "./audio.js";

const $ = (id) => document.getElementById(id);

// One of six cheers on the OK button, picked fresh each round so the summary
// never reads the same twice in a row (§10.1).
const SUM_OK_KEYS = ["sumOk1", "sumOk2", "sumOk3", "sumOk4", "sumOk5", "sumOk6"];

// Give the finish-line walk time to arrive before the summary pops over it.
const SETTLE_MS = 700;

// `picker` — the level picker the OK button opens (the fox is left standing on
// the tile just played, §10.1). `refresh` — re-render the top bar's counters,
// which the round just changed (a thunk, because the bar is usually built after
// this factory runs). Returns the overlay (games' guards call `.open()` on it)
// and `show`, the painter.
export function createRoundSummary({ picker, refresh }) {
  // The summary leads with the trophy it just handed out, and that trophy is a
  // button (the showcase) — so the button, not the trophy, must have the focus.
  const summary = overlayFrom(document.getElementById("sum-overlay"), {
    dismissible: false,
    initialFocus: "#sum-ok",
  });

  let wonTrophies = []; // what this round just handed over, for the showcase

  // The OK button opens the level picker, fox still on the played tile (§3.3).
  $("sum-ok").addEventListener("click", picker.open);

  // A trophy she just won, held up the way the Pokalraum holds it up — without
  // sending her there (§8.3). Delegated once: `show` rewrites this row's
  // innerHTML on every round that pays.
  $("sum-trophy").addEventListener("click", (e) => {
    const card = e.target.closest(".won");
    if (card) openShowcase(wonTrophies[Number(card.dataset.won)]);
  });

  // Paint and open the summary for one finished round.
  // `old`/`stars` — mastered stars before/after; `improved` — stars > old;
  // `diff` — difficulty (for the tile's star groups); `tier`/`tempoImproved` —
  // the tempo verdict; `trophies` — every trophy this round paid.
  function show({ old, stars, improved, diff, tier, tempoImproved, trophies }) {
    setTimeout(() => {
      // The stars as the GROUPS they are won in (§10.1): the tile's state after
      // the round — gold slots you own (a fresh one pops in), ghosts still to
      // win. The slots ARE the score; the goal line names the one number that
      // helps.
      const ownedNow = Math.max(old, stars);
      $("sum-stars").innerHTML = starSlotsHTML(ownedNow, starValue(diff), improved ? stars - old : 0);
      $("sum-best").hidden = !improved;
      $("sum-best").textContent = t("newBest");
      // The finish line's verdict, as a symbol and its name — never a number of
      // time (§10.6). A round that awarded no tier shows nothing: below the hare
      // there is no snail, only an empty line that never appears.
      const paid = stars >= 2 && tier > 0;
      $("sum-tempo").hidden = !paid;
      if (paid) {
        $("sum-tempo").innerHTML =
          `${iconHTML(TEMPO_ICONS[tier], { size: 22 })} ${t(TEMPO_KEYS[tier])}`
          + (tempoImproved ? ` · <b>${t("tempoBest")}</b>` : "");
      }
      // One round can cross several thresholds at once (§8.3) — the summary
      // holds every trophy it paid, each one the same card the album shows.
      const st = $("sum-trophy");
      wonTrophies = trophies;
      st.hidden = trophies.length === 0;
      if (trophies.length > 0) {
        // The cup fills its card; the three widths are in the CSS
        // (`.summary .trophy-earn .won`).
        const size = [82, 68, 48][trophies.length - 1] ?? 48;
        const lang = getLang();
        st.innerHTML = trophies
          .map((s, i) => trophyCardHTML(s, {
            size, lang, cls: "won", button: true, attrs: `data-won="${i}"`,
          }))
          .join("");
        sfx.trophy();
      }
      $("sum-ok").textContent = t(SUM_OK_KEYS[Math.floor(Math.random() * SUM_OK_KEYS.length)]);
      // The stars just changed with the cookie; the chip was rendered at
      // startRound() and nobody told it. Without this a child reads "⭐ 0" in
      // the top bar while three stars light up beneath it.
      refresh();
      summary.open();
      if (improved || tempoImproved || stars === 3 || trophies.length > 0) confetti();
    }, SETTLE_MS);
  }

  return { summary, show };
}
