import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestDbClient } from '../helpers/db';
import { createNamespace } from '../../src/db/repositories/namespaces';
import { createEnvironment } from '../../src/db/repositories/environments';
import { createProject } from '../../src/db/repositories/projects';
import { createKey } from '../../src/db/repositories/keys';
import {
  getKeyValue,
  getKeyValuesByKey,
  getKeyValuesByProject,
  getKeyValuesByEnvironment,
  upsertKeyValue,
  deleteKeyValue,
} from '../../src/db/repositories/key-values';

let db: TestDbClient;

beforeEach(() => { db = new TestDbClient(); });
afterEach(async () => { await db.close(); });

async function setup() {
  const ns = await createNamespace(db, 'ns');
  const dev = await createEnvironment(db, ns.id, 'dev', 0);
  const prod = await createEnvironment(db, ns.id, 'prod', 1);
  const proj = await createProject(db, ns.id, 'proj');
  const key = await createKey(db, proj.id, 'API_KEY', null, null, false);
  return { ns, dev, prod, proj, key };
}

describe('upsertKeyValue', () => {
  it('inserts a new value', async () => {
    const { key, dev } = await setup();
    await upsertKeyValue(db, key.id, dev.id, 'abc');
    const kv = await getKeyValue(db, key.id, dev.id);
    expect(kv?.value).toBe('abc');
  });

  it('updates existing value on conflict', async () => {
    const { key, dev } = await setup();
    await upsertKeyValue(db, key.id, dev.id, 'first');
    await upsertKeyValue(db, key.id, dev.id, 'second');
    const kv = await getKeyValue(db, key.id, dev.id);
    expect(kv?.value).toBe('second');
  });

  it('stores null value', async () => {
    const { key, dev } = await setup();
    await upsertKeyValue(db, key.id, dev.id, null);
    const kv = await getKeyValue(db, key.id, dev.id);
    expect(kv?.value).toBeNull();
  });
});

describe('getKeyValue', () => {
  it('returns null for missing key+env combination', async () => {
    const { key, dev } = await setup();
    const kv = await getKeyValue(db, key.id, dev.id);
    expect(kv).toBeNull();
  });
});

describe('getKeyValuesByKey', () => {
  it('returns all values for a key across environments', async () => {
    const { key, dev, prod } = await setup();
    await upsertKeyValue(db, key.id, dev.id, 'dev-val');
    await upsertKeyValue(db, key.id, prod.id, 'prod-val');
    const values = await getKeyValuesByKey(db, key.id);
    expect(values).toHaveLength(2);
  });

  it('returns empty array for key with no values', async () => {
    const { key } = await setup();
    const values = await getKeyValuesByKey(db, key.id);
    expect(values).toHaveLength(0);
  });
});

describe('getKeyValuesByProject', () => {
  it('returns all values for all keys in a project', async () => {
    const { proj, dev, prod, key } = await setup();
    const key2 = await createKey(db, proj.id, 'DB_HOST', null, null, false);
    await upsertKeyValue(db, key.id, dev.id, 'v1');
    await upsertKeyValue(db, key2.id, prod.id, 'v2');
    const values = await getKeyValuesByProject(db, proj.id);
    expect(values).toHaveLength(2);
    const paths = values.map((v) => v.key_id);
    expect(paths).toContain(key.id);
    expect(paths).toContain(key2.id);
  });
});

describe('getKeyValuesByEnvironment', () => {
  it('returns all key values for a given environment', async () => {
    const { proj, dev, prod, key } = await setup();
    const key2 = await createKey(db, proj.id, 'DB_HOST', null, null, false);
    await upsertKeyValue(db, key.id, dev.id, 'dev-api');
    await upsertKeyValue(db, key2.id, dev.id, 'dev-db');
    await upsertKeyValue(db, key.id, prod.id, 'prod-api');

    const devValues = await getKeyValuesByEnvironment(db, dev.id);
    expect(devValues).toHaveLength(2);
    expect(devValues.every((v) => v.environment_id === dev.id)).toBe(true);
  });

  it('returns empty array when environment has no values', async () => {
    const { dev } = await setup();
    const values = await getKeyValuesByEnvironment(db, dev.id);
    expect(values).toHaveLength(0);
  });
});

describe('deleteKeyValue', () => {
  it('deletes a specific key+env value', async () => {
    const { key, dev } = await setup();
    await upsertKeyValue(db, key.id, dev.id, 'val');
    await deleteKeyValue(db, key.id, dev.id);
    expect(await getKeyValue(db, key.id, dev.id)).toBeNull();
  });
});
