import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Both defects these tests cover were shell/control-flow, invisible to review but caught instantly by
// execution. Scripts are extracted from the shipped workflow rather than copied, so a copy cannot rot.

const workflow = (name: string) => readFileSync(join(__dirname, "..", ".github", "workflows", name), "utf8");

type Step = { name: string; body: string };

function steps(source: string): Step[] {
  const lines = source.split("\n");
  const starts = lines.flatMap((line, i) => (/^\s*- name: /.test(line) ? [i] : []));
  return starts.map((start, i) => ({
    name: lines[start].replace(/^\s*- name: /, "").trim(),
    body: lines.slice(start, starts[i + 1] ?? lines.length).join("\n"),
  }));
}

function extractRunBlock(source: string, stepName: string): string {
  const step = steps(source).find((s) => s.name === stepName);
  if (!step) throw new Error(`Step not found: ${stepName}`);

  const lines = step.body.split("\n");
  const runAt = lines.findIndex((line) => /^\s*run: \|\s*$/.test(line));
  if (runAt === -1) throw new Error(`Step has no block run: ${stepName}`);

  const body = lines.slice(runAt + 1);
  const indent = body.find((line) => line.trim() !== "")?.search(/\S/) ?? 0;
  const script: string[] = [];
  for (const line of body) {
    if (line.trim() !== "" && line.search(/\S/) < indent) break;
    script.push(line.slice(indent));
  }
  return script.join("\n").trimEnd();
}

/** Runs a script the way GitHub runs a default `run:` step: bash -e, no pipefail. */
function runWithStubbedGh(script: string, ghStub: string): number {
  const dir = mkdtempSync(join(tmpdir(), "airlock-guard-"));
  const binDir = join(dir, "bin");
  mkdirSync(binDir);
  writeFileSync(join(binDir, "gh"), ghStub, { mode: 0o755 });
  const scriptPath = join(dir, "guard.sh");
  writeFileSync(scriptPath, script);

  try {
    execFileSync("bash", ["-e", scriptPath], {
      env: {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH}`,
        PR_URL: "https://github.invalid/o/r/pull/1",
      },
      stdio: "pipe",
    });
    return 0;
  } catch (error) {
    return (error as { status: number | null }).status ?? 1;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const ghListing = (...files: string[]) => `#!/bin/sh\n${files.map((f) => `echo '${f}'`).join("\n")}\n`;

describe("audit PR file-scope guard", () => {
  const script = extractRunBlock(workflow("ci.yml"), "Assert audit PR only touches dependency config");

  it("extracted the real guard, not an empty block", () => {
    expect(script).toContain("gh pr diff");
  });

  it("passes when the PR touches only dependency config", () => {
    expect(runWithStubbedGh(script, ghListing("pnpm-lock.yaml", "pnpm-workspace.yaml"))).toBe(0);
  });

  it("fails when the PR touches anything else", () => {
    expect(runWithStubbedGh(script, ghListing("pnpm-lock.yaml", "app/page.tsx"))).not.toBe(0);
  });

  // The original defect: `gh ... | grep ... || true` made an unreachable API read as "nothing
  // unexpected". The default run shell is bash -e without pipefail, so the pipeline hid it twice over.
  it("fails when the GitHub API call fails", () => {
    expect(runWithStubbedGh(script, "#!/bin/sh\necho 'gh: API error' >&2\nexit 1\n")).not.toBe(0);
  });

  it("fails when the API returns an empty file list", () => {
    expect(runWithStubbedGh(script, "#!/bin/sh\nexit 0\n")).not.toBe(0);
  });

  // A non-empty but failed call: passes only if the fetch itself is unguarded, so this is what breaks
  // if `|| true` is ever reattached to the assignment.
  it("fails when the API errors after printing an allowed filename", () => {
    expect(runWithStubbedGh(script, "#!/bin/sh\necho 'pnpm-lock.yaml'\nexit 1\n")).not.toBe(0);
  });
});

describe("audit job fail-closed ordering", () => {
  const auditSteps = steps(workflow("audit.yml"));
  const names = auditSteps.map((s) => s.name);

  // The regeneration resets pnpm-workspace.yaml to base before re-applying fixes, so any step allowed
  // to fail silently between the reset and the change gate can ship a PR that only prunes overrides.
  it("allows exactly one step to fail silently", () => {
    const failOpen = auditSteps.filter((s) => /^\s*continue-on-error:\s*true/m.test(s.body)).map((s) => s.name);
    expect(failOpen).toEqual(["Re-apply audit fixes"]);
  });

  // The gate audits the lockfile, so it has to run after reconciliation: audit the pre-reconcile
  // lockfile and it can pass while the lockfile the PR actually commits is still vulnerable.
  it("verifies advisories after reconciliation and before the change gate", () => {
    const fix = names.indexOf("Re-apply audit fixes");
    const reconcile = names.indexOf("Reconcile lockfile with regenerated overrides");
    const gate = names.indexOf("Fail closed if advisories remain");
    const change = names.indexOf("Check for changes");
    expect(fix).toBeGreaterThan(-1);
    expect(reconcile).toBeGreaterThan(fix);
    expect(gate).toBeGreaterThan(reconcile);
    expect(change).toBeGreaterThan(gate);
  });

  it("runs a real audit at the gate, not another fix", () => {
    // Pinned to the exact command: anything looser accepts a trailing `|| true`, which would restore
    // the fail-open this gate exists to close. Matched on the run: line so comments cannot satisfy it.
    const gate = auditSteps.find((s) => s.name === "Fail closed if advisories remain");
    expect(gate?.body).toMatch(/^\s*run: pnpm audit --no-optional$/m);
    expect(gate?.body).not.toMatch(/^\s*continue-on-error:/m);
  });
});
