import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

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

/** Runs a workflow step's script in a scratch dir under bash -e, with a recording stub for pnpm. */
function runStep(script: string, files: Record<string, string>, keep: string[]) {
  const dir = mkdtempSync(join(tmpdir(), "airlock-step-"));
  try {
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, path)), { recursive: true });
      writeFileSync(join(dir, path), content);
    }
    const bin = join(dir, ".bin");
    mkdirSync(bin);
    const record = `{ echo "$*"; grep '^trustLockfile' pnpm-workspace.yaml || echo unset; } > pnpm-called\n`;
    writeFileSync(join(bin, "pnpm"), `#!/bin/sh\n${record}`, { mode: 0o755 });
    let code = 0;
    try {
      execFileSync("bash", ["-e", "-c", script], {
        cwd: dir,
        env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
        stdio: "pipe",
      });
    } catch (error) {
      code = (error as { status: number | null }).status ?? 1;
    }
    const read = (path: string) => {
      try {
        return readFileSync(join(dir, path), "utf8");
      } catch {
        return undefined;
      }
    };
    return { code, files: Object.fromEntries(keep.map((path) => [path, read(path)])) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

type Job = {
  "runs-on": string;
  if?: string;
  needs?: string[];
  steps: { name?: string; uses?: string; run?: string; "continue-on-error"?: boolean; with?: Record<string, string> }[];
};
const jobs = (name: string) => (parse(workflow(name)) as { jobs: Record<string, Job> }).jobs;

describe("merge-path trust boundaries", () => {
  const ci = jobs("ci.yml");
  const guard = ci["audit-pr-guard"];
  const audit = jobs("audit.yml")["audit-fix"];
  const index = (name: string) => guard.steps.findIndex((s) => s.name === name);
  const REGENERATION = [
    "Reset managed config to base",
    "Natural re-resolve (prunes stale overrides)",
    "Re-apply audit fixes",
    "Reconcile lockfile with regenerated overrides",
    "Fail closed if advisories remain",
  ];

  it("merges an audit PR only after the content guard passes, on the same trust condition", () => {
    expect(ci["audit-fix-auto-merge"].needs).toEqual(
      expect.arrayContaining(["build", "preview-e2e", "audit-pr-guard"]),
    );
    expect(guard.if).toBe(ci["audit-fix-auto-merge"].if);
  });

  // The guard's authority is that the PR equals what the audit job produces, so both must run the same
  // regeneration: a drifted copy would reproduce something else and block every genuine PR.
  it("reproduces audit.yml's regeneration step for step", () => {
    const pick = (job: Job) =>
      REGENERATION.map((name) => {
        const step = job.steps.find((s) => s.name === name);
        return { name, run: step?.run, continueOnError: step?.["continue-on-error"] ?? false };
      });
    expect(pick(guard).every((step) => step.run)).toBe(true);
    expect(pick(guard)).toEqual(pick(audit));
    const order = REGENERATION.map(index);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(guard.steps.filter((s) => s["continue-on-error"]).map((s) => s.name)).toEqual(["Re-apply audit fixes"]);
  });

  // Every regeneration input comes from main; the PR's files are compared and never read by anything else.
  it("regenerates from main and only compares the PR's two files", () => {
    const [main, pr] = guard.steps.filter((s) => s.uses?.startsWith("actions/checkout@"));
    expect(main.with?.ref).toBe("${{ github.event.pull_request.base.sha }}");
    expect(main.with?.path).toBeUndefined();
    expect(pr.with?.path).toBe("pr");
    expect(pr.with?.["sparse-checkout"]?.trim().split("\n")).toEqual(["pnpm-lock.yaml", "pnpm-workspace.yaml"]);
    expect(guard.steps.filter((s) => s.run?.includes("pr/")).map((s) => s.name)).toEqual([
      "Require the PR to match main's regeneration",
    ]);
    expect(index("Require the PR to match main's regeneration")).toBeGreaterThan(
      index("Fail closed if advisories remain"),
    );
    expect(index("Refuse pins inside the quarantine window")).toBeGreaterThan(
      index("Require the PR to match main's regeneration"),
    );
  });

  // github.actor is whoever triggered the run, so it is spoofable and changes when a person reopens a PR.
  it("keys both merge jobs on the PR author and the same repository", () => {
    for (const job of ["dependabot-auto-merge", "audit-fix-auto-merge"]) {
      expect(ci[job].if).toContain("github.event.pull_request.user.login ==");
      expect(ci[job].if).toContain("github.event.pull_request.head.repo.full_name == github.repository");
      expect(ci[job].if).not.toContain("github.actor");
    }
  });

  // ubuntu-latest can move to a new OS release, and so to new apt sources, without a reviewed edit.
  it("pins every runner to an OS release", () => {
    for (const [name, job] of [...Object.entries(ci), ...Object.entries(jobs("audit.yml"))]) {
      expect(job["runs-on"], name).not.toMatch(/-latest$/);
    }
  });
});

describe("audit PR content guard steps", () => {
  const compare = extractRunBlock(workflow("ci.yml"), "Require the PR to match main's regeneration");
  const quarantine = extractRunBlock(workflow("ci.yml"), "Refuse pins inside the quarantine window");
  const regenerated = { "pnpm-workspace.yaml": "trustLockfile: true\n", "pnpm-lock.yaml": "lockfileVersion: '9.0'\n" };
  const pr = (overrides: Record<string, string> = {}) => ({
    "pr/pnpm-workspace.yaml": regenerated["pnpm-workspace.yaml"],
    "pr/pnpm-lock.yaml": regenerated["pnpm-lock.yaml"],
    ...overrides,
  });

  it("extracted the real steps, not empty blocks", () => {
    expect(compare).toContain("cmp");
    expect(quarantine).toContain("pnpm install --frozen-lockfile --lockfile-only");
  });

  it("passes a PR identical to main's regeneration", () => {
    expect(runStep(compare, { ...regenerated, ...pr() }, []).code).toBe(0);
  });

  it("fails a PR whose lockfile differs by a single edge", () => {
    const changed = pr({ "pr/pnpm-lock.yaml": "lockfileVersion: '9.0'\n# postcss: react@19.3.0\n" });
    expect(runStep(compare, { ...regenerated, ...changed }, []).code).not.toBe(0);
  });

  it("fails a PR whose workspace file differs", () => {
    const changed = pr({ "pr/pnpm-workspace.yaml": "trustLockfile: true\nallowBuilds:\n  esbuild: true\n" });
    expect(runStep(compare, { ...regenerated, ...changed }, []).code).not.toBe(0);
  });

  it("fails when the PR's file is missing rather than treating it as a match", () => {
    const files = { ...regenerated, "pr/pnpm-workspace.yaml": regenerated["pnpm-workspace.yaml"] };
    expect(runStep(compare, files, []).code).not.toBe(0);
  });

  // trustLockfile is what lets CI skip the release-age check, so the check only runs if it is switched off.
  it("switches trustLockfile off before pnpm verifies release ages", () => {
    for (const setting of ["trustLockfile: true\n", "trustLockfile: true # skip age re-checks on cold CI\n"]) {
      const run = runStep(quarantine, { "pnpm-workspace.yaml": setting }, ["pnpm-called"]);
      expect(run.code).toBe(0);
      expect(run.files["pnpm-called"]).toBe("install --frozen-lockfile --lockfile-only\ntrustLockfile: false\n");
    }
  });
});
