// The help overlay (§3.3): every child page carries a ❔ button in the top bar,
// before the gear, that opens a short illustrated explanation FOR THE PARENT —
// what the child is meant to do, and what the exercise teaches.
//
// It exists because a grown-up who has never seen the game (Martin's wife, on
// the Rechenberg) faces "? ? ?" over "4 3 2" and a keypad with no idea that
// each brick is the two below it added up. The child learns by playing; the
// adult beside her had nothing to read. This is that missing page, one per
// place, and it never talks to the child — the fox chip and the gear are hers.
//
// The content is bilingual through i18n like everything else; the pictures are
// small inline SVGs built here (never files in the graphics AVAILABLE set —
// they are illustrations, not icons). The sheet is rebuilt on every open so a
// language switch in the gear reaches it, exactly as the settings sheet does.

import { t } from "./i18n.js";
import { createOverlay } from "./overlay.js";
import { sfx } from "./audio.js";

// The topics a page may ask for. A page passes one id to `initTopBar({help})`;
// an unknown id is a wiring bug, caught by tests/help.test.js.
export const HELP_TOPICS = [
  "einmaleins", "rechnungen", "lesen", "map", "album", "stub",
];

// The bar button (child's bar only, before the gear). The glyph is a drawn
// circled "?" in --ink, not the ❔ emoji: the emoji is a pale blue outline that
// read as washed-out next to the solid gear. currentColor keeps it the bar's
// ink weight. The spoken label rides on `data-i18n-label` so a language switch
// finds it — the same contract every other bar string keeps (tests/topbar.js).
export function helpButtonHTML() {
  return `<button class="iconbtn" id="helpbtn" aria-label="${t("helpTitle")}" data-i18n-label="helpTitle">`
    + `<svg class="helpicon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">`
    + `<circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2.2"/>`
    + `<text x="12" y="17.4" text-anchor="middle" font-size="15" font-weight="800" fill="currentColor">?</text>`
    + `</svg></button>`;
}

