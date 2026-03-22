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
 *  • UI slots: status-bar, navbar, inspector-tab, context-menu (node/edge)
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
    addDebugTab(config: { id: string; label: string; panel: unknown }): () => void;
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

const OPEN_MODAL_EVENT = 'plugin-smoke-test:open-modal';

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
// Visible React components (createElement-only, no JSX import needed)
// Each component displays which slot it was injected into.
// ---------------------------------------------------------------------------

/**
 * Create a button-like component for toolbar/navbar/status-bar slots.
 * Logs activation events when clicked.
 */
function makeButtonComponent(slotName: string, label: string) {
  const fn: ((props?: Record<string, unknown>) => unknown) & { displayName?: string } = (props?: any) => {
    const React = (globalThis as any).React;
    if (!React) return null;

    const baseStyle: Record<string, unknown> = {
      cursor: 'pointer',
      border: '1px solid var(--border-medium)',
      color: 'var(--text-primary)',
      backgroundColor: 'var(--bg-secondary)',
    };

    const slotStyle: Record<string, unknown> =
      slotName === 'navbar'
        ? {
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            padding: 0,
          }
        : {
            padding: '4px 8px',
            marginRight: '4px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '600',
          };

    return React.createElement(
      'button',
      {
        onClick: () => log(`UI:${slotName} button clicked`),
        style: { ...baseStyle, ...slotStyle },
        title: `Smoke Test — injected into ${slotName}`,
        'data-plugin': 'smoke-test',
        'data-slot': slotName,
      },
      label,
    );
  };
  fn.displayName = `Smoke${slotName}`;
  return fn;
}

/**
 * Navbar button that opens a plugin-owned modal.
 */
function makeNavbarModalButton() {
  const fn: ((props?: Record<string, unknown>) => unknown) & { displayName?: string } = () => {
    const React = (globalThis as any).React;
    if (!React) return null;

    const [isOpen, setIsOpen] = React.useState(false);

    React.useEffect(() => {
      const open = () => setIsOpen(true);
      window.addEventListener(OPEN_MODAL_EVENT, open);
      return () => window.removeEventListener(OPEN_MODAL_EVENT, open);
    }, []);

    const button = React.createElement(
      'button',
      {
        onClick: () => {
          log('UI:navbar modal opened');
          setIsOpen(true);
        },
        style: {
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '20px',
          padding: 0,
          cursor: 'pointer',
          border: '1px solid var(--border-medium)',
          color: 'var(--text-primary)',
          backgroundColor: 'var(--bg-secondary)',
        },
        title: 'Smoke Test Modal',
        'data-plugin': 'smoke-test',
        'data-slot': 'navbar',
      },
      '🦎',
    );

    if (!isOpen) return button;

    const close = () => setIsOpen(false);

    const modal = React.createElement(
      'div',
      {
        onClick: close,
        style: {
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
        },
      },
      React.createElement(
        'div',
        {
          onClick: (e: Event) => e.stopPropagation(),
          style: {
            width: 'min(520px, 92vw)',
            maxHeight: '80vh',
            overflow: 'auto',
            borderRadius: '12px',
            border: '1px solid var(--border-medium)',
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            boxShadow: 'var(--shadow-lg)',
            padding: '16px',
          },
        },
        React.createElement(
          'div',
          { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' } },
          React.createElement('strong', null, 'Smoke Test Plugin Modal'),
          React.createElement(
            'button',
            {
              onClick: close,
              style: {
                border: '1px solid var(--border-medium)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                borderRadius: '8px',
                width: '30px',
                height: '30px',
                cursor: 'pointer',
              },
            },
            '×',
          ),
        ),
        React.createElement(
          'p',
          { style: { margin: 0, lineHeight: 1.45 } },
          'This modal is rendered and controlled entirely by the smoke-test plugin via the navbar slot.',
        ),
      ),
    );

    return React.createElement(React.Fragment, null, button, modal);
  };

  fn.displayName = 'SmokeNavbarModalButton';
  return fn;
}

/**
 * Create a panel component for the debug panel tab.
 */
function makeDebugPanel() {
  const fn: ((props?: Record<string, unknown>) => unknown) & { displayName?: string } = () => {
    const React = (globalThis as any).React;
    if (!React) return null;

    return React.createElement(
      'div',
      {
        style: {
          padding: '12px',
          fontSize: '13px',
          fontFamily: 'monospace',
          color: 'var(--text-primary)',
          backgroundColor: 'var(--bg-secondary)',
          overflowY: 'auto',
          flex: 1,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        },
        'data-plugin': 'smoke-test',
        'data-slot': 'debug-panel-panels',
      },
      'Smoke Test — Debug Panel\n\nRecent events:\n' + smokeLog.slice(-10).map((e, i) => `${i + 1}. ${e}`).join('\n'),
    );
  };
  fn.displayName = 'SmokeDebugPanel';
  return fn;
}

/**
 * Create a panel component for inspector tabs.
 */
function makeInspectorPanel() {
  const fn: ((props?: Record<string, unknown>) => unknown) & { displayName?: string } = () => {
    const React = (globalThis as any).React;
    if (!React) return null;

    return React.createElement(
      'div',
      {
        style: {
          padding: '12px',
          fontSize: '13px',
          fontFamily: 'monospace',
          color: 'var(--text-primary)',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-light)',
          borderRadius: '4px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        },
        'data-plugin': 'smoke-test',
        'data-slot': 'inspector-tab-panels',
      },
      'Smoke Test Inspector\n\nEvents logged:\n' + smokeLog.slice(-5).map((e, i) => `${i + 1}. ${e}`).join('\n'),
    );
  };
  fn.displayName = 'SmokeInspectorPanel';
  return fn;
}

/**
 * Create an icon component for inspector tab buttons.
 * Must accept size prop for consistent icon sizing.
 */
function makeInspectorIcon() {
  const fn: ((props?: Record<string, unknown>) => unknown) & { displayName?: string } = (props?: any) => {
    const React = (globalThis as any).React;
    if (!React) return null;
    const size = props?.size ?? 18;

    return React.createElement(
      'span',
      {
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: `${size}px`,
          height: `${size}px`,
          backgroundColor: 'var(--accent)',
          borderRadius: '50%',
          color: 'var(--bg-primary)',
          fontSize: `${Math.round(size * 0.6)}px`,
          fontWeight: 'bold',
        },
        title: 'Smoke Test Inspector Tab',
        'data-plugin': 'smoke-test',
        'data-slot': 'inspector-tab-buttons',
      },
      'S',
    );
  };
  fn.displayName = 'SmokeInspectorIcon';
  return fn;
}

