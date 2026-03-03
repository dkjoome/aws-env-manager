import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { serializeBackup, compressBackup, decompressBackup, buildBackupS3Key, exportDb, restoreDb, validateBackup } from '../../src/lib/backup';
import type { BackupData } from '../../src/types';
import { TestDbClient } from '../helpers/db';
import { createNamespace } from '../../src/db/repositories/namespaces';
import { createEnvironment } from '../../src/db/repositories/environments';
import { createProject } from '../../src/db/repositories/projects';
import { createKey } from '../../src/db/repositories/keys';
import { upsertKeyValue, getKeyValuesByProject } from '../../src/db/repositories/key-values';
import { getAllNamespaces } from '../../src/db/repositories/namespaces';
import { getProjectsByNamespace } from '../../src/db/repositories/projects';
import { getEnvironmentsByNamespace } from '../../src/db/repositories/environments';
import { getKeysByProject } from '../../src/db/repositories/keys';
import { getSettings } from '../../src/db/repositories/settings';

function makeBackupData(overrides: Partial<BackupData> = {}): BackupData {
  return {
    version: 1,
    exportedAt: '2026-03-02T14:00:00.000Z',
    namespaces: [],
    environments: [],
    projects: [],
    keys: [],
    keyValues: [],
    keyLinks: [],
    settings: null,
    ...overrides,
  };
}

