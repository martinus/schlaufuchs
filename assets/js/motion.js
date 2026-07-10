// How this site moves (§15). The *arithmetic* of the fox's gait is pure and
// lives in mapwalk.js; this module is the runtime around it — the one rAF
// driver both foxes share, and the one place a script asks whether the child
// asked for no motion at all.

import { walkPoint, walkMs } from "./mapwalk.js";

// `prefers-reduced-motion` is non-negotiable here (§15). The CSS side kills
// every transition and animation site-wide; this is the question every
// *scripted* animation must ask before it starts. Three modules used to ask
// matchMedia themselves — a fourth copy is the one that misspells the query.
export function prefersReducedMotion() {
  return typeof window !== "undefined"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Drive one walk from `from` to `to`: `draw(point)` every frame, `done()`
// exactly once when the fox has landed — with the last drawn point exactly
// `to`, because the loop clamps `p` before it compares (rAF can hand out a
// timestamp past the end on a janky frame).
//
// The island's fox and the picker's fox used to each run this loop; the gait
// was already shared (walkPoint/walkMs), the driver now is too. The caller
// still owns its "no two walks at once" flag — what that flag protects (a
// navigation, a round about to start) is the caller's, not the walk's.
//
// `raf` and `now` are injectable so node --test can run a walk frame by frame.
export function runWalk(from, to, draw, done, { raf, now } = {}) {
  const request = raf ?? ((fn) => requestAnimationFrame(fn));
  const clock = now ?? (() => performance.now());
  const ms = walkMs(from, to);
  const t0 = clock();
  const step = (ts = clock()) => {
    const p = Math.min(1, (ts - t0) / ms);
    draw(walkPoint(from, to, p));
    if (p < 1) request(step);
    else done();
  };
  request(step);
}
