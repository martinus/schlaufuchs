// Journey path strip (§8.2): one node per unique round item, the fox token
// advances on every correct answer, friendly obstacles at nodes 3/6/9,
// themed goal at the end. The journey cannot be lost.

import { foxSVG } from "./fox.js";
import { iconSVG } from "./graphics.js";

const THEMES = {
  village: { goal: "j-goal-bell", obstacles: ["j-basket", "j-rooster", "j-door"], path: "#d9b48f" },
  mountain: { goal: "j-goal-flag", obstacles: ["j-rock", "j-bridge", "j-troll"], path: "#b0a99f" },
  forest: { goal: "j-goal-sparkle", obstacles: ["j-mushroom", "j-hedgehog", "j-door"], path: "#8fbf7f" },
  meadow: { goal: "j-goal-book", obstacles: ["j-butterfly", "j-flower", "j-bee"], path: "#a8d08d" },
};

const OBSTACLE_AT = [2, 5, 8]; // 0-indexed: nodes 3, 6, 9 (§8.2)
const STEP = 34;

export function createJourney(container, { nodes, theme = "village", level = 1 }) {
  const th = THEMES[theme] ?? THEMES.village;
  const w = 26 + nodes * STEP + 20;
  const h = 74;
  // Mountain journeys ascend; others are flat (§8.2 themed scenes).
  const yOf = (i) =>
    theme === "mountain" ? 56 - Math.round((i * 26) / Math.max(nodes - 1, 1)) : 52;
  const xOf = (i) => 26 + i * STEP;

  let svg = `<svg class="journey journey-${theme}" viewBox="0 0 ${w} ${h}"
      preserveAspectRatio="xMidYMid meet" aria-hidden="true">`;
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
      svg += `<circle class="j-node" data-j="${i}" cx="${x}" cy="${y}" r="6"/>`;
      const oi = OBSTACLE_AT.indexOf(i);
      if (oi >= 0 && i > 0) {
        svg += iconSVG(th.obstacles[oi], { x, y: y - 12, size: 14, cls: "j-obstacle", attrs: `data-j="${i}"` });
      }
    }
  }
  svg += `<g class="j-fox" style="transform: translate(${xOf(0) - 13}px, ${yOf(0) - 30}px)">
      ${foxSVG({ pose: "happy", size: 26, level })}</g></svg>`;

  container.innerHTML = svg;
  const el = container.querySelector("svg");
  const fox = el.querySelector(".j-fox");
  let pos = 0;

  function moveFox() {
    fox.style.transform = `translate(${xOf(pos) - 13}px, ${yOf(pos) - 30}px)`;
  }

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
    finish() {
      el.querySelector(".j-goal")?.classList.add("reached");
      fox.classList.add("hop");
    },
  };
}
