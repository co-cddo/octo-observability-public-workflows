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