// --- illustrations ----------------------------------------------------------
// Palette from the CSS custom properties, so light-theme tokens stay in one
// place: --depth is "what you have", --orange is "what you do / look here".
const svg = (vb, inner) =>
  `<svg class="help-ill" viewBox="${vb}" role="img" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;

// A number-wall brick. `hot` marks the worked example (4 + 3 → 7) in orange so
// the eye follows the rule; every other brick is calm --depth.
function wallBrick(x, y, label, hot) {
  const fill = hot ? "var(--orange-soft)" : "var(--depth-soft)";
  const stroke = hot ? "var(--orange)" : "var(--depth)";
  const tcol = hot ? "var(--orange)" : "var(--depth)";
  return `<rect x="${x}" y="${y}" width="64" height="40" rx="9" fill="${fill}" stroke="${stroke}" stroke-width="2.5"/>`
    + `<text x="${x + 32}" y="${y + 27}" text-anchor="middle" font-size="21" font-weight="800" fill="${tcol}">${label}</text>`;
}

// The wall the Rechenmauer draws: base 4·3·2 given, 7·5 and 12 built above.
// The left triangle (4, 3 → 7) is the highlighted worked example, with two
// thin feeders converging into the brick it sums to.
function illWall() {
  return svg("0 0 240 168",
    // feeders from the base pair up into the "7"
    `<path d="M48 120 L80 111 M120 120 L88 111" stroke="var(--orange)" stroke-width="2.5" stroke-linecap="round" fill="none" opacity="0.8"/>`
    + wallBrick(88, 16, "12", false)
    + wallBrick(52, 68, "7", true) + wallBrick(124, 68, "5", false)
    + wallBrick(16, 120, "4", true) + wallBrick(88, 120, "3", true) + wallBrick(160, 120, "2", false));
}

// The Rechenquadrat: a 2×2 grid, its sign in the corner, one cell left as "?"
// so the reader sees an inner cell = its row header ∘ its column header.
function quadCell(x, y, label, kind) {
  const fill = kind === "hdr" ? "var(--depth-soft)" : kind === "ask" ? "var(--orange-soft)" : "var(--panel)";
  const stroke = kind === "ask" ? "var(--orange)" : "var(--depth)";
  const tcol = kind === "hdr" ? "var(--depth)" : kind === "ask" ? "var(--orange)" : "var(--ink)";
  return `<rect x="${x}" y="${y}" width="42" height="42" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="2.5"/>`
    + `<text x="${x + 21}" y="${y + 28}" text-anchor="middle" font-size="20" font-weight="800" fill="${tcol}">${label}</text>`;
}
function illQuad() {
  const C = [8, 58, 108]; // x/y grid lines
  return svg("0 0 158 158",
    quadCell(C[0], C[0], "+", "hdr") + quadCell(C[1], C[0], "3", "hdr") + quadCell(C[2], C[0], "4", "hdr")
    + quadCell(C[0], C[1], "5", "hdr") + quadCell(C[1], C[1], "?", "ask") + quadCell(C[2], C[1], "9", "cell")
    + quadCell(C[0], C[2], "2", "hdr") + quadCell(C[1], C[2], "5", "cell") + quadCell(C[2], C[2], "6", "cell"));
}

// A one-line task card with orange gaps — the shape ÷R and every keypad task
// wear. `task` is the printed line; each `?` in it is drawn as an orange gap.
function illCard(vb, task) {
  const shown = task.replace(/\?/g, `<tspan fill="var(--orange)" font-weight="800">?</tspan>`);
  const [, , w, h] = vb.split(" ").map(Number);
  return svg(vb,
    `<rect x="4" y="4" width="${w - 8}" height="${h - 8}" rx="12" fill="var(--panel)" stroke="var(--depth-soft)" stroke-width="2.5"/>`
    + `<text x="${w / 2}" y="${h / 2 + 9}" text-anchor="middle" font-size="26" font-weight="800" fill="var(--ink)">${shown}</text>`);
}

// Einmaleins: the three stars a tile is worth, and the equation whose one gap
// the child fills.
function illEinmaleins() {
  return svg("0 0 240 116",
    `<text x="92" y="30" font-size="24" text-anchor="middle">⭐</text>`
    + `<text x="120" y="24" font-size="26" text-anchor="middle">⭐</text>`
    + `<text x="148" y="30" font-size="24" text-anchor="middle">⭐</text>`
    + `<rect x="24" y="48" width="192" height="54" rx="12" fill="var(--panel)" stroke="var(--depth-soft)" stroke-width="2.5"/>`
    + `<text x="120" y="84" text-anchor="middle" font-size="27" font-weight="800" fill="var(--ink)">3 × 5 = <tspan fill="var(--orange)">?</tspan></text>`);
}

// Lesen: a flashed word, then the matching picture picked from four. The dog is
// ringed in orange — the answer the reading found.
function illLesen() {
  const tile = (x, emoji, hot) =>
    `<rect x="${x}" y="86" width="46" height="46" rx="10" fill="var(--panel)" stroke="${hot ? "var(--orange)" : "var(--depth-soft)"}" stroke-width="${hot ? 3 : 2}"/>`
    + `<text x="${x + 23}" y="118" text-anchor="middle" font-size="26">${emoji}</text>`;
  return svg("0 0 240 148",
    `<rect x="66" y="8" width="108" height="46" rx="12" fill="var(--depth-soft)" stroke="var(--depth)" stroke-width="2.5"/>`
    + `<text x="120" y="30" text-anchor="middle" font-size="15">👀</text>`
    + `<text x="120" y="48" text-anchor="middle" font-size="19" font-weight="800" fill="var(--depth)">Hund</text>`
    + `<path d="M120 58 L120 78 M114 72 L120 79 L126 72" stroke="var(--orange)" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
    + tile(17, "🐶", true) + tile(71, "🐱", false) + tile(125, "🐟", false) + tile(179, "🦆", false));
}

// The map: regions to tap, the fox that carries the score, on the island.
function illMap() {
  const spot = (x, y, emoji) =>
    `<circle cx="${x}" cy="${y}" r="20" fill="var(--panel)" stroke="var(--depth-soft)" stroke-width="2.5"/>`
    + `<text x="${x}" y="${y + 8}" text-anchor="middle" font-size="20">${emoji}</text>`;
  return svg("0 0 240 130",
    `<rect x="8" y="8" width="224" height="114" rx="18" fill="var(--grass)"/>`
    + spot(58, 46, "🏠") + spot(120, 38, "⛰️") + spot(182, 50, "📖")
    + `<text x="120" y="98" text-anchor="middle" font-size="30">🦊</text>`
    + `<text x="196" y="104" text-anchor="middle" font-size="20">🏆</text>`
    + `<text x="44" y="104" text-anchor="middle" font-size="20">⭐</text>`);
}

