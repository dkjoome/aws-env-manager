import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestDbClient } from '../helpers/db';
import { getSettings, updateSettings } from '../../src/db/repositories/settings';

let db: TestDbClient;

beforeEach(() => { db = new TestDbClient(); });
afterEach(async () => { await db.close(); });

describe('getSettings', () => {
  it('returns the default settings row after schema init', async () => {
    const settings = await getSettings(db);
    expect(settings.id).toBe(1);
    expect(settings.credentials_file_path).toBeNull();
    expect(settings.ssm_profile).toBeNull();
    expect(settings.s3_profile).toBeNull();
    expect(settings.s3_bucket).toBeNull();
    expect(settings.s3_backup_prefix).toBeNull();
    expect(settings.aws_region).toBeNull();
  });
});

describe('updateSettings', () => {
  it('updates credentials_file_path', async () => {
    await updateSettings(db, { credentials_file_path: '/home/user/.aws/credentials' });
    const s = await getSettings(db);
    expect(s.credentials_file_path).toBe('/home/user/.aws/credentials');
  });

  it('updates ssm_profile', async () => {
    await updateSettings(db, { ssm_profile: 'my-ssm-profile' });
    const s = await getSettings(db);
    expect(s.ssm_profile).toBe('my-ssm-profile');
  });

  it('updates s3_profile', async () => {
    await updateSettings(db, { s3_profile: 'my-s3-profile' });
    const s = await getSettings(db);
    expect(s.s3_profile).toBe('my-s3-profile');
  });

  it('updates s3_bucket', async () => {
    await updateSettings(db, { s3_bucket: 'my-bucket' });
    const s = await getSettings(db);
    expect(s.s3_bucket).toBe('my-bucket');
  });

  it('updates aws_region', async () => {
    await updateSettings(db, { aws_region: 'eu-west-1' });
    const s = await getSettings(db);
    expect(s.aws_region).toBe('eu-west-1');
  });

  it('updates s3_backup_prefix', async () => {
    await updateSettings(db, { s3_backup_prefix: 'backups/env-manager/' });
    const s = await getSettings(db);
    expect(s.s3_backup_prefix).toBe('backups/env-manager/');
  });

  it('updates multiple fields at once', async () => {
    await updateSettings(db, {
      credentials_file_path: '/path/to/creds',
      ssm_profile: 'ssm',
      s3_profile: 's3',
      s3_bucket: 'bucket',
      s3_backup_prefix: 'prefix/',
    });
    const s = await getSettings(db);
    expect(s.credentials_file_path).toBe('/path/to/creds');
    expect(s.ssm_profile).toBe('ssm');
    expect(s.s3_profile).toBe('s3');
    expect(s.s3_bucket).toBe('bucket');
    expect(s.s3_backup_prefix).toBe('prefix/');
  });

  it('allows setting fields back to null', async () => {
    await updateSettings(db, { ssm_profile: 'my-profile' });
    await updateSettings(db, { ssm_profile: null });
    const s = await getSettings(db);
    expect(s.ssm_profile).toBeNull();
  });

  it('is a no-op when no fields provided', async () => {
    await updateSettings(db, { ssm_profile: 'before' });
    await updateSettings(db, {});
    const s = await getSettings(db);
    expect(s.ssm_profile).toBe('before');
  });
});
