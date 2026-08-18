# @deepseek-ai/dsh-client-ui-preset-transfer

English | [中文](README.zh.md)

Settings contribution for the optional `@deepseek-ai/dsh-preset-transfer` Host service. The browser package mounts the generated Remote namespace, waits for the settings section declaration, and adds an import/export section without changing the official Agent Preset UI. The contribution is disabled by default in the Web profile and can be enabled through a profile overlay or plugin inventory.

The component receives plain state and callbacks. Its controller owns the Remote calls, bounded archive transfer, confirmation text, and download lifecycle; unloading the plugin withdraws both the settings entry and the mounted Remote namespace.

## Model Experience

None, as this package only renders settings controls and does not alter prompts, tools, messages, provider requests, or model-visible session state.

#### KV Cache effect

No model request is assembled by this package, so the package has no KV-cache effect.

## Known Limitations and Deferred Work

- **No archive signing** - provenance warnings are advisory; imported compositions run with the same user trust as local presets.
- **Browser download and confirmation** - the browser owns the save dialog and confirmation prompt, so embedded clients may provide platform-specific behavior.
