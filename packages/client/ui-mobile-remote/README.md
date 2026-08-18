# @deepseek-ai/dsh-client-ui-mobile-remote

English | [中文](README.zh.md)

Settings contribution for the optional `@deepseek-ai/dsh-host-mobile-remote` service. The browser plugin mounts the generated Remote namespace and injects an independent `settings.section` entry for status, pairing-link rotation, loopback approval, and phone disconnection. It does not patch the Settings, Sidebar, or Conversation packages.

The component receives a snapshot hook and plain callbacks; its controller owns every Remote call and the loopback management-page launch. The Web profile registers the package as disabled by default. Unloading it removes both the settings entry and the generated Remote namespace.

## Model Experience

None, as this package only renders phone-pairing controls and does not alter prompts, tools, messages, provider requests, or model-visible session state.

#### KV Cache effect

None; this package never assembles model input.

## Known Limitations and Deferred Work

- **No embedded QR renderer** - the settings section shows the pairing URL and opens the Host-owned approval page; QR presentation can be added as a separate UI contribution.
- **Host service required** - enabling this browser row without the Host row leaves its generated Remote namespace unavailable.
- **Browser popup policy** - opening the management page depends on a direct user gesture and the browser's popup policy.
