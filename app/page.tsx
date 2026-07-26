import { GitHubIcon, LockIcon, StarIcon } from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { WesternPixelCredit } from "@/components/western-pixel";
import { controls } from "@/lib/controls";
import { readTemplateVersion } from "@/lib/template-version";

const REPO_URL = "https://github.com/imc786/airlock";

const failureModes = [
  {
    title: "Strict mode breaks audit regeneration",
    body: "An explicit minimumReleaseAge turns on strict resolution, which fails any mutating re-resolve of a package under 24 hours old. The audit regen exempts strict per-command; nothing else does.",
  },
  {
    title: "trustLockfile is required, not optional",
    body: "Without it, every cold-store CI runner re-checks the age of each committed pin and goes red for roughly a day after any dependency change, blocking unrelated PRs and auto-merge.",
  },
  {
    title: "audit --fix=override leaves the lockfile stale",
    body: "It writes overrides but not the lockfile, so the PR fails with a lockfile config mismatch. The workflow has to regenerate the lockfile in a second pass.",
  },
  {
    title: "The two-pass ordering is load-bearing",
    body: "Applying the fix before the natural re-resolve finds nothing, then silently re-resolves back to vulnerable versions. Reset to base, re-resolve, then re-fix, in that order.",
  },
  {
    title: "Dependabot does not bump the pnpm pin",
    body: "The packageManager field is left untouched by Dependabot, so the one dependency the whole pipeline runs on is the one nothing auto-maintains. The audit job emits a loud warning when pnpm falls behind; the bump stays by hand, because a pnpm major needs a migration checklist.",
  },
];

const copyableFiles = [
  ".github/workflows/audit.yml",
  ".github/workflows/ci.yml",
  ".github/dependabot.yml",
  ".github/TEMPLATE_VERSION",
  "pnpm-workspace.base.yaml",
  "package.json (the packageManager, engines and script pins)",
  "playwright.config.ts (the PLAYWRIGHT_BASE_URL pattern)",
];

export default function Home() {
  const version = readTemplateVersion();

  return (
    <main className="mx-auto max-w-3xl px-6 pt-16 pb-8">
      <header className="mb-16">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="inline-block rounded-full border border-line px-3 py-1 font-mono text-xs text-muted">
            you are looking at {version.full}
          </p>
          <ThemeToggle />
        </div>
        <h1 className="mb-4 flex items-center gap-3 text-4xl font-bold tracking-tight sm:text-5xl">
          <LockIcon className="h-9 w-9 text-accent sm:h-12 sm:w-12" />
          Airlock
        </h1>
        <p className="mb-8 text-lg text-muted">
          A CI-green reference that wires pnpm 11 supply-chain defaults together with a regenerating audit-fix pipeline,
          Dependabot cooldown and SHA-matched unattended auto-merge, for solo Next.js on Vercel. This very site runs the
          pipeline, so the reference stays alive rather than rotting.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            className="inline-flex items-center gap-2 rounded-md bg-btn px-4 py-2 font-medium text-white hover:bg-btn-hover"
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <GitHubIcon className="h-4 w-4" />
            View the repo
          </a>
          <a
            className="inline-flex items-center gap-2 rounded-md border border-line px-4 py-2 font-medium hover:text-ink"
            href={`${REPO_URL}/stargazers`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <StarIcon className="h-4 w-4 text-[#f5a623]" />
            Star it on GitHub
          </a>
        </div>
      </header>

      <section className="mb-16">
        <h2 className="mb-6 text-2xl font-semibold">What it embodies</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {controls.map((control) => (
            <article key={control.id} className="rounded-lg border border-line p-5">
              <h3 className="mb-2 font-semibold">{control.title}</h3>
              <p className="text-sm text-muted">{control.summary}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mb-16">
        <h2 className="mb-3 text-2xl font-semibold">The gap it fills</h2>
        <p className="mb-6 text-muted">
          The individual settings are documented everywhere. The integration, where the pieces interact badly, is not.
          These are the failure modes you only find by running the whole thing unattended.
        </p>
        <ul className="space-y-5">
          {failureModes.map((mode) => (
            <li key={mode.title}>
              <h3 className="font-semibold">{mode.title}</h3>
              <p className="text-sm text-muted">{mode.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-16">
        <h2 className="mb-3 text-2xl font-semibold">But why not Renovate?</h2>
        <p className="text-muted">
          Renovate covers the Dependabot half of this well: auto-merge, minimum release age and lockfile maintenance.
          Airlock&apos;s novel half is pnpm-11-specific: the <code>audit --fix=override</code> regeneration pipeline,
          the strict / trustLockfile / regen interaction, and override provenance via a committed base template. If that
          half is not your problem, Renovate may be the better fit. If it is, this is the wiring nobody else publishes.
        </p>
      </section>

      <section className="mb-16">
        <h2 className="mb-6 text-2xl font-semibold">How to adopt</h2>
        <div className="mb-6 rounded-lg border border-line p-5">
          <h3 className="mb-2 font-semibold">Starting fresh</h3>
          <p className="text-sm text-muted">
            Use the GitHub &quot;Use this template&quot; button. You get a copy of this whole demo; keep the automation
            and swap in your own app.
          </p>
        </div>
        <div className="rounded-lg border border-line p-5">
          <h3 className="mb-2 font-semibold">Into an existing repo</h3>
          <p className="mb-3 text-sm text-muted">
            Copy this file set, provision an automation token, set the author variable, record the template version, and
            adapt the values marked for first use (allowBuilds, overrides, CSP, app specifics).
          </p>
          <ul className="space-y-1 font-mono text-xs text-muted">
            {copyableFiles.map((file) => (
              <li key={file}>{file}</li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="flex flex-col items-center justify-between gap-4 border-t border-line pt-8 text-sm text-muted sm:flex-row">
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 hover:text-ink"
        >
          <GitHubIcon className="h-4 w-4 shrink-0" />
          <span>imc786/airlock on GitHub. Contributions, forks and stars are welcome.</span>
        </a>
        <WesternPixelCredit className="shrink-0" />
      </footer>
    </main>
  );
}
