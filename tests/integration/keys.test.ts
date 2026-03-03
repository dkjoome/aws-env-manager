import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestDbClient } from '../helpers/db';
import { createNamespace } from '../../src/db/repositories/namespaces';
import { createProject } from '../../src/db/repositories/projects';
import {
  getKeysByProject,
  getKeyById,
  createKey,
  updateKey,
  deleteKey,
} from '../../src/db/repositories/keys';

let db: TestDbClient;

beforeEach(() => { db = new TestDbClient(); });
afterEach(async () => { await db.close(); });

async function setup() {
  const ns = await createNamespace(db, 'ns');
  const proj = await createProject(db, ns.id, 'proj');
  return { ns, proj };
}

describe('createKey', () => {
  it('creates a key with all fields', async () => {
    const { proj } = await setup();
    const key = await createKey(db, proj.id, 'API_KEY', 'description', 'a note', true);
    expect(key.id).toBeGreaterThan(0);
    expect(key.project_id).toBe(proj.id);
    expect(key.name).toBe('API_KEY');
    expect(key.description).toBe('description');
    expect(key.note).toBe('a note');
    expect(key.is_secure).toBe(1);
  });

  it('creates a key with null description and note', async () => {
    const { proj } = await setup();
    const key = await createKey(db, proj.id, 'KEY', null, null, false);
    expect(key.description).toBeNull();
    expect(key.note).toBeNull();
    expect(key.is_secure).toBe(0);
  });

  it('throws on duplicate key name in same project', async () => {
    const { proj } = await setup();
    await createKey(db, proj.id, 'DUPE', null, null, false);
    await expect(createKey(db, proj.id, 'DUPE', null, null, false)).rejects.toThrow();
  });

  it('throws on empty name', async () => {
    const { proj } = await setup();
    await expect(createKey(db, proj.id, '', null, null, false)).rejects.toThrow('cannot be empty');
  });

  it('throws on name with slash or whitespace', async () => {
    const { proj } = await setup();
    await expect(createKey(db, proj.id, 'A/B', null, null, false)).rejects.toThrow('slashes or whitespace');
    await expect(createKey(db, proj.id, 'A B', null, null, false)).rejects.toThrow('slashes or whitespace');
  });
});

describe('getKeysByProject', () => {
  it('returns keys sorted by name', async () => {
    const { proj } = await setup();
    await createKey(db, proj.id, 'ZEBRA', null, null, false);
    await createKey(db, proj.id, 'ALPHA', null, null, false);
    const keys = await getKeysByProject(db, proj.id);
    expect(keys.map((k) => k.name)).toEqual(['ALPHA', 'ZEBRA']);
  });

  it('returns only keys for the given project', async () => {
    const ns = await createNamespace(db, 'ns');
    const p1 = await createProject(db, ns.id, 'p1');
    const p2 = await createProject(db, ns.id, 'p2');
    await createKey(db, p1.id, 'KEY_A', null, null, false);
    await createKey(db, p2.id, 'KEY_B', null, null, false);
    const keys = await getKeysByProject(db, p1.id);
    expect(keys).toHaveLength(1);
    expect(keys[0].name).toBe('KEY_A');
  });
});

describe('getKeyById', () => {
  it('returns null for unknown id', async () => {
    expect(await getKeyById(db, 9999)).toBeNull();
  });
});

describe('updateKey', () => {
  it('updates name', async () => {
    const { proj } = await setup();
    const key = await createKey(db, proj.id, 'OLD', null, null, false);
    await updateKey(db, key.id, { name: 'NEW' });
    const updated = await getKeyById(db, key.id);
    expect(updated?.name).toBe('NEW');
  });

  it('rejects rename to invalid name', async () => {
    const { proj } = await setup();
    const key = await createKey(db, proj.id, 'VALID', null, null, false);
    await expect(updateKey(db, key.id, { name: 'A/B' })).rejects.toThrow('slashes or whitespace');
  });

  it('updates description, note, is_secure independently', async () => {
    const { proj } = await setup();
    const key = await createKey(db, proj.id, 'KEY', null, null, false);
    await updateKey(db, key.id, { description: 'desc', note: 'n', is_secure: 1 });
    const updated = await getKeyById(db, key.id);
    expect(updated?.description).toBe('desc');
    expect(updated?.note).toBe('n');
    expect(updated?.is_secure).toBe(1);
  });

  it('updates is_locked', async () => {
    const { proj } = await setup();
    const key = await createKey(db, proj.id, 'KEY', null, null, false);
    expect(key.is_locked).toBe(0);
    await updateKey(db, key.id, { is_locked: 1 });
    const updated = await getKeyById(db, key.id);
    expect(updated?.is_locked).toBe(1);
    await updateKey(db, key.id, { is_locked: 0 });
    const unlocked = await getKeyById(db, key.id);
    expect(unlocked?.is_locked).toBe(0);
  });

  it('is a no-op when no fields provided', async () => {
    const { proj } = await setup();
    const key = await createKey(db, proj.id, 'STABLE', null, null, false);
    await expect(updateKey(db, key.id, {})).resolves.not.toThrow();
    const updated = await getKeyById(db, key.id);
    expect(updated?.name).toBe('STABLE');
  });
});

describe('deleteKey', () => {
  it('deletes a key', async () => {
    const { proj } = await setup();
    const key = await createKey(db, proj.id, 'TO_DEL', null, null, false);
    await deleteKey(db, key.id);
    expect(await getKeyById(db, key.id)).toBeNull();
  });
});
