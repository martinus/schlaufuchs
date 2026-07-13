// The project's one answer to touch latency: react on pointerdown for instant
// response on touch devices; the later synthetic click is suppressed. Keyboard
// activation still works via click. Every game's answer buttons and keypads go
// through here — it used to live as a verbatim copy in each game page.
export function fastPress(btn, fn) {
  let usedPointer = false;
  btn.addEventListener("pointerdown", () => {
    usedPointer = true;
    fn();
  });
  btn.addEventListener("click", () => {
    if (usedPointer) {
      usedPointer = false;
      return;
    }
    fn();
  });
}
