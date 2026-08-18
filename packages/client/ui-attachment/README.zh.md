# @deepseek-ai/dsh-client-ui-attachment

[English](README.md) | 中文

纯 React 附件原子组件（零 cordis）：输入框草稿附件栏（`AttachmentRail`）、聊天历史图片画廊（`MessageImage`/`ImageGallery`）、原图灯箱（`ImageLightbox`）与整页拖放遮罩（`DropOverlay`）。所有文案都由持有方插件在自己的语言命名空间中解析后经 label props 传入，此包不读取任何应用状态；当前消费者是 `@deepseek-ai/dsh-client-ui-conversation`，经其 `image-labels` 模块桥接 `conversation` 词典。

## 附件栏

`AttachmentRail` 在同一横向滚动栏中，将待发送栅格图片渲染为固定 52px 缩略图，将非图片文件渲染为紧凑的 196px 条目（回形针、浏览器可见的文件名或相对路径以及大写文件类型）。文件条目仅表示引用，没有打开操作；图片缩略图仍可单击查看原图。两类条目共用隐藏滚动条和两端圆形翻页箭头，纵向滚轮会转换为横向滚动，新增条目滚到栏尾，删除保持当前位置。每个条目都有移除按钮；粗指针设备常显该按钮。

## 消息图片与灯箱

`MessageImage` 渲染一张持久化历史图片，经持有方的 `ImageLoader` 加载会话授权 URL；加载失败渲染显式重试按钮，加载完成后单击打开 `ImageLightbox`（加载中的点击被忽略）。尺寸规则对齐 DeepSeek Chat：一条消息仅有的一张图（`variant="single"`）长边 240px、展示宽高比钳制在 [0.25, 4] 之间——超出部分由 `object-fit: cover` 裁切，特别高的图锚定顶部、特别宽的图锚定左侧——且从不放大超过原始尺寸；多图中的一张（`variant="tile"`）为固定 64px 方块。`ImageGallery` 将一条消息的图片包为一个对齐的可换行弹性分组（用户消息 `end`，助手消息 `start`），按图片数量选择 variant，空列表不渲染。`ImageLightbox` 是文档级模态预览，铺在共享的对话框遮罩上（`--dsw-alias-bg-mask-1` 加 `--dsw-mask-blur`，画在独立图层上，模糊不会波及预览图本身），按 Escape、按下遮罩或点关闭按钮均可关闭，卸载时将焦点还给打开者。

## 拖放遮罩

`DropOverlay` 是文件拖拽悬停页面时的全视口邀请层：插画、标题，接受拖放时再加一行上限说明（`disabled` 换为禁用插画并隐藏上限行）。该层不接收指针事件——持有方的 document 级拖拽监听器负责 enter/leave 计数和接受与否的判定；遮罩只呈现状态。与灯箱一样经 body portal 渲染。

## 模型体验

无。该包（package）在浏览器中渲染纯 React 原子组件；这里没有任何内容进入模型请求。

#### KV Cache 影响

无；该包既不组装也不发送提供方请求。

## 已知限制与暂缓事项

- **文件引用只包含草稿元数据** — 此原子组件不上传文件字节，也不渲染发送后的文件历史卡片；引用如何进入模型输入由持有方 composer 决定。
- **灯箱无缩放与下载** — 预览仅以适配视口的尺寸渲染原图。
- **灯箱不锁定焦点** — 它设置 `aria-modal` 并在关闭时归还焦点，但 Tab 仍可移动到背后的页面（沿袭入包前组件的行为）。
