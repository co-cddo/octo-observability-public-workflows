# Contributing

## Prerequisites

- Node.js 24 (see `.nvmrc`)
- [gitleaks](https://github.com/gitleaks/gitleaks) — secret scanning
- [zizmor](https://github.com/woodruffw/zizmor) — GitHub Actions security linting

## Setup

```bash
git clone git@github.com:co-cddo/octo-observability-public-workflows.git
cd octo-observability-public-workflows
nvm use
npm ci
npx husky
```

> **Note:** `npm ci` does not run lifecycle scripts (`.npmrc` sets `ignore-scripts=true` for security). You must run `npx husky` manually to install git hooks.

## Development workflow

1. Create a branch from `main`: `feat/short-description`, `fix/short-description`
2. Make changes in `src/`
3. Run the full validation pipeline:

```bash
npm run all
```

4. Commit the rebuilt `dist/` alongside your source changes
5. Open a pull request against `main`

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run lint` | ESLint (auto-fix) + Prettier on `src/` |
| `npm test` | Jest unit tests |
| `npm run build` | Bundle with ncc → `dist/index.js` |
| `npm run all` | lint → test → build (run before every PR) |

## Pre-commit hooks

Husky runs these automatically on `git commit`:

1. **lint-staged** — ESLint + Prettier on staged `.ts` files
2. **gitleaks** — scans staged changes for secrets
3. **zizmor** — lints `.github/` workflows for security issues

Hooks are installed by running `npx husky` after `npm ci` (see [Setup](#setup)).

## CI checks

Every pull request must pass:

| Job | What it does |
|-----|--------------|
| `validate` | lint, test, build, verify `dist/` is up-to-date |
| `dependency-review` | flags new dependencies with known vulnerabilities |
| `zizmor` | GitHub Actions workflow security linting |

## Pull request requirements

- 1 approving review (code owner required — `@co-cddo/octo-observability`)
- All status checks pass (strict — branch must be up-to-date)
- Linear history (rebase or squash only)
- Stale approvals dismissed on new pushes

## Releasing

Releases are triggered by pushing a version tag:

```bash
git tag v1.2.3
git push origin v1.2.3
```

The release workflow:

1. Builds the action from source
2. Verifies no secrets in `dist/`
3. Verifies bundle size < 5MB
4. Creates a build provenance attestation
5. Creates a GitHub release with `dist/index.js` and `dist/licenses.txt`

## Dependency management

[Renovate](https://docs.renovatebot.com/) manages dependency updates:

- All npm versions are **pinned** (no ranges)
- GitHub Actions pinned by **digest** (SHA)
- 3-day stability delay before proposing updates
- Minor/patch updates grouped into a single PR
- Post-update: `npm dedupe` runs automatically

## Security practices

- `ignore-scripts=true` in `.npmrc` — prevents arbitrary code execution on install
- `persist-credentials: false` on all `actions/checkout` steps
- All actions pinned by full SHA (not mutable tags)
- gitleaks pre-commit hook catches secrets before they reach the remote
- zizmor catches workflow security issues (template injection, cache poisoning, etc.)
