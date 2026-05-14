# SPDD Analysis: SBOM Action Security Hardening and Distribution

## Original Business Requirement

# Story: SBOM Action Security Hardening and Distribution

## [STORY-001-002] Security Hardening, Attestation, and Release Packaging

### Background

As an open-source GitHub Action consumed by third parties, this action becomes part of their software supply chain. A compromised or tampered action could exfiltrate secrets or inject malicious code into customer workflows. The action must follow security best practices: minimal dependencies to reduce attack surface, build attestation to prove provenance, pinned dependencies, and proper release packaging. This story hardens the action produced in STORY-001-001 for safe public consumption.

### Business Value

- Provide supply chain security assurance to customers evaluating the action for enterprise use
- Demonstrate security leadership by following GitHub's recommended action hardening practices
- Enable customers to verify the action's provenance and integrity before adoption
- Reduce risk of supply chain attacks affecting our customers and our platform's reputation

### Dependencies and Assumptions

- **Prerequisites**: STORY-001-001 (core SBOM submission) is complete and functional
- **Data assumptions**: The action codebase exists with a working implementation
- **Integration points**: GitHub Actions attestation infrastructure, npm/package ecosystem (for dependency management), GitHub Releases
- **Business constraints**: Must be open-source; security measures must not impede legitimate contributions or forks

### Scope In

- Minimize runtime dependencies (audit and remove unnecessary packages)
- Pin all dependencies to exact versions (lockfile integrity)
- Add build attestation using GitHub's artifact attestation feature
- Sign releases with provenance information
- Ensure action uses pinned action references (no floating tags in internal workflow references)
- Add dependency review workflow to the action's own repository
- Configure Dependabot or equivalent for automated security updates
- Document security posture and verification steps for consumers
- Package action for distribution (compiled/bundled to avoid `node_modules` in repo)

### Scope Out

- Runtime security features within the action logic (token masking already in STORY-001-001)
- SLSA Level 3+ compliance (Level 2 is target)
- GitHub Marketplace listing and branding (separate effort)
- Security audit by external party
- Vulnerability disclosure policy (organisational concern, not per-action)

### Acceptance Criteria

#### AC1: Minimal dependency footprint

**Given** the action's production dependency tree
**When** a security reviewer audits the shipped action
**Then** the action has no more than 5 direct production dependencies, and the total transitive dependency count is documented in the repository

#### AC2: Pinned and locked dependencies

**Given** the action's dependency manifest and lockfile
**When** a contributor or automated tool inspects the repository
**Then** all dependencies specify exact versions (no ranges, no `^`, no `~`), a lockfile is present and committed, and CI fails if the lockfile is out of sync with the manifest

#### AC3: Build attestation on release

**Given** a new version of the action is released via the release workflow
**When** the release artifacts are published to GitHub Releases
**Then** the release includes a GitHub artifact attestation that consumers can verify using `gh attestation verify`, proving the artifact was built from the claimed source commit in the action's CI environment

#### AC4: No secrets exposed in build or distribution artifacts

**Given** the action is compiled/bundled for distribution
**When** a security reviewer inspects the distributed artifact
**Then** no environment variables, tokens, signing keys, or internal URLs are embedded in the distributed code

#### AC5: Automated dependency vulnerability monitoring

**Given** the action repository with Dependabot or equivalent configured
**When** a known vulnerability is published for any dependency in the action's tree
**Then** an automated PR is raised within 24 hours proposing the version bump, and CI validates the update does not break functionality

#### AC6: Consumer verification documentation

**Given** a third-party developer evaluating the action for use in their organisation
**When** they read the action's README or security documentation
**Then** they find clear instructions on how to verify the action's attestation, how to pin to a specific verified release, and what the action's dependency posture is

#### Non-Functional Expectations

- The security hardening must not increase the action's execution time by more than 5 seconds compared to the unhardened version
- The bundled/compiled action artifact must be under 5MB to ensure fast action download during workflow runs

---

## Domain Concept Identification

### Existing Concepts (from codebase)

- **Action Bundle (`dist/index.js`)**: Single compiled artifact produced by `ncc build` — the distributable unit consumed by third parties. Currently committed to repo.
- **Production Dependencies**: 3 direct (`@actions/core`, `@actions/github`, `@actions/http-client`) with 21 transitive packages bundled into the dist. All use `^` semver ranges.
- **Package Lockfile (`package-lock.json`)**: Present and committed — records resolved dependency versions. Currently allows range-based resolution.
- **Build Pipeline (`npm run build`)**: Uses `@vercel/ncc` to compile TypeScript + dependencies into a single `dist/index.js` with source map and license extraction.

### New Concepts Required

