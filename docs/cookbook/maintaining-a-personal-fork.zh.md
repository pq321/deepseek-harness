# 维护个人 fork

[English](maintaining-a-personal-fork.md) | 中文

本实操手册（cookbook）将一份 Windows checkout 同时作为可编辑源码和已安装的 `dsh` 命令，并保留清晰的上游更新路径。规范源码位于 `E:/Automation/deepseek-harness`，`origin` 指向个人 fork，`upstream` 指向 DeepSeek Harness 官方仓库。

## 仓库约定

- `master` 镜像 `upstream/master`，不得提交个人修改。
- `custom/main` 保存个人修改，并合并更新后的 `master` commit。
- `C:/Users/windows10/.dsh/profiles/web` 保存运行时配置和插件依赖，不是 DeepSeek Harness 源码。
- 全局 `dsh` 包通过 npm link 指向 `E:/Automation/deepseek-harness/apps/cli`，不得用 `npm install --global @deepseek-ai/dsh` 替换该链接。

更新前确认这些前提：

```powershell
Set-Location E:/Automation/deepseek-harness
git status --short --branch
git remote -v
npm list --global --depth=0 @deepseek-ai/dsh
```

如果 worktree 不干净，或全局包未解析到 `E:/Automation/deepseek-harness/apps/cli`，请停止更新。

## 从上游更新

快进镜像分支，将镜像推送到个人 fork，再把它合并到自定义分支：

```powershell
Set-Location E:/Automation/deepseek-harness
git fetch upstream --prune
git switch master
git merge --ff-only upstream/master
git push origin master
git switch custom/main
git merge master
```

所有合并冲突都在 `custom/main` 上解决；不得通过向 `master` 添加个人修改来解决冲突。

## 重新构建并验证

按 lockfile 安装依赖，重新构建已链接的命令和 Web 产物，再运行针对性的 GUI 测试套件：

```powershell
Set-Location E:/Automation/deepseek-harness
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run build
pnpm run test:gui
dsh --version
git status --short --branch
```

仅在检查全部通过后推送：

```powershell
git push origin custom/main
```

npm link 通常不会受构建和分支更新影响。只有移动 checkout 或重置全局 npm 目录后才需要重新创建链接：

```powershell
Set-Location E:/Automation/deepseek-harness/apps/cli
npm link
```

## 运行 Web UI

从任意终端启动已链接的源码，并保持该终端开启：

```powershell
dsh web
```

日常网址是 `http://127.0.0.1:3080`。第一个进程占用端口 `3080` 时，再启动一个 `dsh web` 进程会因 `EADDRINUSE` 失败。
