// Cookie-backed state store (§9). All persistent state lives in ONE cookie.
// Pure encode/decode/budget functions are exported for node --test.

const NAME = "schlaufuchs";
const COOKIE_RE = new RegExp(`(?:^|;\\s*)${NAME}=([^;]*)`);
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
  const m = document.cookie.match(COOKIE_RE);
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

// Decode once per cookie value, not once per call. The hottest paths — a
// sound effect on every keypad press, the top-bar refresh after every answer
// — each land here, and a full decode of a cookie near its 3500-byte budget
// per keystroke is pure waste. The raw string is the cache key, so any write
// (this tab's or another's) invalidates by simply not matching. Callers treat
// the returned state as read-only (writes go through save()), which is what
// makes sharing one object safe.
let lastRaw = null;
let lastState = null;

export function loadState() {
  const raw = readRaw();
  if (raw !== lastRaw) {
    lastRaw = raw;
    lastState = decodeState(raw);
  }
  return lastState;
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

// The child's gear resets the WHOLE site and nothing less: the settings sheet is
// the same on every page that has a gear (§3.4), so a sheet that wiped "this
// game" on one page and everything on another would be two sheets wearing one
// name. She is never told which game she is "in".
export function resetAll() {
  if (typeof document === "undefined") return;
  document.cookie = `${NAME}=;path=/;max-age=0;SameSite=Lax`;
}

// Per-game reset lives in the parents' view instead (§20), where the surface is
// adult and each game is named. Pure so it is unit-testable: the state with one
// game's whole footprint removed — its own section (stars, boxes, practice
// time) AND its trophy counter in `rewards.pr`. The fox's saved position resets
// only if it was standing on that game; every other game, settings and language
// are left exactly as they were.
export function withoutGame(state, name) {
  const next = { ...state };
  delete next[name];
  const rew = next.rewards;
  if (rew && typeof rew === "object" && !Array.isArray(rew)) {
    const pr = { ...(rew.pr ?? {}) };
    delete pr[name];
    // undefined drops out of JSON.stringify, so `at` is scrubbed, not blanked.
    next.rewards = { ...rew, pr, at: rew.at === name ? undefined : rew.at };
  }
  return next;
}

// Whether the cookie holds anything worth resetting for `name`: a section of
// its own, or a trophy counter. Drives the parents' view list, so a stale
// dev-cookie entry still offers its reset.
export function hasGameData(state, name) {
  const section = state?.[name];
  const hasSection = section && typeof section === "object" && Object.keys(section).length > 0;
  const pr = state?.rewards?.pr?.[name];
  return Boolean(hasSection) || (Number.isFinite(pr) && pr > 0);
}

export function resetGame(name) {
  return save(withoutGame(loadState(), name));
}

// --- backup (§9.3) -------------------------------------------------------------
// The whole site lives in this one cookie on this one device: a cleared cache
// or a new phone deletes a year of stars, silently. The backup is the cookie
// as a downloadable file, and the restore replaces the cookie whole.

// The state as pretty-printed JSON — a parent squinting at the file should see
// key/value lines, not one 2000-character wall. Always stamped v: 1, like save().
export function exportState(state = loadState()) {
  return JSON.stringify({ ...state, v: 1 }, null, 2);
}

// Total-or-nothing: the file's text back as a state, or null. Junk, arrays and
// scalars are not state; an over-budget file is refused HERE, where the parent
// can still be told, not half-way through save()'s console warning.
export function parseBackup(text) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
  if (overBudget(obj)) return null;
  return obj;
}

// Replace the cookie with a parsed backup. Nothing merges: the file IS the
// state, exactly as resetAll + a year of play would have written it.
export function replaceState(state) {
  return save(state);
}
