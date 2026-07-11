// Rechnungen strings (§6.1): one object per language in the same file so a
// missing translation is visible in review. UI chrome only — the questions the
// child answers are generated (games/rechnungen/logic.js), not translated.
export default {
  de: {
    rechnenPickTitle: "Rechenart & Schwierigkeit",
    // The five mode tiles (§12.1). The symbol is on the tile; these are the
    // spoken names a screen reader reads, and the round-title chip's text.
    modePlus: "Plus",
    modeMinus: "Minus",
    modeTimes: "Mal",
    modeDivide: "Geteilt",
    modeMix: "Gemischt",
    // German schools write division as ":" — a child has never seen "÷".
    divSign: ":",
    // The tempo ladder (§10.6). Never a number with a unit of time.
    tempo1: "Hase",
    tempo2: "Rennauto",
    tempo3: "Rakete",
    tempoBest: "Neuer Tempo-Rekord!",
    tileTempo: "Tempo: {name}",
  },
  en: {
    rechnenPickTitle: "Operation & difficulty",
    modePlus: "Plus",
    modeMinus: "Minus",
    modeTimes: "Times",
    modeDivide: "Divide",
    modeMix: "Mixed",
    divSign: "÷",
    tempo1: "Hare",
    tempo2: "Race car",
    tempo3: "Rocket",
    tempoBest: "New speed record!",
    tileTempo: "Speed: {name}",
  },
};
