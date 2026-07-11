// Feedback sounds (§5): synthesized via WebAudio, no asset files.
// All sounds respect the persisted mute toggle. Never a harsh buzzer (§8.1).

import { getSettings } from "./storage.js";

let ctx = null;

function ac() {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? window.webkitAudioContext;
  if (!AC) return null;
  ctx ??= new AC();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function enabled() {
  return getSettings().sound !== false;
}

function tone(freq, dur, delay = 0, type = "sine", vol = 0.12) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export const sfx = {
  click() {
    if (enabled()) tone(440, 0.05, 0, "square", 0.04);
  },
  correct() {
    if (!enabled()) return;
    tone(660, 0.09);
    tone(880, 0.14, 0.09);
  },
  wrong() {
    // soft, neutral — not punishing (§8.1)
    if (enabled()) tone(240, 0.22, 0, "sine", 0.07);
  },
  trophy() {
    if (!enabled()) return;
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, i * 0.1));
  },
  blitz() {
    // The ⚡ moment (§10.6): a short bright zap over the correct() that plays
    // in the same breath — two rising triangle blips, quieter than the trophy.
    if (!enabled()) return;
    tone(1320, 0.05, 0, "triangle", 0.07);
    tone(1760, 0.09, 0.04, "triangle", 0.07);
  },
};
