# @deepseek-ai/dsh-preset-transfer

English | [中文](README.zh.md)

Portable `.dshpreset` archive transfer for user-authored Agent Presets. The package is a normal Cordis plugin and exposes a generated `presetTransfer` Remote service; it does not modify `dsh-agent-presets` or the Web UI package.

Only `user` presets can be exported. Archives contain a versioned manifest and the preset directory, reject traversal and symbolic links, enforce file/count/expanded-size limits, and report possible absolute paths or secrets before installation. Import writes to the first writable preset root and validates the composition with the same discovery parser used by the preset roster before renaming it into place.

The package has no effect until its Loader row is enabled. A client UI may mount the generated `./remote` contribution and compose its own settings slot; removing the row withdraws the service and all in-flight Remote methods.

## Model Experience

None, as this package only transfers user-authored composition files and registers no prompt, tool, message, or provider request.

#### KV Cache effect

None; this package never assembles model input.

## Known Limitations and Deferred Work

- **No archive signing** — package provenance is shown as review metadata but is not cryptographically verified; imported compositions have the same trust as any user-authored preset.
- **Remote payloads are base64 encoded** — the current unary Remote contract buffers the archive in memory; a future streaming archive protocol can remove that overhead without changing the preset file format.
