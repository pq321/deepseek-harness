# Agent Note: 可选预设传输插件

Status: implemented

[English](2026-08-18-optional-preset-transfer-plugin.md) | 中文

## 问题

桌面端和浏览器部署都可以受益于可移植的 Agent Preset 压缩包，但通过 patch 修改 `dsh-agent-presets`、`dsh-host-apiproxy` 和 `dsh-client-ui-agent-preset` 会把功能耦合到单个上游构建，并使重载时的所有权不清晰。

## 决策

`@deepseek-ai/dsh-preset-transfer` 负责有界 `.dshpreset` 压缩包格式和生成的 `presetTransfer` Remote 服务。它只导出用户预设，拒绝不安全路径和符号链接，限制压缩后、展开后、单文件和文件数量，报告可能的密钥与绝对路径，使用官方 `scanRoot()` 解析器验证导入内容，再通过临时目录和一次原子重命名安装。由于当前 Remote 传输是一元调用，线上的 base64 必须是严格的规范编码。

`@deepseek-ai/dsh-client-ui-preset-transfer` 挂载 Remote 贡献，并通过 `slots.inject()` 添加独立的 `settings.section`。组件只接收快照 hook 和普通回调，不接收 controller 或 service 对象。slot 贡献和生成的命名空间都归插件 fiber 所有，卸载时一并移除。

Web profile 注册这两个默认禁用的可选入口。是否启用由 profile composition 决定；内置 Agent Preset UI 保持不变，也不需要 `patch-package` 产物。

## 考虑过的替代方案

- **修改官方 Agent Preset 包**：不采用，因为压缩包传输和设置控件会共享上游包生命周期，使功能更难禁用或替换。
- **向浏览器暴露原始文件系统路径**：不采用，因为 Host 服务可以在不提供写文件原语的情况下验证并原子安装 composition。
- **要求 Electron 才能传输**：不采用，因为浏览器下载加 Host Remote 已经支持本地和远程 Web 部署；Electron 仍是可选 shell 适配器。

## 结果

预设压缩包可以在 DSH 安装之间移动，而不改变官方 roster 或设置实现。压缩包没有签名，因此导入信任仍由用户确认，导入的 composition 以用户预设权限运行。base64 缓冲会带来内存开销，直到出现流式 Remote 合约；Electron 仍然是可选 Host 适配器，而不是 Web 插件的前置条件。

## 验证

Host 压缩包测试覆盖用户预设导出、验证后的往返导入、路径穿越拒绝、内置预设拒绝和非法 base64。Client 测试覆盖 Remote 挂载、延迟 slot 声明、卸载撤回、controller 状态与错误路径、浏览器下载以及设置交互。定向 TypeScript 构建和 Client bundle 已通过；当前环境为 Node 22.18，仍会显示仓库声明的 Node 引擎警告。