describe('serializeBackup', () => {
  it('returns valid JSON', () => {
    const data = makeBackupData();
    const json = serializeBackup(data);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('round-trips BackupData', () => {
    const data = makeBackupData({ exportedAt: '2026-01-01T00:00:00.000Z' });
    const parsed = JSON.parse(serializeBackup(data)) as BackupData;
    expect(parsed.version).toBe(1);
    expect(parsed.exportedAt).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('compressBackup / decompressBackup', () => {
  it('compresses and decompresses back to original', () => {
    const data = makeBackupData({
      namespaces: [{ id: 1, name: 'ns', created_at: '', updated_at: '' }],
    });
    const json = serializeBackup(data);
    const compressed = compressBackup(json);
    expect(compressed).toBeInstanceOf(Uint8Array);
    expect(compressed.length).toBeGreaterThan(0);

    const decompressed = decompressBackup(compressed);
    expect(decompressed.namespaces).toHaveLength(1);
    expect(decompressed.namespaces[0].name).toBe('ns');
  });

  it('compressed result is smaller than a large payload', () => {
    const keys = Array.from({ length: 100 }, (_, i) => ({
      id: i,
      project_id: 1,
      name: `KEY_${i}`,
      description: null,
      note: null,
      is_secure: 0,
      is_locked: 0,
      created_at: '',
      updated_at: '',
    }));
    const data = makeBackupData({ keys });
    const json = serializeBackup(data);
    const compressed = compressBackup(json);
    expect(compressed.length).toBeLessThan(json.length);
  });
});

describe('exportDb', () => {
  let db: TestDbClient;
  beforeEach(() => { db = new TestDbClient(); });
  afterEach(async () => { await db.close(); });

  it('returns empty arrays when database is empty', async () => {
    const backup = await exportDb(db);
    expect(backup.version).toBe(1);
    expect(backup.exportedAt).toBeTruthy();
    expect(backup.namespaces).toHaveLength(0);
    expect(backup.environments).toHaveLength(0);
    expect(backup.projects).toHaveLength(0);
    expect(backup.keys).toHaveLength(0);
    expect(backup.keyValues).toHaveLength(0);
    expect(backup.keyLinks).toHaveLength(0);
  });

  it('exports all namespaces, environments, projects, keys, and values', async () => {
    const ns = await createNamespace(db, 'myns');
    const env = await createEnvironment(db, ns.id, 'dev', 0);
    const proj = await createProject(db, ns.id, 'myproj');
    const key = await createKey(db, proj.id, 'API_KEY', null, null, false);
    await upsertKeyValue(db, key.id, env.id, 'secret');

    const backup = await exportDb(db);
    expect(backup.namespaces).toHaveLength(1);
    expect(backup.namespaces[0].name).toBe('myns');
    expect(backup.environments).toHaveLength(1);
    expect(backup.environments[0].name).toBe('dev');
    expect(backup.projects).toHaveLength(1);
    expect(backup.projects[0].name).toBe('myproj');
    expect(backup.keys).toHaveLength(1);
    expect(backup.keys[0].name).toBe('API_KEY');
    expect(backup.keyValues).toHaveLength(1);
    expect(backup.keyValues[0].value).toBe('secret');
  });

  it('includes settings (null when not configured)', async () => {
    const backup = await exportDb(db);
    // Settings row exists but all fields are null
    expect(backup.settings).not.toBeNull();
    expect(backup.settings?.id).toBe(1);
  });

  it('exports data across multiple namespaces', async () => {
    const ns1 = await createNamespace(db, 'ns1');
    const ns2 = await createNamespace(db, 'ns2');
    await createEnvironment(db, ns1.id, 'dev', 0);
    await createEnvironment(db, ns2.id, 'dev', 0);
    await createProject(db, ns1.id, 'p1');
    await createProject(db, ns2.id, 'p2');

    const backup = await exportDb(db);
    expect(backup.namespaces).toHaveLength(2);
    expect(backup.environments).toHaveLength(2);
    expect(backup.projects).toHaveLength(2);
  });
});

describe('buildBackupS3Key', () => {
  it('includes the prefix', () => {
    const key = buildBackupS3Key('my-bucket/backups');
    expect(key.startsWith('my-bucket/backups/')).toBe(true);
  });

  it('normalizes prefix without trailing slash', () => {
    const key = buildBackupS3Key('backups');
    expect(key.startsWith('backups/')).toBe(true);
  });

  it('normalizes prefix with trailing slash', () => {
    const key = buildBackupS3Key('backups/');
    expect(key.startsWith('backups/')).toBe(true);
    // should not double the slash
    expect(key).not.toMatch(/\/\//);
  });

  it('ends with .json.gz', () => {
    const key = buildBackupS3Key('prefix');
    expect(key.endsWith('.json.gz')).toBe(true);
  });

  it('includes a timestamp-like substring', () => {
    const key = buildBackupS3Key('prefix');
    // ISO date with - replacing colons
    expect(key).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/);
  });
});

describe('restoreDb', () => {
  let db: TestDbClient;
  beforeEach(() => { db = new TestDbClient(); });
  afterEach(async () => { await db.close(); });

  it('restores namespaces, environments, projects, keys, and values', async () => {
    const backup = makeBackupData({
      namespaces: [{ id: 1, name: 'ns1', created_at: '2026-01-01', updated_at: '2026-01-01' }],
      environments: [{ id: 1, namespace_id: 1, name: 'dev', sort_order: 0 }],
      projects: [{ id: 1, namespace_id: 1, name: 'proj1', created_at: '2026-01-01', updated_at: '2026-01-01' }],
      keys: [{ id: 1, project_id: 1, name: 'API_KEY', description: 'desc', note: null, is_secure: 0, is_locked: 0, created_at: '2026-01-01', updated_at: '2026-01-01' }],
      keyValues: [{ id: 1, key_id: 1, environment_id: 1, value: 'secret', updated_at: '2026-01-01' }],
    });

    await restoreDb(db, backup);

    const namespaces = await getAllNamespaces(db);
    expect(namespaces).toHaveLength(1);
    expect(namespaces[0].name).toBe('ns1');

    const envs = await getEnvironmentsByNamespace(db, 1);
    expect(envs).toHaveLength(1);
    expect(envs[0].name).toBe('dev');

    const projects = await getProjectsByNamespace(db, 1);
    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe('proj1');

    const keys = await getKeysByProject(db, 1);
    expect(keys).toHaveLength(1);
    expect(keys[0].name).toBe('API_KEY');
    expect(keys[0].description).toBe('desc');

    const kvs = await getKeyValuesByProject(db, 1);
    expect(kvs).toHaveLength(1);
    expect(kvs[0].value).toBe('secret');
  });

  it('overwrites existing data', async () => {
    // Create existing data
    const ns = await createNamespace(db, 'old-ns');
    const proj = await createProject(db, ns.id, 'old-proj');
    await createKey(db, proj.id, 'OLD_KEY', null, null, false);

    // Restore different data
    const backup = makeBackupData({
      namespaces: [{ id: 10, name: 'new-ns', created_at: '2026-01-01', updated_at: '2026-01-01' }],
      projects: [{ id: 10, namespace_id: 10, name: 'new-proj', created_at: '2026-01-01', updated_at: '2026-01-01' }],
      keys: [{ id: 10, project_id: 10, name: 'NEW_KEY', description: null, note: null, is_secure: 1, is_locked: 0, created_at: '2026-01-01', updated_at: '2026-01-01' }],
    });

    await restoreDb(db, backup);

    const namespaces = await getAllNamespaces(db);
    expect(namespaces).toHaveLength(1);
    expect(namespaces[0].name).toBe('new-ns');

    const keys = await getKeysByProject(db, 10);
    expect(keys).toHaveLength(1);
    expect(keys[0].name).toBe('NEW_KEY');
  });

  it('restores settings', async () => {
    const backup = makeBackupData({
      settings: {
        id: 1,
        credentials_file_path: '/custom/creds',
        ssm_profile: 'my-profile',
        s3_profile: 's3-profile',
        s3_bucket: 'my-bucket',
        s3_backup_prefix: 'backups/',
        aws_region: 'eu-west-1',
        updated_at: '2026-01-01',
      },
    });

    await restoreDb(db, backup);

    const settings = await getSettings(db);
    expect(settings.credentials_file_path).toBe('/custom/creds');
    expect(settings.ssm_profile).toBe('my-profile');
    expect(settings.s3_bucket).toBe('my-bucket');
    expect(settings.aws_region).toBe('eu-west-1');
  });

  it('handles empty backup (clears everything)', async () => {
    // Create existing data
    const ns = await createNamespace(db, 'ns');
    await createProject(db, ns.id, 'proj');

    await restoreDb(db, makeBackupData());

    const namespaces = await getAllNamespaces(db);
    expect(namespaces).toHaveLength(0);
  });

  it('round-trips export then restore', async () => {
    // Create data
    const ns = await createNamespace(db, 'roundtrip-ns');
    const env = await createEnvironment(db, ns.id, 'staging', 0);
    const proj = await createProject(db, ns.id, 'roundtrip-proj');
    const key = await createKey(db, proj.id, 'RT_KEY', 'a desc', 'a note', true);
    await upsertKeyValue(db, key.id, env.id, 'rt-value');

    // Export
    const exported = await exportDb(db);

    // Wipe and restore
    await restoreDb(db, exported);

    // Verify
    const namespaces = await getAllNamespaces(db);
    expect(namespaces).toHaveLength(1);
    expect(namespaces[0].name).toBe('roundtrip-ns');

    const keys = await getKeysByProject(db, proj.id);
    expect(keys).toHaveLength(1);
    expect(keys[0].name).toBe('RT_KEY');
    expect(keys[0].description).toBe('a desc');
    expect(keys[0].note).toBe('a note');
    expect(keys[0].is_secure).toBe(1);

    const kvs = await getKeyValuesByProject(db, proj.id);
    expect(kvs).toHaveLength(1);
    expect(kvs[0].value).toBe('rt-value');
  });
});

describe('validateBackup', () => {
  it('accepts a valid backup', () => {
    expect(() => validateBackup(makeBackupData())).not.toThrow();
  });

  it('rejects null', () => {
    expect(() => validateBackup(null)).toThrow('not an object');
  });

  it('rejects wrong version', () => {
    expect(() => validateBackup({ ...makeBackupData(), version: 99 })).toThrow('Unsupported backup version');
  });

  it('rejects missing required arrays', () => {
    const data = makeBackupData() as unknown as Record<string, unknown>;
    delete data.namespaces;
    expect(() => validateBackup(data)).toThrow('"namespaces" must be an array');
  });

  it('rejects non-array field', () => {
    expect(() => validateBackup({ ...makeBackupData(), keys: 'not-array' })).toThrow('"keys" must be an array');
  });
});
