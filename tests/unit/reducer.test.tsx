import { describe, it, expect } from 'vitest';
import { render, act } from '@testing-library/react';
import { AppProvider, useAppState, useAppDispatch } from '../../src/store/AppContext';

type AppDispatch = ReturnType<typeof useAppDispatch>;
import type { Namespace, Environment, Project, EnvKey, KeyValue, KeyLink, DiffItem } from '../../src/types';

// Helper: renders the AppProvider and captures state/dispatch
function renderApp() {
  let capturedState: ReturnType<typeof useAppState>['state'] | null = null;
  let capturedDispatch: ReturnType<typeof useAppDispatch> | null = null;

  function Probe() {
    const { state } = useAppState();
    const dispatch = useAppDispatch();
    capturedState = state;
    capturedDispatch = dispatch;
    return null;
  }

  render(
    <AppProvider>
      <Probe />
    </AppProvider>
  );

  return {
    getState: () => capturedState!,
    dispatch: (action: Parameters<AppDispatch>[0]) => {
      act(() => { capturedDispatch!(action); });
    },
  };
}

const ns: Namespace = { id: 1, name: 'ns', created_at: '', updated_at: '' };
const env: Environment = { id: 10, namespace_id: 1, name: 'dev', sort_order: 0 };
const proj: Project = { id: 100, namespace_id: 1, name: 'proj', created_at: '', updated_at: '' };
const key: EnvKey = { id: 1000, project_id: 100, name: 'K', description: null, note: null, is_secure: 0, is_locked: 0, created_at: '', updated_at: '' };
const kv: KeyValue = { id: 1, key_id: 1000, environment_id: 10, value: 'v', updated_at: '' };
const link: KeyLink = { id: 1, source_key_id: 1000, target_key_id: 1001, rule: 'eq', created_at: '' };
const diffItem: DiffItem = { action: 'create', path: '/a', localValue: 'v' };

describe('reducer — SET_NAMESPACES', () => {
  it('replaces the namespaces array', () => {
    const { getState, dispatch } = renderApp();
    dispatch({ type: 'SET_NAMESPACES', namespaces: [ns] });
    expect(getState().namespaces).toEqual([ns]);
  });
});

describe('reducer — SELECT_NAMESPACE', () => {
  it('sets selectedNamespaceId, environments, and projects', () => {
    const { getState, dispatch } = renderApp();
    dispatch({ type: 'SELECT_NAMESPACE', id: 1, environments: [env], projects: [proj] });
    const s = getState();
    expect(s.selectedNamespaceId).toBe(1);
    expect(s.environments).toEqual([env]);
    expect(s.projects).toEqual([proj]);
  });

  it('resets selectedProjectId, keys, keyValues, and keyLinks', () => {
    const { getState, dispatch } = renderApp();
    // First select a project so those fields are populated
    dispatch({ type: 'SELECT_PROJECT', id: 100, keys: [key], keyValues: [kv], keyLinks: [link] });
    expect(getState().selectedProjectId).toBe(100);

    // Now select a namespace — project-level state must be cleared
    dispatch({ type: 'SELECT_NAMESPACE', id: 1, environments: [env], projects: [proj] });
    const s = getState();
    expect(s.selectedProjectId).toBeNull();
    expect(s.keys).toHaveLength(0);
    expect(s.keyValues).toHaveLength(0);
    expect(s.keyLinks).toHaveLength(0);
  });
});

describe('reducer — SELECT_PROJECT', () => {
  it('sets selectedProjectId, keys, keyValues, keyLinks', () => {
    const { getState, dispatch } = renderApp();
    dispatch({ type: 'SELECT_PROJECT', id: 100, keys: [key], keyValues: [kv], keyLinks: [link] });
    const s = getState();
    expect(s.selectedProjectId).toBe(100);
    expect(s.keys).toEqual([key]);
    expect(s.keyValues).toEqual([kv]);
    expect(s.keyLinks).toEqual([link]);
  });

  it('clears project data when id is null', () => {
    const { getState, dispatch } = renderApp();
    dispatch({ type: 'SELECT_PROJECT', id: 100, keys: [key], keyValues: [kv], keyLinks: [link] });
    dispatch({ type: 'SELECT_PROJECT', id: null, keys: [], keyValues: [], keyLinks: [] });
    const s = getState();
    expect(s.selectedProjectId).toBeNull();
    expect(s.keys).toHaveLength(0);
  });
});

describe('reducer — SET_PENDING_DIFF / CLEAR_PENDING_DIFF', () => {
  it('sets and clears pendingDiff', () => {
    const { getState, dispatch } = renderApp();
    dispatch({ type: 'SET_PENDING_DIFF', diff: [diffItem] });
    expect(getState().pendingDiff).toHaveLength(1);
    dispatch({ type: 'CLEAR_PENDING_DIFF' });
    expect(getState().pendingDiff).toHaveLength(0);
  });
});

describe('reducer — SET_ERROR', () => {
  it('sets and clears the error', () => {
    const { getState, dispatch } = renderApp();
    dispatch({ type: 'SET_ERROR', error: 'oops' });
    expect(getState().error).toBe('oops');
    dispatch({ type: 'SET_ERROR', error: null });
    expect(getState().error).toBeNull();
  });
});

describe('reducer — SET_LOADING', () => {
  it('toggles isLoading', () => {
    const { getState, dispatch } = renderApp();
    dispatch({ type: 'SET_LOADING', loading: true });
    expect(getState().isLoading).toBe(true);
    dispatch({ type: 'SET_LOADING', loading: false });
    expect(getState().isLoading).toBe(false);
  });
});
