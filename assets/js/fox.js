// The Schlaufuchs mascot (§15): one geometric SVG fox, poses as variations,
// cosmetic layers unlocked by fox level (§8.4). Returned as a markup string
// so pages can inline it anywhere (map, journey, headers, reactions).

import { COSMETICS } from "./rewards.js";

const ORANGE = "#e8590c";
const DARK = "#4a2c17";
const CREAM = "#fff7ee";

function eyes(pose) {
  switch (pose) {
    case "happy":
    case "cheer":
      // closed happy arcs
      return `<path d="M35 49 q5 -6 10 0" stroke="${DARK}" stroke-width="3" fill="none" stroke-linecap="round"/>
              <path d="M55 49 q5 -6 10 0" stroke="${DARK}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    case "breath":
      // gently closed
      return `<path d="M36 50 h8" stroke="${DARK}" stroke-width="3" stroke-linecap="round"/>
              <path d="M56 50 h8" stroke="${DARK}" stroke-width="3" stroke-linecap="round"/>`;
    case "think":
      return `<circle cx="40" cy="50" r="3.5" fill="${DARK}"/>
              <circle cx="60" cy="50" r="3.5" fill="${DARK}"/>
              <path d="M33 42 h12" stroke="${DARK}" stroke-width="2.5" stroke-linecap="round"/>`;
    default:
      return `<circle cx="40" cy="50" r="3.5" fill="${DARK}"/>
              <circle cx="60" cy="50" r="3.5" fill="${DARK}"/>`;
  }
}

function mouth(pose) {
  switch (pose) {
    case "cheer":
      return `<ellipse cx="50" cy="73" rx="5" ry="6" fill="${DARK}"/>`;
    case "breath":
      return `<circle cx="50" cy="73" r="3" fill="${DARK}"/>`;
    default:
      return `<path d="M44 71 q6 5 12 0" stroke="${DARK}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  }
}

function cosmeticLayers(level) {
  const on = new Set(COSMETICS.filter(([lvl]) => level >= lvl).map(([, name]) => name));
  let s = "";
  if (on.has("backpack"))
    s += `<rect x="16" y="60" width="8" height="22" rx="4" fill="#8d5524"/>
          <rect x="76" y="60" width="8" height="22" rx="4" fill="#8d5524"/>`;
  if (on.has("scarf"))
    s += `<rect x="28" y="80" width="44" height="9" rx="4" fill="#c1121f"/>
          <rect x="58" y="86" width="9" height="12" rx="3" fill="#c1121f"/>`;
  if (on.has("medal"))
    s += `<path d="M46 88 l4 6 l4 -6" stroke="#1d6fb8" stroke-width="3" fill="none"/>
          <circle cx="50" cy="95" r="4.5" fill="#f4b400" stroke="#b8860b"/>`;
  if (on.has("glasses"))
    s += `<circle cx="40" cy="50" r="8" fill="none" stroke="${DARK}" stroke-width="2.5"/>
          <circle cx="60" cy="50" r="8" fill="none" stroke="${DARK}" stroke-width="2.5"/>
          <path d="M48 50 h4" stroke="${DARK}" stroke-width="2.5"/>`;
  if (on.has("cap") && !on.has("crown") && !on.has("goldcrown"))
    s += `<path d="M32 30 a18 12 0 0 1 36 0 z" fill="#1d6fb8"/>
          <rect x="48" y="16" width="6" height="8" rx="2" fill="#1d6fb8"/>`;
  if (on.has("crown") && !on.has("goldcrown"))
    s += `<path d="M36 28 l4 -10 l6 7 l4 -11 l4 11 l6 -7 l4 10 z" fill="#c0c0c0" stroke="#8a8a8a"/>`;
  if (on.has("goldcrown"))
    s += `<path d="M34 28 l5 -12 l7 8 l4 -13 l4 13 l7 -8 l5 12 z" fill="#f4b400" stroke="#b8860b"/>
          <circle cx="43" cy="22" r="1.8" fill="#c1121f"/><circle cx="57" cy="22" r="1.8" fill="#1d6fb8"/>`;
  return s;
}

// foxSVG({pose, size, level, cls}) → SVG markup string.
// Poses: neutral | happy | cheer | think | breath.
export function foxSVG({ pose = "neutral", size = 64, level = 1, cls = "" } = {}) {
  return `<svg class="fox ${cls}" viewBox="0 0 100 100" width="${size}" height="${size}"
       aria-hidden="true" focusable="false">
    <polygon points="22,42 32,8 46,34" fill="${ORANGE}"/>
    <polygon points="78,42 68,8 54,34" fill="${ORANGE}"/>
    <polygon points="27,36 33,16 41,32" fill="${DARK}"/>
    <polygon points="73,36 67,16 59,32" fill="${DARK}"/>
    <ellipse cx="50" cy="55" rx="32" ry="30" fill="${ORANGE}"/>
    <path d="M20 58 a32 27 0 0 0 60 0 a45 34 0 0 1 -60 0" fill="${CREAM}"/>
    <ellipse cx="50" cy="67" rx="15" ry="12" fill="${CREAM}"/>
    ${eyes(pose)}
    <circle cx="50" cy="61" r="4.5" fill="${DARK}"/>
    ${mouth(pose)}
    ${cosmeticLayers(level)}
  </svg>`;
}
