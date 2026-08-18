# Agent Note: Optional mobile remote plugin

Status: implemented

English | [中文](2026-08-18-optional-mobile-remote-plugin.zh.md)

## Problem

Phone access is useful when a local DSH session is running away from the desk, but placing the listener, pairing state, mobile UI, and navigation button inside an Electron fork makes the capability inseparable from that shell. Direct edits to the Web gateway or Conversation UI also make upstream replacement and plugin unload behavior unclear.

## Decision

`@deepseek-ai/dsh-host-mobile-remote` is an optional Host Cordis service. It owns a separate private-network HTTP listener, five-minute pairing tokens, loopback-only approval and disconnect operations, one HttpOnly SameSite phone session, and a six-method mobile RPC allowlist. It forwards only workspace listing and session list/history/create/prompt/cancel calls to the existing loopback DSH API, bounds request bodies, verifies response ids, rejects cross-origin RPC posts, and clears all listener state on unload.

`@deepseek-ai/dsh-client-ui-mobile-remote` mounts the generated Remote contribution, then consumes `remote.mobileRemote` from a child Fiber that explicitly injects the dynamic namespace. Its disposer unloads that child before withdrawing the Remote contribution. This ordering avoids waiting for a namespace before the plugin can mount it while preserving Cordis service-access checks. The child registers a settings section through `slots.inject()`; the component receives only a snapshot hook and callbacks, not the controller, and does not mutate the DOM through a preload script or patch Sidebar and Settings owners.

Both Web profile rows are disabled by default. A deployment opts into the Host listener and its settings surface explicitly, and can remove either row independently. Electron or Tauri may remain optional shell adapters, but neither owns this capability.

## Alternatives considered

- **Keep the feature inside Electron**: rejected because phone control does not require a desktop window and should survive replacement of the presentation shell.
- **Proxy arbitrary DSH RPC methods**: rejected because pairing should grant the smallest useful capability set, not an open API tunnel.
- **Reuse the main Web listener**: rejected for the first version because a separate listener gives the plugin an unambiguous lifecycle and lets unload close the complete network surface.
- **Add a QR dependency immediately**: rejected because URL pairing is complete without a rendering dependency; QR can be an independent UI contribution.

## Consequences

The mobile capability is spatially removable from the Web profile and temporally reversible at runtime: unload retracts the settings contribution, Remote namespace, listener, pending approvals, and phone session. The listener is plain HTTP intended only for a trusted private network, advertises IPv4 LAN addresses, and supports one active phone. Deployments needing TLS, routed access, or multiple devices must add those as explicit adapters rather than silently widening this plugin's trust boundary.

## Verification

Host tests exercise real HTTP pairing, loopback approval, the authenticated mobile page, allowlisted forwarding, blocked RPC methods, and listener shutdown on unload. Client tests provide the generated namespace from a separate Cordis Fiber, so an undeclared nested service read fails with the same injection guard as the assembled browser; they also cover late settings-slot declaration, unload withdrawal, controller success/error paths, management-page opening, and rendered controls. The assembled Web profile boots both optional Client plugins without a plugin-load failure. Targeted TypeScript builds, Host and Client tests, and the Client bundle run under the current Node 22.18 environment, with the repository's declared Node engine warning.
