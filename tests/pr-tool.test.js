// tools/pr.sh runs the repo's whole PR loop (push → PR → CI → squash-merge →
// watch deploy → prune). Its worth is the guards, each encoding a burnt finger
// from CLAUDE.md — so the guards are what gets pinned: remove one and this
// file goes red, not a future merge.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const path = fileURLToPath(new URL("../tools/pr.sh", import.meta.url));
const src = readFileSync(path, "utf8");

test("pr.sh is valid sh and fails fast", () => {
  execFileSync("sh", ["-n", path]); // throws on a syntax error
  assert.match(src, /^set -eu$/m, "one silent mid-loop failure must abort the whole loop");
});

test("pr.sh keeps the guards that were each learned the hard way", () => {
  // never PR from the default branch — branch first (CLAUDE.md pre-flight)
  assert.ok(src.includes(`[ "$branch" != "$default" ]`), "must refuse to PR from the default branch");
  // never with uncommitted work — half a change must not stay behind. Pinned
  // as the full guard LINE: the option string alone survives an `if false`.
  assert.ok(src.includes('if [ -n "$(git status --porcelain)" ]; then'),
    "must refuse a dirty working tree");
  // never merge unread deletions — that is how a neighbour's merge gets undone
  assert.ok(src.includes('deleted=$(git diff --diff-filter=D --name-only "origin/$default..HEAD")'),
    "must name every file the PR deletes");
  assert.ok(src.includes('if [ -n "$deleted" ] && [ "$allow_deletions" -eq 0 ]; then'),
    "…and the guard itself must be live, not just its option string");
});

test("pr.sh merges the repo's way and proves the deploy", () => {
  assert.ok(src.includes("gh pr merge") && src.includes("--squash"),
    "squash is the merge method the ruleset and the history expect");
  assert.ok(src.includes("gh pr checks") && src.includes("--watch"),
    "CI must settle before the merge, not after");
  assert.ok(src.includes("gh run watch") && src.includes("--exit-status"),
    "the deploy the merge triggers is part of the loop, not an afterthought");
  assert.match(src, /grep -o 'v=\[a-z0-9\]\*'/,
    "the loop ends by reading the live site's version — deploy green is a claim, v=N is proof");
});
