// The ⚡ moment (§10.6): a single rocket-speed answer flies a bolt over the
// stage, with its zap (sfx.blitz, muted like all the rest — a silent reward is
// one the child cannot brag about). `host` is the element the bolt flies over:
// the question's stage in the keypad games, the word card's stage in lesen.
// Decorative only; a slow answer sees nothing, because there is no negative
// moment. The flight is a CSS transition, so reduced motion degrades to
// "briefly there", never a keyframe hanging mid-air (§10.5).
import { sfx } from "./audio.js";

export function blitzFlash(host) {
  const b = document.createElement("span");
  b.className = "blitz";
  b.setAttribute("aria-hidden", "true");
  b.textContent = "⚡";
  host.appendChild(b);
  requestAnimationFrame(() => b.classList.add("gone"));
  setTimeout(() => b.remove(), 800);
  sfx.blitz();
}
