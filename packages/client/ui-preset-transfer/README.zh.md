# @deepseek-ai/dsh-client-ui-preset-transfer

[English](README.md) | 中文

这是可选 `@deepseek-ai/dsh-preset-transfer` Host 服务的设置贡献插件。浏览器端挂载生成的 Remote 命名空间，等待设置区声明，然后添加独立的导入/导出区域，不修改官方 Agent Preset 界面。Web profile 默认禁用此插件，可通过 profile overlay 或插件清单启用。

组件只接收普通状态和回调。controller 负责 Remote 调用、有界压缩包传输、确认文案和下载生命周期；卸载插件时，设置入口和已挂载的 Remote 命名空间都会撤回。

## 模型体验

无。本包只渲染设置控件，不改变提示词、工具、消息、provider 请求或模型可见的会话状态。

#### KV Cache 影响

无；本包不组装模型请求。

## 已知限制与后续工作

- **没有压缩包签名**：来源警告仅供参考，导入的 composition 会以与本地预设相同的用户信任级别运行。
- **浏览器下载与确认**：保存对话框和确认提示由浏览器负责，嵌入式客户端可能提供平台相关的行为。
