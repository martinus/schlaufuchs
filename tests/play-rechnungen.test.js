// tools/play-rechnungen.js is a browser script, so it cannot be imported. Its
// real logic — the resolvers that read a printed task off the screen — sits on
// `globalThis`, and this test runs them in Node against every task shape
// `questionFor()` can produce, cell by cell, at every difficulty. A driver that
// answers the wrong thing proves nothing, quietly (see tests/play.test.js).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BUCKETS, BUCKET_COUNT, questionFor } from "../games/rechnungen/logic.js";

const src = readFileSync(fileURLToPath(new URL("../tools/play-rechnungen.js", import.meta.url)), "utf8");

// Loading it must not touch the DOM: it defines functions and returns.
const sandbox = { document: undefined, window: undefined };
new Function("globalThis", `with (this) { ${src} }`).call(sandbox, sandbox);
const { resolveRechnung, resolveMauer, resolveQuad } = sandbox;

const seeded = (seed = 1) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

test("play-rechnungen.js loads without a DOM and exposes its resolvers", () => {
  assert.equal(typeof resolveRechnung, "function");
  assert.equal(typeof resolveMauer, "function");
  assert.equal(typeof resolveQuad, "function");
  assert.equal(typeof sandbox.playRechnung, "function");
  assert.equal(typeof sandbox.readRechnungScene, "function");
});

// What the SCREEN shows for a one-line task when cell `i` is being answered:
// cells before `i` display their answers, `i` and the rest still show "?" —
// exactly what rechnungen.js renders (lineHTML) and the driver reads.
function screenText(task, i) {
  const parts = task.text.split("?");
  let s = parts[0];
  task.cells.forEach((c, j) => {
    s += (j < i ? String(c.answer) : "?") + parts[j + 1];
  });
  return s;
}

test("the driver resolves every one-line task the game can ask, cell by cell, in both languages", () => {
  for (const divSign of [":", "÷"]) {
    for (let i = 0; i < BUCKET_COUNT; i++) {
      if (["mauer", "quad"].some((k) => BUCKETS[i].key.includes(k))) continue;
      const rng = seeded(i * 53 + 3);
      for (let k = 0; k < 800; k++) {
        const task = questionFor(i, rng, divSign);
        task.cells.forEach((cell, c) => {
          assert.equal(resolveRechnung(screenText(task, c)), cell.answer,
            `${BUCKETS[i].key}: "${screenText(task, c)}" cell ${c}`);
        });
      }
    }
  }
});

// A wall as the screen shows it while cell `i` is active: given bricks and
// already-solved cells visible, the rest null.
test("the driver completes every wall the game can show, at every step", () => {
  for (const key of ["mauer-l", "mauer-m", "mauer-s"]) {
    const i = BUCKETS.findIndex((b) => b.key === key);
    const rng = seeded(i * 53 + 3);
    for (let k = 0; k < 800; k++) {
      const task = questionFor(i, rng, ":");
      task.cells.forEach((cell, c) => {
        const vals = task.vals.map((v, pos) => {
          if (task.given[pos]) return v;
          const idx = task.cells.findIndex((x) => x.pos === pos);
          return idx >= 0 && idx < c ? v : null;
        });
        const full = resolveMauer(vals);
        assert.equal(full[cell.pos], cell.answer, `${key}: step ${c} of [${vals}]`);
        assert.deepEqual(full, task.vals, `${key}: the wall completes wrongly`);
      });
    }
  }
});

// A grid as the screen shows it: a hidden header — column OR row — is null
// until its cell lands, anchors and solved cells visible.
test("the driver completes every grid the game can show, at every step", () => {
  const FACE = { "+": "+", "-": "−" };
  for (const key of ["quad-l", "quad-m", "quad-s"]) {
    const i = BUCKETS.findIndex((b) => b.key === key);
    const rng = seeded(i * 53 + 3);
    for (let k = 0; k < 800; k++) {
      const task = questionFor(i, rng, ":");
      task.cells.forEach((cell, c) => {
        const landed = (pred) => {
          const idx = task.cells.findIndex(pred);
          return idx >= 0 && idx < c;
        };
        const cols = task.cols.map((v, idx) =>
          (task.hdr === idx && !landed((x) => x.pos.hdr === idx) ? null : v));
        const rows = task.rows.map((v, idx) =>
          (task.hdrRow === idx && !landed((x) => x.pos.hdrRow === idx) ? null : v));
        const grid = [[null, null], [null, null]];
        for (const g of task.given) grid[g.r][g.c] = task.grid[g.r][g.c];
        task.cells.forEach((x, idx) => {
          if (idx < c && x.pos.r !== undefined) grid[x.pos.r][x.pos.c] = x.answer;
        });
        const full = resolveQuad({ op: FACE[task.op], rows, cols, grid });
        const want = cell.pos.hdr !== undefined ? full.cols[cell.pos.hdr]
          : cell.pos.hdrRow !== undefined ? full.rows[cell.pos.hdrRow]
          : full.grid[cell.pos.r][cell.pos.c];
        assert.equal(want, cell.answer, `${key}: step ${c}`);
        assert.deepEqual(full.grid, task.grid, `${key}: the grid completes wrongly`);
        assert.deepEqual(full.rows, task.rows, `${key}: the rows complete wrongly`);
      });
    }
  }
});

test("the resolver refuses an equation with no operator it knows", () => {
  assert.throws(() => resolveRechnung("5 ⊕ 3 = ?"), /unknown operator/);
  assert.throws(() => resolveRechnung("hello"), /not an equation/);
});
