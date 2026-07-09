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

// A theme is a path colour and three friendly obstacles. There is no themed
// goal any more: the basket *is* the goal, in every theme, because the basket
// is where the stars land and the round's point is the stars.
export const THEMES = {
  // the village's first obstacle used to be a basket, which read as a second
  // copy of the big one standing at the end of the path
  village: { obstacles: ["j-sunflower", "j-rooster", "j-door"], path: "#d9b48f" },
  mountain: { obstacles: ["j-rock", "j-bridge", "j-troll"], path: "#b0a99f" },
  forest: { obstacles: ["j-mushroom", "j-hedgehog", "j-door"], path: "#8fbf7f" },
  meadow: { obstacles: ["j-butterfly", "j-flower", "j-bee"], path: "#a8d08d" },
};

const OBSTACLE_AT = [2, 5, 8]; // 0-indexed: nodes 3, 6, 9 (§8.2)

// Scene geometry, in viewBox units. Tall for its width: a flat strip made the
// sky read as empty page rather than as sky.
const H = 150;
const HORIZON = 96;
const STEP_ = 28;
const PATH_X0 = 26;
const PATH_Y = 124;
const STAR_SIZE = 28;
const BASKET_SIZE = 52;
const SLOTS = 3;

// The three stars hang as a small constellation, not as a row of three. Given
// as fractions of the scene's width and absolute text baselines, so the shape
// survives a round with a different number of questions.
const SKY = [[0.28, 52], [0.47, 32], [0.68, 48]];

// Where everything stands, for a round of `nodes` questions. Pure: it takes a
// count and returns coordinates, so the arithmetic that decides whether a star
// lands in the basket or beside it can be checked without a browser.
//
// A ten-question round is 26+9×28+30+34 = 342 units wide; a shorter round is a
// narrower scene, not a stretched one, because the fox's stride is fixed.
export function sceneGeometry(nodes, theme = "village") {
  const n = Math.max(1, Math.floor(nodes) || 1);
  const xOf = (i) => PATH_X0 + i * STEP_;
  // the mountain path climbs; every other theme is flat
  const yOf = (i) =>
    theme === "mountain" ? PATH_Y - 4 - Math.round((i * 22) / Math.max(n - 1, 1)) : PATH_Y;

  // The basket stands at the end of the path, raised clear of it so the whole
  // basket is visible, and the fox's last step lands beside it. The reward and
  // the finish line are the same object.
  const basket = { x: xOf(n - 1) + 30, y: yOf(n - 1) - 2 }; // y is a text baseline
  const width = basket.x + 34;

  return {
    width,
    height: H,
    nodes: Array.from({ length: n }, (_, i) => ({ x: xOf(i), y: yOf(i) })),
    basket,
    sky: SKY.map(([fx, y]) => ({ x: Math.round(fx * width), y })),
    // three abreast in the basket's mouth
    landing: [0, 1, 2].map((i) => ({ x: basket.x - 12 + i * 12, y: basket.y - 24 })),
  };
}

// `stars` is what the basket holds: the stars this tile has already earned.
// `worth` is what each of them counts (§10.2): 1 on Leicht, 2 on Mittel, 3 on
// Schwer. Mara could not see that the harder levels paid more, because the
// claim only ever appeared inside the picker she never opened. Now the tag
// rides on the star itself, and into the basket with it.
export function createJourney(container, { nodes, theme = "village", stars = 0, worth = 1 }) {
  const th = THEMES[theme] ?? THEMES.village;
  const g = sceneGeometry(nodes, theme);
  const { width: w, basket } = g;
  const xOf = (i) => g.nodes[i].x;
  const yOf = (i) => g.nodes[i].y;
  const bx = basket.x;
  const by = basket.y;
  const skyX = (i) => g.sky[i].x;
  const skyY = (i) => g.sky[i].y;
  const landing = (i) => g.landing[i];

  let svg = `<svg class="journey journey-${theme}" viewBox="0 0 ${w} ${H}"
      preserveAspectRatio="xMidYMid meet" aria-hidden="true">`;

  // Sky, then a meadow with a soft horizon. The meadow is clipped to the sky's
  // rounded corners, or it spills out of them square at the bottom. One scene
  // per page, and `container.innerHTML` replaces it wholesale each round, so a
  // fixed id cannot collide.
  svg += `<defs><clipPath id="j-clip">
      <rect x="0" y="0" width="${w}" height="${H}" rx="14"/></clipPath></defs>`;
  svg += `<g clip-path="url(#j-clip)">
      <rect class="j-sky" x="0" y="0" width="${w}" height="${H}"/>
      <path class="j-grass" d="M0 ${HORIZON}
        C ${Math.round(w * 0.28)} ${HORIZON - 12}, ${Math.round(w * 0.72)} ${HORIZON - 12}, ${w} ${HORIZON}
        L ${w} ${H} L 0 ${H} Z"/></g>`;

  // the path and its nodes
  let path = `M ${xOf(0)} ${yOf(0)}`;
  for (let i = 1; i < nodes; i++) path += ` L ${xOf(i)} ${yOf(i)}`;
  svg += `<path d="${path}" stroke="${th.path}" stroke-width="6" fill="none"
      stroke-linecap="round" stroke-dasharray="1 10"/>`;

  for (let i = 0; i < nodes; i++) {
    const x = xOf(i);
    const y = yOf(i);
    svg += `<circle class="j-node" data-j="${i}" cx="${x}" cy="${y}" r="5"/>`;
    const oi = OBSTACLE_AT.indexOf(i);
    if (oi >= 0 && i > 0) {
      svg += iconSVG(th.obstacles[oi], { x, y: y - 12, size: 14, cls: "j-obstacle", attrs: `data-j="${i}"` });
    }
  }

  // the goal, and the place the stars fall into
  svg += iconSVG("ui-basket", { x: bx, y: by, size: BASKET_SIZE, cls: "j-basket-big j-goal" });

  // The sky. A grey ghost marks every slot; the gold star on top of it is the
  // one that flies. Its trip is a CSS transform, so `prefers-reduced-motion`
  // (which kills every transition site-wide) simply places it in the basket.
  for (let i = 0; i < SLOTS; i++) {
    svg += iconSVG("ui-star", { x: skyX(i), y: skyY(i), size: STAR_SIZE, cls: "j-ghost" });
  }
  for (let i = 0; i < SLOTS; i++) {
    const to = landing(i);
    const dx = to.x - skyX(i);
    const dy = to.y - skyY(i);
    // The tag lives INSIDE the group, so the group's transform carries it to
    // the basket. A keyframe of its own would never run under reduced motion.
    const tag = worth > 1
      ? `<text class="j-worth" x="${skyX(i)}" y="${skyY(i) + STAR_SIZE / 2 + 7}" text-anchor="middle">×${worth}</text>`
      : "";
    svg += `<g class="j-star" data-s="${i}" style="--dx:${dx}px; --dy:${dy}px">`
      + iconSVG("ui-star", { x: skyX(i), y: skyY(i), size: STAR_SIZE })
      + tag
      + "</g>";
  }

  svg += `<g class="j-fox" style="transform: translate(${xOf(0) - 13}px, ${yOf(0) - 30}px)">
      ${foxSVG({ pose: "happy", size: 26 })}</g></svg>`;

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
      // the last node is a node like any other now; nothing else marks it done
      el.querySelector(`.j-node[data-j="${nodes - 1}"]`)?.classList.add("done");
      el.querySelector(".j-goal")?.classList.add("reached");
      fox.classList.add("hop");
    },
  };
}
