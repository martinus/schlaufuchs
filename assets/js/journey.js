// The round's scene (§8.2, §10.5). One picture, almost no words:
//
//   sky      the stars still to be won on this tile
//   meadow   a basket holding the stars you already own
//   path     the fox, advancing on every correct answer
//
// A star is never lost. It sits in the sky until it is earned, then it flies
// down into the basket and stays there. The sky slot it left keeps a grey
// ghost, so "collected" and "still open" are one glance apart. A tile already
// taken to three stars therefore opens with a full basket and a grey sky: the
// scene cannot promise a star that `endRound()` will not pay.
//
// Stars that this round can no longer reach stay gold. They are still winnable
// — just not today — and dimming them would be the loss framing we refuse.

import { foxSVG } from "./fox.js";
import { iconSVG } from "./graphics.js";

export const THEMES = {
  // the village's first obstacle used to be a basket, which read as a second
  // copy of the big one standing in the meadow
  village: { goal: "j-goal-bell", obstacles: ["j-sunflower", "j-rooster", "j-door"], path: "#d9b48f" },
  mountain: { goal: "j-goal-flag", obstacles: ["j-rock", "j-bridge", "j-troll"], path: "#b0a99f" },
  forest: { goal: "j-goal-sparkle", obstacles: ["j-mushroom", "j-hedgehog", "j-door"], path: "#8fbf7f" },
  meadow: { goal: "j-goal-book", obstacles: ["j-butterfly", "j-flower", "j-bee"], path: "#a8d08d" },
};

const OBSTACLE_AT = [2, 5, 8]; // 0-indexed: nodes 3, 6, 9 (§8.2)

// Scene geometry, in viewBox units. The scene is deliberately tall for its
// width: a flat strip made the sky read as empty page rather than as sky.
const H = 128;
const HORIZON = 84;
const STEP_ = 28;
const PATH_X0 = 76; // the basket owns the left margin
const PATH_Y = 102;
const SKY_Y = 30;
const SKY_GAP = 46;
const STAR_SIZE = 26;
const BASKET = { x: 40, y: 106, size: 46 };
const SLOTS = 3;

// Where star `i` comes to rest, nestled in the basket's mouth. These are text
// baselines, not centres: an emoji glyph hangs above its baseline, so a naive
// y put the stars on the basket's rim instead of inside it.
const landing = (i) => ({ x: BASKET.x - 11 + i * 11, y: 104 });

