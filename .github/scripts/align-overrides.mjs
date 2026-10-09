// Dependency-free: the audit jobs never populate node_modules, so no YAML library is available.
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const ENTRY = /^(\s+(?:"([^"]+)"|'([^']+)'|([^\s"'#][^:]*?)):\s+(["']?))([^"'#\s]+)(\5[^\r\n]*?)(\r?)$/;
const CARET = /^\^(\d+)\.(\d+)\.(\d+)$/;

function overrideLines(lines) {
  const start = lines.findIndex((line) => /^overrides:\s*(#.*)?$/.test(line));
  if (start === -1) return [];
  const found = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^[^\s#]/.test(lines[i])) break;
    found.push(i);
  }
  return found;
}

const compare = (a, b) => a.parts.reduce((diff, part, i) => diff || part - b.parts[i], 0);
const keyOf = (match) => match[2] ?? match[3] ?? match[4];

// Groups are package plus major, so every 0.x target shares one group: `a@<0.3.1: ^0.3.1` beside
// `a@<0.4.0: ^0.4.0` both become ^0.4.0. Overlaps across majors are left as written for the audit.
export function alignOverridesCounted(workspace, base) {
  const lines = workspace.split("\n");
  const baseLines = base.split("\n");
  const managed = new Set();
  for (const i of overrideLines(baseLines)) {
    const match = ENTRY.exec(baseLines[i]);
    if (match) managed.add(keyOf(match));
  }
  const groups = new Map();
  const entries = [];

  for (const i of overrideLines(lines)) {
    const match = ENTRY.exec(lines[i]);
    if (!match) continue;
    const key = keyOf(match);
    if (managed.has(key)) continue;
    const at = key.indexOf("@", 1);
    const caret = CARET.exec(match[6]);
    if (at === -1 || !caret) continue;
    const parts = caret.slice(1).map(Number);
    const group = `${key.slice(0, at)}\0${parts[0]}`;
    const best = groups.get(group);
    if (!best || compare({ parts }, best) > 0) groups.set(group, { parts, text: match[6] });
    entries.push({ i, match, group });
  }

  let raised = 0;
  for (const { i, match, group } of entries) {
    const target = groups.get(group).text;
    if (target === match[6]) continue;
    lines[i] = `${match[1]}${target}${match[7]}${match[8]}`;
    raised++;
  }
  return { text: lines.join("\n"), raised };
}

export const alignOverrides = (workspace, base) => alignOverridesCounted(workspace, base).text;

// import.meta.url is realpath'd, argv[1] is not: compare like with like on symlinked checkouts.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const base = readFileSync("pnpm-workspace.base.yaml", "utf8");
  const file = "pnpm-workspace.yaml";
  const { text, raised } = alignOverridesCounted(readFileSync(file, "utf8"), base);
  writeFileSync(file, text);
  console.log(`Aligned ${raised} override target(s)`);
}