- **Release Workflow**: CI/CD pipeline that tags, builds, attests, and publishes versioned releases to GitHub Releases — does not exist yet (no `.github/` directory).
- **Build Attestation**: Cryptographic provenance proof generated during CI that binds the release artifact to a specific source commit and build environment — uses GitHub's artifact attestation infrastructure. Covers provenance signing (no separate signing step needed).
- **Dependency Review Workflow**: CI check that blocks PRs introducing dependencies with known vulnerabilities — requires `actions/dependency-review-action`.
- **Renovate Configuration**: Automated dependency update mechanism with `stabilityDays: 3` — delays adoption of newly published versions to allow community detection of malicious releases. Configured via `renovate.json`.
- **`.npmrc` Security Config**: Repository-level npm config with `ignore-scripts=true` — prevents postinstall script execution during `npm ci`, blocking a major supply chain attack vector.
- **Pre-commit Configuration**: Local development hooks (`.pre-commit-config.yaml`) enforcing lint, test, build, and workflow security checks before push — reduces CI feedback loop.
- **Zizmor Workflow Linting**: Security linter for GitHub Actions workflow files — detects injection vulnerabilities, excessive permissions, unpinned actions, dangerous defaults. Runs both locally (via pre-commit) and in CI.
- **Security Documentation**: Consumer-facing documentation explaining verification steps, pinning guidance, and dependency posture — new artifact in repository.
- **CI Validation Workflow**: Continuous integration pipeline running lint, test, lockfile integrity checks, and zizmor workflow linting on every PR — does not exist yet.

### Key Business Rules

- **Dependency ceiling**: No more than 5 direct production dependencies at any time — governs `package.json` dependencies section
- **Exact version pinning**: All dependency specifiers must use exact versions (no `^`, `~`, or ranges) — governs `package.json` and lockfile consistency
- **Lockfile integrity**: CI must fail if lockfile is out of sync with manifest — governs build/CI workflow
- **Attestation on every release**: No release can be published without accompanying artifact attestation — governs release workflow
- **No embedded secrets**: Distribution artifact must contain zero credentials, tokens, or internal URLs — governs build process and review
- **Performance budget**: Security measures must add ≤5 seconds to action execution time — governs approach to attestation (build-time only, not runtime)
- **Size budget**: Bundled artifact must be <5MB — governs dependency choices and bundle strategy
- **Open-source compatibility**: Security measures must not prevent forks or contributions — governs workflow design (no org-level secrets required for contributor CI)

---

## Strategic Approach

### Solution Direction

Harden the existing action through **configuration and CI/CD workflow additions** rather than code changes. The core action logic from STORY-001-001 remains unchanged. The work is primarily:

1. **Dependency hygiene** — pin existing deps to exact versions, add `.npmrc` with `ignore-scripts=true`, audit for removability
2. **CI workflows** — add PR validation (lint, test, lockfile check) and dependency review
3. **Release workflow** — automated build, attestation, and GitHub Release publishing on tag push
4. **Renovate** — configure automated vulnerability monitoring with `stabilityDays: 3` delay
5. **Documentation** — security posture and consumer verification guide

This is infrastructure/tooling work, not application logic. The action's runtime behaviour does not change.

### Key Design Decisions

- **Attestation approach: GitHub artifact attestations vs Sigstore/cosign vs custom signing**
  - GitHub artifact attestations: native integration, `gh attestation verify` support, SLSA Level 2 compatible, no external key management → **recommended**
  - Sigstore/cosign: more portable but adds complexity, requires consumers to install cosign
  - Custom GPG signing: high maintenance, key rotation burden, non-standard verification
  
- **Release strategy: tag-triggered workflow vs manual dispatch vs release branch**
  - Tag-triggered (`v*` push): standard for GitHub Actions, simple, deterministic → **recommended**
  - Manual dispatch: adds friction, easy to forget attestation step
  - Release branch: unnecessary for a single-artifact action

- **Bundle distribution: committed `dist/` vs GitHub Release artifact only**
  - Committed `dist/`: required by GitHub Actions runtime (actions are checked out from repo at ref) → **required, not a choice**
  - Release artifact: additional distribution for verification purposes, complements committed dist

- **Lockfile enforcement: `npm ci` in CI vs custom check**
  - `npm ci`: standard, fails if lockfile diverges from `package.json`, fast → **recommended**
  - Custom diff check: unnecessary complexity when `npm ci` already enforces this

- **Renovate for automated updates (decided)**
  - Renovate with `stabilityDays: 3`: delays adopting new versions for 3 days, allowing community detection of malicious releases → **chosen**
  - Dependabot: simpler but lacks stability delay feature — rejected due to missing `stabilityDays` equivalent

