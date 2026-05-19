# SPDD Analysis: SBOM Submission GitHub Action

## Original Business Requirement

### [STORY-001-001] SBOM Retrieval and Submission to Ingestion API

#### Background

Third-party organisations using GitHub need a simple, automated way to submit their Software Bill of Materials (SBOM) to our observability platform's ingestion API. GitHub already generates SBOMs via its dependency graph API, so the action should retrieve this data and forward it to our endpoint. This is the core value proposition of the action — without it, customers must build custom scripts to achieve the same result.

#### Business Value

- Provide a one-click integration for any GitHub repository to submit SBOMs to our platform
- Reduce onboarding friction for new customers from hours of custom scripting to minutes of action configuration
- Enable continuous, automated SBOM submission on every dependency change or scheduled interval

#### Dependencies and Assumptions

- **Prerequisites**: Our ingestion API endpoint exists and accepts SBOM payloads via POST with token-based authentication
- **Data assumptions**: The target repository has GitHub's dependency graph enabled (default for public repos, opt-in for private)
- **Integration points**: GitHub Dependency Graph API (read), our SBOM ingestion API (write)
- **Business constraints**: Action must be open-source (public repository) for third-party consumption

#### Scope In

- Action input for API endpoint URL (configurable, supports nonprod/prod)
- Action input for API authentication token (passed as a GitHub secret)
- Retrieve SBOM from the GitHub dependency graph API for the current repository
- POST the SBOM payload to the configured ingestion endpoint with the API token in an authorization header
- Action outputs indicating success/failure and submission metadata
- Clear error messages when the GitHub API or ingestion API returns errors
- Basic input validation (endpoint URL format, token presence)

#### Scope Out

- Retry logic or circuit breakers (future enhancement)
- SBOM transformation or enrichment before submission
- Support for non-GitHub SBOM sources (e.g., Syft, Trivy)
- Security attestation and provenance signing of the action itself
- GitHub Marketplace publishing
- Rate limiting or batching of submissions

#### Acceptance Criteria

**AC1: Successful SBOM submission to production endpoint**
Given a repository with GitHub dependency graph enabled and an action workflow configured with `endpoint: "https://api.example.com/sbom/ingest"` and `api-token` set to a valid secret, when the action runs in a workflow execution, then the action retrieves the repository's SBOM from GitHub's dependency graph API, POSTs it to the configured endpoint with the token in the Authorization header, and completes successfully with a summary indicating acceptance.

**AC2: Configurable endpoint for nonprod testing**
Given a repository with the action configured with `endpoint: "https://staging.example.com/sbom/ingest"`, when the action runs, then the SBOM is submitted to the staging URL demonstrating full endpoint configurability.

**AC3: Missing API token**
Given a workflow configuration where `api-token` input is not provided or empty, when the action attempts to run, then it fails immediately with a clear error message without making any API calls.

**AC4: GitHub dependency graph API unavailable or returns error**
Given a repository where the dependency graph API returns an error, when the action attempts to retrieve the SBOM, then it fails with a descriptive error message including the HTTP status code.

**AC5: Ingestion API rejects the submission**
Given a valid SBOM but the ingestion API returns HTTP 401 or 400, when the action POSTs, then it fails with an error including the HTTP status and error detail from the response.

**AC6: Invalid endpoint URL format**
Given `endpoint` set to an invalid URL, when the action starts, then it fails with a validation error before any network calls.

**Non-Functional Expectations:**
- Action must complete within 60 seconds for typical repositories
- Action must not expose the API token in workflow logs

---

## Domain Concept Identification

### Existing Concepts (from codebase)

None — this is a greenfield repository with no existing code. The repository was created to house this action.

### New Concepts Required

- **SBOM (Software Bill of Materials)**: The payload retrieved from GitHub's dependency graph API in SPDX format — the core data artifact being transported. Related to Repository.
- **Ingestion Endpoint**: The configurable destination URL where SBOMs are submitted — represents our platform's API contract. Configured per-workflow.
- **API Token**: Authentication credential for the ingestion API — passed as a GitHub secret, must never be logged. Governs authorization to Ingestion Endpoint.
- **GitHub Dependency Graph API**: External data source providing the SBOM for a given repository — requires appropriate permissions (GITHUB_TOKEN with `contents: read`).
- **Action Inputs/Outputs**: The interface contract of the GitHub Action — inputs (base-url, service-id, api-key) and outputs (status, metadata) that consumers interact with.

### Conceptual Relationships

```
Repository (GitHub context)
    └── has → SBOM (via Dependency Graph API)
                └── submitted to → Ingestion Endpoint (authenticated by API Token)

Action Inputs → configure → [Endpoint URL, API Token]
Action Outputs → report → [submission status, metadata]
```

### Key Business Rules

- **API key required before any network activity**: If api-key is missing/empty, fail fast — no partial execution
- **Base URL must be valid URL**: Syntactic validation before any API calls
- **Service ID must be valid UUID**: Format validation before any API calls
- **Key secrecy**: API key must never appear in logs, summaries, or error messages
- **Single responsibility per run**: One SBOM retrieval, one submission, one result — no batching
- **Configurable destination**: Base URL is not hardcoded — must be user-supplied to support nonprod/prod separation
- **Fixed path structure**: Path `/api/modules/sbom/services/{service-id}` is constructed by action, not user-supplied

---

## Strategic Approach

### Solution Direction

