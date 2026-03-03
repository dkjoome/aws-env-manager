import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestDbClient } from '../helpers/db';
import { createNamespace } from '../../src/db/repositories/namespaces';
import { createProject } from '../../src/db/repositories/projects';
import { createKey } from '../../src/db/repositories/keys';
import { createLink, getAllLinkedKeyIds } from '../../src/db/repositories/key-links';

let db: TestDbClient;

beforeEach(() => { db = new TestDbClient(); });
afterEach(async () => { await db.close(); });

async function setupChain() {
  const ns = await createNamespace(db, 'ns');
  const projA = await createProject(db, ns.id, 'projA');
  const projB = await createProject(db, ns.id, 'projB');
  const projC = await createProject(db, ns.id, 'projC');
  const projD = await createProject(db, ns.id, 'projD');
  const keyA = await createKey(db, projA.id, 'KEY_A', null, null, false);
  const keyB = await createKey(db, projB.id, 'KEY_B', null, null, false);
  const keyC = await createKey(db, projC.id, 'KEY_C', null, null, false);
  const keyD = await createKey(db, projD.id, 'KEY_D', null, null, false);
  return { ns, projA, projB, projC, projD, keyA, keyB, keyC, keyD };
}

describe('getAllLinkedKeyIds', () => {
  it('returns empty array for unlinked key', async () => {
    const { keyA } = await setupChain();
    const result = await getAllLinkedKeyIds(db, keyA.id);
    expect(result).toEqual([]);
  });

  it('returns direct neighbor for A-B link', async () => {
    const { keyA, keyB } = await setupChain();
    await createLink(db, keyA.id, keyB.id);

    const fromA = await getAllLinkedKeyIds(db, keyA.id);
    expect(fromA).toEqual([keyB.id]);

    const fromB = await getAllLinkedKeyIds(db, keyB.id);
    expect(fromB).toEqual([keyA.id]);
  });

  it('returns full chain for A-B-C (daisy chain)', async () => {
    const { keyA, keyB, keyC } = await setupChain();
    await createLink(db, keyA.id, keyB.id);
    await createLink(db, keyB.id, keyC.id);

    const fromA = await getAllLinkedKeyIds(db, keyA.id);
    expect(fromA.sort()).toEqual([keyB.id, keyC.id].sort());

    const fromC = await getAllLinkedKeyIds(db, keyC.id);
    expect(fromC.sort()).toEqual([keyA.id, keyB.id].sort());
  });

  it('returns both neighbors from middle of chain (B in A-B-C)', async () => {
    const { keyA, keyB, keyC } = await setupChain();
    await createLink(db, keyA.id, keyB.id);
    await createLink(db, keyB.id, keyC.id);

    const fromB = await getAllLinkedKeyIds(db, keyB.id);
    expect(fromB.sort()).toEqual([keyA.id, keyC.id].sort());
  });

  it('returns full group for star topology (A-B, A-C)', async () => {
    const { keyA, keyB, keyC } = await setupChain();
    await createLink(db, keyA.id, keyB.id);
    await createLink(db, keyA.id, keyC.id);

    const fromA = await getAllLinkedKeyIds(db, keyA.id);
    expect(fromA.sort()).toEqual([keyB.id, keyC.id].sort());

    // B is connected to A, which is connected to C
    const fromB = await getAllLinkedKeyIds(db, keyB.id);
    expect(fromB.sort()).toEqual([keyA.id, keyC.id].sort());
  });

  it('returns full group for longer chain A-B-C-D', async () => {
    const { keyA, keyB, keyC, keyD } = await setupChain();
    await createLink(db, keyA.id, keyB.id);
    await createLink(db, keyB.id, keyC.id);
    await createLink(db, keyC.id, keyD.id);

    const fromA = await getAllLinkedKeyIds(db, keyA.id);
    expect(fromA.sort()).toEqual([keyB.id, keyC.id, keyD.id].sort());

    const fromD = await getAllLinkedKeyIds(db, keyD.id);
    expect(fromD.sort()).toEqual([keyA.id, keyB.id, keyC.id].sort());
  });

  it('handles cycles (A-B, B-C, C-A) without infinite loop', async () => {
    const { keyA, keyB, keyC } = await setupChain();
    await createLink(db, keyA.id, keyB.id);
    await createLink(db, keyB.id, keyC.id);
    await createLink(db, keyC.id, keyA.id);

    const fromA = await getAllLinkedKeyIds(db, keyA.id);
    expect(fromA.sort()).toEqual([keyB.id, keyC.id].sort());
  });
});
