# @deepseek-ai/dsh-preset-transfer

[English](README.md) | 中文

这是用户 Agent Preset 的可移植 `.dshpreset` 压缩包传输插件。它是普通 Cordis 插件，提供生成的 `presetTransfer` Remote 服务；不会修改 `dsh-agent-presets` 或 Web UI 包。

只有 `user` 预设可以导出。压缩包包含带版本的 manifest 和预设目录；插件拒绝路径穿越与符号链接，限制文件数、单文件大小和展开后的总大小，并在安装前报告可能存在的绝对路径或密钥。导入写入第一个可写预设根目录，使用预设清单同一套发现解析器验证 composition，然后通过原子重命名安装。

Loader 行禁用时本包没有任何效果。浏览器 UI 可以挂载 `./remote` 贡献并自行组合设置 slot；移除 Loader 行会撤回服务及所有正在进行的 Remote 方法。

## 模型体验

无。本包只传输用户 composition 文件，不注册提示词、工具、消息或 provider 请求。

#### KV Cache 影响

无；本包不组装模型输入。

## 已知限制与后续工作

- **没有压缩包签名**：来源信息只用于复核，导入的 composition 会以与本地用户预设相同的信任级别运行。
- **Remote 使用 base64**：当前一元 Remote 合约会在内存中缓冲压缩包；未来的流式压缩包协议可以降低这部分开销，而不改变预设文件格式。
