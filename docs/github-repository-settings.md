# GitHub Repository Settings

Use this checklist when updating the public GitHub repository metadata for
`biubiukam/vite-plugin-keep-console`.

## About

Description:

```text
Production console policy for Vite: remove, keep, report, or fail builds on console calls with Babel/OXC backends.
```

Website:

```text
https://www.npmjs.com/package/vite-plugin-keep-console
```

Topics:

```text
vite
vite-plugin
console
console-policy
remove-console
strip-console
build-tool
production
typescript
javascript
babel
oxc
frontend
logging
ci
```

## Features

- Keep Issues enabled.
- Keep Wiki disabled.
- Keep Discussions disabled until there is enough user support traffic to justify it.
- Disable Projects if no active roadmap or triage board is maintained there.

## Branch Protection

Protect the default branch and require the `CI` workflow to pass before merging.

Recommended required checks:

```text
Syntax checks
Unit tests / Node 18
Unit tests / Node 20
Unit tests / Node 22
```

## Release Readiness

Before promoting the updated positioning publicly, publish a new npm version so the
registry metadata and installed package match the README and repository About.
