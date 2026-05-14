# Submit SBOM to Observability Platform

A GitHub Action that retrieves your repository's Software Bill of Materials (SBOM) from the GitHub Dependency Graph API and submits it to the Observability Platform ingestion API.

## Usage

```yaml
- uses: octo-observability/submit-sbom-action@v1.0.0
  with:
    base-url: "https://api.example.com"
    service-id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
    api-key: ${{ secrets.OBSERVABILITY_API_KEY }}
```

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| `base-url` | Yes | Base URL of the ingestion API |
| `service-id` | Yes | UUID of the target service in the observability platform |
| `api-key` | Yes | API key for ingestion API authentication |
| `github-token` | No | GitHub token for dependency graph API access (defaults to `github.token`) |

## Permissions

The workflow using this action must grant:

```yaml
permissions:
  contents: read
```

This allows the action to read the repository's dependency graph via the GitHub API.

## Example Workflow

```yaml
name: Submit SBOM

on:
  release:
    types: [published]

permissions:
  contents: read

jobs:
  submit-sbom:
    runs-on: ubuntu-latest
    steps:
      - uses: octo-observability/submit-sbom-action@v1.0.0
        with:
          base-url: ${{ vars.OBSERVABILITY_BASE_URL }}
          service-id: ${{ vars.SERVICE_ID }}
          api-key: ${{ secrets.OBSERVABILITY_API_KEY }}
```

## Security

This action follows supply chain security best practices:

- 3 direct production dependencies (all GitHub-maintained)
- All dependencies pinned to exact versions
- Install scripts disabled via `.npmrc`
- Build attestation on every release (verifiable with `gh attestation verify`)
- Automated vulnerability monitoring via Renovate with 3-day stability delay
- Workflow files linted with zizmor for security issues

See [SECURITY.md](SECURITY.md) for verification instructions and full details.

## Development

### Prerequisites

- Node.js 20
- [gitleaks](https://github.com/gitleaks/gitleaks) (secret scanning)
- [zizmor](https://github.com/woodruffw/zizmor) (workflow security linting)

### Setup

```bash
npm ci --ignore-scripts
npm run prepare  # installs husky git hooks (also runs automatically on npm install)
```

### Pre-commit Hooks

Husky runs the following checks automatically on `git commit`:

- **lint-staged** — ESLint + Prettier on staged `*.ts` files
- **gitleaks** — secret scanning on staged changes
- **zizmor** — GitHub Actions workflow security linting

### Commands

```bash
npm run lint    # eslint + prettier
npm test        # jest
npm run build   # ncc bundle to dist/
npm run all     # lint + test + build
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes and ensure `npm run all` passes
4. Commit the rebuilt `dist/` directory
5. Open a pull request

CI validates lockfile integrity, lint, tests, dist freshness, dependency security, and workflow security on every PR.

## Licence

Released under the [Open Government Licence v3.0](LICENCE).
