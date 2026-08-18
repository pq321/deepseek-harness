# Agent Note: Optional preset transfer plugin

Status: implemented

English | [中文](2026-08-18-optional-preset-transfer-plugin.zh.md)

## Problem

Portable Agent Preset packages are useful on desktop and browser deployments, but adding archive routes and import UI by patching `dsh-agent-presets`, `dsh-host-apiproxy`, and `dsh-client-ui-agent-preset` couples the feature to one upstream build and makes reload ownership unclear.

## Decision

`@deepseek-ai/dsh-preset-transfer` owns a bounded `.dshpreset` archive format and a generated `presetTransfer` Remote service. It exports only user-authored presets, rejects unsafe paths and symbolic links, enforces compressed, expanded, per-file, and file-count limits, warns about likely secrets and absolute paths, validates imported files with the official `scanRoot()` parser, and installs through a temporary directory followed by one atomic rename. The wire payload is strict canonical base64 because the current Remote transport is unary.

`@deepseek-ai/dsh-client-ui-preset-transfer` mounts that Remote contribution and adds an independent `settings.section` entry through `slots.inject()`. Components receive a snapshot hook plus plain callbacks; they do not receive the controller or a service object. Both the slot contribution and generated namespace are owned by the plugin fiber and are removed on unload.

The Web profile registers both rows as disabled-by-default optional entries. Enabling them is a profile composition decision; the shipped Agent Preset UI remains unchanged and no `patch-package` artifact is required.

## Alternatives considered

- **Patch the official Agent Preset package**: rejected because archive transport and settings controls would share the upstream package lifecycle and make the feature harder to disable or replace.
- **Expose raw filesystem paths to the browser**: rejected because the Host service can validate and atomically install the composition without giving the browser a write primitive.
- **Require Electron for transfer**: rejected because browser download plus a Host Remote works for local and remote Web deployments; Electron remains an optional shell adapter.

## Consequences

Preset packages can move between DSH installations without changing the official roster or settings implementation. The archive is not signed, so import trust remains an explicit user confirmation and imported compositions run with user-preset privileges. Base64 buffering adds memory overhead until a streaming Remote contract exists. Electron remains an optional host adapter rather than a requirement of the Web plugin.

## Verification

Host archive tests cover user export, validated round trip, traversal rejection, built-in refusal, and malformed base64. Client tests cover Remote mounting, late slot declaration, unload withdrawal, controller state/error paths, browser download, and settings interactions. Targeted TypeScript builds and the Client bundle pass on the repository's current Node 22.18 environment, with the repository's declared Node engine warning.
