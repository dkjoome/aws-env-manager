import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestDbClient } from '../helpers/db';
import { createNamespace } from '../../src/db/repositories/namespaces';
import {
  getProjectsByNamespace,
  getProjectById,
  createProject,
  deleteProject,
} from '../../src/db/repositories/projects';

let db: TestDbClient;

beforeEach(() => { db = new TestDbClient(); });
afterEach(async () => { await db.close(); });

describe('createProject', () => {
  it('creates a project under a namespace', async () => {
    const ns = await createNamespace(db, 'hello');
    const proj = await createProject(db, ns.id, 'projectA');
    expect(proj.id).toBeGreaterThan(0);
    expect(proj.namespace_id).toBe(ns.id);
    expect(proj.name).toBe('projectA');
  });

  it('throws on duplicate project name in same namespace', async () => {
    const ns = await createNamespace(db, 'hello');
    await createProject(db, ns.id, 'p1');
    await expect(createProject(db, ns.id, 'p1')).rejects.toThrow();
  });

  it('throws on empty name', async () => {
    const ns = await createNamespace(db, 'ns');
    await expect(createProject(db, ns.id, '')).rejects.toThrow('cannot be empty');
  });

  it('throws on name with slash or whitespace', async () => {
    const ns = await createNamespace(db, 'ns');
    await expect(createProject(db, ns.id, 'a/b')).rejects.toThrow('slashes or whitespace');
    await expect(createProject(db, ns.id, 'a b')).rejects.toThrow('slashes or whitespace');
  });

  it('allows same name in different namespaces', async () => {
    const ns1 = await createNamespace(db, 'ns1');
    const ns2 = await createNamespace(db, 'ns2');
    const p1 = await createProject(db, ns1.id, 'shared');
    const p2 = await createProject(db, ns2.id, 'shared');
    expect(p1.id).not.toBe(p2.id);
  });
});

describe('getProjectsByNamespace', () => {
  it('returns only projects for the given namespace', async () => {
    const ns1 = await createNamespace(db, 'ns1');
    const ns2 = await createNamespace(db, 'ns2');
    await createProject(db, ns1.id, 'a');
    await createProject(db, ns1.id, 'b');
    await createProject(db, ns2.id, 'c');

    const result = await getProjectsByNamespace(db, ns1.id);
    expect(result.map((p) => p.name)).toEqual(['a', 'b']);
  });

  it('returns projects sorted by name', async () => {
    const ns = await createNamespace(db, 'ns');
    await createProject(db, ns.id, 'zebra');
    await createProject(db, ns.id, 'alpha');
    const result = await getProjectsByNamespace(db, ns.id);
    expect(result.map((p) => p.name)).toEqual(['alpha', 'zebra']);
  });

  it('returns empty array when namespace has no projects', async () => {
    const ns = await createNamespace(db, 'empty');
    const result = await getProjectsByNamespace(db, ns.id);
    expect(result).toEqual([]);
  });
});

describe('getProjectById', () => {
  it('returns the project for a known id', async () => {
    const ns = await createNamespace(db, 'ns');
    const created = await createProject(db, ns.id, 'myproj');
    const found = await getProjectById(db, created.id);
    expect(found?.name).toBe('myproj');
  });

  it('returns null for unknown id', async () => {
    expect(await getProjectById(db, 9999)).toBeNull();
  });
});

describe('deleteProject', () => {
  it('deletes a project', async () => {
    const ns = await createNamespace(db, 'ns');
    const proj = await createProject(db, ns.id, 'to-delete');
    await deleteProject(db, proj.id);
    expect(await getProjectById(db, proj.id)).toBeNull();
  });
});
