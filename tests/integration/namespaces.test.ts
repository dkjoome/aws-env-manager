import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestDbClient } from '../helpers/db';
import {
  getAllNamespaces,
  getNamespaceById,
  getNamespaceByName,
  createNamespace,
  deleteNamespace,
} from '../../src/db/repositories/namespaces';

let db: TestDbClient;

beforeEach(() => { db = new TestDbClient(); });
afterEach(async () => { await db.close(); });

describe('getAllNamespaces', () => {
  it('returns empty array when no namespaces exist', async () => {
    const result = await getAllNamespaces(db);
    expect(result).toEqual([]);
  });

  it('returns all namespaces sorted by name', async () => {
    await createNamespace(db, 'zebra');
    await createNamespace(db, 'apple');
    const result = await getAllNamespaces(db);
    expect(result.map((n) => n.name)).toEqual(['apple', 'zebra']);
  });
});

describe('createNamespace', () => {
  it('creates a namespace and returns it with an id', async () => {
    const ns = await createNamespace(db, 'hello');
    expect(ns.id).toBeGreaterThan(0);
    expect(ns.name).toBe('hello');
    expect(ns.created_at).toBeTruthy();
    expect(ns.updated_at).toBeTruthy();
  });

  it('throws on duplicate name', async () => {
    await createNamespace(db, 'hello');
    await expect(createNamespace(db, 'hello')).rejects.toThrow();
  });

  it('throws on empty name', async () => {
    await expect(createNamespace(db, '')).rejects.toThrow('cannot be empty');
    await expect(createNamespace(db, '   ')).rejects.toThrow('cannot be empty');
  });

  it('throws on name with slash or whitespace', async () => {
    await expect(createNamespace(db, 'a/b')).rejects.toThrow('slashes or whitespace');
    await expect(createNamespace(db, 'a b')).rejects.toThrow('slashes or whitespace');
  });
});

describe('getNamespaceById', () => {
  it('returns the namespace for a known id', async () => {
    const created = await createNamespace(db, 'ns1');
    const found = await getNamespaceById(db, created.id);
    expect(found?.name).toBe('ns1');
  });

  it('returns null for unknown id', async () => {
    const found = await getNamespaceById(db, 9999);
    expect(found).toBeNull();
  });
});

describe('getNamespaceByName', () => {
  it('returns the namespace for a known name', async () => {
    await createNamespace(db, 'myns');
    const found = await getNamespaceByName(db, 'myns');
    expect(found?.name).toBe('myns');
  });

  it('returns null for unknown name', async () => {
    const found = await getNamespaceByName(db, 'nonexistent');
    expect(found).toBeNull();
  });
});

describe('deleteNamespace', () => {
  it('deletes a namespace', async () => {
    const ns = await createNamespace(db, 'to-delete');
    await deleteNamespace(db, ns.id);
    const found = await getNamespaceById(db, ns.id);
    expect(found).toBeNull();
  });

  it('deleting non-existent id does not throw', async () => {
    await expect(deleteNamespace(db, 9999)).resolves.not.toThrow();
  });
});
