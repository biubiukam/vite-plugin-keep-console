# Contributing

Thanks for taking the time to improve `vite-plugin-keep-console`. This guide
covers the development workflow and conventions used in this project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Reporting Issues](#reporting-issues)
- [Commit Convention](#commit-convention)

## Code of Conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md). By
participating, you are expected to uphold it.

## Development Setup

### Prerequisites

- Node.js >= 18 for local development and CI parity.
- npm, which ships with Node.js.

The package keeps `backend: "babel"` compatible with older runtime targets, but
the development toolchain uses modern Vite, Vitest, TypeScript, and tsup
versions.

### Getting Started

```bash
git clone https://github.com/biubiukam/vite-plugin-keep-console.git
cd vite-plugin-keep-console
npm install
```

### Useful Commands

```bash
npm run typecheck       # Type check the project
npm run lint            # Run ESLint
npm run format:check    # Check Prettier formatting
npm run format          # Format files with Prettier
npm run test            # Run the test suite
npm run test:coverage   # Run tests and generate coverage
npm run test:watch      # Run tests in watch mode
npm run build           # Build CJS, ESM, and type declarations
npm pack --dry-run      # Inspect package contents before publishing
```

## Project Structure

```text
src/
├── index.ts            # Vite plugin entry
├── transform.ts        # Public transform factory
├── backend.ts          # Backend selection and dynamic OXC loading
├── babel-backend.ts    # Legacy Babel AST transform
├── oxc-backend.ts      # OXC parser + MagicString transform
├── options.ts          # Option normalization and file filters
└── types.ts            # Public option types
test/
├── backend.test.ts     # Backend resolution and fallback coverage
├── transform.test.ts   # Console transform behavior
├── file-types.test.ts  # Supported file extension coverage
└── index.test.ts       # Vite plugin entry coverage
```

## Making Changes

1. Create a feature branch from `master`:
    ```bash
    git checkout -b feat/my-feature
    ```
2. Make focused changes with clear commits.
3. Run verification before opening a pull request:
    ```bash
    npm run lint && npm run format:check && npm run typecheck && npm run test && npm run build && npm pack --dry-run
    ```
4. Open a pull request targeting `master`.

## Testing

Tests are written with [Vitest](https://vitest.dev/).

- Add behavior coverage for any public option or transform behavior change.
- Backend changes should cover both Babel and OXC behavior when practical.
- `backend: "auto"` must continue to fall back to Babel when OXC cannot be
  loaded or the Node runtime is below the OXC requirement.
- `backend: "oxc"` must fail loudly with an actionable error when OXC cannot be
  loaded.

## Pull Request Guidelines

- Keep changes focused on one bug fix, feature, or documentation update.
- Add or update tests for behavior changes.
- Update `README.md` and `README.zh-CN.md` when public APIs or usage examples
  change.
- Run all verification commands before opening a pull request.
- Do not commit generated output such as `dist/`, `coverage/`, or
  `node_modules/`.
- Keep comments and public documentation in English unless editing localized
  documentation.

## Reporting Issues

### Bug Reports

When reporting a bug, include:

- `vite-plugin-keep-console` version.
- Vite version.
- Node.js version.
- Configured backend: `auto`, `oxc`, or `babel`.
- Minimal Vite config and source snippet.
- Expected behavior vs. actual behavior.

### Feature Requests

Feature requests are welcome. Please describe the use case and motivation before
proposing a specific API surface.

## Commit Convention

This project follows a lightweight conventional commit style:

```text
type: short description

Optional body with more detail.
```

Common types:

| Type       | Usage                                                   |
| ---------- | ------------------------------------------------------- |
| `feat`     | New feature                                             |
| `fix`      | Bug fix                                                 |
| `docs`     | Documentation only                                      |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test`     | Adding or updating tests                                |
| `chore`    | Tooling, CI, or dependency updates                      |
| `perf`     | Performance improvement                                 |

Examples:

```text
feat: add oxc backend fallback
fix: preserve marked console calls in expressions
docs: document backend option
```