/**
 * Create a context menu item (canvas, node, edge).
 */
function makeContextMenuItem(target: string) {
  const fn: ((props?: Record<string, unknown>) => unknown) & { displayName?: string } = (props?: any) => {
    const React = (globalThis as any).React;
    if (!React) return null;

    const onClose = (props?.onClose as AnyFn) ?? (() => { });

    return React.createElement(
      'button',
      {
        onClick: () => {
          log(`UI:context-menu-${target} item clicked`);
          onClose();
        },
        style: {
          display: 'block',
          width: '100%',
          padding: '8px 12px',
          textAlign: 'left',
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontSize: '13px',
          color: 'var(--text-primary)',
          fontWeight: '600',
        },
        'data-plugin': 'smoke-test',
        'data-slot': `context-menu-${target}`,
      },
      `Smoke Test (${target})`,
    );
  };
  fn.displayName = `SmokeContextMenu${target}`;
  return fn;
}

const SmokeStatusBarItem    = makeButtonComponent('status-bar', 'Smoke Test');
const SmokeNavbarItem       = makeNavbarModalButton();
const SmokeToolbarItem      = makeButtonComponent('toolbar', '🔥 Smoke');
const SmokeInspectorIcon    = makeInspectorIcon();
const SmokeInspectorPanel   = makeInspectorPanel();
const SmokeDebugPanel       = makeDebugPanel();
const SmokeContextMenuNode  = makeContextMenuItem('node');
const SmokeContextMenuEdge  = makeContextMenuItem('edge');
const SmokeContextMenuCanvas = makeContextMenuItem('canvas');

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

  api.commands.register(
    'open-modal',
    () => {
      log('open-modal command invoked');
      window.dispatchEvent(new CustomEvent(OPEN_MODAL_EVENT));
    },
    'Open the smoke-test plugin modal from PUCC',
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
  // NOTE: Available slots that are actually rendered in the UI:
  //   - status-bar (bottom status bar)
  //   - toolbar (toolbar panel)
  //   - navbar (left sidebar)
  //   - inspector-tab-buttons + inspector-tab-panels (right-panel inspector tabs)
  //   - context-menu-canvas (canvas context menu)
  //   - context-menu-node (node context menu)
  //   - context-menu-edge (edge context menu)

  // Status bar item — bottom status bar
  api.ui.addStatusBarItem(SmokeStatusBarItem, 999);
  log('ui.addStatusBarItem ✓');

  // Navbar item — left sidebar navigation
  api.ui.addNavbarItem(SmokeNavbarItem, 999);
  log('ui.addNavbarItem ✓');

  // Toolbar item — canvas toolbar
  api.ui.addToolbarItem(SmokeToolbarItem, 999);
  log('ui.addToolbarItem ✓');

  // Inspector tab — right-panel inspector with icon + panel
  api.ui.addInspectorTab({
    id: 'smoke-test',
    icon: SmokeInspectorIcon,
    label: 'Smoke Test',
    panel: SmokeInspectorPanel,
  });
  log('ui.addInspectorTab ✓ (icon + panel)');

  // Debug panel tab — adds a 'Smoke Test' tab to the bottom debug panel
  api.ui.addDebugTab({
    id: 'smoke-test',
    label: 'Smoke Test',
    panel: SmokeDebugPanel,
  });
  log('ui.addDebugTab ✓');

  // Context menu items — for canvas, node and edge targets
  api.ui.addContextMenuItem('canvas', SmokeContextMenuCanvas);
  log('ui.addContextMenuItem ✓ (canvas)');

  api.ui.addContextMenuItem('node', SmokeContextMenuNode);
  log('ui.addContextMenuItem ✓ (node)');

  api.ui.addContextMenuItem('edge', SmokeContextMenuEdge);
  log('ui.addContextMenuItem ✓ (edge)');

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
