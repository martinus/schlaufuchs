// Cookie-backed state store (§9). All persistent state lives in ONE cookie.
// Pure encode/decode/budget functions are exported for node --test.

const NAME = "schlaufuchs";
const MAX_AGE = 31536000; // 1 year
export const BUDGET = 3500; // bytes, hard limit per §9.2

export function encodeState(state) {
  return encodeURIComponent(JSON.stringify(state));
}

export function decodeState(raw) {
  if (!raw) return {};
  try {
    const obj = JSON.parse(decodeURIComponent(raw));
    return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
  } catch {
    return {};
  }
}

export function overBudget(state) {
  return encodeState(state).length >= BUDGET;
}

// Merge `patch` into `state[key]`, without touching the caller's objects. The
// three sections of the cookie used to each carry their own copy of this.
export function patchSection(state, key, patch) {
  return { ...state, [key]: { ...(state[key] ?? {}), ...patch } };
}

function readRaw() {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${NAME}=([^;]*)`));
  return m ? m[1] : "";
}

function writeRaw(value) {
  if (typeof document === "undefined") return;
  let c = `${NAME}=${value};path=/;max-age=${MAX_AGE};SameSite=Lax`;
  if (typeof location !== "undefined" && location.protocol === "https:") c += ";Secure";
  document.cookie = c;
}

function save(state) {
  const enc = encodeState({ ...state, v: 1 });
  if (enc.length >= BUDGET) {
    console.warn(`schlaufuchs: cookie budget exceeded (${enc.length} >= ${BUDGET}), write refused`);
    return false;
  }
  writeRaw(enc);
  return true;
}

export function loadState() {
  return decodeState(readRaw());
}

// One reader and one writer per section of the cookie. `getGame` takes the
// game's name because games are the only section that has more than one.
const sectionOf = (key) => (state = loadState()) => state[key] ?? {};
const writeSection = (key) => (patch) => save(patchSection(loadState(), key, patch));

export const getSettings = sectionOf("settings");
export const setSettings = writeSection("settings");
export const getRewards = sectionOf("rewards");
export const setRewards = writeSection("rewards");

export function getGame(name) {
  return loadState()[name] ?? {};
}

export function setGame(name, data) {
  return save(patchSection(loadState(), name, data));
}

// There is no per-game reset. The settings sheet is the same on every page that
// has a gear (§3.4), and a sheet that resets "this game" on one page and the
// whole site on another is two sheets wearing one name.
export function resetAll() {
  if (typeof document === "undefined") return;
  document.cookie = `${NAME}=;path=/;max-age=0;SameSite=Lax`;
}
