import { describe, it, expect } from 'vitest';
import { buildLocalParams } from '../../src/lib/local-params';
import type { EnvKey, KeyValue, Environment } from '../../src/types';

const env: Environment = { id: 1, namespace_id: 1, name: 'dev', sort_order: 0 };
const key: EnvKey = {
  id: 10, project_id: 1, name: 'API_KEY', description: 'desc',
  note: null, is_secure: 1, is_locked: 0, created_at: '', updated_at: '',
};
const kv: KeyValue = { id: 100, key_id: 10, environment_id: 1, value: 'secret', updated_at: '' };

describe('buildLocalParams', () => {
  it('builds params with metadata (push mode)', () => {
    const result = buildLocalParams('ns', 'proj', [key], [env], [kv], {
      skipNullValues: true, includeMetadata: true,
    });
    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('/ns/proj/dev/API_KEY');
    expect(result[0].value).toBe('secret');
    expect(result[0].isSecure).toBe(true);
    expect(result[0].description).toBe('desc');
  });

  it('skips null values when skipNullValues is true', () => {
    const nullKv: KeyValue = { ...kv, value: null };
    const result = buildLocalParams('ns', 'proj', [key], [env], [nullKv], {
      skipNullValues: true, includeMetadata: true,
    });
    expect(result).toHaveLength(0);
  });

  it('includes null values when skipNullValues is false (pull mode)', () => {
    const nullKv: KeyValue = { ...kv, value: null };
    const result = buildLocalParams('ns', 'proj', [key], [env], [nullKv], {
      skipNullValues: false, includeMetadata: false,
    });
    expect(result).toHaveLength(1);
    expect(result[0].value).toBeNull();
    expect(result[0].isSecure).toBeUndefined();
  });

  it('skips entries with no KV record', () => {
    const result = buildLocalParams('ns', 'proj', [key], [env], [], {
      skipNullValues: false, includeMetadata: false,
    });
    expect(result).toHaveLength(0);
  });

  it('handles multiple keys and environments', () => {
    const env2: Environment = { id: 2, namespace_id: 1, name: 'prod', sort_order: 1 };
    const key2: EnvKey = { ...key, id: 20, name: 'DB_HOST', is_secure: 0 };
    const kvs: KeyValue[] = [
      kv,
      { id: 101, key_id: 10, environment_id: 2, value: 'prod-secret', updated_at: '' },
      { id: 102, key_id: 20, environment_id: 1, value: 'localhost', updated_at: '' },
    ];
    const result = buildLocalParams('ns', 'proj', [key, key2], [env, env2], kvs, {
      skipNullValues: true, includeMetadata: true,
    });
    expect(result).toHaveLength(3);
    expect(result.map((p) => p.path)).toEqual([
      '/ns/proj/dev/API_KEY',
      '/ns/proj/prod/API_KEY',
      '/ns/proj/dev/DB_HOST',
    ]);
  });
});
