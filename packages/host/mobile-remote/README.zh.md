# @deepseek-ai/dsh-host-mobile-remote

[English](README.md) | 中文

这是可选的私有网络手机配对与遥控 Host 服务。启用这个普通 Cordis 插件后，它会启动独立 HTTP listener，并向浏览器设置插件提供生成的 `mobileRemote` 命名空间；它不会修改主 Web server、API gateway 或 Electron shell。

配对链接五分钟后过期。手机需要先申请配对，再由仅允许 loopback 访问的桌面页面批准，服务才会签发 HttpOnly、SameSite cookie。手机请求只接受 loopback 或 RFC 1918 IPv4 地址。桥接只会把 `workspace.list`、`session.list`、`session.history`、`session.create`、`session.prompt` 和 `session.cancel` 转发到 DSH 主 gateway，同时校验 RPC id、把请求体限制为 64 KiB，并拒绝跨源 RPC POST。

Web profile 默认禁用本包。卸载插件会关闭 listener、清除配对请求与会话，并撤回 Remote 服务。

## 模型体验

无，因为本服务只把用户的显式操作转发给现有 session 方法，不注册提示词、工具、消息变换或 provider 请求。

#### KV Cache 影响

无；本包不组装模型输入。

## 已知限制与后续工作

- **仅提供私有网络 HTTP**：listener 不终止 TLS。只应在可信本地网络使用；不可信或可路由网络需要 TLS 反向代理和更强的部署认证。
- **只允许一台活跃手机**：批准新手机会使旧会话失效，多设备会话管理有意留待后续实现。
- **IPv4 局域网发现**：对外显示的配对 URL 选择 RFC 1918 IPv4 地址，尚未实现 IPv6 局域网发现。
- **不引入二维码依赖**：当前设置页显示并打开配对 URL。独立 UI 插件可以增加二维码渲染，而无需改变 Host 安全边界。
