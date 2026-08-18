# Agent Note：可选手机遥控插件

状态：已实现

[English](2026-08-18-optional-mobile-remote-plugin.md) | 中文

## 问题

当本地 DSH 会话运行而用户离开桌面时，手机访问很有用；但若把 listener、配对状态、手机 UI 和导航按钮放进 Electron fork，这项能力就无法与该 shell 分离。直接修改 Web gateway 或 Conversation UI，也会让上游替换和插件卸载行为变得不清晰。

## 决策

`@deepseek-ai/dsh-host-mobile-remote` 是可选 Host Cordis 服务。它拥有独立的私有网络 HTTP listener、五分钟配对 token、仅限 loopback 的批准与断开操作、一个使用 HttpOnly SameSite cookie 的手机会话，以及六个方法的 mobile RPC allowlist。它只把工作区列表和 session 列表／历史／创建／提示／取消调用转发到现有 DSH loopback API，同时限制请求体、校验响应 id、拒绝跨源 RPC POST，并在卸载时清除 listener 的全部状态。

`@deepseek-ai/dsh-client-ui-mobile-remote` 挂载生成的 Remote 贡献，然后在显式注入动态命名空间的子 Fiber 中使用 `remote.mobileRemote`。它的 disposer 先卸载该子 Fiber，再撤回 Remote 贡献。这个顺序既避免插件在挂载命名空间之前等待该命名空间，也保留 Cordis 的服务访问检查。子 Fiber 通过 `slots.inject()` 注册设置区；组件只接收 snapshot hook 和回调，不接收 controller，也不通过 preload 脚本修改 DOM 或 patch Sidebar 与 Settings owner。

Web profile 中的两个 row 都默认禁用。部署方需要显式启用 Host listener 及其设置区，并且可以独立移除任一 row。Electron 或 Tauri 可以继续作为可选 shell adapter，但不拥有这项能力。

## 考虑过的替代方案

- **把功能保留在 Electron 内**：拒绝，因为手机控制不需要桌面窗口，而且应当允许替换表现层 shell。
- **代理任意 DSH RPC 方法**：拒绝，因为配对应授予满足使用需求的最小能力集，而不是开放 API 隧道。
- **复用主 Web listener**：首个版本拒绝，因为独立 listener 让插件生命周期没有歧义，卸载时可以关闭完整网络表面。
- **立即增加二维码依赖**：拒绝，因为 URL 已能完成配对；二维码可以作为独立 UI 贡献。

## 后果

mobile 能力可以从 Web profile 中按空间移除，也可在运行时按时间逆转：卸载会撤回设置贡献、Remote 命名空间、listener、待批准请求和手机会话。listener 使用明文 HTTP，只适用于可信私有网络；它显示 IPv4 局域网地址，并只支持一台活跃手机。需要 TLS、路由访问或多设备的部署应把这些能力作为显式 adapter 加入，而不是悄悄扩大本插件的信任边界。

## 验证

Host 测试覆盖真实 HTTP 配对、loopback 批准、已认证手机页面、allowlist 转发、被阻止的 RPC 方法，以及卸载后 listener 关闭。Client 测试从独立 Cordis Fiber 提供生成的命名空间，因此未声明的嵌套服务读取会触发与组装后浏览器相同的注入保护；测试也覆盖设置 slot 延迟声明、卸载撤回、controller 成功／错误路径、管理页打开和控件渲染。组装后的 Web profile 可以加载两个可选 Client 插件，且不产生插件加载失败。定向 TypeScript 构建、Host 与 Client 测试及 Client bundle 均在当前 Node 22.18 环境运行；仓库会给出 Node engine 版本警告。
