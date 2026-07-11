// One trophy, held up (§3.2). The album shelf and the round summary both call
// this, so a child meets the same celebration in both places.
//
// A trophy on a 77px slot is a receipt. Mara won her first one, tapped it, and
// nothing happened — so it stayed a receipt. Tapping it now hands it to her: the
// cup fills the screen, confetti falls, the fox jumps at its corner and the
// stars around it blink. It is the one screen in this site built to be shown to
// somebody else.
//
// The summary's trophy used to be a *link to the Pokalraum*. Tapping it did
// celebrate — by taking the child out of her finished round and dropping her in
// a room full of empty slots. Now the round stays where it is and the trophy
// comes forward. The showcase's overlay sits above the summary's (z-index 50 vs
// 40), Escape closes it, and the focus goes back to the trophy she pressed.

import { createOverlay } from "./overlay.js";
import { confettiRain } from "./confetti.js";
import { foxSVG } from "./fox.js";
import { sfx } from "./audio.js";
import { trophyCardHTML } from "./trophycard.js";
import { t, getLang } from "./i18n.js";

const SPARKS = 7;

// The card is square and fills what the screen has left over once the sheet's
// own box and the Close button are paid for. Measured here, not in CSS: the cup
// is an emoji, so its size is a font-size in px, and no CSS length can be
// derived from the width of the box it has to fit into.
//
// The width budget is the overlay's 12px margins plus the sheet's 16px padding,
// on both sides — a card sized to the viewport alone hung out over the sheet.
const SHEET_X = 2 * (12 + 16);
const SHEET_Y = 250; // the Close button, the gaps, the paddings

export function showcaseSizes(w, h) {
  const card = Math.max(160, Math.min(w - SHEET_X - 8, h - SHEET_Y, 340));
  // the art is the symbol (0.66 cups, overlapping the rim) standing on the cup —
  // about 1.4 cups tall — and the name lives under it
  return { card, cup: Math.round(card * 0.52) };
}

// Built on the first open, not at import: a round that wins nothing never puts
// an overlay in the page.
let ui = null;
// The rain runs while the sheet is open and is torn down when it closes, so the
// looping pieces do not keep animating behind a dismissed overlay.
let stopRain = null;

function build() {
  const overlay = createOverlay({
    className: "showcase",
    sheet: `<div class="sc-stage">
        <div class="sc-sparks" aria-hidden="true">${"<i>⭐</i>".repeat(SPARKS)}</div>
        <div class="sc-card" id="sc-card"></div>
        <div class="sc-fox" aria-hidden="true">${foxSVG({ pose: "cheer", size: 76 })}</div>
      </div>
      <button class="primary" id="sc-close"></button>`,
    initialFocus: "#sc-close",
    onClose: () => { stopRain?.(); stopRain = null; },
  });
  const card = overlay.el.querySelector("#sc-card");
  const close = overlay.el.querySelector("#sc-close");
  const sheet = overlay.el.querySelector(".sheet");
  close.addEventListener("click", overlay.close);
  return { overlay, card, close, sheet };
}

export function openShowcase(trophy) {
  ui ??= build();
  const { card, cup } = showcaseSizes(window.innerWidth, window.innerHeight);
  ui.card.style.setProperty("--sc-card", `${card}px`);
  ui.card.innerHTML = trophyCardHTML(trophy, { size: cup, lang: getLang() });
  ui.close.textContent = t("close");
  ui.overlay.open();
  sfx.trophy();
  // The whole view fills with confetti that never stops, in front of everything
  // but the cup — the trophy is being shown off, so the storm keeps going until
  // she puts it down, and only the plaque is lifted clear of it so it is framed,
  // not buried (§3.2). Started after open(), so the overlay has a measured
  // height for the fall distance.
  stopRain?.();
  stopRain = confettiRain(ui.overlay.el);
}
