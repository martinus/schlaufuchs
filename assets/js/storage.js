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

function readRaw() {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(/(?:^|;\s*)schlaufuchs=([^;]*)/);
  return m ? m[1] : "";
}

function writeRaw(value) {
  if (typeof document === "undefined") return;
  let c = `${NAME}=${value};path=/;max-age=${MAX_AGE};SameSite=Lax`;
  if (typeof location !== "undefined" && location.protocol === "https:") c += ";Secure";
  document.cookie = c;
}

function save(state) {
  state.v = 1;
  const enc = encodeState(state);
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

export function getGame(name) {
  return loadState()[name] ?? {};
}

export function setGame(name, data) {
  const state = loadState();
  state[name] = { ...(state[name] ?? {}), ...data };
  return save(state);
}

export function getSettings() {
  return loadState().settings ?? {};
}

export function setSettings(patch) {
  const state = loadState();
  state.settings = { ...(state.settings ?? {}), ...patch };
  return save(state);
}

export function getRewards() {
  return loadState().rewards ?? {};
}

export function setRewards(patch) {
  const state = loadState();
  state.rewards = { ...(state.rewards ?? {}), ...patch };
  return save(state);
}

export function resetGame(name) {
  const state = loadState();
  delete state[name];
  if (state.rewards?.pr) delete state.rewards.pr[name];
  if (state.rewards?.at === name) delete state.rewards.at;
  return save(state);
}

export function resetAll() {
  if (typeof document === "undefined") return;
  document.cookie = `${NAME}=;path=/;max-age=0;SameSite=Lax`;
}
