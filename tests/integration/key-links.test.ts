import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestDbClient } from '../helpers/db';
import { createNamespace } from '../../src/db/repositories/namespaces';
import { createProject } from '../../src/db/repositories/projects';
import { createKey } from '../../src/db/repositories/keys';
import {
  getLinksByKey,
  getLinksByNamespace,
  createLink,
  deleteLink,
} from '../../src/db/repositories/key-links';

let db: TestDbClient;

beforeEach(() => { db = new TestDbClient(); });
afterEach(async () => { await db.close(); });

async function setup() {
  const ns = await createNamespace(db, 'ns');
  const projA = await createProject(db, ns.id, 'projA');
  const projB = await createProject(db, ns.id, 'projB');
  const keyA = await createKey(db, projA.id, 'KEY_A', null, null, false);
  const keyB = await createKey(db, projB.id, 'KEY_B', null, null, false);
  return { ns, projA, projB, keyA, keyB };
}

describe('createLink', () => {
  it('creates a link with default eq rule', async () => {
    const { keyA, keyB } = await setup();
    const link = await createLink(db, keyA.id, keyB.id);
    expect(link.id).toBeGreaterThan(0);
    expect(link.source_key_id).toBe(keyA.id);
    expect(link.target_key_id).toBe(keyB.id);
    expect(link.rule).toBe('eq');
  });

  it('throws on duplicate link', async () => {
    const { keyA, keyB } = await setup();
    await createLink(db, keyA.id, keyB.id);
    await expect(createLink(db, keyA.id, keyB.id)).rejects.toThrow();
  });

  it('throws on reverse-direction duplicate (B→A when A→B exists)', async () => {
    const { keyA, keyB } = await setup();
    await createLink(db, keyA.id, keyB.id);
    await expect(createLink(db, keyB.id, keyA.id)).rejects.toThrow('already exists');
  });
});

describe('getLinksByKey', () => {
  it('returns links where key is source or target', async () => {
    const { keyA, keyB } = await setup();
    await createLink(db, keyA.id, keyB.id);

    const linksA = await getLinksByKey(db, keyA.id);
    expect(linksA).toHaveLength(1);

    const linksB = await getLinksByKey(db, keyB.id);
    expect(linksB).toHaveLength(1);
  });

  it('returns empty array when key has no links', async () => {
    const { keyA } = await setup();
    const links = await getLinksByKey(db, keyA.id);
    expect(links).toHaveLength(0);
  });
});

describe('getLinksByNamespace', () => {
  it('returns all links where source key is in namespace', async () => {
    const { ns, keyA, keyB } = await setup();
    await createLink(db, keyA.id, keyB.id);
    const links = await getLinksByNamespace(db, ns.id);
    expect(links).toHaveLength(1);
  });

  it('does not return links from other namespaces', async () => {
    const ns2 = await createNamespace(db, 'ns2');
    const proj2 = await createProject(db, ns2.id, 'p2');
    const key2a = await createKey(db, proj2.id, 'K1', null, null, false);
    const key2b = await createKey(db, proj2.id, 'K2', null, null, false);
    await createLink(db, key2a.id, key2b.id);

    const { ns } = await setup();
    const links = await getLinksByNamespace(db, ns.id);
    expect(links).toHaveLength(0);
  });
});

describe('deleteLink', () => {
  it('deletes a link', async () => {
    const { ns, keyA, keyB } = await setup();
    const link = await createLink(db, keyA.id, keyB.id);
    await deleteLink(db, link.id);
    const links = await getLinksByNamespace(db, ns.id);
    expect(links).toHaveLength(0);
  });
});
