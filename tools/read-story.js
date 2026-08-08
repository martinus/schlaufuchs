// Read a drachen story the way a child does — as prose, not as a data
// structure. The one thing no test can check about a branching story is whether
// its steps FOLLOW each other, and that defect is invisible in the diff: every
// scene reads fine on its own, and only the join between two of them is wrong.
//
//   node tools/read-story.js              # every story, joins view
//   node tools/read-story.js ei           # one story
//   node tools/read-story.js ei --paths   # every complete path, start to end
//
// The default view is by JOIN, because that is the review unit. A scene in a
// layered DAG can be walked into from more than one earlier scene, and it has to
// make sense after EACH of them — after "Über den Bach springen" as well as
// after "Den Zettel einstecken". Reading whole paths finds the same defects but
// re-reads the coherent parts 2^depth times.

import { STORIES } from "../games/drachen/content.js";
import { storiesFor, isEnding, startNode, layersOf } from "../games/drachen/logic.js";

const DIFF = ["Leicht", "Mittel", "Schwer"];
const args = process.argv.slice(2);
const wantPaths = args.includes("--paths");
const only = args.find((a) => !a.startsWith("--"));

const wrap = (text, indent) => {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > 76 - indent.length) { lines.push(line); line = w; }
    else line = (line ? `${line} ${w}` : w);
  }
  if (line) lines.push(line);
  return lines.map((l) => indent + l).join("\n");
};

function joins(story) {
  // every incoming edge, grouped by the scene it arrives at
  const into = new Map(story.nodes.map((n) => [n.id, []]));
  for (const node of story.nodes) {
    for (const c of node.c ?? []) into.get(c.to)?.push({ from: node, choice: c.a });
  }
  const layer = layersOf(story);
  console.log(`\n${"═".repeat(78)}\n${story.title}  (${DIFF[story.diff]}, ${story.depth} Szenen, key "${story.key}")\n${"═".repeat(78)}`);
  for (const node of story.nodes) {
    const tag = isEnding(node) ? `ENDE ${node.end} — ${node.name}` : node.id;
    console.log(`\n── ${tag}  [Ebene ${layer.get(node.id)}]`);
    const ins = into.get(node.id) ?? [];
    if (ins.length === 0) console.log("   (Start)");
    for (const { from, choice } of ins) {
      console.log(`   ←  ${from.id}: „${choice}“`);
    }
    console.log(wrap(`${node.e} ${node.t}`, "      "));
  }
}

function paths(story) {
  console.log(`\n${"═".repeat(78)}\n${story.title}  — alle Wege\n${"═".repeat(78)}`);
  const walk = (node, trail) => {
    if (isEnding(node)) {
      console.log(`\n--- ${trail.map((t) => t.pick).join(" → ")}`);
      for (const t of trail) console.log(wrap(`${t.e} ${t.t}`, "   ") + `\n      ▸ ${t.pick}`);
      console.log(wrap(`${node.e} ${node.t}`, "   ") + `\n      ★ ${node.name}`);
      return;
    }
    for (const c of node.c ?? []) {
      walk(story.nodes.find((n) => n.id === c.to), [...trail, { ...node, pick: c.a }]);
    }
  };
  walk(startNode(story), []);
}

const all = [0, 1, 2].flatMap((d) => storiesFor(d, STORIES.de));
for (const story of all) {
  if (only && story.key !== only) continue;
  if (wantPaths) paths(story); else joins(story);
}
