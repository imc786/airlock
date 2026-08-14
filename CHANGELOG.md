# Changelog

Notable changes to the Airlock template surface. Versions are the git tags adopters copy from; each
entry says what changed and any action needed when re-syncing a repo that copied an earlier tag.

Tags are immutable: a published tag is never moved, only superseded by a new one.

## v6 - 2026-08-14

- **audit.yml:** a mandatory `pnpm audit --no-optional` now runs after lockfile reconciliation and
  before the change gate. `Re-apply audit fixes` is `continue-on-error` and the regeneration resets
  `pnpm-workspace.yaml` to base first, so a failed or partial fix previously opened an
  auto-mergeable PR whose entire content was the removal of live overrides. The job now fails closed
  instead. Advisories listed in `auditConfig.ignoreGhsas` do not trip it.
- **ci.yml:** the audit-PR file-scope guard fetches the changed-file list before filtering it.
  `gh pr diff ... | grep ... || true` swallowed API failures, and the default `run` shell sets no
  `pipefail`, so an unreachable API read as "no unexpected files" and the PR merged unattended. An
  empty file list is now rejected too.
- **README:** documents the fail-closed audit step, including that a new advisory with no published
  fix turns the daily job red until it is added to `auditConfig.ignoreGhsas` or a patch ships.

**Adopter action:** re-copy `.github/workflows/audit.yml` and `.github/workflows/ci.yml`. No
dependency or config changes.

## v5 - 2026-08-12

- **package.json:** `packageManager` bumped `pnpm@11.18.0` -> `pnpm@11.21.0` (current `latest`). The
  11.19–11.21 minors are lockfile-neutral for this template: the changes touching areas it uses
  (`minimumReleaseAge` correctness and resolution performance, lockfile determinism) are fixes in its
  favour; the one behaviour change (11.20's registry-qualified lockfile keys) applies only to repos
  using named registries, which this template does not. Lockfile format is unchanged (`9.0`); a
  `--frozen-lockfile` install stays valid, no regeneration needed.
- **README:** a subtle note that a private-repo variant of this template is maintained separately.

**Adopter action:** bump the `packageManager` pin to `pnpm@11.21.0` and verify a `--frozen-lockfile`
install + build. No workflow changes.

## v4 - 2026-07-31

- **audit.yml:** `step-security/harden-runner` egress promoted from audit to **block** on the
  PAT-holding audit job, completing the follow-up v3 flagged. The allowlist is the endpoint set six
  daily runs converged on: `github.com`, `api.github.com`, `registry.npmjs.org`. This job holds the
  write PAT, so a call to anything else now fails the run instead of being logged.
- **package.json:** `packageManager` bumped `pnpm@11.17.0` -> `pnpm@11.18.0` (current `latest`; 11.19
  is intentionally skipped until it carries the dist-tag). No change to the audit pipeline behaviour.

**Adopter action:** re-copy `.github/workflows/audit.yml` and bump the `packageManager` pin to
`pnpm@11.18.0`.

## v3 - 2026-07-28

- **audit.yml / ci.yml:** `step-security/harden-runner` added to every job. Block-mode egress
  allowlists on both auto-merge jobs; audit mode on the PAT-holding audit job, build and preview-e2e,
  to observe the real endpoint set before blocking (the audit job is promoted to block first in a
  later version). Validated against Aikido's GitHub Actions security checklist; the remaining items
  are repository settings, documented in the README.
- **README:** new "Repo settings the template cannot carry" (four Settings > Actions checkboxes,
  including turning off "Allow GitHub Actions to create and approve pull requests", which this design
  uniquely permits) and "Threat model, honestly" (single-owner assumption, PAT scoping,
  frozen-lockfile versus exact pins, provenance watch item).
- **Site:** settings note in the copy list and a sixth failure-mode card.

**Adopter action:** re-copy both workflow files, then apply the four repo settings from the README.
They are not carried by files and "Use this template" does not set them.

## v2 - 2026-07-27

- **audit.yml:** the PR body now reports the full advisory set the regenerated overrides address,
  captured against the natural post-reset state. Previously it captured against the committed lockfile
  (already fixed), so prune-only PRs carried an empty advisory section. The pure-prune and
  audit-did-not-complete cases now get their own distinct messages.
- **README:** documents the live-file adoption step (copy `pnpm-workspace.yaml`, not just the base, or
  the first CI install runs with no `trustLockfile`/`allowBuilds`), the overlapping-overrides
  behaviour of `--fix=override`, and the `--no-optional` audit scope.

**Adopter action:** re-copy `.github/workflows/audit.yml`, and make sure the live `pnpm-workspace.yaml`
is committed alongside `pnpm-workspace.base.yaml`.

## v1 - 2026-07-26

Initial release: two-pass audit regenerator, Vercel-preview-gated unattended auto-merge, Dependabot
with cooldown, SHA-pinned actions, and the pnpm 11 supply-chain settings. The unattended audit to
auto-merge round-trip was verified live before tagging.
