# Story Decomposition: SBOM Submission GitHub Action

## INVEST Analysis

### Abstract Task: "SBOM Submission GitHub Action"

**Analysis Dimensions**:
- **Core Responsibility**: Enable third-party repos to automatically submit SBOMs to our ingestion API via GitHub Actions
- **Primary Operations**: Retrieve SBOM from GitHub dependency graph API, POST to ingestion endpoint with auth
- **Key Constraints**: Minimal dependencies (supply chain risk), proper attestation, configurable endpoints, API token auth
- **Technical Complexity**: Medium — GitHub API integration, HTTP POST, action metadata, security hardening
- **Business Complexity**: Low — single directional data flow (fetch SBOM → submit), clear API contract

### INVEST Evaluation
- ✅ **Independent**: Single action, no dependencies on other features
- ✅ **Negotiable**: Design details (error handling, retry, output format) negotiable
- ✅ **Valuable**: Core product value — enables customers to submit SBOMs
- ✅ **Estimable**: Clear scope, well-understood GitHub Actions patterns
- ✅ **Small**: 3-5 days total
- ✅ **Testable**: Clear acceptance criteria possible

### Split Strategy

**By complexity**: Core functionality / Security & Distribution

---

## [STORY-001-001] SBOM Retrieval and Submission to Ingestion API

### Background

Third-party organisations using GitHub need a simple, automated way to submit their Software Bill of Materials (SBOM) to our observability platform's ingestion API. GitHub already generates SBOMs via its dependency graph API, so the action should retrieve this data and forward it to our endpoint. This is the core value proposition of the action — without it, customers must build custom scripts to achieve the same result.

### Business Value

- Provide a one-click integration for any GitHub repository to submit SBOMs to our platform
- Reduce onboarding friction for new customers from hours of custom scripting to minutes of action configuration
- Enable continuous, automated SBOM submission on every dependency change or scheduled interval

### Dependencies and Assumptions

- **Prerequisites**: Our ingestion API endpoint exists and accepts SBOM payloads via POST with token-based authentication
- **Data assumptions**: The target repository has GitHub's dependency graph enabled (default for public repos, opt-in for private)
- **Integration points**: GitHub Dependency Graph API (read), our SBOM ingestion API (write)
- **Business constraints**: Action must be open-source (public repository) for third-party consumption

### Scope In

- Action input for API base URL (configurable, supports nonprod/prod)
- Action input for service ID (UUID identifying the target service in the ingestion platform)
- Action input for API key (passed as a GitHub secret)
- Retrieve SBOM from the GitHub dependency graph API for the current repository
- POST the SBOM payload to `{base-url}/api/modules/sbom/services/{service-id}` with the API key in an `X-API-Key` header and `Content-Type: application/spdx+json`
- Action outputs indicating success/failure and submission metadata
- Clear error messages when the GitHub API or ingestion API returns errors
- Basic input validation (endpoint URL format, token presence)

### Scope Out

- Retry logic or circuit breakers (future enhancement)
- SBOM transformation or enrichment before submission
- Support for non-GitHub SBOM sources (e.g., Syft, Trivy)
- Security attestation and provenance signing of the action itself
- GitHub Marketplace publishing
- Rate limiting or batching of submissions

### Acceptance Criteria

#### AC1: Successful SBOM submission to production endpoint

**Given** a repository with GitHub dependency graph enabled and an action workflow configured with `base-url: "https://api.example.com"`, `service-id: "1cf4b6eb-4c86-4774-92af-ae681024f46b"`, and `api-key` set to a valid secret
**When** the action runs in a workflow execution
**Then** the action retrieves the repository's SBOM from GitHub's dependency graph API, POSTs it to `https://api.example.com/api/modules/sbom/services/1cf4b6eb-4c86-4774-92af-ae681024f46b` with the key in an `X-API-Key` header and content type `application/spdx+json`, and the action completes successfully with a summary indicating the submission was accepted

#### AC2: Configurable endpoint for nonprod testing

**Given** a repository with the action configured with `base-url: "https://staging.example.com"` and a valid `service-id`
**When** the action runs
**Then** the SBOM is submitted to `https://staging.example.com/api/modules/sbom/services/{service-id}`, not the production URL, demonstrating that the base URL is fully configurable per workflow

#### AC3: Missing API token

**Given** a workflow configuration where `api-key` input is not provided or is empty
**When** the action attempts to run
**Then** the action fails immediately with a clear error message indicating that the API key is required, without making any API calls

#### AC4: GitHub dependency graph API unavailable or returns error

**Given** a repository where the dependency graph API returns an error (e.g., dependency graph not enabled, insufficient permissions)
**When** the action attempts to retrieve the SBOM
**Then** the action fails with a descriptive error message indicating the GitHub API issue, including the HTTP status code received

#### AC5: Ingestion API rejects the submission

**Given** a valid SBOM retrieved from GitHub but the ingestion API returns HTTP 401 (invalid API key) or HTTP 400 (malformed payload)
**When** the action POSTs the SBOM
**Then** the action fails with an error message that includes the HTTP status code and any error detail from the API response, enabling the user to diagnose the issue

#### AC6: Invalid endpoint URL format

**Given** a workflow configuration where `base-url` is set to an invalid URL (e.g., missing scheme, empty string) or `service-id` is not a valid UUID
**When** the action starts
**Then** the action fails with a validation error before attempting any network calls, indicating the expected format

#### Non-Functional Expectations

- The action must complete within a reasonable time for CI workflows (SBOM retrieval and submission combined should not exceed 60 seconds for typical repositories)
- The action must not expose the API key in workflow logs
