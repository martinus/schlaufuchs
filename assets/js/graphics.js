// Central graphics registry (§ graphics registry). Every emoji used as an
// icon lives here with a stable name. By default a name renders as its emoji;
// once a matching SVG file is dropped into assets/img/icons/ and the name is
// listed in AVAILABLE, that name renders as the SVG instead. No runtime
// probing, no 404s — swapping graphics is: add files + add names to AVAILABLE.
//
// NOT routed through here: the fox mascot (fox.js, code-generated) and the
// hand-drawn map scenery polygons in index.html.

import { GAMES, TROPHIES } from "./rewards.js";

// name -> { emoji }. The emoji is always the fallback and must always exist.
export const GRAPHICS = {
  // UI
  "ui-map": { emoji: "🗺️" },
  "ui-gear": { emoji: "⚙️" },
  "ui-sound-on": { emoji: "🔊" },
  "ui-sound-off": { emoji: "🔇" },
  "ui-flame": { emoji: "🔥" },
  "ui-star": { emoji: "⭐" },
  "ui-basket": { emoji: "🧺" },
  "ui-trash": { emoji: "🗑️" },
  "ui-lock": { emoji: "🔒" },

  // Language flags — one per entry in LANGUAGES (i18n.js). Windows renders no
  // flag emoji, so these are the first candidates for real SVGs.
  "flag-de": { emoji: "🇩🇪" },
  "flag-en": { emoji: "🇬🇧" },

  // Regions (mini symbols under the map / on nav buttons)
  "region-einmaleins": { emoji: "🏠" },
  "region-rechnungen": { emoji: "⛰️" },
  "region-tippen": { emoji: "🌊" },
  "region-vokabeln": { emoji: "🌲" },
  "region-lesen": { emoji: "📖" },
  "region-pokalraum": { emoji: "🏆" },

  // Map decorations
  "deco-goat": { emoji: "🐐" },
  "deco-flag": { emoji: "🚩" },
  "deco-eagle": { emoji: "🦅" },
  "deco-owl": { emoji: "🦉" },
  "deco-deer": { emoji: "🦌" },
  "deco-sparkle": { emoji: "✨" },
  "deco-sailboat": { emoji: "⛵" },
  "deco-swan": { emoji: "🦢" },
  "deco-circus": { emoji: "🎪" },
  "deco-flower": { emoji: "🌼" },
  "deco-rainbow": { emoji: "🌈" },
  "deco-book": { emoji: "📖" },
  "deco-trophy": { emoji: "🏆" },
  "deco-party": { emoji: "🎉" },

  // Journey path (obstacles + goals)
  "j-sunflower": { emoji: "🌻" },
  "j-rooster": { emoji: "🐓" },
  "j-door": { emoji: "🚪" },
  "j-rock": { emoji: "🪨" },
  "j-bridge": { emoji: "🌉" },
  "j-troll": { emoji: "🧌" },
  "j-mushroom": { emoji: "🍄" },
  "j-hedgehog": { emoji: "🦔" },
  "j-butterfly": { emoji: "🦋" },
  "j-flower": { emoji: "🌼" },
  "j-bee": { emoji: "🐝" },
};

// Trophy icon names are generated from the TROPHIES table (60 entries), so
// there is no duplication. rewards.js also stamps s.icon on each trophy.
for (const g of GAMES) {
  TROPHIES[g].forEach((s, i) => {
    GRAPHICS[`trophy-${g}-${i + 1}`] = { emoji: s.e };
  });
}

// Names that have a real SVG file in assets/img/icons/<name>.svg. Empty until
// graphics are delivered; add names here (and drop the files) to switch a name
// from emoji to SVG. Nothing else in the code changes.
export const AVAILABLE = new Set([]);

// Resolve an icon file URL relative to THIS module, so it works from any page
// depth and under subpath deploys (never emit an absolute /assets/... path).
const ICON_BASE = new URL("../img/icons/", import.meta.url);
function iconURL(name) {
  return new URL(`${name}.svg`, ICON_BASE).href;
}

function emojiOf(name) {
  return GRAPHICS[name]?.emoji ?? "";
}

// Inline HTML icon. AVAILABLE -> <img>; otherwise a sized <span> with the emoji.
export function iconHTML(name, { size = 24, cls = "" } = {}) {
  const c = cls ? ` ${cls}` : "";
  if (AVAILABLE.has(name)) {
    return `<img class="gicon${c}" src="${iconURL(name)}" width="${size}" height="${size}" alt="">`;
  }
  return `<span class="gicon${c}" style="font-size:${size}px" aria-hidden="true">${emojiOf(name)}</span>`;
}

// Inline SVG icon markup for embedding inside an <svg>. x is the horizontal
// center; y is the text BASELINE (matches every existing <text> call site).
// AVAILABLE -> <image>; otherwise a centered <text> with the emoji.
export function iconSVG(name, { x, y, size = 16, cls = "", attrs = "" } = {}) {
  const a = attrs ? ` ${attrs}` : "";
  if (AVAILABLE.has(name)) {
    return `<image class="${cls}"${a} href="${iconURL(name)}" x="${x - size / 2}" y="${y - size * 0.85}" width="${size}" height="${size}"/>`;
  }
  return `<text class="${cls}"${a} x="${x}" y="${y}" font-size="${size}" text-anchor="middle">${emojiOf(name)}</text>`;
}

const SVGNS = "http://www.w3.org/2000/svg";

// Upgrade every [data-icon] element in `root` to its SVG file IF available.
// If not available, do nothing — the emoji already in the static markup IS the
// fallback, so pages render correctly with an empty AVAILABLE set.
export function applyIcons(root = document) {
  for (const el of root.querySelectorAll("[data-icon]")) {
    const name = el.dataset.icon;
    if (!AVAILABLE.has(name)) continue;
    const size = Number(el.dataset.iconSize) || (el.namespaceURI === SVGNS ? 16 : 24);

    if (el.namespaceURI === SVGNS) {
      // SVG <text> -> SVG-namespace <image>, positioned like iconSVG above.
      const x = Number(el.getAttribute("x")) || 0;
      const y = Number(el.getAttribute("y")) || 0;
      const img = document.createElementNS(SVGNS, "image");
      img.setAttribute("href", iconURL(name));
      img.setAttribute("x", String(x - size / 2));
      img.setAttribute("y", String(y - size * 0.85));
      img.setAttribute("width", String(size));
      img.setAttribute("height", String(size));
      if (el.getAttribute("class")) img.setAttribute("class", el.getAttribute("class"));
      for (const { name: an, value } of Array.from(el.attributes)) {
        if (an.startsWith("data-")) img.setAttribute(an, value);
      }
      el.replaceWith(img);
    } else {
      el.innerHTML = iconHTML(name, { size });
    }
  }
}
