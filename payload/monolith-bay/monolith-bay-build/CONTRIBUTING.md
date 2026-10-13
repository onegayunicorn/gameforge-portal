# Contributing to Monolith Bay

Thank you for your interest in contributing! This document outlines the process.

## Getting Started

1. Fork the repository and clone your fork.
2. Install dependencies: `pnpm install --frozen-lockfile`.
3. Create a feature branch: `git checkout -b feat/your-feature`.
4. Make your changes with tests.
5. Run `pnpm lint && pnpm typecheck && pnpm test`.
6. Open a pull request following the template.

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation only
- `style:` formatting, no code change
- `refactor:` code change that neither fixes a bug nor adds a feature
- `perf:` performance improvement
- `test:` adding or correcting tests
- `build:` build system or dependencies
- `ci:` CI configuration
- `chore:` maintenance
- `content:` game content (quests, dialogue, items)
- `asset:` visual or audio assets

## Content and Asset Contributions

- All contributed assets must include provenance metadata.
- Only newly authored, licensed, public-domain, or open-source-compatible assets are accepted.
- Assets extracted from other games or unlicensed sources will be rejected.
- See `security/content-trust-policy.md` for the full policy.

## Pull Request Process

1. Ensure CI passes (typecheck, lint, unit tests, content validation).
2. Update documentation where relevant.
3. Add a changeset with `pnpm changeset` if your change affects a published package.
4. Request review from at least one maintainer.
