import type { DiffItem } from '../types';

export interface RemoteParam {
  path: string;
  value: string;
  description?: string | null;
  lastModified?: Date;
  isSecure?: boolean;
}

export interface LocalParam {
  path: string;
  value: string | null;
  keyId: number;
  environmentId: number;
  isSecure?: boolean;
  description?: string | null;
}

/**
 * Computes the diff between local parameters and remote (Parameter Store) parameters.
 *
 * - New local keys not in remote   → 'create'
 * - Local keys with different value → 'update'
 * - Remote keys not in local        → 'delete'
 *
 * Local null values are excluded (SSM requires value length >= 1).
 * Callers should filter null/unset entries before calling, but this is a safety guard.
 */
export function computeDiff(
  local: LocalParam[],
  remote: RemoteParam[]
): DiffItem[] {
  const diff: DiffItem[] = [];

  const remoteMap = new Map<string, RemoteParam>();
  for (const r of remote) {
    remoteMap.set(r.path, r);
  }

  const localMap = new Map<string, LocalParam>();
  for (const l of local) {
    if (l.value === null) continue; // SSM requires value length >= 1
    localMap.set(l.path, l);
  }

  // Check local → remote (creates and updates)
  for (const [path, local] of localMap) {
    const localVal = local.value!;
    const remote = remoteMap.get(path);
    if (!remote) {
      diff.push({
        action: 'create',
        path,
        localValue: localVal,
        keyId: local.keyId,
        environmentId: local.environmentId,
        isSecure: local.isSecure,
        description: local.description,
      });
    } else if (remote.value !== localVal || !!local.isSecure !== !!remote.isSecure) {
      diff.push({
        action: 'update',
        path,
        localValue: localVal,
        remoteValue: remote.value,
        remoteLastModified: remote.lastModified,
        keyId: local.keyId,
        environmentId: local.environmentId,
        isSecure: local.isSecure,
        description: local.description,
      });
    }
  }

  // Check remote → local (deletes: remote has it, local doesn't)
  for (const [path, remote] of remoteMap) {
    if (!localMap.has(path)) {
      diff.push({
        action: 'delete',
        path,
        remoteValue: remote.value,
        remoteLastModified: remote.lastModified,
      });
    }
  }

  // Sort: creates first, then updates, then deletes
  const order: Record<DiffItem['action'], number> = { create: 0, update: 1, delete: 2 };
  diff.sort((a, b) => order[a.action] - order[b.action] || a.path.localeCompare(b.path));

  return diff;
}

/**
 * Computes the diff from SSM's perspective for a Pull operation.
 * SSM (remote) is the source of truth.
 *
 * - Remote has key, local doesn't                      → 'create' (set locally)
 * - Both have key but values differ (null treated as "") → 'update' (remote value wins)
 * - Local has key (any value), remote doesn't           → 'delete' (remove locally)
 */
export function computePullDiff(
  remote: RemoteParam[],
  local: LocalParam[]
): DiffItem[] {
  const diff: DiffItem[] = [];

  const remoteMap = new Map<string, RemoteParam>();
  for (const r of remote) {
    remoteMap.set(r.path, r);
  }

  const localMap = new Map<string, LocalParam>();
  for (const l of local) {
    localMap.set(l.path, l);
  }

  // Check remote → local (creates and updates)
  for (const [path, r] of remoteMap) {
    const l = localMap.get(path);
    if (!l) {
      // No local record at all → create
      diff.push({
        action: 'create',
        path,
        remoteValue: r.value,
        description: r.description,
      });
    } else {
      // Local record exists — compare (null treated as "")
      const localVal = l.value ?? '';
      if (r.value !== localVal) {
        diff.push({
          action: 'update',
          path,
          remoteValue: r.value,
          localValue: l.value,
          keyId: l.keyId,
          environmentId: l.environmentId,
          description: r.description,
        });
      }
    }
  }

  // Check local → remote (deletes: local has record, remote doesn't)
  for (const [path, l] of localMap) {
    if (!remoteMap.has(path)) {
      diff.push({
        action: 'delete',
        path,
        localValue: l.value,
        keyId: l.keyId,
        environmentId: l.environmentId,
      });
    }
  }

  // Sort: creates first, then updates, then deletes
  const order: Record<DiffItem['action'], number> = { create: 0, update: 1, delete: 2 };
  diff.sort((a, b) => order[a.action] - order[b.action] || a.path.localeCompare(b.path));

  return diff;
}
