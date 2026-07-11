// Celebration confetti (§8): DOM particles with CSS animation, removed after
// the show. No-op under prefers-reduced-motion (§15).

import { prefersReducedMotion } from "./motion.js";

const COLORS = ["#e8590c", "#f4b400", "#2f9e44", "#1d6fb8", "#c1121f", "#9c36b5"];

export function confetti(count = 80) {
  if (typeof document === "undefined") return;
  if (prefersReducedMotion()) return;
  const box = document.createElement("div");
  box.className = "confetti-box";
  box.setAttribute("aria-hidden", "true");
  for (let i = 0; i < count; i++) {
    const p = document.createElement("i");
    const size = 6 + Math.random() * 7;
    p.style.cssText = `
      left:${Math.random() * 100}vw;
      width:${size}px;height:${size * 0.6}px;
      background:${COLORS[i % COLORS.length]};
      animation-delay:${Math.random() * 0.6}s;
      animation-duration:${1.8 + Math.random() * 1.4}s;
      --spin:${Math.random() > 0.5 ? 1 : -1};`;
    box.appendChild(p);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 4200);
}

// A confetti rain that does not stop, for the trophy showcase (§3.2). It fills
// the whole panel and falls in front of everything in it EXCEPT the trophy — the
// plaque is the one thing lifted above the rain (CSS), so the storm makes it pop
// rather than bury it. Every piece fades to nothing on the way down, so the
// lower panel (and the Close button) stays clear. It loops in pure CSS (each
// piece its own delay and speed, many already mid-fall via a negative delay, so
// the rain is at full strength the instant it opens), which means the site-wide
// prefers-reduced-motion rule stills it — and here it is not even built.
//
// `host` is the panel the rain fills; its measured height sets how far each
// piece falls (`--rain-h`), so the pieces cross the visible panel rather than
// racing past it, on a panel of any height. Returns a stop handle; the showcase
// calls it on close so the pieces do not keep looping behind a shut sheet.
export function confettiRain(host, count = 140) {
  if (typeof document === "undefined") return () => {};
  if (prefersReducedMotion()) return () => {};
  const box = document.createElement("div");
  box.className = "confetti-rain";
  box.setAttribute("aria-hidden", "true");
  box.style.setProperty("--rain-h", `${host.clientHeight || 480}px`);
  for (let i = 0; i < count; i++) {
    const p = document.createElement("i");
    const size = 7 + Math.random() * 8;
    p.style.cssText = `
      left:${(Math.random() * 100).toFixed(1)}%;
      width:${size.toFixed(1)}px;height:${(size * 0.62).toFixed(1)}px;
      background:${COLORS[i % COLORS.length]};
      animation-delay:${(-Math.random() * 4).toFixed(2)}s;
      animation-duration:${(2.4 + Math.random() * 2).toFixed(2)}s;
      --spin:${Math.random() > 0.5 ? 1 : -1};
      --drift:${(Math.random() * 30 - 15).toFixed(0)}px;`;
    box.appendChild(p);
  }
  host.appendChild(box);
  return () => box.remove();
}
