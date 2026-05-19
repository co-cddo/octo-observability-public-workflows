# SPDD Analysis: Repository Governance Configuration

## Original Business Requirement

Implement full repository governance for the octo-observability submit-sbom-action GitHub repository. This includes: branch protection rules for main (require PR reviews, require status checks to pass including CI workflow, require branches to be up-to-date, no force pushes, no deletions), a CODEOWNERS file assigning ownership, a pull request template with checklist, issue templates for bugs and feature requests, and repository settings enforced via code (e.g., GitHub Terraform provider or a settings.yml for probot/settings app). The goal is to codify all repository governance so that best practices are enforced automatically rather than relying on manual configuration.

---

## Domain Concept Identification

### Existing Concepts (from codebase)

- **CI Workflow (`.github/workflows/ci.yml`)**: PR validation pipeline with jobs `validate`, `dependency-review`, and `zizmor` — the status checks that rulesets should require.
- **Release Workflow (`.github/workflows/release.yml`)**: Tag-triggered release pipeline — not relevant to PR governance but informs what branches/tags to protect.
- **Repository structure**: TypeScript GitHub Action with `src/`, `dist/`, standard npm tooling. Open-source, consumed by third parties.

### New Concepts Required

- **GitHub Rulesets**: Newer replacement for branch protection rules. Configured via API, support branch + tag targeting, bypass actor lists, and better audit logging. Applied from maintainer's machine using personal token; committed JSON is source of truth.
- **Ruleset Drift Detection**: CI workflow that compares committed ruleset JSON against live GitHub API state, failing if someone changes rulesets via UI without updating committed config.
- **CODEOWNERS**: File mapping paths to responsible reviewers — auto-assigns reviewers on PRs. Team: `@co-cddo/octo-observability`. Does not exist.
- **Pull Request Template**: Standardised checklist for PR authors — ensures consistent quality. Does not exist.
- **Issue Templates**: Structured forms for bug reports and feature requests — reduces triage burden. Does not exist.

### Key Business Rules

- **All changes via PR**: No direct pushes to `main` — enforced by ruleset, not just convention.
- **Review required**: At least 1 approval before merge, must be from code owner — governed by ruleset + CODEOWNERS.
- **CI must pass**: PR cannot merge unless status checks succeed (`validate`, `dependency-review`, `zizmor`) — ruleset `required_status_checks`.
- **Up-to-date branches**: PR branch must be current with `main` before merge — ruleset `strict_required_status_checks_policy: true`.
- **Immutable main**: No force pushes (`non_fast_forward` rule) or deletions (`deletion` rule) on `main`.
- **Linear history**: Squash-only merge + `required_linear_history` rule.
- **Governance as code**: Committed JSON is source of truth. Drift detection catches UI changes. Maintainer applies via `gh api` from their machine — no admin PAT stored in CI.

### Resolved Decisions

- **CODEOWNERS**: `@co-cddo/octo-observability` (team-based)
- **Reviewers required**: 1
- **Merge strategy**: Squash only
- **Branch protection mechanism**: GitHub Rulesets (not probot/settings branch protection, not Terraform)
- **Ruleset application**: Manual from maintainer's machine via `gh api` — avoids admin PAT in CI
- **Drift handling**: CI workflow compares committed JSON vs live API — read-only `GITHUB_TOKEN` sufficient

---

## Strategic Approach

### Solution Direction

Codify governance through **committed JSON + native GitHub features**:

1. **Rulesets** — committed as `.github/rulesets/*.json`, applied via `gh api` from maintainer's machine, drift detected by CI workflow. Covers: required reviews, status checks, force-push prevention, linear history, deletion prevention.

2. **Native GitHub features** — CODEOWNERS, PR template, issue templates. Committed files that GitHub reads directly, no API calls needed.

### Key Design Decisions

- **Rulesets vs branch protection rules (decided: rulesets)**
  - Rulesets: more powerful, better bypass controls, supports tags, better audit, org-level capable → **chosen**
  - Branch protection: older, supported by probot/settings but less granular
  - Trade-off: rulesets have no native "config-as-code" auto-apply mechanism. Solved by drift detection workflow.

