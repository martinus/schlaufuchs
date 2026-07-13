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

// What a slot in the sky looks like when its star counts double or triple
// (§10.2). It used to be one star with "×2" written under it, and a tag is a
// sentence: a child who cannot read still has to be told. A slot now simply
// *holds two stars*, or three — smaller, so the group takes about the room one
// big star took — and the whole group flies into the basket together.
//
// Offsets are relative to the slot's anchor (x, and y as a text baseline);
// sizes are viewBox units.
const CLUSTERS = {
  1: [[0, 0, STAR_SIZE]],
  2: [[-8, -3, 20], [8, 5, 20]],
  3: [[0, -8, 17], [-9, 6, 17], [9, 6, 17]],
};

export function starCluster(worth) {
  const w = Math.min(3, Math.max(1, Math.round(worth) || 1));
  return CLUSTERS[w].map(([dx, dy, size]) => ({ dx, dy, size }));
}

// The summary's star display (§10.1): the same three GROUPS the round's sky
// holds. A slot is `worth` stars and is only ever won whole, so the summary
// shows slots, not a count — `owned` of them gold (the tile's state after the
// round), the last `fresh` of those just arrived and pop in, the rest grey
// ghosts of what is still to win. The display IS the arithmetic; the numbers
// ("8/8 +6 ⭐") it replaces read as homework.
export function starSlotsHTML(owned, worth, fresh = 0) {
  const own = Math.max(0, Math.min(SLOTS, Math.round(owned) || 0));
  const neu = Math.max(0, Math.min(own, Math.round(fresh) || 0));
  const cluster = starCluster(worth);
  const stars = cluster
    .map(({ dx, dy, size }) => iconSVG("ui-star", { x: 32 + dx * 1.6, y: 38 + dy * 1.6, size: size * 1.6 }))
    .join("");
  return Array.from({ length: SLOTS }, (_, i) => {
    const state = i >= own ? "j-ghost" : i >= own - neu ? "owned fresh" : "owned";
    return `<span class="sslot ${state}"><svg viewBox="4 6 56 50" aria-hidden="true">${stars}</svg></span>`;
  }).join("");
}

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
  // A short round keeps the TEN-node scene's width: the fox takes wider
  // strides, the sky stays a wide strip. (It used to keep the step and shrink
  // the width instead — a four-node scene was nearly square, and at CSS width
  // 100 % it blew up to fill half the phone.) A round longer than ten still
  // grows to the right, step by step.
  const step = n > 1 ? Math.max(STEP_, (STEP_ * 9) / (n - 1)) : STEP_;
  const xOf = (i) => PATH_X0 + Math.round(i * step);
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
// `worth` is what each slot counts (§10.2): 1 on Leicht, 2 on Mittel, 3 on
// Schwer. Mara could not see that the harder levels paid more, because the
// claim only ever appeared inside the picker she never opened. Now a slot is
// drawn as the stars it pays, and they all fly into the basket together.
//
// EVERY ASKED TASK IS ITS OWN WAYPOINT (Martin, second play-test): the fox
// steps forward when a task ends, whether it went right (`advance`, a green
// node) or wrong (`advanceMissed`, a red node). A missed skill returns later
// in the round (the engine re-queues it), so `advanceMissed` also GROWS the
// path by one node — the scene re-renders in place, strides narrowing, and the
// fox still reaches the basket exactly on the round's last answer. `stumble()`
// stays the miss animation at the moment of the wrong answer.
export function createJourney(container, { nodes, theme = "village", stars = 0, worth = 1 }) {
  const th = THEMES[theme] ?? THEMES.village;
  let count = Math.max(1, Math.floor(nodes) || 1);
  let pos = 0;
  let owned = -1;
  const marks = []; // per passed node: "done" | "missed"
  const cleared = new Set(); // obstacle node indices already celebrated
  let g;
  let el;
  let fox;
  let starEls;
  const xOf = (i) => g.nodes[i].x;
  const yOf = (i) => g.nodes[i].y;

  function render() {
    g = sceneGeometry(count, theme);
    const { width: w, basket } = g;
    const bx = basket.x;
    const by = basket.y;

    let svg = `<svg class="journey journey-${theme}" viewBox="0 0 ${w} ${H}"
        preserveAspectRatio="xMidYMid meet" aria-hidden="true">`;

    // Sky, then a meadow with a soft horizon. The meadow is clipped to the sky's
    // rounded corners, or it spills out of them square at the bottom. One scene
    // per page, and `container.innerHTML` replaces it wholesale on every render,
    // so a fixed id cannot collide.
    svg += `<defs><clipPath id="j-clip">
        <rect x="0" y="0" width="${w}" height="${H}" rx="14"/></clipPath></defs>`;
    svg += `<g clip-path="url(#j-clip)">
        <rect class="j-sky" x="0" y="0" width="${w}" height="${H}"/>
        <path class="j-grass" d="M0 ${HORIZON}
          C ${Math.round(w * 0.28)} ${HORIZON - 12}, ${Math.round(w * 0.72)} ${HORIZON - 12}, ${w} ${HORIZON}
          L ${w} ${H} L 0 ${H} Z"/></g>`;

    // the path and its nodes, marked as the round has gone so far
    let path = `M ${xOf(0)} ${yOf(0)}`;
    for (let i = 1; i < count; i++) path += ` L ${xOf(i)} ${yOf(i)}`;
    svg += `<path d="${path}" stroke="${th.path}" stroke-width="6" fill="none"
        stroke-linecap="round" stroke-dasharray="1 10"/>`;

    for (let i = 0; i < count; i++) {
      const x = xOf(i);
      const y = yOf(i);
      const mark = marks[i] ? ` ${marks[i] === "missed" ? "missed" : "done"}` : "";
      svg += `<circle class="j-node${mark}" data-j="${i}" cx="${x}" cy="${y}" r="5"/>`;
      const oi = OBSTACLE_AT.indexOf(i);
      if (oi >= 0 && i > 0) {
        // 18, not 14: at 14 the milestones vanished beside a 26-unit fox and a
        // 52-unit basket, and the mini-celebration animated a speck
        const done = cleared.has(i) ? " cleared" : "";
        svg += iconSVG(th.obstacles[oi], { x, y: y - 13, size: 18, cls: `j-obstacle${done}`, attrs: `data-j="${i}"` });
      }
    }

    // the goal, and the place the stars fall into
    svg += iconSVG("ui-basket", { x: bx, y: by, size: BASKET_SIZE, cls: "j-basket-big j-goal" });

    // The sky. A grey ghost marks every slot; the gold stars on top of it are the
    // ones that fly. Their trip is a CSS transform, so `prefers-reduced-motion`
    // (which kills every transition site-wide) simply places them in the basket.
    //
    // A slot holds `worth` stars, so a Schwer round has nine stars in its sky and
    // a Leicht round three. Nobody is told that hard work pays triple; the sky is
    // three times as full.
    const cluster = starCluster(worth);
    const clusterAt = (x, y, cls) => cluster
      .map(({ dx, dy, size }) => iconSVG("ui-star", { x: x + dx, y: y + dy, size, cls }))
      .join("");

    for (let i = 0; i < SLOTS; i++) svg += clusterAt(g.sky[i].x, g.sky[i].y, "j-ghost");
    for (let i = 0; i < SLOTS; i++) {
      const to = g.landing[i];
      const dx = to.x - g.sky[i].x;
      const dy = to.y - g.sky[i].y;
      // The whole cluster is one group, so one transform carries every star in it
      // to the basket. Given a keyframe each, none of them would move under
      // prefers-reduced-motion.
      svg += `<g class="j-star" data-s="${i}" style="--dx:${dx}px; --dy:${dy}px">`
        + clusterAt(g.sky[i].x, g.sky[i].y, "")
        + "</g>";
    }

    svg += `<g class="j-fox" style="transform: translate(${xOf(pos) - 13}px, ${yOf(pos) - 30}px)">
        ${foxSVG({ pose: "happy", size: 26 })}</g></svg>`;

    container.innerHTML = svg;
    el = container.querySelector("svg");
    fox = el.querySelector(".j-fox");
    starEls = [...el.querySelectorAll(".j-star")];
    // stars already in the basket land again before the first paint — exactly
    // the landed ones, never the throttled backlog (see setStars)
    const held = owned;
    owned = -1;
    land(Math.max(held, 0), false);
  }

  function moveFox() {
    fox.style.transform = `translate(${xOf(pos) - 13}px, ${yOf(pos) - 30}px)`;
  }

  // Land the first `n` slots outright — the constructor's banked stars and a
  // re-render's already-landed ones. No throttle: nothing here is "collected".
  function land(n, animate) {
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

  // Idempotent, and monotone by contract: the caller passes `max(best, earned)`,
  // which never decreases. A star group that is already in the basket is not
  // re-flown — and AT MOST ONE group flies per call (Martin, third play-test):
  // on a short round the ⭐⭐ and ⭐⭐⭐ thresholds fall on the same last task
  // (80 % and 100 % of three tasks are both "all three"), and two groups
  // leaving one waypoint together read as a glitch. The game calls setStars
  // once per waypoint, so the backlog drains one group per step; whatever is
  // still owed when the basket is reached lands in `finish()`.
  let want = 0; // groups earned so far; owned may lag by the throttle
  function setStars(n, { animate = true } = {}) {
    want = Math.max(want, Math.max(0, Math.min(n, SLOTS)));
    land(animate ? Math.min(want, Math.max(owned, 0) + 1) : want, animate);
  }

  // One step forward, however the task went. `mark` colours the node the fox
  // leaves behind; a missed step first grows the path (the skill will be asked
  // again), which re-renders the scene around the fox.
  function step(mark) {
    marks[pos] = mark;
    if (mark === "missed") {
      count += 1;
      render();
    } else {
      el.querySelector(`.j-node[data-j="${pos}"]`)?.classList.add(mark === "done" ? "done" : "missed");
    }
    const obstacle = el.querySelector(`.j-obstacle[data-j="${pos + 1}"]:not(.cleared)`);
    if (obstacle) {
      // the fox reaches a milestone: a themed mini-celebration. The sound is
      // the normal "correct" tone already played by the caller — no extra sfx.
      const oi = OBSTACLE_AT.indexOf(pos + 1); // 0 | 1 | 2
      obstacle.classList.add("cleared", `j-clear-${oi}`);
      cleared.add(pos + 1);
    }
    pos = Math.min(pos + 1, count - 1);
    moveFox();
    fox.classList.remove("hop");
    void fox.getBoundingClientRect(); // restart animation
    fox.classList.add("hop");
  }

  render();
  // the stars already won on this tile are in the basket before the round starts
  setStars(stars, { animate: false });

  return {
    advance() {
      step("done");
    },
    // the task ended, but not cleanly: the fox still gets her waypoint (red),
    // and the path grows by the re-queued ask this miss just created
    advanceMissed() {
      step("missed");
    },
    stumble() {
      fox.classList.remove("stumble");
      void fox.getBoundingClientRect();
      fox.classList.add("stumble");
    },
    setStars,
    finish() {
      // the last node is a node like any other now; nothing else marks it done
      el.querySelector(`.j-node[data-j="${count - 1}"]`)?.classList.add("done");
      el.querySelector(".j-goal")?.classList.add("reached");
      fox.classList.add("hop");
      // Whatever the one-group-per-waypoint throttle still owes flies now, as
      // the fox reaches the basket — one beat behind the group that just left,
      // a little cascade rather than a double liftoff. Under reduced motion
      // the delay only postpones an instant landing.
      setTimeout(() => land(want, true), 350);
    },
  };
}
