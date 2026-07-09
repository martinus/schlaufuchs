// The Schlaufuchs mascot (§15): one geometric SVG fox, poses as variations.
// Returned as a markup string so pages can inline it anywhere (map, journey,
// headers, reactions).
//
// The fox used to grow a cap, glasses, a backpack, a medal and two crowns as
// the star count rose (§8.4). It wore them everywhere and looked like a
// different animal in every screenshot; the fox is who the child is, not a
// display of what they own. The stars and the trophies say that, once, in the
// top bar.

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

// foxSVG({pose, size, cls}) → SVG markup string.
// Poses: neutral | happy | cheer | think | breath.
export function foxSVG({ pose = "neutral", size = 64, cls = "" } = {}) {
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
  </svg>`;
}
