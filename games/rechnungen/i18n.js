// Rechnungen strings (§6.1): one object per language in the same file so a
// missing translation is visible in review. UI chrome only — the tasks the
// child answers are generated (games/rechnungen/logic.js), not translated.
export default {
  de: {
    rechnenPickTitle: "Rechenart & Schwierigkeit",
    // The six mode tiles (§12.1). The symbol is on the tile; these are the
    // spoken names a screen reader reads, and the round-title chip's text.
    modePlus: "Plus",
    modeMinus: "Minus",
    modeRest: "Division mit Rest",
    modeMauer: "Rechenmauern",
    modeQuad: "Rechenquadrate",
    modeMix: "Gemischt",
  },
  en: {
    rechnenPickTitle: "Operation & difficulty",
    modePlus: "Plus",
    modeMinus: "Minus",
    modeRest: "Division with remainder",
    modeMauer: "Number walls",
    modeQuad: "Number grids",
    modeMix: "Mixed",
  },
};
