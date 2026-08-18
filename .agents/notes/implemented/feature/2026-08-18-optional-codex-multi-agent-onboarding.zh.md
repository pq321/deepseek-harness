# Agent Note: 可选 Codex 多 Agent 接入

Status: implemented

[English](2026-08-18-optional-codex-multi-agent-onboarding.md) | 中文

## 问题

Web profile 需要以可选方式提供固定的 FastAI Worker 与 Reviewer 路由、原生 Codex 委派和跨 Session 的 Subagent 统计，同时不能替换 DSH 的 Session 所有权、父 Agent 唤醒机制、内置 `code` preset 或 profile 现有的 bundle 栈。可观测性故障不得阻止 DSH 启动或结算 Subagent。

## 决策

[`dsh-codex-enhancements`](../../../../dsh-codex-enhancements/CHECKLIST.md) 是面向 `web` profile 的可卸载 patch-layer bundle。它挂载[原生后端决策](2026-08-04-claude-code-and-codex-subagent-backends.md)所述的现有 `@deepseek-ai/dsh-subagent-codex` provider，不增加 Wake Bridge、轮询循环、Codex 状态机或第二个 `CODEX_HOME`。

该 bundle 将 `fastai-worker` 和 `fastai-reviewer` 注册为原生 `spawn` provider 的包装层。两个包装层都会在委派前用 `fastai` 和 `gpt-5.6-sol` 替换调用方选择的 provider 与 model，同时保留其他子 Agent 选项。独立的 `code-multi-agent` 用户 preset 会公开这两个包装层和原生 one-shot `codex` provider。安装过程把内置 `code` composition 复制到由 bundle 拥有的用户 preset 目录，再追加新增工具；它不会编辑内置 preset 或默认 preset 设置。

Subagent Ledger 监听 DSH 的 Session 与 Subagent 生命周期事件，并写入可重建的 JSON 投影。它记录父子身份、角色、provider 路由、模型、终止结果、usage、cache 流量、retry 和 retry waste。投影加载、事件折叠、服务发布、日志和写入均独立隔离；故障只更新 Ledger health，不会拒绝 DSH 生命周期操作。当仍有对应的活动 Subagent 时，Session dispose 会把事实保留到配对的 subagent end 到达，从而保留先释放 Session、后发布终止事件的 continuable 子 Agent usage。

安装脚本把 bundle 和仓库中的原生 Codex provider 一并添加为 profile 管理的依赖，再物化 owned preset。卸载脚本移除这两个依赖，并且只删除带有 bundle ownership marker 的 preset。preset 安装失败时，安装脚本会回滚 profile 依赖。

## 考虑过的替代方案

- **把 Codex 编排迁入 DSH**：不采用，因为 DSH 已经拥有持久化 Session、continuation 投递、父 Agent 唤醒、retry policy、工具与权限；原生 provider 继续只充当 Worker 后端。
- **替换内置 `code` preset**：不采用，因为多 Agent 工具属于可选部署策略，不应改变普通 DSH 行为。
- **持久化第二份执行真源**：不采用，因为 Ledger 是派生的可观测性数据；DSH Session log 与生命周期事件仍为权威来源。
- **让 Ledger 故障成为致命错误**：不采用，因为统计功能不能阻断 Agent 启动、结算或 profile boot。

## 后果

Web profile 可以选择启用固定的 Sol Worker、Reviewer 路由和原生 Codex 委派，而不改变默认 Agent preset。卸载会移除该 profile 拥有的全部运行时新增项和 owned preset，同时保留无关 bundle 与用户 preset。角色包装层有意使用前台 one-shot 工具，因为 continuable provider preparation 不接收角色模型选项；DSH 普通 continuable `subagent` 工具继续承担父 Agent 唤醒路径。Worktree 隔离、Codex continuation 和基于风险的 Reviewer policy 不属于该 bundle。

本地接入脚本要求 bundle checkout 与匹配的 DSH 仓库 checkout 同时存在，因为尚未发布的原生 Codex package 通过 profile-local link 安装。该 provider package 以匹配的 DSH 版本发布后，发布版 bundle 可以把此 link 换成 registry dependency。

## 验证

Node 测试固定了角色路由替换、无效 policy 拒绝、owned preset 安装与拒绝行为、跨 dispose 顺序的 Ledger 聚合以及写入失败隔离。DSH Codex provider spec 固定其 app-server 协议和生命周期行为。聚焦的 continuation 测试固定 settlement 投递会唤醒空闲父 Agent。临时 profile 测试固定 bundle composition、真实 Web 启动、preset 物化、卸载清理以及移除后普通 Web 启动。
