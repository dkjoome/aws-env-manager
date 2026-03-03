import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestDbClient } from '../helpers/db';
import { validateLinks } from '../../src/lib/link-validator';
import { createNamespace } from '../../src/db/repositories/namespaces';
import { createEnvironment } from '../../src/db/repositories/environments';
import { createProject } from '../../src/db/repositories/projects';
import { createKey } from '../../src/db/repositories/keys';
import { upsertKeyValue } from '../../src/db/repositories/key-values';
import { createLink } from '../../src/db/repositories/key-links';

let db: TestDbClient;

beforeEach(() => { db = new TestDbClient(); });
afterEach(async () => { await db.close(); });

async function seedBasicNamespace() {
  const ns = await createNamespace(db, 'hello');
  const dev = await createEnvironment(db, ns.id, 'dev', 0);
  const prod = await createEnvironment(db, ns.id, 'prod', 1);
  const projA = await createProject(db, ns.id, 'projectA');
  const projB = await createProject(db, ns.id, 'projectB');
  return { ns, dev, prod, projA, projB };
}

describe('validateLinks — eq rule', () => {
  it('returns no errors when there are no links', async () => {
    const { ns } = await seedBasicNamespace();
    const errors = await validateLinks(db, ns.id);
    expect(errors).toHaveLength(0);
  });

  it('returns no errors when linked keys have matching values', async () => {
    const { ns, dev, projA, projB } = await seedBasicNamespace();
    const keyA = await createKey(db, projA.id, 'API_KEY', null, null, false);
    const keyB = await createKey(db, projB.id, 'INTERNAL_KEY', null, null, false);
    await upsertKeyValue(db, keyA.id, dev.id, 'shared-secret');
    await upsertKeyValue(db, keyB.id, dev.id, 'shared-secret');
    await createLink(db, keyA.id, keyB.id);

    const errors = await validateLinks(db, ns.id);
    expect(errors).toHaveLength(0);
  });

  it('returns an error when linked keys have different values', async () => {
    const { ns, dev, projA, projB } = await seedBasicNamespace();
    const keyA = await createKey(db, projA.id, 'API_KEY', null, null, false);
    const keyB = await createKey(db, projB.id, 'INTERNAL_KEY', null, null, false);
    await upsertKeyValue(db, keyA.id, dev.id, 'value-a');
    await upsertKeyValue(db, keyB.id, dev.id, 'value-b');
    await createLink(db, keyA.id, keyB.id);

    const errors = await validateLinks(db, ns.id);
    expect(errors).toHaveLength(1);
    expect(errors[0].environmentName).toBe('dev');
    expect(errors[0].sourceValue).toBe('value-a');
    expect(errors[0].targetValue).toBe('value-b');
    expect(errors[0].rule).toBe('eq');
  });

  it('checks all environments independently', async () => {
    const { ns, dev, prod, projA, projB } = await seedBasicNamespace();
    const keyA = await createKey(db, projA.id, 'API_KEY', null, null, false);
    const keyB = await createKey(db, projB.id, 'INTERNAL_KEY', null, null, false);

    // dev: matches, prod: mismatch
    await upsertKeyValue(db, keyA.id, dev.id, 'same');
    await upsertKeyValue(db, keyB.id, dev.id, 'same');
    await upsertKeyValue(db, keyA.id, prod.id, 'prod-a');
    await upsertKeyValue(db, keyB.id, prod.id, 'prod-b');
    await createLink(db, keyA.id, keyB.id);

    const errors = await validateLinks(db, ns.id);
    expect(errors).toHaveLength(1);
    expect(errors[0].environmentName).toBe('prod');
  });

  it('treats both null values as equal (eq)', async () => {
    const { ns, projA, projB } = await seedBasicNamespace();
    const keyA = await createKey(db, projA.id, 'API_KEY', null, null, false);
    const keyB = await createKey(db, projB.id, 'INTERNAL_KEY', null, null, false);
    // No values set for either key — both null
    await createLink(db, keyA.id, keyB.id);

    const errors = await validateLinks(db, ns.id);
    expect(errors).toHaveLength(0);
  });

  it('reports an error when one is null and other has value', async () => {
    const { ns, dev, projA, projB } = await seedBasicNamespace();
    const keyA = await createKey(db, projA.id, 'API_KEY', null, null, false);
    const keyB = await createKey(db, projB.id, 'INTERNAL_KEY', null, null, false);
    await upsertKeyValue(db, keyA.id, dev.id, 'some-value');
    // keyB dev has no value → null
    await createLink(db, keyA.id, keyB.id);

    const errors = await validateLinks(db, ns.id);
    expect(errors).toHaveLength(1);
    expect(errors[0].sourceValue).toBe('some-value');
    expect(errors[0].targetValue).toBeNull();
  });

  it('includes project names in error', async () => {
    const { ns, dev, projA, projB } = await seedBasicNamespace();
    const keyA = await createKey(db, projA.id, 'API_KEY', null, null, false);
    const keyB = await createKey(db, projB.id, 'INTERNAL_KEY', null, null, false);
    await upsertKeyValue(db, keyA.id, dev.id, 'a');
    await upsertKeyValue(db, keyB.id, dev.id, 'b');
    await createLink(db, keyA.id, keyB.id);

    const errors = await validateLinks(db, ns.id);
    expect(errors[0].sourceProjectName).toBe('projectA');
    expect(errors[0].targetProjectName).toBe('projectB');
    expect(errors[0].sourceKeyName).toContain('API_KEY');
    expect(errors[0].targetKeyName).toContain('INTERNAL_KEY');
  });

  it('returns no errors for links in other namespaces', async () => {
    const ns1 = await createNamespace(db, 'ns1');
    const ns2 = await createNamespace(db, 'ns2');
    const env1 = await createEnvironment(db, ns1.id, 'dev', 0);
    const env2 = await createEnvironment(db, ns2.id, 'dev', 0);
    const proj1 = await createProject(db, ns1.id, 'p1');
    const proj2 = await createProject(db, ns2.id, 'p2');
    const key1 = await createKey(db, proj1.id, 'KEY', null, null, false);
    const key2 = await createKey(db, proj2.id, 'KEY_A', null, null, false);
    const key3 = await createKey(db, proj2.id, 'KEY_B', null, null, false);
    await upsertKeyValue(db, key1.id, env1.id, 'a');
    await upsertKeyValue(db, key2.id, env2.id, 'b');
    await upsertKeyValue(db, key3.id, env2.id, 'c');
    // Link is between two different keys in ns2, but we validate ns1
    await createLink(db, key2.id, key3.id);

    const errors = await validateLinks(db, ns1.id);
    expect(errors).toHaveLength(0);
  });
});
