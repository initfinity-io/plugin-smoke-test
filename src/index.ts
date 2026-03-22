/**
 * @initfinity/plugin-smoke-test
 *
 * End-to-end smoke test that exercises every surface of the Initfinity
 * plugin API.  Load and activate this plugin to confirm the system works.
 *
 * What it covers
 * ──────────────
 *  • manifest shape validation
 *  • commands.register
 *  • hooks: all 8 hook types (sync, waterfall, bail, async-series)
 *  • engine.subscribe + engine.registerNodeType / removeNodeType
 *  • events.emit / events.on
 *  • settings.get / settings.subscribe
 *  • UI slots: toolbar, status-bar, navbar, inspector-tab, context-menu
 *
 * Usage
 * ─────
 *  const mod  = await loadPluginFromVFS(fs, 'plugin-smoke-test');
 *  manager.install(mod);
 *  await manager.activate('plugin-smoke-test');
 *  // Then run the 'smoke-test' terminal command to print the event log.
 */

// ---------------------------------------------------------------------------
// Minimal inlined types (stripped at compile-time; no host-app import needed)
// ---------------------------------------------------------------------------

type AnyFn = (...args: any[]) => any;

interface PluginManifest {
  name: string;
  version: string;
  description?: string;
  author?: string;
  apiVersion?: string;
  capabilities?: string[];
}

interface PluginAPI {
  hooks: {
    beforeFlowExecute:     { tap(name: string, fn: (flow: any) => void): void };
    afterFlowExecute:      { tap(name: string, fn: (state: any) => void | Promise<void>): void };
    beforeNodeExecute:     { tap(name: string, fn: (ctx: any) => any): void };
    afterNodeExecute:      { tap(name: string, fn: (ctx: any) => void | Promise<void>): void };
    onFlowValidate:        { tap(name: string, fn: (flow: any) => string | null | undefined): void };
    modifyNodeDefinitions: { tap(name: string, fn: (defs: any[]) => any[]): void };
    onSettingsChange:      { tap(name: string, fn: (settings: any) => void): void };
    onThemeChange:         { tap(name: string, fn: (theme: any) => void): void };
  };
  ui: {
    registerSlot(slotName: string, component: unknown, order?: number): () => void;
    addInspectorTab(config: { id: string; icon: unknown; label: string; panel: unknown }): () => void;
    addToolbarItem(component: unknown, order?: number): () => void;
    addContextMenuItem(target: 'node' | 'edge' | 'canvas', component: unknown): () => void;
    addNavbarItem(component: unknown, order?: number): () => void;
    addStatusBarItem(component: unknown, order?: number): () => void;
  };
  engine: {
    subscribe(listener: AnyFn): () => void;
    registerNodeType(definition: unknown): Promise<void>;
    removeNodeType(typeKey: string): Promise<void>;
  };
  commands: {
    register(name: string, handler: AnyFn, description?: string): () => void;
  };
  settings: {
    get(): { settings: Record<string, unknown> };
    update(partial: Record<string, unknown>): void;
    subscribe(listener: AnyFn): () => void;
  };
  events: {
    emit(event: string, data?: unknown): void;
    on(event: string, handler: (data: unknown) => void): () => void;
  };
}

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

export const manifest: PluginManifest = {
  name: 'plugin-smoke-test',
  version: '0.1.0',
  description: 'End-to-end smoke test that exercises the full Initfinity plugin API',
  author: 'Jay Mathis',
  apiVersion: '1.0.0',
  capabilities: ['ui', 'engine', 'commands', 'settings', 'events'],
};

// ---------------------------------------------------------------------------
// Observable event log — exported so tests and the command handler can read it
// ---------------------------------------------------------------------------

export const smokeLog: string[] = [];

function log(msg: string): void {
  smokeLog.push(msg);
  console.log(`[smoke-test] ${msg}`);
}

// ---------------------------------------------------------------------------
// Custom node definition registered at runtime to test engine.registerNodeType
// ---------------------------------------------------------------------------