Build a **JavaScript/TypeScript GitHub Action** (not composite, not Docker) that:
1. Validates inputs (token presence, endpoint URL format)
2. Calls the GitHub REST API to retrieve the repository SBOM
3. POSTs the SBOM JSON to the configured ingestion endpoint with bearer token auth
4. Reports success/failure via action outputs and job summary

JavaScript actions are preferred because they start faster than Docker actions (no container build), run on all runner OS types, and have mature tooling via `@actions/core`, `@actions/github`, and `@actions/http-client`.

### Key Design Decisions

- **Action type: JavaScript vs Composite vs Docker**
  - JavaScript: fast startup, cross-platform, access to GitHub toolkit libraries, can be compiled/bundled → **recommended**
  - Composite: simpler but limited error handling, no native token masking, harder to test
  - Docker: unnecessary overhead for a pure API-to-API relay, limits runner compatibility

- **HTTP client: `@actions/http-client` vs `node-fetch` vs native `fetch`**
  - `@actions/http-client`: maintained by GitHub, minimal, designed for actions, respects proxy settings → **recommended** (minimizes dependency count per Story 2 security requirements)
  - Native `fetch` (Node 18+): zero deps but GitHub runners may pin older Node; less control over timeouts
  - `node-fetch`: additional dependency with no benefit over `@actions/http-client`

- **TypeScript vs plain JavaScript**
  - TypeScript: type safety, better maintainability for open-source contributions → **recommended** per user's global TypeScript conventions (`strict: true`)
  - Requires compilation step (ncc or esbuild to bundle into single dist/index.js)

- **GitHub API authentication: GITHUB_TOKEN vs PAT**
  - GITHUB_TOKEN (automatic): sufficient for dependency graph read access, no user secret management → **recommended**
  - PAT: unnecessary privilege escalation for this use case

- **SBOM API endpoint**: GitHub's `GET /repos/{owner}/{repo}/dependency-graph/sbom` returns SPDX-format SBOM — this is the canonical source

### Alternatives Considered

- **Composite action using `curl`**: Rejected — poor error handling, no token masking, OS-dependent behavior, harder to test
- **Docker action**: Rejected — adds 10-30s container startup, limits to Linux runners, unnecessary complexity
- **Fetching SBOM via GraphQL**: Rejected — REST endpoint is simpler, well-documented, and returns the complete SBOM in one call

---

## Risk & Gap Analysis

### Requirement Ambiguities (Updated)

- ✅ ~~Authorization header format~~ — **RESOLVED**: `X-API-Key: <key>` custom header
- ✅ ~~SBOM format~~ — **RESOLVED**: `Content-Type: application/spdx+json` — GitHub API returns SPDX JSON, ingestion API expects SPDX JSON. Direct passthrough confirmed.
- ✅ ~~Endpoint structure~~ — **RESOLVED**: Base URL + path `/api/modules/sbom/services/{service-id}`. Action needs `base-url` and `service-id` inputs.
- ✅ ~~Action trigger context~~ — **RESOLVED**: Expected use is release workflows only. No need to explicitly support PR/fork contexts, but must fail gracefully (clear error) if permissions are insufficient.
- ✅ ~~Output metadata~~ — **RESOLVED**: No metadata needed. Success/failure status is sufficient.

### Edge Cases

- **Private repository without dependency graph enabled**: The API will return 404 or 403 — action should surface a clear message distinguishing "not enabled" from "no permission"
- **Very large SBOM (monorepo with thousands of dependencies)**: Could exceed ingestion API payload limits or cause timeout — not addressed in ACs
- **Network timeout to ingestion API**: No retry in scope, but should the action set a reasonable request timeout? If so, should it be configurable?
- **Ingestion API returns 2xx but with warning/partial acceptance**: Only success/failure is modeled — what about partial results?
- **Rate limiting from GitHub API**: Unlikely for single calls but possible in matrix builds or org-wide scheduled workflows hitting the same endpoint

### Technical Risks

- **GitHub dependency graph API permissions**: Requires `contents: read` permission on GITHUB_TOKEN. If the consuming workflow doesn't grant this, the call fails. Risk: confusing error message. Mitigation: document required permissions clearly and validate the error response.
- **GITHUB_TOKEN not available in all contexts**: Reusable workflows and some composite action nesting patterns may not pass the token automatically. Mitigation: accept an optional `github-token` input that defaults to `github.token`.
- **Node.js version compatibility**: GitHub Actions runners update Node versions. Action should declare `node20` (current LTS used by runners) in `action.yml`. Risk: future deprecation of Node 20.
- **Token exposure in error scenarios**: If the ingestion API returns the request headers in an error response body, and the action logs that body, the token could leak. Mitigation: sanitize response output, use `core.setSecret()`.

### Acceptance Criteria Coverage

| AC# | Description | Addressable? | Gaps/Notes |
|-----|-------------|--------------|------------|
| AC1 | Successful SBOM submission | Yes | Need to clarify Authorization header format |
| AC2 | Configurable endpoint | Yes | Straightforward input parameter |
| AC3 | Missing API token | Yes | Fail-fast validation before any network calls |
| AC4 | GitHub API error | Yes | Need to handle multiple error codes (403, 404, 500) with distinct messages |
| AC5 | Ingestion API rejection | Yes | Need to decide how much of error response to surface (token leak risk) |
| AC6 | Invalid endpoint URL | Yes | Need to define what constitutes "valid" — scheme + host minimum? |
| NFR | 60s timeout | Yes | Need to split budget between GitHub API call and ingestion POST |
| NFR | Token not in logs | Yes | Requires `core.setSecret()` and careful response body logging |
