# Airlock

The golden pnpm 11 + Dependabot + audit-fix CI template for solo Next.js on Vercel.

Airlock is a CI-green reference that wires together pnpm 11 supply-chain defaults, a regenerating
(not appending) audit-fix pipeline, Dependabot cooldown, and SHA-matched unattended auto-merge. It is
a live repository, not a snapshot: its own workflows run daily and its own Dependabot keeps the action
SHAs current, so the reference stays current instead of drifting out of date.

This repo is the source of truth. The version other repos copy is recorded in
[`.github/TEMPLATE_VERSION`](.github/TEMPLATE_VERSION), and the running site displays it.

## The gap it fills

Every individual setting here is documented somewhere. What is not documented is the integration,
where the pieces interact badly. These are the failure modes you only find by running the whole thing
unattended:

- **Strict `minimumReleaseAge` breaks audit regeneration.** Setting the value explicitly turns on
  strict resolution, which fails any mutating re-resolve of a package under 24 hours old
  (`ERR_PNPM_NO_MATURE_MATCHING_VERSION`). The audit regen exempts strict per-command; nothing else
  does.
- **`trustLockfile` is required, not optional.** Without it every cold-store CI runner re-checks the
  age of each committed pin and goes red for roughly a day after any dependency change, blocking
  unrelated PRs and auto-merge.
- **`audit --fix=override` leaves the lockfile stale.** It writes overrides to
  `pnpm-workspace.yaml` but not `pnpm-lock.yaml`, so the PR fails with
  `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH`. The workflow regenerates the lockfile in a second pass.
- **The two-pass ordering is load-bearing.** Applying the fix before the natural re-resolve finds
  nothing, then silently re-resolves back to vulnerable versions. Reset to base, re-resolve, then
  re-fix, in that order.