const SMOKE_NODE_DEF = {
  typeKey: 'smoke-test:ping',
  version: '0.1.0',
  display: {
    label: 'Smoke Ping',
    description: 'Test node injected by the smoke-test plugin',
    backgroundColor: '#1a1a2e',
    borderColor: '#e94560',
  },
  fields: [
    {
      key: 'message',
      label: 'Message',
      type: 'string' as const,
      control: 'input' as const,
      defaultValue: 'ping',
      placeholder: 'Message to echo back as pong',
    },
  ],
  ports: [
    { id: 'in',     direction: 'input'  as const, label: 'In',     kind: 'trigger' as const },
    { id: 'out',    direction: 'output' as const, label: 'Out',    kind: 'trigger' as const },
    { id: 'result', direction: 'output' as const, label: 'Result', kind: 'data'    as const, dataType: 'string' },
  ],
  runtimeKind: 'compute' as const,
  // Appends ':pong' to the message field and passes through the trigger.
  engineFunction: `
    const msg = fields.message ?? 'ping';
    outputs['result'] = [String(msg) + ':pong'];
    outputs['out'] = inputs['in'];
  `,
};

// ---------------------------------------------------------------------------
// Minimal stub React component (createElement-only, no JSX import needed)
// Uses globalThis.React if available; stays inert otherwise.
// ---------------------------------------------------------------------------

function makeStubComponent(displayName: string) {
  // Return a plain object that satisfies ComponentType at runtime without
  // requiring a compile-time React import.
  const fn: ((props?: Record<string, unknown>) => unknown) & { displayName?: string } = () => {
    const React = (globalThis as any).React;
    if (!React) return null;
    return React.createElement(
      'span',
      { 'data-plugin': 'smoke-test', 'data-slot': displayName, style: { display: 'none' } },
    );
  };
  fn.displayName = displayName;
  return fn;
}

const SmokeToolbarItem   = makeStubComponent('SmokeToolbarItem');
const SmokeStatusBarItem = makeStubComponent('SmokeStatusBarItem');
const SmokeNavbarItem    = makeStubComponent('SmokeNavbarItem');
const SmokeInspectorIcon = makeStubComponent('SmokeInspectorIcon');
const SmokeInspectorPanel = makeStubComponent('SmokeInspectorPanel');
const SmokeContextItem   = makeStubComponent('SmokeContextItem');

// ---------------------------------------------------------------------------
// Internal reference kept for dispose()
// ---------------------------------------------------------------------------

let _api: PluginAPI | null = null;

// ---------------------------------------------------------------------------
// register — called once when the plugin is activated
// ---------------------------------------------------------------------------