// The Pokalraum: stars collected become a trophy on the shelf.
function illAlbum() {
  return svg("0 0 240 110",
    `<text x="40" y="52" text-anchor="middle" font-size="22">⭐</text>`
    + `<text x="66" y="46" text-anchor="middle" font-size="18">⭐</text>`
    + `<text x="40" y="76" text-anchor="middle" font-size="18">⭐</text>`
    + `<path d="M92 58 L128 58 M120 50 L130 58 L120 66" stroke="var(--orange)" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
    + `<text x="176" y="66" text-anchor="middle" font-size="48">🏆</text>`
    + `<rect x="130" y="86" width="92" height="8" rx="4" fill="var(--depth-soft)"/>`);
}

// --- topics -----------------------------------------------------------------
// Each builds the sheet's inner HTML in the CURRENT language. Every string is a
// literal `t("help…")` so the i18n liveness test sees it used.
// The picture follows its own text, never precedes it: stacked on a narrow
// phone, a picture placed first reads as belonging to the heading above it (the
// wall's grid sat under "Number wall" and looked like its illustration). After
// the text it attaches to its own step — heading, explanation, then the picture.
function step(html, art) {
  return `<li><div class="help-steptxt">${html}</div>${art ? `<div class="help-art">${art}</div>` : ""}</li>`;
}

function sheetHTML({ title, hero, goal, steps }) {
  return `<div class="help-top">
      <h2 class="help-title" tabindex="-1">${title}</h2>
      <p class="help-forparents">${t("helpForParents")}</p>
    </div>
    ${hero ? `<div class="help-hero">${hero}</div>` : ""}
    <section class="help-sec">
      <h3>${t("helpGoalH")}</h3>
      <p>${goal}</p>
    </section>
    <section class="help-sec">
      <h3>${t("helpStepsH")}</h3>
      <ol class="help-steps">${steps.join("")}</ol>
    </section>
    <button class="primary" id="help-close">${t("close")}</button>`;
}

const BUILDERS = {
  einmaleins: () => sheetHTML({
    title: t("region_einmaleins"),
    hero: illEinmaleins(),
    goal: t("helpEmGoal"),
    steps: [step(t("helpEmS1")), step(t("helpStars")), step(t("helpAid"))],
  }),
  rechnungen: () => sheetHTML({
    title: t("region_rechnungen"),
    hero: "",
    goal: t("helpReGoal"),
    steps: [
      step(t("helpReS1")),
      step(`<b class="help-mode">${t("helpReMauerH")}</b> ${t("helpReMauer")}`, illWall()),
      step(`<b class="help-mode">${t("helpReQuadH")}</b> ${t("helpReQuad")}`, illQuad()),
      step(`<b class="help-mode">${t("helpReRestH")}</b> ${t("helpReRest")}`, illCard("0 0 200 52", "13 : 4 = ? R ?")),
      step(t("helpStars")),
    ],
  }),
  lesen: () => sheetHTML({
    title: t("region_lesen"),
    hero: illLesen(),
    goal: t("helpLeGoal"),
    steps: [step(t("helpLeS1")), step(t("helpLeS2")), step(t("helpLeS3")), step(t("helpStars"))],
  }),
  map: () => sheetHTML({
    title: t("helpMapTitle"),
    hero: illMap(),
    goal: t("helpMapGoal"),
    steps: [step(t("helpMapS1")), step(t("helpMapS2"))],
  }),
  album: () => sheetHTML({
    title: t("region_pokalraum"),
    hero: illAlbum(),
    goal: t("helpAlGoal"),
    steps: [step(t("helpAlS1")), step(t("helpStars"))],
  }),
  stub: () => sheetHTML({
    title: t("helpMapTitle"),
    hero: illMap(),
    goal: t("helpMapGoal"),
    steps: [step(t("helpStubBody"))],
  }),
};

// The inner markup of one topic's sheet, in the current language. Exported for
// tests/help.test.js (every topic builds, every string is real).
export function helpSheetHTML(topic) {
  return (BUILDERS[topic] ?? BUILDERS.map)();
}

// Build the help overlay for `topic` and return its handle. The sheet is
// rebuilt on every open (`onOpen`) so a language switch reaches it. The close
// button is inside the sheet — the overlay's own Escape/backdrop close it too.
export function initHelpOverlay(topic) {
  const overlay = createOverlay({
    className: "help-overlay",
    sheet: "",
    // Focus the title, not the first control: the only control is the Close
    // button at the very bottom, and focusing it scrolled the tall sheet down
    // so the guide opened on its last line. The title sits at the top, carries
    // the same role a screen reader wants read first, and takes no scroll with
    // it (it is `tabindex="-1"`, reachable only this way).
    initialFocus: ".help-title",
    onOpen() {
      const sheet = overlay.el.querySelector(".sheet");
      sheet.innerHTML = helpSheetHTML(topic);
      sheet.scrollTop = 0;
      sheet.querySelector("#help-close")?.addEventListener("click", () => {
        sfx.click();
        overlay.close();
      });
    },
  });
  return overlay;
}
