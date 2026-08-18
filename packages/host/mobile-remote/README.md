# @deepseek-ai/dsh-host-mobile-remote

English | [中文](README.zh.md)

Optional private-network phone pairing and mobile-control Host service. Enabling the normal Cordis plugin starts a separate HTTP listener and exposes a generated `mobileRemote` namespace for the browser settings plugin. It does not modify the main Web server, API gateway, or Electron shell.

The pairing URL expires after five minutes. A phone must request pairing, and the loopback-only desktop page must approve it before the service issues an HttpOnly, SameSite cookie. Phone requests are accepted only from loopback or RFC 1918 IPv4 addresses. The bridge forwards only `workspace.list`, `session.list`, `session.history`, `session.create`, `session.prompt`, and `session.cancel` to the main DSH gateway, verifies the RPC id, limits request bodies to 64 KiB, and rejects cross-origin RPC posts.

The Web profile registers this package as disabled by default. Unloading the plugin closes the listener, clears pairing requests and sessions, and withdraws the Remote service.

## Model Experience

None, as the service only forwards explicit user actions to existing session methods and registers no prompt, tool, message transform, or provider request.

#### KV Cache effect

None; this package never assembles model input.

## Known Limitations and Deferred Work

- **Private-network HTTP only** - the listener does not terminate TLS. Use it only on a trusted local network; an untrusted or routed network requires a TLS reverse proxy and stronger deployment authentication.
- **One active phone** - approving a new phone invalidates the previous session. Multi-device session management is intentionally deferred.
- **IPv4 LAN discovery** - the advertised pairing URL selects an RFC 1918 IPv4 address; IPv6 LAN discovery is not implemented.
- **No QR code dependency** - the current settings page displays and opens the pairing URL. A separate UI plugin can add QR rendering without changing the Host security boundary.