- **`.npmrc` install script prevention (decided)**
  - `ignore-scripts=true` in `.npmrc`: blocks postinstall/preinstall script execution during `npm ci` — prevents supply chain attacks via malicious lifecycle scripts
  - Safe because `ncc build` compiles everything needed; no dependency requires postinstall scripts for the bundled output to function

### Alternatives Considered

- **Runtime attestation verification within the action**: Rejected — attestation proves provenance of the action itself, not something the action does at runtime. Would violate the ≤5s performance budget and is out of scope.
- **Removing `@actions/github` dependency to reduce footprint**: Rejected — it's essential for fetching the SBOM. The 3 direct deps are already within the ≤5 ceiling.
- **Docker-based release build for reproducibility**: Rejected — unnecessary complexity. GitHub Actions runners with `ncc` produce deterministic builds. Attestation provides the provenance guarantee instead.
- **Monorepo with shared CI config**: Rejected — single-action repo, no benefit from monorepo structure.

---

## Risk & Gap Analysis

### Requirement Ambiguities (All Resolved)

- ✅ **"Pinned action references in internal workflow references"** — **RESOLVED**: Yes, all action refs in CI/release workflows must be pinned to full SHAs. Renovate will manage updates to these.
- ✅ **"Sign releases with provenance information"** — **RESOLVED**: No separate signing needed. GitHub artifact attestation covers provenance. One mechanism, not two.
- ✅ **"Compiled/bundled to avoid `node_modules` in repo"** — **RESOLVED**: ncc bundling already in place and sufficient. No change needed.
- ✅ **SLSA Level 2 target** — **RESOLVED**: Attestation + GitHub Actions hosted build = SLSA Level 2. No additional requirements.
- ✅ **"Total transitive dependency count is documented"** — **RESOLVED**: Not required. AC1 only mandates ≤5 direct deps.

### Edge Cases

- **Fork contributors cannot generate attestations**: Attestations require repository write permissions and OIDC token access. PRs from forks won't be able to test the release workflow. Need to ensure CI workflow doesn't require attestation for PR validation.
- **Renovate PRs failing CI due to lockfile drift**: If Renovate updates `package.json` but doesn't regenerate the lockfile correctly (rare but possible), CI will reject the PR. Renovate's `postUpdateOptions: ["npmDedupe"]` can mitigate.
- **Tag collision on re-release**: If a tag is deleted and re-pushed, the attestation may reference a different commit. Need a policy against re-using tags.
- **Bundle size growth over time**: Currently well under 5MB, but future dependency additions could approach the limit. No automated check exists.
- **`dist/` committed but out of sync with source**: If a contributor modifies source but doesn't rebuild `dist/`, the committed artifact diverges. CI should verify `dist/` matches a fresh build.

### Technical Risks

- **GitHub attestation feature availability**: Artifact attestation is GA but relatively new (2024). API surface may evolve. Mitigation: pin the `actions/attest-build-provenance` action to a specific SHA.
- **ncc determinism**: `@vercel/ncc` builds may not be perfectly reproducible across Node versions or OS environments. Mitigation: pin Node version in CI workflow, verify in release pipeline only.
- **Lockfile format changes**: npm lockfile format has evolved (v1 → v2 → v3). Pinning `npm` version in CI prevents unexpected format shifts.
- **Action SHA pinning maintenance burden**: Pinning all action refs to full SHAs makes version updates manual. Renovate handles this natively when configured with `github-actions` manager.
- **`dist/` freshness check in CI**: Verifying that committed `dist/` matches a fresh build requires running `ncc build` and diffing output — adds build time to every PR. Mitigation: only check on PRs that modify `src/` or `package*.json`.

### Acceptance Criteria Coverage

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| AC1 | Minimal dependency footprint (≤5 direct) | Yes | Already at 3 direct deps. No documentation of count needed. |
| AC2 | Pinned and locked dependencies | Yes | Change `^` to exact versions in `package.json`, add `.npmrc` with `ignore-scripts=true`, enforce via `npm ci` in CI. |
| AC3 | Build attestation on release | Yes | New release workflow with `actions/attest-build-provenance`. Attestation covers provenance — no separate signing. |
| AC4 | No secrets in distribution artifact | Yes | Current `ncc` build doesn't embed secrets. CI can verify via grep/pattern check on `dist/`. |
| AC5 | Automated dependency vulnerability monitoring | Yes | Renovate with `stabilityDays: 3`. CI workflow validates updates don't break functionality. |
| AC6 | Consumer verification documentation | Yes | Attestation verification, version pinning guidance, dependency posture. |
| NFR | ≤5s execution overhead | Yes | All hardening is build/CI-time, not runtime. Zero runtime impact. |
| NFR | Bundle <5MB | Yes | Current bundle well within limit. CI check can enforce. |
