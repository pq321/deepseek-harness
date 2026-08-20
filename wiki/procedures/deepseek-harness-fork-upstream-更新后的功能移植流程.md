---
type: procedures
title: deepseek-harness fork：upstream 更新后的功能移植流程
tags: []
related: []
relations: []
status: verified
applies_when: deepseek-harness 个人 fork（origin=pq321，upstream=deepseek-ai）在 upstream 大版本更新后需要把 custom 功能移植回来时
verified_on: 2026-08-20
source:
  kind: session
  sessionId: session-8a429ac7-3b51-4d4a-9b6b-c5710d565525
created: 2026-08-20
updated: 2026-08-20
---

## 适用条件

deepseek-harness 个人 fork（origin=pq321，upstream=deepseek-ai）在 upstream 大版本更新后需要把 custom 功能移植回来时

## 步骤

1. git fetch upstream，计算 merge-base upstream/master origin/custom/main，git log --oneline <base>..origin/custom/main 列出全部 fork 提交
2. 按依赖排序而非时间排序：纯逻辑修复 → 全新包（零冲突）→ 对既有包的增量 → 深度耦合 UI 层；docs 提交跟随对应功能提交之后
3. 建分支 git checkout -b custom/port-<tag> upstream/master，逐个 cherry-pick；冲突先看两边语义是否兼容（多数可共存合并）
4. README 冲突合并两边段落语义后必须跑 pnpm run verify-translation-pairing --write <pair> 重记录，pre-commit 才会过
5. PowerShell 写 UTF-8 文件一律 [IO.File]::WriteAllText + UTF8Encoding($false)，Set-Content 会引入 BOM 弄坏 JSON hook
6. tsconfig.host.json / tsconfig.client.json 冲突以 upstream 为基手工叠加 fork 新增行，绝不能整段取 fork 侧（会丢 upstream 新包引用）
7. 深度重构区域（如 ui-attachment image→attachment 泛化）放弃 cherry-pick，改语义移植：读 fork 版函数体，在新架构上重放
8. 验证阶梯：受影响包 vitest → pnpm run test:gui → pnpm run typecheck；sandbox-windows-acl 的 CreateProcessAsUserW pwsh 失败是本机环境预存问题，与移植无关
9. 完成后 push 分支（custom/port-rc8），确认后再快进 custom/main

## 有效做法（works）

- 依赖排序 cherry-pick：15 提交中 12 个低摩擦落地
- 语义合并 README 双语冲突段落（两侧功能描述拼合）
- image-files.ts + resolveImageMediaType 在新 attachment 架构上重放成功

## 无效做法（doesn't work）

- git add -A 在有并发子代理写工作树时会扫入半成品（本次 FilePickerButton 事故）；提交前必须逐文件 audit
- 机械取 --theirs/--ours 解决 tsconfig 冲突（丢 upstream 引用导致 30 个 TS6307）
- cherry-pick 深度重构过的提交（ui-conversation input 层 1200 行分歧，冲突解不过来）

## 验证与证据

2026-08-20 完成 rc.8 移植：15 个 fork 提交全部落到 custom/port-rc8（14 个提交），test:gui 291 文件/3998 用例全绿，typecheck 0 错。冲突类型与解法来自实际操作记录。

## 相关词条

- （待补充）
