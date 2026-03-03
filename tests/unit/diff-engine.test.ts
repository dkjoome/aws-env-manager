import { describe, it, expect } from 'vitest';
import { computeDiff, computePullDiff } from '../../src/lib/diff-engine';
import type { LocalParam, RemoteParam } from '../../src/lib/diff-engine';

function local(path: string, value: string | null, keyId = 1, environmentId = 1): LocalParam {
  return { path, value, keyId, environmentId };
}

function remote(path: string, value: string, lastModified?: Date, description?: string | null): RemoteParam {
  return { path, value, lastModified, description };
}

describe('computeDiff', () => {
  it('returns empty diff when both are empty', () => {
    expect(computeDiff([], [])).toEqual([]);
  });

  it('creates new params not in remote', () => {
    const diff = computeDiff([local('/ns/p/dev/KEY', 'abc')], []);
    expect(diff).toHaveLength(1);
    expect(diff[0].action).toBe('create');
    expect(diff[0].path).toBe('/ns/p/dev/KEY');
    expect(diff[0].localValue).toBe('abc');
  });

  it('updates params with different values', () => {
    const diff = computeDiff(
      [local('/ns/p/dev/KEY', 'new')],
      [remote('/ns/p/dev/KEY', 'old')]
    );
    expect(diff).toHaveLength(1);
    expect(diff[0].action).toBe('update');
    expect(diff[0].localValue).toBe('new');
    expect(diff[0].remoteValue).toBe('old');
  });

  it('preserves remoteLastModified on update', () => {
    const lastMod = new Date('2026-01-01');
    const diff = computeDiff(
      [local('/ns/p/dev/KEY', 'new')],
      [remote('/ns/p/dev/KEY', 'old', lastMod)]
    );
    expect(diff[0].remoteLastModified).toBe(lastMod);
  });

  it('no diff when values are equal', () => {
    const diff = computeDiff(
      [local('/ns/p/dev/KEY', 'same')],
      [remote('/ns/p/dev/KEY', 'same')]
    );
    expect(diff).toHaveLength(0);
  });

  it('deletes remote params not in local', () => {
    const diff = computeDiff([], [remote('/ns/p/dev/ORPHAN', 'val')]);
    expect(diff).toHaveLength(1);
    expect(diff[0].action).toBe('delete');
    expect(diff[0].path).toBe('/ns/p/dev/ORPHAN');
    expect(diff[0].remoteValue).toBe('val');
  });

  // null local values are excluded (SSM requires value length >= 1)
  it('skips null local value — no diff when remote also missing', () => {
    const diff = computeDiff([local('/ns/p/dev/KEY', null)], []);
    expect(diff).toHaveLength(0);
  });

  it('deletes remote when local value is null (null excluded → remote-only)', () => {
    const diff = computeDiff(
      [local('/ns/p/dev/KEY', null)],
      [remote('/ns/p/dev/KEY', 'old')]
    );
    expect(diff).toHaveLength(1);
    expect(diff[0].action).toBe('delete');
    expect(diff[0].remoteValue).toBe('old');
  });

  it('sorts: creates first, updates second, deletes last', () => {
    const diff = computeDiff(
      [
        local('/a', 'new'),
        local('/b', 'changed'),
      ],
      [
        remote('/b', 'old'),
        remote('/c', 'val'),
      ]
    );
    expect(diff[0].action).toBe('create');
    expect(diff[1].action).toBe('update');
    expect(diff[2].action).toBe('delete');
  });

  it('sorts alphabetically within same action type', () => {
    const diff = computeDiff(
      [local('/z', 'v'), local('/a', 'v')],
      []
    );
    expect(diff[0].path).toBe('/a');
    expect(diff[1].path).toBe('/z');
  });

  it('attaches keyId and environmentId to creates/updates', () => {
    const diff = computeDiff([local('/ns/p/dev/KEY', 'v', 42, 7)], []);
    expect(diff[0].keyId).toBe(42);
    expect(diff[0].environmentId).toBe(7);
  });

  it('does not attach keyId/environmentId to deletes', () => {
    const diff = computeDiff([], [remote('/ns/p/dev/KEY', 'v')]);
    expect(diff[0].keyId).toBeUndefined();
    expect(diff[0].environmentId).toBeUndefined();
  });

  it('carries local description on create', () => {
    const l: LocalParam = { path: '/ns/p/dev/KEY', value: 'val', keyId: 1, environmentId: 1, description: 'my desc' };
    const diff = computeDiff([l], []);
    expect(diff[0].description).toBe('my desc');
  });

  it('carries local description on update', () => {
    const l: LocalParam = { path: '/ns/p/dev/KEY', value: 'new', keyId: 1, environmentId: 1, description: 'updated' };
    const diff = computeDiff([l], [remote('/ns/p/dev/KEY', 'old')]);
    expect(diff[0].description).toBe('updated');
  });
});

