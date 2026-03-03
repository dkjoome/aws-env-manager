import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestDbClient } from '../helpers/db';
import { createNamespace, deleteNamespace } from '../../src/db/repositories/namespaces';
import { createEnvironment } from '../../src/db/repositories/environments';
import { createProject, deleteProject, getProjectById } from '../../src/db/repositories/projects';
import { createKey, getKeyById } from '../../src/db/repositories/keys';
import { upsertKeyValue, getKeyValue } from '../../src/db/repositories/key-values';
import { createLink, getLinksByKey } from '../../src/db/repositories/key-links';

let db: TestDbClient;

beforeEach(() => { db = new TestDbClient(); });
afterEach(async () => { await db.close(); });

describe('cascade: delete namespace', () => {
  it('deletes all environments when namespace is deleted', async () => {
    const ns = await createNamespace(db, 'ns');
    await createEnvironment(db, ns.id, 'dev', 0);
    await createEnvironment(db, ns.id, 'prod', 1);
    await deleteNamespace(db, ns.id);

    const envs = await db.select<{ id: number }>(
      'SELECT id FROM environments WHERE namespace_id = ?', [ns.id]
    );
    expect(envs).toHaveLength(0);
  });

  it('deletes all projects when namespace is deleted', async () => {
    const ns = await createNamespace(db, 'ns');
    const p = await createProject(db, ns.id, 'proj');
    await deleteNamespace(db, ns.id);
    expect(await getProjectById(db, p.id)).toBeNull();
  });

  it('deletes all keys when namespace is deleted', async () => {
    const ns = await createNamespace(db, 'ns');
    const p = await createProject(db, ns.id, 'proj');
    const k = await createKey(db, p.id, 'KEY', null, null, false);
    await deleteNamespace(db, ns.id);
    expect(await getKeyById(db, k.id)).toBeNull();
  });

  it('deletes all key values when namespace is deleted', async () => {
    const ns = await createNamespace(db, 'ns');
    const env = await createEnvironment(db, ns.id, 'dev', 0);
    const p = await createProject(db, ns.id, 'proj');
    const k = await createKey(db, p.id, 'KEY', null, null, false);
    await upsertKeyValue(db, k.id, env.id, 'value');
    await deleteNamespace(db, ns.id);
    // value row should be gone since key is gone
    const rows = await db.select<{ id: number }>(
      'SELECT id FROM key_values WHERE key_id = ?', [k.id]
    );
    expect(rows).toHaveLength(0);
  });

  it('deletes all key links when namespace is deleted', async () => {
    const ns = await createNamespace(db, 'ns');
    const pA = await createProject(db, ns.id, 'pA');
    const pB = await createProject(db, ns.id, 'pB');
    const kA = await createKey(db, pA.id, 'KEY_A', null, null, false);
    const kB = await createKey(db, pB.id, 'KEY_B', null, null, false);
    await createLink(db, kA.id, kB.id);
    await deleteNamespace(db, ns.id);

    const links = await db.select<{ id: number }>('SELECT id FROM key_links');
    expect(links).toHaveLength(0);
  });
});

describe('cascade: delete project', () => {
  it('deletes all keys in the project', async () => {
    const ns = await createNamespace(db, 'ns');
    const p = await createProject(db, ns.id, 'proj');
    const k1 = await createKey(db, p.id, 'K1', null, null, false);
    const k2 = await createKey(db, p.id, 'K2', null, null, false);
    await deleteProject(db, p.id);
    expect(await getKeyById(db, k1.id)).toBeNull();
    expect(await getKeyById(db, k2.id)).toBeNull();
  });

  it('deletes key values when project is deleted', async () => {
    const ns = await createNamespace(db, 'ns');
    const env = await createEnvironment(db, ns.id, 'dev', 0);
    const p = await createProject(db, ns.id, 'proj');
    const k = await createKey(db, p.id, 'KEY', null, null, false);
    await upsertKeyValue(db, k.id, env.id, 'val');
    await deleteProject(db, p.id);
    expect(await getKeyValue(db, k.id, env.id)).toBeNull();
  });

  it('deletes key links when project is deleted', async () => {
    const ns = await createNamespace(db, 'ns');
    const pA = await createProject(db, ns.id, 'pA');
    const pB = await createProject(db, ns.id, 'pB');
    const kA = await createKey(db, pA.id, 'KA', null, null, false);
    const kB = await createKey(db, pB.id, 'KB', null, null, false);
    await createLink(db, kA.id, kB.id);
    await deleteProject(db, pA.id);

    // Link referencing deleted key should be gone
    const links = await getLinksByKey(db, kB.id);
    expect(links).toHaveLength(0);
  });

  it('does not affect other projects in the same namespace', async () => {
    const ns = await createNamespace(db, 'ns');
    const p1 = await createProject(db, ns.id, 'p1');
    const p2 = await createProject(db, ns.id, 'p2');
    const k2 = await createKey(db, p2.id, 'KEY', null, null, false);
    await deleteProject(db, p1.id);
    expect(await getKeyById(db, k2.id)).not.toBeNull();
  });
});

describe('cascade: delete key', () => {
  it('deletes associated key_values', async () => {
    const ns = await createNamespace(db, 'ns');
    const env = await createEnvironment(db, ns.id, 'dev', 0);
    const p = await createProject(db, ns.id, 'proj');
    const k = await createKey(db, p.id, 'KEY', null, null, false);
    await upsertKeyValue(db, k.id, env.id, 'val');

    const { deleteKey } = await import('../../src/db/repositories/keys');
    await deleteKey(db, k.id);

    expect(await getKeyValue(db, k.id, env.id)).toBeNull();
  });

  it('deletes associated key_links', async () => {
    const ns = await createNamespace(db, 'ns');
    const pA = await createProject(db, ns.id, 'pA');
    const pB = await createProject(db, ns.id, 'pB');
    const kA = await createKey(db, pA.id, 'KA', null, null, false);
    const kB = await createKey(db, pB.id, 'KB', null, null, false);
    await createLink(db, kA.id, kB.id);

    const { deleteKey } = await import('../../src/db/repositories/keys');
    await deleteKey(db, kA.id);

    const links = await getLinksByKey(db, kB.id);
    expect(links).toHaveLength(0);
  });
});