- **Dependabot does not bump the pnpm pin itself.** The `packageManager` field is left untouched
  ([dependabot-core#4830](https://github.com/dependabot/dependabot-core/issues/4830) is still open),
  so the one dependency the whole pipeline runs on is the one nothing auto-maintains. The audit job
  emits a loud warning when pnpm falls behind; the bump stays by hand, because a pnpm major needs a
  migration checklist.
- **`--fix=override` emits one override per advisory, so selectors can overlap.** This repo's own live
  `pnpm-workspace.yaml` has carried overlapping `postcss` overrides (one version matching more than one
  selector) as a live example. It looks like a corrupted config but is not: the daily regeneration
  rebuilds the managed set from the base every run, so it never accumulates beyond the advisories
  currently open.

## Threat model

This template assumes a **single trusted owner**. That assumption shapes several decisions below, so
it is stated up front:

- **No CODEOWNERS or required review on `.github/workflows/`.** Those controls are only enforceable
  through branch protection, which the unattended solo design deliberately omits. Workflow files run
  with token access and nothing gates changes to them except the owner's account, so the actual
  control at this layer is account security (passkeys, 2FA) and PAT hygiene, not review process. With
  a second maintainer, add branch protection and CODEOWNERS and this section stops applying.
- **`AUTOMATION_TOKEN` is a repo-level secret**, readable by any workflow in this repo and not gated
  behind a GitHub Environment (an Environment cannot scope a secret to a specific workflow file, which
  is the protection that would matter here). Compensating controls: the PAT is fine-grained,
  single-repo, Contents and Pull requests only; the auto-merge job asserts changed files are limited
  to `pnpm-workspace.yaml` and `pnpm-lock.yaml`, bounding what a stolen token can merge unattended;
  and the audit job never materialises `node_modules`, so no dependency code executes next to the
  token.
- **Exact version pinning: checklists ask for it, this repo floats ranges.** `package.json` uses `^`
  ranges, but every CI install is `--frozen-lockfile`, so nothing resolves at run time. The risk that
  exact pinning addresses belongs to lockfile-less workflows. Range floors plus lockfile plus cooldown
  is the deliberate design.
- **`patrickedqvist/wait-for-vercel-preview`** is the one single-maintainer community action in the
  set. SHA-pinning removes the tag-repointing vector and, as a bundled Node action, it pulls no
  transitive actions at run time. Re-vet the diff when bumping its pin; it is the dependency here
  most worth close scrutiny.
- **Provenance attestations are not enforced.** npm has `npm audit signatures`; pnpm has no
  equivalent first-class verification today. Tracked as a watch item, not a control.

## Comparison with Renovate

Renovate covers the Dependabot half of this well: automerge, minimum release age, and lockfile
maintenance. Airlock's novel half is pnpm-11-specific: the `audit --fix=override` regeneration
pipeline, the strict / `trustLockfile` / regen interaction, and override provenance via a committed
base template. If that half is not your problem, Renovate may be the better fit. If it is, this is the
part that is hard to assemble from the docs alone.

## How to adopt

### Starting fresh

Click **Use this template** on GitHub. You get a copy of this whole demo; keep the automation surface
below and swap in your own app (`app/`, `lib/`, `components/`).

### Into an existing repo

Copy these files:

- `.github/workflows/audit.yml`
- `.github/workflows/ci.yml`
- `.github/dependabot.yml`
- `.github/TEMPLATE_VERSION`
- `pnpm-workspace.base.yaml` **and** the live `pnpm-workspace.yaml` (see step 4: the live file must
  exist from day one, or your first CI install runs with no `trustLockfile`/`allowBuilds`)
- the `packageManager`, `engines` and lint/check/test script pins from `package.json`
- the `PLAYWRIGHT_BASE_URL` pattern from `playwright.config.ts`

Then:

1. Provision a fine-grained PAT for the repo owner with **Contents: read/write AND Pull requests:
   read/write** (both are mandatory; PRs-only fails the branch push with a 403). Store it as the
   repo secret `AUTOMATION_TOKEN`.
2. Set the repo variable `AUTOMATION_AUTHOR` to `NAME <ID+USERNAME@users.noreply.github.com>` for the
   owner account, so Vercel's author allowlist still builds the preview.
3. Set `.github/TEMPLATE_VERSION` to the tag you copied, for example `airlock@v4`. When re-syncing
   later, [`CHANGELOG.md`](CHANGELOG.md) lists what changed per tag and any action required.
4. Create the live workspace file from the base and commit both: `cp pnpm-workspace.base.yaml
   pnpm-workspace.yaml`. It must exist from day one, or your first `pnpm install --frozen-lockfile` in
   CI runs with no `trustLockfile` (the ~24h cold-store red) and no `allowBuilds` protection. The audit
   job regenerates it thereafter.
5. Adapt the values marked for first use (below).

### Repo settings the template cannot carry

Template files cannot express repository settings, so "Use this template" does not copy these. All
four live under **Settings > Actions > General** and take two minutes total:

1. **Workflow permissions: read repository contents (read-only).** Both workflows declare explicit
   `permissions:` blocks, so this default never applies to them. It exists to protect the workflow
   you add next year without one.
2. **Untick "Allow GitHub Actions to create and approve pull requests."** Airlock needs neither: the
   audit PR is created by the `AUTOMATION_TOKEN` PAT, not `GITHUB_TOKEN`, and auto-merge is a merge,
   not an approval. Most auto-merge setups have to leave this on; this design is shaped so you can
   turn it off.
3. **Fork pull request workflows: require approval for all outside collaborators.** On a public repo,
   fork PRs trigger the build job (read-only and secretless: `pull_request` never exposes secrets to
   forks, and the preview and merge jobs are guarded). This setting is about runner-minute abuse and
   probing, not secrets.
4. **Allow select actions**, restricted to the exact list this template uses: `actions/*`,
   `pnpm/action-setup`, `dependabot/fetch-metadata`, `peter-evans/create-pull-request`,
   `patrickedqvist/wait-for-vercel-preview`, `step-security/harden-runner`. A malicious marketplace
   action then cannot be adopted here without an explicit settings change.

### Adapt on first use

- **`AUTOMATION_AUTHOR`** repo variable: the owner's git identity
- **`allowBuilds`** in `pnpm-workspace.base.yaml`: derived from your own dependency build scripts
  (pnpm scaffolds placeholders on first install; resolve each)
- **`overrides` / `minimumReleaseAgeExclude`**: generated by your own audit runs
- **CSP and security headers** in `next.config.ts`: match your app's origins
- **PostHog keys/host** (`NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`) or drop PostHog
  entirely. Analytics is gated on Vercel's auto-injected `NEXT_PUBLIC_VERCEL_ENV`, so it needs no env
  setup to stay off in preview and local
- **App specifics**: ports, routes, Playwright projects, domain

Node needs no edit: the workflows read `engines.node` from `package.json` via
`node-version-file`, and pnpm derives from `packageManager`.

## How it works

- **`.github/workflows/audit.yml`** runs daily. It resets `pnpm-workspace.yaml` to
  `pnpm-workspace.base.yaml`, re-resolves the lockfile, re-applies `pnpm audit --fix=override`,
  reconciles the lockfile, and opens a PR only if something changed. It also fails loudly if the
  automation identity or token is missing, and warns when the pinned pnpm falls behind the registry.
  The audit runs with `--no-optional`, a deliberate scope choice: optional dependencies (where
  platform binaries like sharp's prebuilt artifacts live) are outside the audit lane and are covered
  by Dependabot version updates instead.
- **`.github/workflows/ci.yml`** runs a local build gate (lint, unit tests, build, type-check) and a
  preview-e2e gate that waits for the Vercel preview and runs Playwright against it. Both audit and
  Dependabot PRs auto-merge only after both gates pass, pinned to the tested commit.
- **`pnpm-workspace.base.yaml`** is the hand-maintained source of truth. Edit it, never the live
  `pnpm-workspace.yaml`, which the audit job regenerates.

## Development

```sh
pnpm install
cp .env.example .env.local   # optional: analytics runs only on the Vercel production deployment
pnpm dev                     # http://localhost:3000
pnpm check && pnpm test && pnpm build && pnpm test:e2e
```

## Maintenance

Airlock is dogfooded: it runs the same automation it documents, so keeping it green keeps the pattern
proven. Two rules:

- **A red CI on Airlock is worth fixing first.** A broken reference spreads breakage to everyone who
  copies from it.
- **Never move a published tag; always cut a new one.** Repos that adopt Airlock diff against tags via
  their `.github/TEMPLATE_VERSION`, and that diffing assumes tags are immutable.

## Security posture

The build and preview-e2e gates verify functionality, not safety: a competently compromised package
passes them fine. The real install-time protections are `allowBuilds` (deny-by-default), Dependabot
cooldown, SHA-matched merges, SHA-pinned actions, and the minimal-privilege `--lockfile-only` audit
job. The audit lane deliberately fast-tracks CVE fixes and so is the one lane where cooldown does not
apply. There is no branch protection on this plan, so the workflow ordering protects only the
automated merge paths; a human with write access can still merge manually.

## Licence

MIT. Built by [Western Pixel](https://westernpixel.com).