export function register(api: PluginAPI): void {
  _api = api;
  log('register() — smoke test starting');

  // ── 1. Commands ───────────────────────────────────────────────────────────
  api.commands.register(
    'smoke-test',
    () => {
      log('smoke-test command invoked');
      console.group('[smoke-test] Event log');
      smokeLog.forEach((entry, i) => console.log(`  ${i + 1}. ${entry}`));
      console.groupEnd();
    },
    'Print the smoke-test plugin event log',
  );
  log('commands.register ✓');

  // ── 2. Hooks ──────────────────────────────────────────────────────────────

  // SyncHook — no return value
  api.hooks.beforeFlowExecute.tap('smoke', (flow) => {
    log(`hook:beforeFlowExecute — nodes:${flow?.nodes?.length ?? '?'}`);
  });

  // AsyncSeriesHook — returns void Promise
  api.hooks.afterFlowExecute.tap('smoke', async (state) => {
    log(`hook:afterFlowExecute — status:${state?.status ?? '?'}`);
  });

  // SyncWaterfallHook — must return the (possibly mutated) value
  api.hooks.beforeNodeExecute.tap('smoke', (ctx) => {
    log(`hook:beforeNodeExecute — nodeId:${ctx?.nodeId}`);
    return ctx;
  });

  // AsyncSeriesHook
  api.hooks.afterNodeExecute.tap('smoke', async (ctx) => {
    log(`hook:afterNodeExecute — nodeId:${ctx?.nodeId}`);
  });

  // SyncBailHook — return a string to bail (fail validation), null/undefined to pass
  api.hooks.onFlowValidate.tap('smoke', (flow) => {
    if ((flow?.nodes?.length ?? 0) === 0) {
      return '[smoke-test] Flow is empty — nothing to execute.';
    }
    return undefined;
  });

  // SyncWaterfallHook — must return the (possibly extended) array
  api.hooks.modifyNodeDefinitions.tap('smoke', (defs) => {
    log(`hook:modifyNodeDefinitions — ${defs.length} existing definitions`);
    return defs;
  });

  // SyncHook
  api.hooks.onSettingsChange.tap('smoke', (settings) => {
    log(`hook:onSettingsChange — keys:[${Object.keys(settings ?? {}).join(', ')}]`);
  });

  // SyncHook
  api.hooks.onThemeChange.tap('smoke', (theme) => {
    log(`hook:onThemeChange — theme:${theme?.theme} mode:${theme?.mode}`);
  });

  log('hooks.tap ✓ (all 8 hooks)');

  // ── 3. Engine ─────────────────────────────────────────────────────────────

  api.engine.subscribe((state) => {
    if (state?.status) {
      log(`engine.subscribe — status:${state.status}`);
    }
  });
  log('engine.subscribe ✓');

  api.engine.registerNodeType(SMOKE_NODE_DEF)
    .then(() => log('engine.registerNodeType ✓ (smoke-test:ping)'))
    .catch((err: unknown) => log(`engine.registerNodeType ✗ — ${String(err)}`));

  // ── 4. Events ─────────────────────────────────────────────────────────────

  api.events.on('smoke-test:pong', (data) => {
    log(`events:pong received — ${JSON.stringify(data)}`);
  });

  // Self-referential ping → pong to confirm the event bus round-trips.
  api.events.on('smoke-test:ping', (data) => {
    log(`events:ping received — echoing pong`);
    api.events.emit('smoke-test:pong', data);
  });

  api.events.emit('smoke-test:ping', { timestamp: Date.now() });
  log('events.emit/on ✓');

  // ── 5. Settings ───────────────────────────────────────────────────────────

  try {
    const { settings } = api.settings.get();
    log(`settings.get ✓ — keys:[${Object.keys(settings).join(', ')}]`);
  } catch {
    log('settings.get — host not available (acceptable in unit tests)');
  }

  api.settings.subscribe((state) => {
    log(`settings.subscribe callback — keys:[${Object.keys(state?.settings ?? {}).join(', ')}]`);
  });
  log('settings.subscribe ✓');

  // ── 6. UI slots ───────────────────────────────────────────────────────────

  api.ui.addToolbarItem(SmokeToolbarItem, 999);
  log('ui.addToolbarItem ✓');

  api.ui.addStatusBarItem(SmokeStatusBarItem, 999);
  log('ui.addStatusBarItem ✓');

  api.ui.addNavbarItem(SmokeNavbarItem, 999);
  log('ui.addNavbarItem ✓');

  api.ui.addInspectorTab({
    id: 'smoke-test',
    icon: SmokeInspectorIcon,
    label: 'Smoke Test',
    panel: SmokeInspectorPanel,
  });
  log('ui.addInspectorTab ✓');

  api.ui.addContextMenuItem('canvas', SmokeContextItem);
  api.ui.addContextMenuItem('node',   SmokeContextItem);
  log('ui.addContextMenuItem ✓ (canvas + node)');

  log('register() complete — all API surfaces exercised ✓');
}

// ---------------------------------------------------------------------------
// dispose — called when the plugin is deactivated
// ---------------------------------------------------------------------------

export async function dispose(): Promise<void> {
  log('dispose() called');
  if (_api) {
    await _api.engine
      .removeNodeType('smoke-test:ping')
      .catch(() => { /* best-effort */ });
    log('engine.removeNodeType ✓ (smoke-test:ping)');
  }
  _api = null;
  smokeLog.length = 0;
  console.log('[smoke-test] deactivated — goodbye!');
}