export function createJourney(container, { nodes, theme = "village", level = 1, stars = 0 }) {
  const th = THEMES[theme] ?? THEMES.village;
  const xOf = (i) => PATH_X0 + i * STEP_;
  const w = xOf(nodes - 1) + 30;
  const yOf = (i) =>
    theme === "mountain" ? PATH_Y - 4 - Math.round((i * 22) / Math.max(nodes - 1, 1)) : PATH_Y;
  const skyX = (i) => Math.round(w / 2 + 24) + (i - 1) * SKY_GAP;

  let svg = `<svg class="journey journey-${theme}" viewBox="0 0 ${w} ${H}"
      preserveAspectRatio="xMidYMid meet" aria-hidden="true">`;

  // Sky, then a meadow with a soft horizon, then the basket standing in it.
  // The meadow is clipped to the sky's rounded corners, or it spills out of
  // them square at the bottom. One scene per page, and `container.innerHTML`
  // replaces it wholesale each round, so a fixed id cannot collide.
  svg += `<defs><clipPath id="j-clip">
      <rect x="0" y="0" width="${w}" height="${H}" rx="14"/></clipPath></defs>`;
  svg += `<g clip-path="url(#j-clip)">
      <rect class="j-sky" x="0" y="0" width="${w}" height="${H}"/>
      <path class="j-grass" d="M0 ${HORIZON}
        C ${Math.round(w * 0.28)} ${HORIZON - 12}, ${Math.round(w * 0.72)} ${HORIZON - 12}, ${w} ${HORIZON}
        L ${w} ${H} L 0 ${H} Z"/></g>`;
  svg += iconSVG("ui-basket", { x: BASKET.x, y: BASKET.y + 16, size: BASKET.size, cls: "j-basket-big" });

  // the path and its nodes
  let path = `M ${xOf(0)} ${yOf(0)}`;
  for (let i = 1; i < nodes; i++) path += ` L ${xOf(i)} ${yOf(i)}`;
  svg += `<path d="${path}" stroke="${th.path}" stroke-width="6" fill="none"
      stroke-linecap="round" stroke-dasharray="1 10"/>`;

  for (let i = 0; i < nodes; i++) {
    const x = xOf(i);
    const y = yOf(i);
    if (i === nodes - 1) {
      svg += iconSVG(th.goal, { x, y: y + 7, size: 22, cls: "j-goal", attrs: `data-j="${i}"` });
    } else {
      svg += `<circle class="j-node" data-j="${i}" cx="${x}" cy="${y}" r="5"/>`;
      const oi = OBSTACLE_AT.indexOf(i);
      if (oi >= 0 && i > 0) {
        svg += iconSVG(th.obstacles[oi], { x, y: y - 12, size: 14, cls: "j-obstacle", attrs: `data-j="${i}"` });
      }
    }
  }

  // The sky. A grey ghost marks every slot; the gold star on top of it is the
  // one that flies. Its trip is a CSS transform, so `prefers-reduced-motion`
  // (which kills every transition site-wide) simply places it in the basket.
  for (let i = 0; i < SLOTS; i++) {
    svg += iconSVG("ui-star", { x: skyX(i), y: SKY_Y, size: STAR_SIZE, cls: "j-ghost" });
  }
  for (let i = 0; i < SLOTS; i++) {
    const to = landing(i);
    const dx = to.x - skyX(i);
    const dy = to.y - SKY_Y;
    svg += `<g class="j-star" data-s="${i}" style="--dx:${dx}px; --dy:${dy}px">`
      + iconSVG("ui-star", { x: skyX(i), y: SKY_Y, size: STAR_SIZE })
      + "</g>";
  }

  svg += `<g class="j-fox" style="transform: translate(${xOf(0) - 13}px, ${yOf(0) - 30}px)">
      ${foxSVG({ pose: "happy", size: 26, level })}</g></svg>`;

  container.innerHTML = svg;
  const el = container.querySelector("svg");
  const fox = el.querySelector(".j-fox");
  const starEls = [...el.querySelectorAll(".j-star")];
  let pos = 0;
  let owned = -1;

  function moveFox() {
    fox.style.transform = `translate(${xOf(pos) - 13}px, ${yOf(pos) - 30}px)`;
  }

  // Idempotent, and monotone by contract: the caller passes `max(best, earned)`,
  // which never decreases. A star that is already in the basket is not re-flown.
  function setStars(n, { animate = true } = {}) {
    const next = Math.max(0, Math.min(n, SLOTS));
    if (next === owned) return;
    starEls.forEach((s, i) => {
      const inBasket = i < next;
      if (inBasket && !s.classList.contains("landed")) {
        if (!animate) s.classList.add("j-instant");
        s.classList.add("landed");
      }
    });
    if (!animate) {
      void el.getBoundingClientRect(); // land them before the first paint
      starEls.forEach((s) => s.classList.remove("j-instant"));
    }
    owned = next;
  }

  // the stars already won on this tile are in the basket before the round starts
  setStars(stars, { animate: false });

  return {
    advance() {
      const prev = el.querySelector(`.j-node[data-j="${pos}"]`);
      if (prev) prev.classList.add("done");
      const obstacle = el.querySelector(`.j-obstacle[data-j="${pos + 1}"]`);
      if (obstacle) {
        // the fox reaches a milestone: a themed mini-celebration. The sound is
        // the normal "correct" tone already played by the caller — no extra sfx.
        const oi = OBSTACLE_AT.indexOf(pos + 1); // 0 | 1 | 2
        obstacle.classList.add("cleared", `j-clear-${oi}`);
      }
      pos = Math.min(pos + 1, nodes - 1);
      moveFox();
      fox.classList.remove("hop");
      void fox.getBoundingClientRect(); // restart animation
      fox.classList.add("hop");
    },
    stumble() {
      fox.classList.remove("stumble");
      void fox.getBoundingClientRect();
      fox.classList.add("stumble");
    },
    setStars,
    finish() {
      el.querySelector(".j-goal")?.classList.add("reached");
      fox.classList.add("hop");
    },
  };
}
