# @deepseek-ai/dsh-host-plugin-inventory

[English](README.md) | 中文

Host 侧的 profile 包与运行时插件管理。`PluginInventoryGateway` 注册 `pluginInventory` 服务，并发布三个由 Typert 生成的直接 Remote：`pluginInventory/list`、`pluginInventory/checkAndUpdate` 与 `pluginInventory/setEnabled`。

`list` 将两个概念保持分离。已安装包是当前 profile `package.json` 中的直接依赖，包含请求 spec、已安装版本、registry／GitHub／本地来源、组合包成员关系、仓库 URL，以及可用时解析出的本地路径。运行时插件是 `ctx.loader.entries()` 中的非 group 条目，包含 Loader 身份、模块与包信息、DSH 原生／Cordis 内置／外部／本地来源、生效的启用状态、切换保护和当前根 Fiber 阶段。阶段为 `pending`、`loading`、`active`、`failed` 或 `unloading`；条目没有存活的根 Fiber 时则为 `null`。

`checkAndUpdate` 只接受 profile 的直接、非本地依赖。registry 包先通过 `pnpm outdated` 检查，并在需要时升级到最新发行版；GitHub 与其他远程 spec 则刷新其已配置来源。包修改会串行执行，经由受管 subprocess 服务而不经过 shell，输出有界、超时为五分钟；文件发生变化后必须重启 DSH Web。本地 `link:`、`file:` 与 `workspace:` 依赖仍由其源码 checkout 负责。

`setEnabled` 会立即通过 Loader 应用允许的运行时条目变更，再把期望状态持久化到 profile manifest 的 `dsh.profile.entryStates`。如果持久化失败，实时变更会回滚。结构性的树承载条目与管理控制平面受到保护，因而该界面不能断开自己的更新路径。

该服务仅供 Remote 使用，刻意不声明同进程 Cordis `Context` merge。Client 包通过显式的 [`api-remotes`](../../api/remotes/README.md) 组合消费它，而不导入 Host 实现。

## 模型体验

无，因为这个仅限 Host 的管理服务不注册提示词、工具、消息或提供方请求。

#### KV Cache 影响

无；本包从不组装模型输入。

## 已知限制与暂缓事项

- **清单仅表示调用当下** —— `list` 不包含持久的失败历史或订阅；只要不存在存活的根 Fiber，就会报告 `null`，而不区分其原因。
- **不安装或移除包** —— 更新只操作 profile 已直接声明的依赖。添加、移除或重新构建本地插件仍属于 profile／源码工作流。
