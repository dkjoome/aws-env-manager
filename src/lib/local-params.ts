import type { EnvKey, KeyValue, Environment } from '../types';
import { buildPath } from './path-builder';

export interface LocalParam {
  path: string;
  value: string | null;
  keyId: number;
  environmentId: number;
  isSecure?: boolean;
  description?: string | null;
}

/**
 * Builds the list of local parameters from keys, environments, and key-values.
 *
 * @param opts.skipNullValues  When true, entries with null value are excluded
 *                             (used for push/sync). When false, only entries
 *                             with no KV record at all are skipped (used for pull).
 * @param opts.includeMetadata When true, attaches isSecure and description
 *                             from the key (used for push/sync).
 */
export function buildLocalParams(
  namespaceName: string,
  projectName: string,
  keys: EnvKey[],
  environments: Environment[],
  keyValues: KeyValue[],
  opts: { skipNullValues: boolean; includeMetadata: boolean } = { skipNullValues: true, includeMetadata: true },
): LocalParam[] {
  const params: LocalParam[] = [];
  for (const key of keys) {
    for (const env of environments) {
      const kv = keyValues.find(
        (v) => v.key_id === key.id && v.environment_id === env.id,
      );
      if (!kv) continue;
      if (opts.skipNullValues && kv.value === null) continue;
      const entry: LocalParam = {
        path: buildPath(namespaceName, projectName, env.name, key.name),
        value: kv.value,
        keyId: key.id,
        environmentId: env.id,
      };
      if (opts.includeMetadata) {
        entry.isSecure = key.is_secure === 1;
        entry.description = key.description;
      }
      params.push(entry);
    }
  }
  return params;
}
