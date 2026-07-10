// The fox in the level picker (§10.2).
//
// The only thing on the list of levels that said "you are here" was a coloured
// border around one tile. The fox says it: it stands on the level she is
// playing. Tapping another tile sends the fox there, and the level opens when
// the fox arrives — exactly the rule the island keeps for its regions (§3.1).
//
// The gait is the island's gait: `walkPoint`/`walkMs` from `mapwalk.js`, whose
// arithmetic is plain numbers and does not care whether they are map units or
// pixels. One fox, one walk.

import { foxSVG } from "./fox.js";
import { prefersReducedMotion, runWalk } from "./motion.js";

// Small, and standing low: the fox shares its tile with the stars that tile
// still has to give, and at 40px it stood on top of the top row of them.
export const FOX_SIZE = 34;

// The fox stands ON a tile, on its lower edge — not in the middle of it.
const FOOT_INSET = 4;

// The drawing fills its 100×100 viewBox down to y≈85, so a fox placed at its
// own bottom edge would sink into the tile up to the shoulders.
const FEET = 0.85;

// Where the fox's feet go for a tile, in the coordinates of the tile's
// offsetParent — which the picker makes the level list itself, so the fox
// scrolls with the tiles instead of sailing over them.
export function tileAnchor({ offsetLeft, offsetTop, offsetWidth, offsetHeight }) {
  return [offsetLeft + offsetWidth / 2, offsetTop + offsetHeight - FOOT_INSET];
}

// The top-left corner of a fox of `size` whose feet stand on `[x, y]`.
export function foxOrigin([x, y], size = FOX_SIZE) {
  return [x - size / 2, y - size * FEET];
}

// A fox that lives inside `container` (a positioned element holding the tiles).
// `jumpTo` puts it somewhere without a walk — the first render, and every
// reopening of the picker, which rebuilds its tiles from scratch.
// `walkTo` hops it across and calls `done` when it lands.
export function createLevelFox(container, { size = FOX_SIZE } = {}) {
  const el = document.createElement("div");
  el.className = "lvl-fox";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = foxSVG({ pose: "happy", size });
  container.appendChild(el);

  let at = null; // the point under the fox's feet, or null before the first jump
  let walking = false;

  function draw(point) {
    const [l, top] = foxOrigin(point, size);
    el.style.transform = `translate(${l.toFixed(1)}px, ${top.toFixed(1)}px)`;
  }

  return {
    el,
    // Nothing else may start a walk while one runs: two rAF loops would fight
    // over the same transform, and two rounds would start on top of each other.
    get walking() {
      return walking;
    },
    jumpTo(tile) {
      at = tileAnchor(tile);
      draw(at);
    },
    // `prefers-reduced-motion` skips the hops and opens the level at once — the
    // fox still ends up on the tile she tapped (§15).
    walkTo(tile, done) {
      if (walking) return;
      const to = tileAnchor(tile);
      if (!at || prefersReducedMotion()) {
        at = to;
        draw(at);
        done();
        return;
      }
      walking = true;
      runWalk(at, to, draw, () => {
        at = to;
        walking = false;
        done();
      });
    },
  };
}
