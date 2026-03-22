import { describe, it, expect, vi, beforeEach } from 'vitest';
import { manifest, register, dispose, smokeLog } from './index.js';

// ---------------------------------------------------------------------------
// Mock PluginAPI factory
// ---------------------------------------------------------------------------

function makeMockHook() {
  return { tap: vi.fn() };
}

function makeMockAPI() {
  return {
    hooks: {
      beforeFlowExecute:     makeMockHook(),
      afterFlowExecute:      makeMockHook(),
      beforeNodeExecute:     makeMockHook(),
      afterNodeExecute:      makeMockHook(),
      onFlowValidate:        makeMockHook(),
      modifyNodeDefinitions: makeMockHook(),
      onSettingsChange:      makeMockHook(),
      onThemeChange:         makeMockHook(),
    },
    ui: {
      registerSlot:       vi.fn(() => vi.fn()),
      addInspectorTab:    vi.fn(() => vi.fn()),
      addDebugTab:        vi.fn(() => vi.fn()),
      addToolbarItem:     vi.fn(() => vi.fn()),
      addContextMenuItem: vi.fn(() => vi.fn()),
      addNavbarItem:      vi.fn(() => vi.fn()),
      addStatusBarItem:   vi.fn(() => vi.fn()),
    },
    engine: {
      subscribe:        vi.fn(() => vi.fn()),
      registerNodeType: vi.fn(() => Promise.resolve()),
      removeNodeType:   vi.fn(() => Promise.resolve()),
    },
    commands: {
      register: vi.fn(() => vi.fn()),
    },
    settings: {
      get:       vi.fn(() => ({ settings: { theme: 'dark', language: 'en' } })),
      update:    vi.fn(),
      subscribe: vi.fn(() => vi.fn()),
    },
    events: {
      emit: vi.fn(),
      on:   vi.fn(() => vi.fn()),
    },
  };
}

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

