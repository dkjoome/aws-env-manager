import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestDbClient } from '../helpers/db';
import { createNamespace } from '../../src/db/repositories/namespaces';
import {
  createEnvironment,
  getEnvironmentsByNamespace,
  getEnvironmentById,
  deleteEnvironment,
  reorderEnvironments,
} from '../../src/db/repositories/environments';

let db: TestDbClient;

beforeEach(() => { db = new TestDbClient(); });
afterEach(async () => { await db.close(); });

describe('createEnvironment', () => {
  it('creates an environment and returns it with an id', async () => {
    const ns = await createNamespace(db, 'ns');
    const env = await createEnvironment(db, ns.id, 'dev', 0);
    expect(env.id).toBeGreaterThan(0);
    expect(env.name).toBe('dev');
    expect(env.namespace_id).toBe(ns.id);
    expect(env.sort_order).toBe(0);
  });

  it('throws on duplicate name within the same namespace', async () => {
    const ns = await createNamespace(db, 'ns');
    await createEnvironment(db, ns.id, 'dev', 0);
    await expect(createEnvironment(db, ns.id, 'dev', 1)).rejects.toThrow();
  });

  it('throws on empty name', async () => {
    const ns = await createNamespace(db, 'ns');
    await expect(createEnvironment(db, ns.id, '', 0)).rejects.toThrow('cannot be empty');
  });

  it('throws on name with slash or whitespace', async () => {
    const ns = await createNamespace(db, 'ns');
    await expect(createEnvironment(db, ns.id, 'a/b', 0)).rejects.toThrow('slashes or whitespace');
    await expect(createEnvironment(db, ns.id, 'a b', 0)).rejects.toThrow('slashes or whitespace');
  });

  it('allows same name in different namespaces', async () => {
    const ns1 = await createNamespace(db, 'ns1');
    const ns2 = await createNamespace(db, 'ns2');
    const e1 = await createEnvironment(db, ns1.id, 'dev', 0);
    const e2 = await createEnvironment(db, ns2.id, 'dev', 0);
    expect(e1.namespace_id).toBe(ns1.id);
    expect(e2.namespace_id).toBe(ns2.id);
  });
});

describe('getEnvironmentsByNamespace', () => {
  it('returns environments sorted by sort_order then name', async () => {
    const ns = await createNamespace(db, 'ns');
    await createEnvironment(db, ns.id, 'prod', 2);
    await createEnvironment(db, ns.id, 'dev', 0);
    await createEnvironment(db, ns.id, 'staging', 1);
    const envs = await getEnvironmentsByNamespace(db, ns.id);
    expect(envs.map((e) => e.name)).toEqual(['dev', 'staging', 'prod']);
  });

  it('returns empty array when namespace has no environments', async () => {
    const ns = await createNamespace(db, 'ns');
    const envs = await getEnvironmentsByNamespace(db, ns.id);
    expect(envs).toHaveLength(0);
  });
});

describe('getEnvironmentById', () => {
  it('returns the environment for a known id', async () => {
    const ns = await createNamespace(db, 'ns');
    const created = await createEnvironment(db, ns.id, 'dev', 0);
    const found = await getEnvironmentById(db, created.id);
    expect(found?.name).toBe('dev');
  });

  it('returns null for unknown id', async () => {
    const found = await getEnvironmentById(db, 9999);
    expect(found).toBeNull();
  });
});

describe('deleteEnvironment', () => {
  it('deletes an environment', async () => {
    const ns = await createNamespace(db, 'ns');
    const env = await createEnvironment(db, ns.id, 'dev', 0);
    await deleteEnvironment(db, env.id);
    const found = await getEnvironmentById(db, env.id);
    expect(found).toBeNull();
  });

  it('cascades to key_values on delete', async () => {
    const { createProject } = await import('../../src/db/repositories/projects');
    const { createKey } = await import('../../src/db/repositories/keys');
    const { upsertKeyValue, getKeyValue } = await import('../../src/db/repositories/key-values');

    const ns = await createNamespace(db, 'ns');
    const env = await createEnvironment(db, ns.id, 'dev', 0);
    const proj = await createProject(db, ns.id, 'proj');
    const key = await createKey(db, proj.id, 'K', null, null, false);
    await upsertKeyValue(db, key.id, env.id, 'val');

    await deleteEnvironment(db, env.id);
    const kv = await getKeyValue(db, key.id, env.id);
    expect(kv).toBeNull();
  });

  it('deleting non-existent id does not throw', async () => {
    await expect(deleteEnvironment(db, 9999)).resolves.not.toThrow();
  });
});

describe('reorderEnvironments', () => {
  it('updates sort_order based on position in array', async () => {
    const ns = await createNamespace(db, 'ns');
    const dev = await createEnvironment(db, ns.id, 'dev', 0);
    const staging = await createEnvironment(db, ns.id, 'staging', 1);
    const prod = await createEnvironment(db, ns.id, 'prod', 2);

    // Reverse the order: prod, staging, dev
    await reorderEnvironments(db, [prod.id, staging.id, dev.id]);

    const envs = await getEnvironmentsByNamespace(db, ns.id);
    expect(envs.map((e) => e.name)).toEqual(['prod', 'staging', 'dev']);
  });

  it('moves a single item to a new position', async () => {
    const ns = await createNamespace(db, 'ns');
    const dev = await createEnvironment(db, ns.id, 'dev', 0);
    const staging = await createEnvironment(db, ns.id, 'staging', 1);
    const prod = await createEnvironment(db, ns.id, 'prod', 2);

    // Move prod to front: prod, dev, staging
    await reorderEnvironments(db, [prod.id, dev.id, staging.id]);

    const envs = await getEnvironmentsByNamespace(db, ns.id);
    expect(envs.map((e) => e.name)).toEqual(['prod', 'dev', 'staging']);
  });
});
