# Agent Note: 让 PTC JSON 失败可修复并保留部分搜索结果

Status: implemented

[English](2026-08-18-ptc-json-diagnostics-and-partial-search.md) | 中文

## Problem

Code mode 程序可能返回 JSON 无法无损表达的 JavaScript 值，例如值为 `undefined` 的对象属性。worker 正确拒绝这些值，但通用的 `program completion must be lossless JSON` 消息没有指出模型需要修改什么。这使模型中立的 PTC 执行路径不必要地依赖模型猜测 Harness 规则。

文件发现还存在另一个全有或全无的问题。Ripgrep 可以先输出有效匹配，再因为某个嵌套目录不可访问而以非零状态退出。把这次运行视为完全失败会丢弃工作区可读部分的有用路径，并促使模型绕过搜索工具。同一个退出码也可能表示无效 pattern、根目录不存在或其他 I/O 失败，因此接受所有非零运行会掩盖真实故障。

## Decision

worker-thread JSON 快照在执行既有的一次读取、迭代验证时，把第一个无效值记录为链式 JSON 路径和面向修正的原因。PTC completion 仍然 fail-closed：无效值继续产生 `invalid-output`，但消息会指出有界路径、违反的无损 JSON 规则及修复方式。宿主对伪造 worker 通信的验证仍使用通用错误，因为不可信对端不能提供诊断事实。

只有当 ripgrep 已产生可用且完整的 stdout、stderr 完整，并且每个非空 stderr 行都匹配已识别的 Windows 或 POSIX 访问拒绝诊断时，`dsh-tool-fs-search` 才接受非零退出。规范结果携带 `warnings: [{ code: "SEARCH_ACCESS_DENIED", paths }]`，模型可见渲染会说明结果不完整。没有输出的访问拒绝、混合诊断、截断 stderr、无效 pattern、根目录不存在及其他失败保留既有 `SEARCH_*` 错误。

两项改动都留在行为所属的包中，不增加依赖、模型专用 prompt、宽松 JSON 转换或提供方分支。

## Alternatives considered

**把受影响 session 切换到 Standard mode。** 拒绝，因为这会绕过 PTC，而不是改善其模型中立的执行与诊断约定。

**静默 stringify completion 值。** 拒绝，因为 JSON 序列化会丢弃值为 `undefined` 的对象属性、改变稀疏数组并规范化非有限数；接受这种输出会掩盖数据损失。

**通过单个模型的 prompt 要求省略 `undefined`。** 拒绝，因为规则属于执行校验的 runtime 操作，并且必须适用于每个模型适配器。

**忽略所有 ripgrep 访问错误或所有非零退出。** 拒绝，因为不可访问的显式根目录和混合诊断都不能证明存在可用的部分结果，而语法及 I/O 失败需要被修正。

**为 runtime 专用秘密目录增加永久默认排除。** 拒绝，因为部署可以在任意名称下创建不可访问子树；遍历恢复属于结果分类，不属于不断增长的名称列表。

## Consequences

PTC 重试会获得足够信息来修正第一个无效返回字段，同时无损 JSON 规则不被削弱。诊断路径渲染有界，因此恶意的深度嵌套或长键名无法产生无限错误文本；诊断无法装入剩余输出账本时，仍按既有规则变为 `output-limit`。

Glob 和 grep 能在已识别的嵌套访问拒绝中保留可读结果，并向结构化调用方和模型公开其不完整性。保守分类器仍可能拒绝本地化或尚未见过的访问拒绝消息；增加签名需要证据与测试。真实 worker 测试固定 PTC 诊断，搜索单元测试固定部分成功与结构化警告，既有真实 ripgrep 集成测试固定未改变的正常及硬失败行为。