describe('manifest', () => {
  it('has the correct name', () => {
    expect(manifest.name).toBe('plugin-smoke-test');
  });

  it('has a semver version', () => {
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('declares all exercised capabilities', () => {
    const required = ['ui', 'engine', 'commands', 'settings', 'events'];
    for (const cap of required) {
      expect(manifest.capabilities).toContain(cap);
    }
  });

  it('specifies apiVersion', () => {
    expect(typeof manifest.apiVersion).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// Module shape
// ---------------------------------------------------------------------------

describe('module exports', () => {
  it('exports register as a function', () => {
    expect(typeof register).toBe('function');
  });

  it('exports dispose as an async function', () => {
    expect(typeof dispose).toBe('function');
    expect(dispose()).toBeInstanceOf(Promise);
  });

  it('exports smokeLog as an array', () => {
    expect(Array.isArray(smokeLog)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// register()
// ---------------------------------------------------------------------------

describe('register()', () => {
  let api: ReturnType<typeof makeMockAPI>;

  beforeEach(async () => {
    // Reset dispose between tests
    await dispose();
    api = makeMockAPI();
  });

  it('does not throw', () => {
    expect(() => register(api as any)).not.toThrow();
  });

  it('registers smoke-test and open-modal commands', () => {
    register(api as any);
    expect(api.commands.register).toHaveBeenCalledWith(
      'smoke-test',
      expect.any(Function),
      expect.any(String),
    );
    expect(api.commands.register).toHaveBeenCalledWith(
      'open-modal',
      expect.any(Function),
      expect.any(String),
    );
  });

  it('taps all 8 hooks', () => {
    register(api as any);
    const hooks = [
      'beforeFlowExecute',
      'afterFlowExecute',
      'beforeNodeExecute',
      'afterNodeExecute',
      'onFlowValidate',
      'modifyNodeDefinitions',
      'onSettingsChange',
      'onThemeChange',
    ] as const;
    for (const h of hooks) {
      expect(api.hooks[h].tap).toHaveBeenCalled();
    }
  });

  it('subscribes to engine state', () => {
    register(api as any);
    expect(api.engine.subscribe).toHaveBeenCalledWith(expect.any(Function));
  });

  it('registers the custom smoke-test:ping node type', async () => {
    register(api as any);
    // registerNodeType is async — wait for the microtask
    await Promise.resolve();
    expect(api.engine.registerNodeType).toHaveBeenCalledWith(
      expect.objectContaining({ typeKey: 'smoke-test:ping' }),
    );
  });

  it('sets up event listeners and emits the initial ping', () => {
    register(api as any);
    expect(api.events.on).toHaveBeenCalled();
    expect(api.events.emit).toHaveBeenCalledWith('smoke-test:ping', expect.objectContaining({ timestamp: expect.any(Number) }));
  });

  it('calls settings.get and settings.subscribe', () => {
    register(api as any);
    expect(api.settings.get).toHaveBeenCalled();
    expect(api.settings.subscribe).toHaveBeenCalled();
  });

  it('registers all UI slots', () => {
    register(api as any);
    expect(api.ui.addStatusBarItem).toHaveBeenCalled();
    expect(api.ui.addNavbarItem).toHaveBeenCalled();
    expect(api.ui.addToolbarItem).toHaveBeenCalled();
    expect(api.ui.addInspectorTab).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'smoke-test', label: 'Smoke Test' }),
    );
    expect(api.ui.addDebugTab).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'smoke-test', label: 'Smoke Test' }),
    );
    // Called for 'canvas', 'node', and 'edge' targets
    expect(api.ui.addContextMenuItem).toHaveBeenCalledTimes(3);
    expect(api.ui.addContextMenuItem).toHaveBeenCalledWith('canvas', expect.any(Function));
    expect(api.ui.addContextMenuItem).toHaveBeenCalledWith('node', expect.any(Function));
    expect(api.ui.addContextMenuItem).toHaveBeenCalledWith('edge', expect.any(Function));
  });

  it('populates smokeLog with registration events', () => {
    register(api as any);
    expect(smokeLog.length).toBeGreaterThan(0);
    expect(smokeLog.some(e => e.includes('register() complete'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Hook behaviour
// ---------------------------------------------------------------------------

describe('hook tap functions', () => {
  let api: ReturnType<typeof makeMockAPI>;

  beforeEach(async () => {
    await dispose();
    api = makeMockAPI();
    register(api as any);
  });

  it('beforeFlowExecute tap logs the node count', () => {
    const [[, tapFn]] = api.hooks.beforeFlowExecute.tap.mock.calls;
    tapFn({ nodes: [1, 2, 3] });
    expect(smokeLog.some(e => e.includes('beforeFlowExecute') && e.includes('3'))).toBe(true);
  });

  it('onFlowValidate tap bails with an error for empty flows', () => {
    const [[, tapFn]] = api.hooks.onFlowValidate.tap.mock.calls;
    const result = tapFn({ nodes: [] });
    expect(typeof result).toBe('string');
  });

  it('onFlowValidate tap returns undefined for non-empty flows', () => {
    const [[, tapFn]] = api.hooks.onFlowValidate.tap.mock.calls;
    const result = tapFn({ nodes: [1] });
    expect(result == null).toBe(true);
  });

  it('beforeNodeExecute tap returns the context unchanged', () => {
    const [[, tapFn]] = api.hooks.beforeNodeExecute.tap.mock.calls;
    const ctx = { nodeId: 'node-1', inputs: {} };
    expect(tapFn(ctx)).toBe(ctx);
  });

  it('modifyNodeDefinitions tap returns the array unchanged', () => {
    const [[, tapFn]] = api.hooks.modifyNodeDefinitions.tap.mock.calls;
    const defs = [{ typeKey: 'existing' }];
    expect(tapFn(defs)).toBe(defs);
  });
});

// ---------------------------------------------------------------------------
// dispose()
// ---------------------------------------------------------------------------

describe('dispose()', () => {
  it('calls engine.removeNodeType for the smoke node', async () => {
    const api = makeMockAPI();
    register(api as any);
    await dispose();
    expect(api.engine.removeNodeType).toHaveBeenCalledWith('smoke-test:ping');
  });

  it('clears the smokeLog after disposal', async () => {
    const api = makeMockAPI();
    register(api as any);
    expect(smokeLog.length).toBeGreaterThan(0);
    await dispose();
    expect(smokeLog.length).toBe(0);
  });

  it('is safe to call multiple times without throwing', async () => {
    const api = makeMockAPI();
    register(api as any);
    await dispose();
    await expect(dispose()).resolves.not.toThrow();
  });
});
