# Agent Note: Web Settings manages profile packages and runtime plugins

Status: implemented

English | [中文](2026-08-16-plugin-management-settings.zh.md)

## Problem

DSH profiles can combine registry packages, GitHub dependencies, local links, installation-owned plugins, and Cordis builtins, but Web Settings previously exposed only a read-only projection of Loader entries. Users could not tell which direct dependency owned an installed artifact, where an external plugin came from, or whether a row was DSH-native, built in, external, or local. Updating a package still required forwarding pnpm arguments through `dsh plugin`, while enabling or disabling a Loader entry required hand-editing patch files despite Loader already supporting live updates.

Treating every Loader row as an independently installed package would be incorrect. A direct aggregate dependency can introduce several runtime modules, so updating a leaf module name could bypass the package that actually owns profile installation. Package replacement also changes files on disk and cannot make already imported JavaScript adopt the new artifact safely, while Loader enablement is an in-process lifecycle transition that can take effect immediately.

## Decision

The plugin-management Remote and Settings tab expose two explicit inventories. **Installed packages** come only from direct profile `dependencies`; each item reports the requested spec, installed version, registry/GitHub/local source, bundle membership, GitHub repository when declared by package metadata, and resolved local path when applicable. Only these package identities may be updated. **Runtime plugins** come from non-group `ctx.loader.entries()` and report their exact Loader identity, module/package facts, DSH-native/Cordis-built-in/external/local origin, effective enablement, lifecycle phase, and toggle eligibility.

One-click update is intentionally an update operation, not a general package manager. Registry dependencies run `pnpm outdated` and move to the latest release only when one exists; GitHub and other remote specs refresh their configured source; `link:`, `file:`, and `workspace:` dependencies stay read-only and point users to their source checkout. Commands run through the managed subprocess service without a shell, with serialized mutation, bounded output, a timeout, and package-name membership validation. Changed package files set `restartRequired` because the current DSH Web process has already imported its plugin graph.

Runtime enablement uses `ctx.loader.update()` for the immediate hot-plug transition and persists the desired boolean in the active profile manifest at `dsh.profile.entryStates[entryId]`. Boot projects that map into Loader patches after the profile and home user patch layers and before explicit command-line overlays, so the UI state survives restart without taking final authority away from an operator's launch overlay. A persistence failure rolls the live transition back. Structural tree carriers and the management control plane are not toggleable from this surface, preventing the page from detaching its own Remote, server, client runtime, or Settings dependencies.

## Alternatives considered

- **Model every Loader entry as an installed package** — rejected because aggregate bundles can own many leaf modules, package specifiers need not match Loader module names, and updating a leaf would mutate the wrong dependency boundary.
- **Rewrite `cordis.patch.yml` for each toggle** — rejected because those files hold user-authored full configuration patches and whole-config replacement semantics. A dedicated boolean map avoids rewriting or interpreting user YAML while retaining the same composition algorithm.
- **Apply package updates as runtime hot reloads** — rejected because pnpm can replace an arbitrary dependency graph and imported module state. A process restart is the honest boundary for adopting changed package artifacts.
- **Allow every row to disable itself** — rejected because disabling the Loader subtree or the management control plane can remove the very mechanism needed to restore it from the browser.

## Consequences

- Web Settings now lists direct installed packages separately from runtime plugins, displays source badges, GitHub links or local paths, and provides package update and runtime enablement controls at their correct ownership boundaries.
- External package updates are one click but not silent: the result distinguishes already-current from updated, and an updated result tells the user to restart DSH Web. Local plugins remain source-owned and require rebuilding in their checkout.
- Runtime toggles take effect immediately and survive restart. An enabled child under a disabled parent can remain effectively disabled; the Remote returns effective state and the UI explains that the desired child state was saved.
- The inventory remains point-in-time and does not subscribe to changes made elsewhere. The tab refreshes after its own update and patches its own toggle result; reopening or retrying obtains other changes.
- Package installation/removal, local repository pulls/builds, and durable failure history remain outside this management surface.
