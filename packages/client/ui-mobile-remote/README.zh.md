# @deepseek-ai/dsh-client-ui-mobile-remote

[English](README.md) | 中文

这是可选 `@deepseek-ai/dsh-host-mobile-remote` 服务的设置贡献插件。浏览器插件挂载生成的 Remote 命名空间，并注入独立的 `settings.section` 入口，用于查看状态、轮换配对链接、打开 loopback 批准页和断开手机。它不会 patch Settings、Sidebar 或 Conversation 包。

组件只接收 snapshot hook 和普通回调；controller 负责全部 Remote 调用与 loopback 管理页面的打开操作。Web profile 默认禁用本包。卸载时，设置入口和生成的 Remote 命名空间都会被移除。

## 模型体验

无，因为本包只渲染手机配对控件，不改变提示词、工具、消息、provider 请求或模型可见的 session 状态。

#### KV Cache 影响

无；本包不组装模型输入。

## 已知限制与后续工作

- **没有内嵌二维码渲染**：设置区显示配对 URL，并打开 Host 拥有的批准页面；二维码可以作为独立 UI 贡献加入。
- **需要 Host 服务**：只启用浏览器 row 而不启用 Host row 时，生成的 Remote 命名空间不可用。
- **浏览器弹窗策略**：打开管理页面依赖用户的直接操作以及浏览器弹窗策略。
