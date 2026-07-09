// Shared page chrome (§3.3): the fox level chip and the settings overlay,
// used identically by the map, the games and the stub pages so every screen
// has the same top bar. Vanilla, no framework.

import { t, getLang, setLang } from "./i18n.js";
import { getSettings, setSettings, resetAll, resetGame } from "./storage.js";
import { levelInfo } from "./rewards.js";
import { foxSVG } from "./fox.js";
import { iconHTML } from "./graphics.js";
import { sfx } from "./audio.js";

// Render the fox + "level N · ⭐ total" chip with a progress bar and a
// "N more stars to level N+1" sub-line. Call it again to refresh after a round.
export function renderLevelChip(el) {
  const info = levelInfo();
  const sub = info.nextAt == null
    ? t("levelMax")
    : t("levelNext", { n: info.nextAt - info.total, lvl: info.level + 1 });
  el.innerHTML = `
    ${foxSVG({ pose: "neutral", size: 40, level: info.level })}
    <span>
      <span class="lbl">${t("foxLevel", { lvl: info.level })} · ⭐ ${info.total}</span>
      <span class="bar"><i style="width:${Math.round(info.frac * 100)}%"></i></span>
      <span class="sub">${sub}</span>
    </span>`;
}

// Build the settings overlay in document.body and wire the gear button to it.
// resetKind: "all" (whole site), "game" (one game), or null (no reset row).
// onChange fires after a sound/language change; onClose fires when it closes.
// Returns { open, close }.
export function initSettingsOverlay({ resetKind = null, game, onChange, onClose } = {}) {
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.hidden = true;
  overlay.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">
      <h2 class="cx-title"></h2>
      <div class="setrow"><span class="cx-l-sound"></span><button class="iconbtn" id="cx-sound"></button></div>
      <div class="setrow"><span class="cx-l-lang"></span><button class="iconbtn" id="cx-lang"></button></div>
      ${resetKind ? `<div class="setrow"><span class="cx-l-reset"></span><button class="iconbtn" id="cx-reset"></button></div>` : ""}
      <button class="primary" id="cx-close"></button>
    </div>`;
  document.body.appendChild(overlay);

  const soundBtn = overlay.querySelector("#cx-sound");
  const langBtn = overlay.querySelector("#cx-lang");
  const resetBtn = overlay.querySelector("#cx-reset");
  const closeBtn = overlay.querySelector("#cx-close");
  let resetArmed = false;

  function renderRows() {
    overlay.querySelector(".cx-title").textContent = t("settings");
    overlay.querySelector(".cx-l-sound").textContent = t("sound");
    overlay.querySelector(".cx-l-lang").textContent = t("language");
    soundBtn.innerHTML = iconHTML(getSettings().sound !== false ? "ui-sound-on" : "ui-sound-off", { size: 22 });
    langBtn.textContent = getLang() === "de" ? "EN" : "DE";
    if (resetBtn) {
      overlay.querySelector(".cx-l-reset").textContent = resetKind === "all" ? t("resetAll") : t("resetGame");
      if (!resetArmed) resetBtn.innerHTML = iconHTML("ui-trash", { size: 22 });
    }
    closeBtn.textContent = t("close");
  }

  function open() {
    renderRows();
    overlay.hidden = false;
  }
  function close() {
    overlay.hidden = true;
    onClose?.();
  }

  soundBtn.addEventListener("click", () => {
    setSettings({ sound: getSettings().sound === false });
    sfx.click();
    renderRows();
    onChange?.();
  });
  langBtn.addEventListener("click", () => {
    setLang(getLang() === "de" ? "en" : "de"); // re-translates [data-i18n] on the page
    renderRows();
    onChange?.();
  });
  // two-step confirm for the destructive reset (§3.4)
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (!resetArmed) {
        resetArmed = true;
        resetBtn.textContent = "❗";
        setTimeout(() => {
          resetArmed = false;
          resetBtn.innerHTML = iconHTML("ui-trash", { size: 22 });
        }, 3000);
        return;
      }
      if (resetKind === "all") resetAll();
      else resetGame(game);
      location.reload();
    });
  }
  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  return { open, close };
}
