# @initfinity/plugin-smoke-test

> End-to-end smoke test that exercises the full Initfinity plugin API.

Load and activate this plugin to confirm that every surface of the plugin system is wired up and working. It is generated from the `plugin` Turbo generator and serves as both a correctness check and a reference implementation.

## What it exercises

| API surface | Detail |
|---|---|
| `commands.register` | Registers a `smoke-test` terminal command that prints the event log |
| `hooks.beforeFlowExecute` | SyncHook — logs node count |
| `hooks.afterFlowExecute` | AsyncSeriesHook — logs execution status |
| `hooks.beforeNodeExecute` | SyncWaterfallHook — passes context through unchanged |
| `hooks.afterNodeExecute` | AsyncSeriesHook — logs node id |
| `hooks.onFlowValidate` | SyncBailHook — fails empty flows |
| `hooks.modifyNodeDefinitions` | SyncWaterfallHook — passes definitions through unchanged |
| `hooks.onSettingsChange` | SyncHook — logs changed setting keys |
| `hooks.onThemeChange` | SyncHook — logs theme/mode |
| `engine.subscribe` | Logs every execution-state change |
| `engine.registerNodeType` | Registers a custom `smoke-test:ping` compute node |
| `engine.removeNodeType` | Removes `smoke-test:ping` on dispose |
| `events.emit / events.on` | Ping → pong round-trip via the event bus |
| `settings.get` | Reads and logs current settings keys |
| `settings.subscribe` | Receives future settings change callbacks |
| `ui.addToolbarItem` | Injects a hidden `<span>` stub |
| `ui.addStatusBarItem` | Injects a hidden `<span>` stub |
| `ui.addNavbarItem` | Injects a hidden `<span>` stub |
| `ui.addInspectorTab` | Adds a "Smoke Test" inspector panel |
| `ui.addContextMenuItem` | Adds context items on both `canvas` and `node` targets |

## Usage

```js
import { loadPluginFromVFS } from '../src/plugins/plugin-loader';

const mod = await loadPluginFromVFS(fs, 'plugin-smoke-test');
manager.install(mod);
await manager.activate('plugin-smoke-test');

// Run the registered terminal command to dump the event log:
//   smoke-test
```

Or load from the built dist file:

```js
import { loadPluginFromURL } from '../src/plugins/plugin-loader';

const mod = await loadPluginFromURL('/plugins/plugin-smoke-test/dist/index.js');
manager.install(mod);
await manager.activate('plugin-smoke-test');
```

## Observing results

After activation, open the browser console. You should see lines like:

```
[smoke-test] register() — smoke test starting
[smoke-test] commands.register ✓
[smoke-test] hooks.tap ✓ (all 8 hooks)
[smoke-test] engine.subscribe ✓
[smoke-test] events:ping received — echoing pong
[smoke-test] events:pong received — {...}
[smoke-test] events.emit/on ✓
[smoke-test] settings.get ✓ — keys:[...]
[smoke-test] settings.subscribe ✓
[smoke-test] ui.addToolbarItem ✓
...
[smoke-test] register() complete — all API surfaces exercised ✓
[smoke-test] engine.registerNodeType ✓ (smoke-test:ping)
```

Run `smoke-test` in the terminal to reprint the full ordered event log at any time.

## Development

```bash
# Type-check
pnpm check-types

# Run tests
pnpm test

# Build (outputs dist/index.js for dynamic import)
pnpm build
```

## Scaffolding new plugins

This package was created with the `plugin` Turbo generator:

```bash
pnpm turbo gen plugin
```

See `turbo/generators/config.ts` for the generator definition and `turbo/generators/templates/plugin-*.hbs` for the templates.

## License

MIT
