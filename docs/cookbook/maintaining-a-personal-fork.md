# Maintaining a personal fork

English | [中文](maintaining-a-personal-fork.zh.md)

This cookbook keeps one Windows checkout as both the editable source and the installed `dsh` command while preserving a clean path for upstream updates. The canonical checkout is `E:/Automation/deepseek-harness`, `origin` is the personal fork, and `upstream` is the official DeepSeek Harness repository.

## Repository contract

- `master` mirrors `upstream/master`; do not commit personal changes there.
- `custom/main` contains personal changes and merges updated `master` commits.
- `C:/Users/windows10/.dsh/profiles/web` contains runtime configuration and plugin dependencies, not DeepSeek Harness source.
- The global `dsh` package is an npm link to `E:/Automation/deepseek-harness/apps/cli`; do not replace it with `npm install --global @deepseek-ai/dsh`.

Confirm these assumptions before updating:

```powershell
Set-Location E:/Automation/deepseek-harness
git status --short --branch
git remote -v
npm list --global --depth=0 @deepseek-ai/dsh
```

Stop if the worktree is not clean or the global package does not resolve to `E:/Automation/deepseek-harness/apps/cli`.

## Update from upstream

Fast-forward the mirror branch, publish the mirror to the personal fork, and merge it into the customization branch:

```powershell
Set-Location E:/Automation/deepseek-harness
git fetch upstream --prune
git switch master
git merge --ff-only upstream/master
git push origin master
git switch custom/main
git merge master
```

Resolve any merge conflict on `custom/main`; never resolve it by adding personal changes to `master`.

## Rebuild and verify

Install the lockfile state, rebuild the linked command and web assets, then run the focused GUI suite:

```powershell
Set-Location E:/Automation/deepseek-harness
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run build
pnpm run test:gui
dsh --version
git status --short --branch
```

Push only after the checks pass:

```powershell
git push origin custom/main
```

The npm link normally survives builds and branch updates. Recreate it only after moving the checkout or resetting the global npm directory:

```powershell
Set-Location E:/Automation/deepseek-harness/apps/cli
npm link
```

## Run the web UI

Start the linked source from any terminal and keep that terminal open:

```powershell
dsh web
```

The daily URL is `http://127.0.0.1:3080`. A second `dsh web` process fails with `EADDRINUSE` while the first process owns port `3080`.
