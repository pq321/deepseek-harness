# @deepseek-ai/dsh-host-plugin-inventory

English | [中文](README.zh.md)

Host-side profile package and runtime plugin management. `PluginInventoryGateway` registers the `pluginInventory` service and publishes three generated direct Remotes: `pluginInventory/list`, `pluginInventory/checkAndUpdate`, and `pluginInventory/setEnabled`.

`list` keeps two concepts separate. Installed packages are direct dependencies from the active profile's `package.json`, with their requested spec, installed version, registry/GitHub/local source, bundle membership, repository URL, and resolved local path when available. Runtime plugins are the non-group entries from `ctx.loader.entries()`, with their Loader identity, module and package facts, DSH-native/Cordis-built-in/external/local origin, effective enablement, toggle protection, and current root Fiber phase. The phase is `pending`, `loading`, `active`, `failed`, or `unloading`; it is `null` when the entry has no live root Fiber.

`checkAndUpdate` accepts only a direct, non-local profile dependency. Registry packages are checked with `pnpm outdated` and moved to the latest release when needed; GitHub and other remote specs refresh their configured source. Package mutations are serialized, run through the managed subprocess service without a shell, have bounded output and a five-minute timeout, and require a DSH Web restart when files changed. Local `link:`, `file:`, and `workspace:` dependencies remain source-checkout-owned.

`setEnabled` applies an allowed runtime entry change through Loader immediately, then persists the desired state under `dsh.profile.entryStates` in the profile manifest. If persistence fails, the live change is rolled back. Structural tree carriers and the management control plane are protected from this surface so it cannot detach its own update path.

The service is Remote-only and deliberately declares no same-process Cordis `Context` merge. Client packages consume it through the explicit [`api-remotes`](../../api/remotes/README.md) assembly rather than importing the Host implementation.

## Model Experience

None, as this Host-only management service registers no prompt, tool, message, or provider request.

#### KV Cache effect

None; this package never assembles model input.

## Known Limitations and Deferred Work

- **Point-in-time inventory only** — `list` contains no durable failure history or subscription; a missing root Fiber is reported as `null`, regardless of why no live root exists.
- **No package installation or removal** — updates operate only on dependencies already declared directly by the profile. Adding, removing, or rebuilding a local plugin remains a profile/source workflow.
