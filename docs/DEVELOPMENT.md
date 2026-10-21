# Development, CI and merge protocol

## Why this policy exists

The historical main branch triggered GitHub Actions for unfinished commits, producing many permanent failed runs and email notifications. A later green commit **does not erase those failures**. We will not mask failed assertions or disable the CI checks to reduce alerts.

## Required workflow for Agents and contributors

1. Begin each change from the latest `main` on a **feature branch**. Never push an unvalidated intermediate change directly to `main`.
2. Read `AGENTS.md`, applicable module-level `AGENTS.md` files, and the relevant design/spec.
3. Before publishing, run `pnpm install --no-frozen-lockfile` (the repository does not currently commit `pnpm-lock.yaml`), then `pnpm check` and `pnpm --filter @ai-composer/web test:e2e` locally when browsers are available. Report any unavailable checks accurately.
4. Open a Pull Request into `main`. The PR is the **pre-merge test gate**. Wait for both `check` and `e2e` jobs to complete successfully; inspect logs and repair changes on the PR branch if needed.
5. Review the entire PR diff, ensure no generated artifacts/secrets are committed, and only then squash-merge or merge. Do not interpret a started or still-running workflow as successful.
6. Any resulting `main` push CI is the post-merge regression signal. If it fails, diagnose and revert/fix instead of producing a stream of speculative direct commits.

The workflow listens to PRs targeting main and pushes *to main only*; branch-only pushes are not independently tested, preventing duplicate branch/PR runs. `concurrency.cancel-in-progress` cancels superseded in-flight PR checks, but it does not remove recorded failures or suppress real alerts.

**Important:** This is a written process plus CI event filtering, not a repository-level GitHub branch protection rule. To enforce merging permissions on all collaborators, a repository administrator must separately configure **Settings → Rules → Rulesets** (or Branch protection) for `main` and require the `check` and `e2e` status checks. Do not claim branch protection is active without checking.

## When working without local dependency/network access

Use a feature branch and the PR's remote CI as the explicit validation boundary. Preserve failing PR artifacts/logs, fix the branch, and merge only after the latest commit's jobs are green. Never use the inability to run local tests as a reason to claim unverified code passes.