- **Ruleset application: maintainer's machine vs CI with admin PAT (decided: maintainer's machine)**
  - Manual `gh api` from local machine: uses maintainer's existing auth, no stored secrets → **chosen**
  - CI with admin PAT: would auto-apply but requires storing admin token as repo secret — security risk for open-source repo
  - Trade-off: small manual step on ruleset changes, but more secure

- **Drift detection: CI workflow with read-only token**
  - `GITHUB_TOKEN` can read rulesets (no admin scope needed for read)
  - Compares committed JSON vs live API response
  - Fails if drift detected, with actionable fix commands in output
  - Runs: on PRs touching `.github/rulesets/`, weekly schedule, manual dispatch

- **Issue templates: YAML forms (decided)**
  - Structured fields, required inputs, dropdowns → better triage

- **CODEOWNERS: whole-repo team ownership (decided)**
  - `* @co-cddo/octo-observability` — simple, survives personnel changes

### Alternatives Considered

- **probot/settings**: Rejected — doesn't support rulesets, adds external app dependency, only covers older branch protection API.
- **Terraform GitHub provider**: Rejected — requires state backend, admin credentials in CI, pipeline infrastructure. Overkill for single repo.
- **Auto-apply rulesets via CI workflow**: Rejected — requires admin PAT stored as secret. Security risk in open-source repo.
- **No drift detection (trust maintainers)**: Rejected — defeats "governance as code" goal. UI changes would silently diverge from committed config.

---

## Risk & Gap Analysis

### Requirement Ambiguities (All Resolved)

- ✅ **Code owners**: `@co-cddo/octo-observability`
- ✅ **Number of reviewers**: 1
- ✅ **Merge strategy**: Squash only
- ✅ **Protection mechanism**: Rulesets
- ✅ **Application method**: Manual from maintainer's machine

### Edge Cases

- **Renovate bot PRs**: CODEOWNERS auto-requests review from team. Renovate PRs need human approval — this is intentional (supply chain safety from story 2).
- **Ruleset not yet applied**: If someone clones the repo fresh and hasn't applied the ruleset, main is unprotected. Drift detection will catch this (ruleset exists in committed config but not live).
- **Fork PRs and CODEOWNERS**: External fork PRs trigger review request but external contributors can't be assigned. GitHub handles this gracefully.
- **`GITHUB_TOKEN` read access to rulesets**: Verified — default `GITHUB_TOKEN` with `contents: read` can read rulesets via API. No elevated permissions needed for drift detection.

### Technical Risks

- **Status check name coupling**: Ruleset `required_status_checks` references CI job names by exact string. Renaming a job in `ci.yml` without updating `main.json` will block all merges. Mitigation: document coupling, drift detection catches the inverse (live vs committed), but not the "both wrong" case.
- **Ruleset JSON schema changes**: GitHub may evolve the rulesets API response shape. Drift detection compares normalised JSON — cosmetic API changes could cause false positives. Mitigation: compare only the fields we define in committed JSON (not extra fields GitHub adds).
- **Team must exist**: `@co-cddo/octo-observability` must exist as a GitHub team. If deleted, CODEOWNERS silently fails. Mitigation: drift detection doesn't cover this, but it's a rare org-level change.

### Acceptance Criteria Coverage

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| 1 | Branch protection on main (reviews, status checks, up-to-date, no force push, no delete) | Yes | Via ruleset JSON committed to `.github/rulesets/main.json`, applied via `gh api` |
| 2 | CODEOWNERS file | Yes | Native GitHub feature, `.github/CODEOWNERS`, team `@co-cddo/octo-observability` |
| 3 | Pull request template with checklist | Yes | `.github/pull_request_template.md` |
| 4 | Issue templates for bugs and feature requests | Yes | `.github/ISSUE_TEMPLATE/*.yml` YAML forms |
| 5 | Repository settings enforced via code | Yes | `.github/rulesets/main.json` applied via `gh api`, drift detection in CI |
| 6 | Governance is automatic/codified | Yes | Committed JSON is source of truth. `gh api` applies from maintainer's machine. Drift detection catches divergence automatically. |
