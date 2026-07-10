// One trophy, drawn the same way wherever it appears (§3.2, §3.4).
//
// Mara won a trophy, saw it in the round summary, and did not recognise the
// thing on the album shelf as the same object — the summary showed a bare
// emoji, the album showed it in a frame. So there is now exactly one card:
// a cup with the trophy's own emoji sitting in its bowl, the name beneath it.
// The album and the summary both call this, and a child can follow the picture
// from the round that earned it to the shelf it lives on.
//
// It renders an <a> when `href` is given, a <button> when `button` is set, and
// a <div> otherwise: the summary's trophy leads to the album, the album's opens
// the trophy full size, and a card that does neither must not look tappable.

import { iconHTML } from "./graphics.js";

// The theme emoji rides in the cup's bowl, so it is drawn smaller than the cup
// that carries it — but not by much. At half the cup a 🔔 in a 34px card was a
// speck, and the twelve trophies on a shelf were twelve identical cups. Ratio,
// not pixels: the card is used at 34px on the shelf and at 44px in the summary.
const THEME_RATIO = 0.66;

export function trophyCardHTML(trophy, { size = 34, lang = "de", href, button = false, cls = "", label, attrs: extra = "" } = {}) {
  const tag = href ? "a" : button ? "button" : "div";
  const attrs = [
    `class="tcard${cls ? ` ${cls}` : ""}"`,
    href ? `href="${href}"` : "",
    button ? `type="button"` : "",
    label ? `aria-label="${label}"` : "",
    extra,
  ].filter(Boolean).join(" ");

  const cup = iconHTML("deco-trophy", { size, cls: "t-cup" });
  const theme = iconHTML(trophy.icon, { size: Math.round(size * THEME_RATIO), cls: "t-theme" });

  return `<${tag} ${attrs}><span class="t-art" aria-hidden="true">${cup}${theme}</span>` +
    `<span class="sname">${trophy[lang]}</span></${tag}>`;
}
