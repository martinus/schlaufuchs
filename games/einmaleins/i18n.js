// Einmaleins strings (§6.1): one object per language in the same file so a
// missing translation is visible in review.
export default {
  de: {
    emTitle: "Einmaleins",
    emTable: "{t}er-Reihe",
    emTableShort: "{t}er",
    emMixed: "Alle",
    emPickTitle: "Reihe & Schwierigkeit",
    // The picker's tiles are pictures; these two are what a screen reader hears.
    tileStarsLeft: "noch {n} Sterne zu holen",
    tileMastered: "geschafft",
    // German schools write division as ":" — Mara did not recognise "÷".
    divSign: ":",
  },
  en: {
    emTitle: "Times tables",
    emTable: "{t} times table",
    emTableShort: "×{t}",
    emMixed: "All",
    emPickTitle: "Table & difficulty",
    tileStarsLeft: "{n} stars still to win",
    tileMastered: "mastered",
    divSign: "÷",
  },
};
