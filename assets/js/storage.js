// localStorage-backed state store (§9). All persistent state lives under ONE
// key. Pure encode/decode/budget functions are exported for node --test.

const NAME = "schlaufuchs";

// Self-imposed hard limit per §9.2. The state lived in a cookie until July
// 2026, where the browser's 4 KB ceiling made this budget physics; localStorage
// would take megabytes, but the discipline the ceiling forced is the feature:
// state stays minimal and derivable (digit strings, never event logs), the
// backup file stays a glanceable page, and parseBackup's refusal keeps meaning
// something. So the number stays — as a commitment now, not a constraint. Note
// it buys MORE than it used to: the budget is measured on plain JSON, where the
// cookie's percent-encoding paid three bytes for every quote and brace.
export const BUDGET = 3500;

export function encodeState(state) {
  return JSON.stringify(state);
}

export function decodeState(raw) {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
  } catch {
    return {};
  }
}

export function overBudget(state) {
  return encodeState(state).length >= BUDGET;
}

// Merge `patch` into `state[key]`, without touching the caller's objects. The
// three sections of the store used to each carry their own copy of this.
export function patchSection(state, key, patch) {
  return { ...state, [key]: { ...(state[key] ?? {}), ...patch } };
}

// localStorage, or null where there is none (node --test) or the browser
// blocks it (all site data disabled — even *touching* the global throws then).
function store() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function readRaw() {
  try {
    return store()?.getItem(NAME) ?? "";
  } catch {
    return "";
  }
}

function writeRaw(value) {
  try {
    store()?.setItem(NAME, value);
  } catch {
    // quota or blocked storage: the session simply does not persist
  }
}

function save(state) {
  const enc = encodeState({ ...state, v: 1 });
  if (enc.length >= BUDGET) {
    console.warn(`schlaufuchs: state budget exceeded (${enc.length} >= ${BUDGET}), write refused`);
    return false;
  }
  writeRaw(enc);
  return true;
}

// --- legacy cookie migration (§9.1) ---------------------------------------
// Until July 2026 the state lived in a cookie of this name, percent-encoded.
// A cookie rides the header of EVERY request to the host — so the progress
// blob went to GitHub Pages dozens of times per page load, while the privacy
// page promised it never leaves the device. localStorage is never sent.
//
// The migration adopts a legacy cookie's state once — only into an EMPTY
// store, because the store is written by newer code and must win — and
// deletes the cookie either way, so it stops being transmitted. Deleting on
// sight also covers the mixed-cache day after the switch deploys (§9.2): a
// stale cached page still writes cookies, and a lingering one must not
// resurrect state a parent has since reset.

const COOKIE_RE = new RegExp(`(?:^|;\\s*)${NAME}=([^;]*)`);

// The state a legacy cookie header carries, or null. Pure, for node --test.
export function legacyCookieState(cookieStr) {
  const m = (cookieStr ?? "").match(COOKIE_RE);
  if (!m || !m[1]) return null;
  let raw = "";
  try {
    raw = decodeURIComponent(m[1]);
  } catch {
    // malformed percent-encoding is not state
  }
  const state = decodeState(raw);
  return Object.keys(state).length > 0 ? state : null;
}

// Self-disabling: deleting the cookie it migrates makes the next call free.
function migrateLegacyCookie() {
  if (typeof document === "undefined" || !COOKIE_RE.test(document.cookie)) return;
  const state = legacyCookieState(document.cookie);
  if (state && !readRaw()) save(state);
  document.cookie = `${NAME}=;path=/;max-age=0;SameSite=Lax`;
}

// Decode once per stored value, not once per call. The hottest paths — a
// sound effect on every keypad press, the top-bar refresh after every answer
// — each land here, and a full decode of a state near its 3500-byte budget
// per keystroke is pure waste. The raw string is the cache key, so any write
// (this tab's or another's) invalidates by simply not matching. Callers treat
// the returned state as read-only (writes go through save()), which is what
// makes sharing one object safe.
let lastRaw = null;
let lastState = null;

export function loadState() {
  migrateLegacyCookie();
  const raw = readRaw();
  if (raw !== lastRaw) {
    lastRaw = raw;
    lastState = decodeState(raw);
  }
  return lastState;
}

// One reader and one writer per section of the store. `getGame` takes the
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
  try {
    store()?.removeItem(NAME);
  } catch {
    // nothing stored anywhere the reset could miss
  }
  // a legacy cookie is state too — a reset that left it behind would resurrect
  if (typeof document !== "undefined") document.cookie = `${NAME}=;path=/;max-age=0;SameSite=Lax`;
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

// Whether the store holds anything worth resetting for `name`: a section of
// its own, or a trophy counter. Drives the parents' view list, so a stale
// dev-state entry still offers its reset.
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
// The whole site lives in this one store on this one device: a cleared cache
// or a new phone deletes a year of stars, silently. The backup is the state
// as a downloadable file, and the restore replaces the store whole.

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

// Replace the store with a parsed backup. Nothing merges: the file IS the
// state, exactly as resetAll + a year of play would have written it.
export function replaceState(state) {
  return save(state);
}