describe('computePullDiff (SSM wins)', () => {
  it('returns empty diff when both are empty', () => {
    expect(computePullDiff([], [])).toEqual([]);
  });

  it('creates locally when only remote has the key', () => {
    const diff = computePullDiff([remote('/ns/p/dev/KEY', 'from-ssm')], []);
    expect(diff).toHaveLength(1);
    expect(diff[0].action).toBe('create');
    expect(diff[0].path).toBe('/ns/p/dev/KEY');
    expect(diff[0].remoteValue).toBe('from-ssm');
  });

  // null local compared as "" vs remote value
  it('updates locally when local value is null and remote is non-empty', () => {
    const diff = computePullDiff(
      [remote('/ns/p/dev/KEY', 'from-ssm')],
      [local('/ns/p/dev/KEY', null)]
    );
    expect(diff).toHaveLength(1);
    expect(diff[0].action).toBe('update');
    expect(diff[0].remoteValue).toBe('from-ssm');
    expect(diff[0].localValue).toBeNull();
  });

  it('no diff when local value is null and remote is empty string', () => {
    const diff = computePullDiff(
      [remote('/ns/p/dev/KEY', '')],
      [local('/ns/p/dev/KEY', null)]
    );
    expect(diff).toHaveLength(0);
  });

  it('no diff when both have the same value', () => {
    const diff = computePullDiff(
      [remote('/ns/p/dev/KEY', 'same')],
      [local('/ns/p/dev/KEY', 'same')]
    );
    expect(diff).toHaveLength(0);
  });

  it('updates locally when values differ (remote wins)', () => {
    const diff = computePullDiff(
      [remote('/ns/p/dev/KEY', 'ssm-value')],
      [local('/ns/p/dev/KEY', 'local-value', 5, 3)]
    );
    expect(diff).toHaveLength(1);
    expect(diff[0].action).toBe('update');
    expect(diff[0].remoteValue).toBe('ssm-value');
    expect(diff[0].localValue).toBe('local-value');
    expect(diff[0].keyId).toBe(5);
    expect(diff[0].environmentId).toBe(3);
  });

  it('deletes locally when only local has the key (non-null)', () => {
    const diff = computePullDiff([], [local('/ns/p/dev/KEY', 'local-only', 7, 2)]);
    expect(diff).toHaveLength(1);
    expect(diff[0].action).toBe('delete');
    expect(diff[0].path).toBe('/ns/p/dev/KEY');
    expect(diff[0].localValue).toBe('local-only');
    expect(diff[0].keyId).toBe(7);
    expect(diff[0].environmentId).toBe(2);
  });

  // null local record still exists → if remote doesn't have it, delete
  it('deletes locally when local value is null and remote is missing', () => {
    const diff = computePullDiff([], [local('/ns/p/dev/KEY', null, 7, 2)]);
    expect(diff).toHaveLength(1);
    expect(diff[0].action).toBe('delete');
    expect(diff[0].path).toBe('/ns/p/dev/KEY');
    expect(diff[0].localValue).toBeNull();
    expect(diff[0].keyId).toBe(7);
    expect(diff[0].environmentId).toBe(2);
  });

  it('does not attach keyId/environmentId to creates', () => {
    const diff = computePullDiff([remote('/ns/p/dev/KEY', 'v')], []);
    expect(diff[0].keyId).toBeUndefined();
    expect(diff[0].environmentId).toBeUndefined();
  });

  it('sorts: creates first, updates second, deletes last', () => {
    const diff = computePullDiff(
      [
        remote('/a', 'new'),
        remote('/b', 'changed'),
      ],
      [
        local('/b', 'old', 1, 1),
        local('/c', 'local-only', 2, 1),
      ]
    );
    expect(diff[0].action).toBe('create');
    expect(diff[1].action).toBe('update');
    expect(diff[2].action).toBe('delete');
  });

  it('sorts alphabetically within same action type', () => {
    const diff = computePullDiff(
      [remote('/z', 'v'), remote('/a', 'v')],
      []
    );
    expect(diff[0].path).toBe('/a');
    expect(diff[1].path).toBe('/z');
  });

  it('carries remote description on create', () => {
    const diff = computePullDiff(
      [remote('/ns/p/dev/KEY', 'val', undefined, 'API key desc')],
      []
    );
    expect(diff).toHaveLength(1);
    expect(diff[0].action).toBe('create');
    expect(diff[0].description).toBe('API key desc');
  });

  it('carries remote description on update', () => {
    const diff = computePullDiff(
      [remote('/ns/p/dev/KEY', 'new', undefined, 'updated desc')],
      [local('/ns/p/dev/KEY', 'old', 1, 1)]
    );
    expect(diff).toHaveLength(1);
    expect(diff[0].action).toBe('update');
    expect(diff[0].description).toBe('updated desc');
  });

  it('carries null description when remote has no description', () => {
    const diff = computePullDiff(
      [remote('/ns/p/dev/KEY', 'val')],
      []
    );
    expect(diff).toHaveLength(1);
    expect(diff[0].description).toBeUndefined();
  });
});
