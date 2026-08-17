# @deepseek-ai/dsh-client-ui-attachment

English | [中文](README.zh.md)

Pure React attachment atoms (zero cordis): the composer draft-attachment rail (`AttachmentRail`), the chat-history image gallery (`MessageImage`/`ImageGallery`), the original-image lightbox (`ImageLightbox`), and the full-page drop overlay (`DropOverlay`). Every string arrives through label props resolved by the owning plugin's own locale namespace, and nothing here reads application state; `@deepseek-ai/dsh-client-ui-conversation` is the current consumer, bridging its `conversation` dictionary through its `image-labels` module.

## Attachment rail

`AttachmentRail` renders pending raster images as fixed 64px thumbnails and non-image files as 220px metadata rows (paperclip, browser-visible name or relative path, MIME type, and size) in one horizontally scrolling rail. File rows are references only and have no open action; image thumbnails retain single-click original preview. Overflow uses the same hidden-scrollbar paging behavior for both item kinds: circular edge arrows page one viewport (minus one image card of context, floored at 200px), vertical wheel input pans horizontally, new items reveal the rail end, and removal keeps the current position. Every item has a remove control; coarse-pointer surfaces keep it visible.

## Message images and the lightbox

`MessageImage` renders one durable history image, loading a session-authorized URL through the owner's `ImageLoader`; a failed load renders an explicit retry control, and a settled load answers a single click by opening `ImageLightbox` (clicks during loading are ignored). Sizing follows DeepSeek Chat: a message's lone image (`variant="single"`) renders at 240px on its longer edge with the displayed aspect ratio clamped to [0.25, 4] — the overflow is cropped by `object-fit: cover`, anchored to the top of very tall images and the left of very wide ones — and never upscales past its natural size; an image among several (`variant="tile"`) is a fixed 64px square. `ImageGallery` wraps a message's images in one aligned wrapping flex group (`end` for user messages, `start` for assistant messages), picks the variant from the image count, and renders nothing for an empty list. `ImageLightbox` is a document-level modal preview over the shared dialog mask (`--dsw-alias-bg-mask-1` + `--dsw-mask-blur`, painted on its own layer so the blur never touches the previewed image) that closes on Escape, a mask press, or its close control, and restores focus to its opener on unmount.

## Drop overlay

`DropOverlay` is the full-viewport invitation shown while a file drag is over the page: illustration, title, and a limits line while drops are accepted (`disabled` swaps the blocked illustration and hides the limits line). The layer is pointer-inert — the owner's document-level drag listeners keep the enter/leave count and decide accept/reject; the overlay only shows state. It portals to the body like the lightbox.

## Model Experience

None, as the package renders pure React atoms in the browser; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **File references are draft-only metadata** — this atom does not upload file bytes or render a sent-file history card; the owning composer decides how references become model-visible input.
- **No zoom or download in the lightbox** — the preview renders the original at fit-to-viewport size only.
- **The lightbox does not trap focus** — it sets `aria-modal` and restores focus on close, but Tab can reach the page behind it (behavior carried over from the pre-package component).
