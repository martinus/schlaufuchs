// Einmaleins strings (§6.1): one object per language in the same file so a
// missing translation is visible in review.
export default {
  de: {
    emTitle: "Einmaleins",
    emTable: "{t}er-Reihe",
    emTableShort: "{t}er",
    emMixed: "Alle",
    emPickTitle: "Reihe & Schwierigkeit",
    // The picker's tiles are pictures; these three are what a screen reader
    // hears — including the fox, which is drawn but never announced.
    tileStarsLeft: "noch {n} Sterne zu holen",
    tileMastered: "geschafft",
    tileHere: "hier stehst du",
    // The tempo ladder (§10.6). Never a number with a unit of time — the
    // child sees an animal or a vehicle, never seconds.
    tempo1: "Hase",
    tempo2: "Rennauto",
    tempo3: "Rakete",
    tempoBest: "Neuer Tempo-Rekord!",
    tileTempo: "Tempo: {name}",
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
    tileHere: "you are here",
    tempo1: "Hare",
    tempo2: "Race car",
    tempo3: "Rocket",
    tempoBest: "New speed record!",
    tileTempo: "Speed: {name}",
    divSign: "÷",
  },
};
