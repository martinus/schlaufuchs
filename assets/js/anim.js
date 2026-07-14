// Re-trigger a one-shot CSS animation on an element that already carries it.
// Removing the class, forcing a synchronous reflow, then re-adding it is the
// one reliable way to replay a keyframe animation (`stumbling`, a second wrong
// try): without the reflow the browser coalesces the remove+add into no change
// and nothing moves. The `void el.offsetWidth` read is the reflow — its value
// is unused on purpose. This lived as a three-line copy (comment and all) in
// every game's reject/shake handler.
export function restartAnimation(el, cls) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth; // force reflow so the class re-add replays the animation
  el.classList.add(cls);
}
