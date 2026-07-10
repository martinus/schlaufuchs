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
