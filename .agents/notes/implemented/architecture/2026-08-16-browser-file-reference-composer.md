# Agent Note: Browser files become durable references without byte upload

Status: implemented

English | [中文](2026-08-16-browser-file-reference-composer.zh.md)

## Problem

The composer routed every pasted or dropped browser `File` through the image intake path. PNG, JPEG, WebP, and GIF worked, while every other type failed with the image-format warning. A UI-only file chip would not be sufficient: submitting it must leave model-visible, replayable data in the session log, without accidentally uploading or reading arbitrary file contents.

## Decision

The per-session input machine now owns ordered generic draft attachment ids. `ConversationController` keeps the browser objects and classifies each file at intake:

- PNG, JPEG, WebP, and GIF retain object-URL preview, image limits, base64 serialization, and Host attachment admission.
- Every other MIME type becomes a `file` draft descriptor containing the browser-visible relative path when available, otherwise the file name. This branch creates no object URL and never calls `File.arrayBuffer()`.

`AttachmentRail` is a discriminated image/file atom. Images remain 64px preview tiles; file references are fixed-height horizontal metadata rows with name, MIME type, size, and a remove action. Paste and whole-page drop share the same generic intake, while image count and byte limits apply only to supported raster images.

At submit, file references are JSON-escaped into a final text section:

```text
Referenced files (content not uploaded):
- "report.pdf"
```

That text crosses the existing `session.prompt` contract and is therefore logged, replayed, queued, and steered with the user message. The wire protocol does not gain a temporary file part that the Host or providers cannot honor.

## Browser path boundary

Standard browsers intentionally do not disclose an absolute local path for a dropped `File`. The implementation uses `webkitRelativePath` when a browser supplies one (for example a directory selection), then falls back to `name`. It does not fabricate a path or imply that the Host can read content that was never uploaded. A future native shell may supply a stronger path-bearing reference through a separate trusted bridge.

## Alternatives considered

- A UI-only chip was rejected because it would disappear at submission and leave no model-visible or replayable reference.
- A new wire/core `file` content block was rejected because the browser has neither trusted absolute paths nor uploaded bytes for the Host and provider adapters to honor; it would encode capability the system does not have.
- Uploading arbitrary file bytes was rejected because the requested behavior is reference-only and a general upload pipeline would add storage, size, malware, retention, and provider-format policy far beyond this change.

## Consequences

Arbitrary file types can remain in every session draft and survive the normal session switch/failure lifecycle until submission or removal. The model sees the reference identity but not file contents. Sent history currently renders the durable reference section as ordinary user text; a structured history file card would require a durable core content block plus adapter, compaction, queue-edit, and transcript support.

## Verification

Unit coverage pins mixed paste/drop, image-limit isolation, file-row rendering, file-only submit, mixed image/file serialization, absence of file-byte reads, and attachment release. The assembled Web snapshot pins the built plugin graph accepting a non-image paste as a file-reference row.
