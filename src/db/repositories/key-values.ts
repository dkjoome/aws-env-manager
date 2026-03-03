import type { DbClient } from '../client';
import type { KeyValue } from '../../types';

export async function getKeyValuesByKey(db: DbClient, keyId: number): Promise<KeyValue[]> {
  return db.select<KeyValue>(
    'SELECT * FROM key_values WHERE key_id = ?',
    [keyId]
  );
}

export async function getKeyValue(
  db: DbClient,
  keyId: number,
  environmentId: number
): Promise<KeyValue | null> {
  const rows = await db.select<KeyValue>(
    'SELECT * FROM key_values WHERE key_id = ? AND environment_id = ?',
    [keyId, environmentId]
  );
  return rows[0] ?? null;
}

export async function getKeyValuesByEnvironment(
  db: DbClient,
  environmentId: number
): Promise<KeyValue[]> {
  return db.select<KeyValue>(
    'SELECT * FROM key_values WHERE environment_id = ?',
    [environmentId]
  );
}

export async function getKeyValuesByProject(
  db: DbClient,
  projectId: number
): Promise<KeyValue[]> {
  return db.select<KeyValue>(
    `SELECT kv.* FROM key_values kv
     JOIN keys k ON k.id = kv.key_id
     WHERE k.project_id = ?`,
    [projectId]
  );
}

export async function upsertKeyValue(
  db: DbClient,
  keyId: number,
  environmentId: number,
  value: string | null
): Promise<void> {
  await db.execute(
    `INSERT INTO key_values (key_id, environment_id, value, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(key_id, environment_id)
     DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [keyId, environmentId, value]
  );
}

export async function deleteKeyValue(
  db: DbClient,
  keyId: number,
  environmentId: number
): Promise<void> {
  await db.execute(
    'DELETE FROM key_values WHERE key_id = ? AND environment_id = ?',
    [keyId, environmentId]
  );
}
