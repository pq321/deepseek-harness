# @deepseek-ai/dsh-client-ui-settings-plugin-inventory

English | [中文](README.zh.md)

Interactive **Plugin list** tab for Web Settings. The browser plugin registers one localized `settings.plugins.tab` contribution with id `all`; the Plugins section owns the navigation entry and tab chrome. It performs no Remote read during plugin activation. Selecting the tab for the first time mounts it and lazily calls `ctx.remote.pluginInventory.list()` through [`api-remotes`](../../api/remotes/README.md).

The tab renders one searchable catalog in two explicit groups. **Installed packages** are profile dependencies, tagged as external npm, external GitHub, or local installs. Details show the current version and requested source, link to GitHub when package metadata provides a repository, show the resolved path for local dependencies, and expose one **Check for updates** action for each remote package. **Update all external packages** runs the same operation sequentially for every update-supported dependency, skips local sources, continues after an individual failure, retains each package outcome, and finishes with updated/current/failed totals. A successful update refreshes the catalog and tells the user to restart DSH Web when the new files must be loaded.

**Runtime plugins** are Loader entries tagged as DSH native, Cordis built-in, external, or local. Details show exact module and entry identities, package version and repository/path facts when known, effective configuration, and Cordis phase. An accessible switch calls `setEnabled` for immediate Loader hot-plug and persisted restart state. Tree carriers and management control-plane entries show a locked switch with the reason; an enabled child beneath a disabled parent reports that its desired state was saved but is not yet effective.

Loading, empty, no-match, generic read failure, update status, and enablement failure states stay local to the mounted component. Failed inventory reads can be retried without exposing transport details. The registration uses `ctx.slots.inject()`, so it follows late tab declaration, redeclaration, locale changes, and teardown without importing the section owner.

## Model Experience

None, as this package only visualizes a Host-owned deployment snapshot in browser Settings and registers nothing model-facing.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **No live inventory subscription** — the tab refreshes after its own package updates and patches its own successful enablement result, but changes made elsewhere appear only after retrying or reopening Settings.
- **No package installation or removal** — local packages expose their source path and update guidance, while profile dependency creation/removal and local builds remain outside this tab.
