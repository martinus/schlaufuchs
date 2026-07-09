// What the test suite knows about the pages of this site.
//
// Four test files used to each rediscover the pages and each read their files.
// Discovery, not a list: a new root page is covered by every test the moment it
// exists, not when someone remembers to add it.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
export const abs = (p) => fileURLToPath(new URL(p, root));
export const read = (p) => readFileSync(abs(p), "utf8");

export const ROOT_PAGES = readdirSync(abs(".")).filter((f) => f.endsWith(".html")).sort();
export const GAME_PAGES = readdirSync(abs("games")).map((g) => `games/${g}/index.html`);
export const PAGES = [...ROOT_PAGES, ...GAME_PAGES];

// The entry module of a page, repo-relative, or null if it carries none.
export function entryOf(page) {
  const src = read(page).match(/<script type="module" src="([^"?]+)/)?.[1];
  if (!src) return null;
  return new URL(src, new URL(page, root)).href.slice(root.href.length);
}

// A page's own markup plus the module it loads. Enough to answer "does this
// page end up with a gear?", which stopped being a question about markup when
// the top bar became a function.
export function sourcesOf(page) {
  const entry = entryOf(page);
  return read(page) + (entry ? `\n${read(entry)}` : "");
}

// The bar comes in two shapes (§3.3). A page asks for exactly one of them: the
// child's, with the fox chip and the gear, or the reader's, with a title.
export const hasFoxBar = (page) => {
  const src = sourcesOf(page);
  return src.includes("initTopBar(") && !/\btitle:\s*["']/.test(src);
};
