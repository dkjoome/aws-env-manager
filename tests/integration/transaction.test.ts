import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestDbClient } from '../helpers/db';
import { createNamespace } from '../../src/db/repositories/namespaces';
import { createProject } from '../../src/db/repositories/projects';
import { createKey, getKeysByProject } from '../../src/db/repositories/keys';
import { createEnvironment } from '../../src/db/repositories/environments';
import { upsertKeyValue, getKeyValuesByProject } from '../../src/db/repositories/key-values';

let db: TestDbClient;

beforeEach(() => { db = new TestDbClient(); });
afterEach(async () => { await db.close(); });

async function setup() {
  const ns = await createNamespace(db, 'ns');
  const proj = await createProject(db, ns.id, 'proj');
  const env = await createEnvironment(db, ns.id, 'dev', 0);
  return { ns, proj, env };
}

describe('transaction — commit', () => {
  it('persists all writes on success', async () => {
    const { proj } = await setup();

    await db.transaction(async (tx) => {
      await createKey(tx, proj.id, 'KEY_A', null, null, false);
      await createKey(tx, proj.id, 'KEY_B', null, null, false);
    });

    const keys = await getKeysByProject(db, proj.id);
    expect(keys).toHaveLength(2);
    expect(keys.map((k) => k.name).sort()).toEqual(['KEY_A', 'KEY_B']);
  });

  it('returns the value from the callback', async () => {
    const result = await db.transaction(async () => {
      return 42;
    });
    expect(result).toBe(42);
  });
});

describe('transaction — rollback', () => {
  it('rolls back all writes on error', async () => {
    const { proj } = await setup();

    await expect(
      db.transaction(async (tx) => {
        await createKey(tx, proj.id, 'KEY_A', null, null, false);
        throw new Error('simulated failure');
      }),
    ).rejects.toThrow('simulated failure');

    const keys = await getKeysByProject(db, proj.id);
    expect(keys).toHaveLength(0);
  });

  it('rolls back partial writes when failure occurs mid-way', async () => {
    const { proj } = await setup();

    await expect(
      db.transaction(async (tx) => {
        await createKey(tx, proj.id, 'KEY_1', null, null, false);
        await createKey(tx, proj.id, 'KEY_2', null, null, false);
        // Third write fails
        throw new Error('mid-way failure');
      }),
    ).rejects.toThrow('mid-way failure');

    const keys = await getKeysByProject(db, proj.id);
    expect(keys).toHaveLength(0);
  });

  it('rolls back mixed operations (keys + values)', async () => {
    const { proj, env } = await setup();

    // Pre-create a key outside the transaction
    const existingKey = await createKey(db, proj.id, 'EXISTING', null, null, false);

    await expect(
      db.transaction(async (tx) => {
        await upsertKeyValue(tx, existingKey.id, env.id, 'new-val');
        await createKey(tx, proj.id, 'NEW_KEY', null, null, false);
        throw new Error('abort');
      }),
    ).rejects.toThrow('abort');

    // Existing key still exists, but no new key
    const keys = await getKeysByProject(db, proj.id);
    expect(keys).toHaveLength(1);
    expect(keys[0].name).toBe('EXISTING');

    // Value was not persisted
    const kvs = await getKeyValuesByProject(db, proj.id);
    expect(kvs).toHaveLength(0);
  });
});

describe('transaction — reads within transaction', () => {
  it('reads uncommitted writes inside the transaction', async () => {
    const { proj } = await setup();

    await db.transaction(async (tx) => {
      await createKey(tx, proj.id, 'INNER_KEY', null, null, false);
      const keys = await getKeysByProject(tx, proj.id);
      expect(keys).toHaveLength(1);
      expect(keys[0].name).toBe('INNER_KEY');
    });
  });
});

describe('transaction — re-throws original error', () => {
  it('preserves the error type and message', async () => {
    const err = new TypeError('type mismatch');
    await expect(
      db.transaction(async () => { throw err; }),
    ).rejects.toBe(err);
  });
});

describe('transaction — database usable after rollback', () => {
  it('allows normal operations after a rolled-back transaction', async () => {
    const { proj } = await setup();

    // Failed transaction
    await expect(
      db.transaction(async (tx) => {
        await createKey(tx, proj.id, 'GHOST', null, null, false);
        throw new Error('fail');
      }),
    ).rejects.toThrow('fail');

    // Normal operation after rollback
    const key = await createKey(db, proj.id, 'REAL', null, null, false);
    expect(key.name).toBe('REAL');

    const keys = await getKeysByProject(db, proj.id);
    expect(keys).toHaveLength(1);
    expect(keys[0].name).toBe('REAL');
  });
});
