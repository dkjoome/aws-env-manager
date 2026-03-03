import type { DbClient } from '../client';
import type { Settings } from '../../types';

export async function getSettings(db: DbClient): Promise<Settings> {
  const rows = await db.select<Settings>('SELECT * FROM settings WHERE id = 1');
  if (!rows[0]) throw new Error('Settings row missing — was migration run?');
  return rows[0];
}

export async function updateSettings(
  db: DbClient,
  fields: Partial<Omit<Settings, 'id' | 'updated_at'>>
): Promise<Settings> {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (fields.credentials_file_path !== undefined) {
    sets.push('credentials_file_path = ?');
    params.push(fields.credentials_file_path);
  }
  if (fields.ssm_profile !== undefined) {
    sets.push('ssm_profile = ?');
    params.push(fields.ssm_profile);
  }
  if (fields.s3_profile !== undefined) {
    sets.push('s3_profile = ?');
    params.push(fields.s3_profile);
  }
  if (fields.s3_bucket !== undefined) {
    sets.push('s3_bucket = ?');
    params.push(fields.s3_bucket);
  }
  if (fields.s3_backup_prefix !== undefined) {
    sets.push('s3_backup_prefix = ?');
    params.push(fields.s3_backup_prefix);
  }
  if (fields.aws_region !== undefined) {
    sets.push('aws_region = ?');
    params.push(fields.aws_region);
  }

  if (sets.length === 0) return getSettings(db);

  sets.push("updated_at = datetime('now')");
  await db.execute(`UPDATE settings SET ${sets.join(', ')} WHERE id = 1`, params);
  return getSettings(db);
}
