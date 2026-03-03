import type { DbClient } from '../client';
import type { EnvKey } from '../../types';
import { validateName } from '../validate';

export async function getKeysByProject(db: DbClient, projectId: number): Promise<EnvKey[]> {
  return db.select<EnvKey>(
    'SELECT * FROM keys WHERE project_id = ? ORDER BY name',
    [projectId]
  );
}

export async function getKeyById(db: DbClient, id: number): Promise<EnvKey | null> {
  const rows = await db.select<EnvKey>('SELECT * FROM keys WHERE id = ?', [id]);
  return rows[0] ?? null;
}

export async function createKey(
  db: DbClient,
  projectId: number,
  name: string,
  description: string | null,
  note: string | null,
  isSecure: boolean
): Promise<EnvKey> {
  validateName(name, 'Key');
  const result = await db.execute(
    `INSERT INTO keys (project_id, name, description, note, is_secure) VALUES (?, ?, ?, ?, ?)`,
    [projectId, name, description, note, isSecure ? 1 : 0]
  );
  const key = await getKeyById(db, result.lastInsertId);
  if (!key) throw new Error(`Failed to create key: ${name}`);
  return key;
}

export async function updateKey(
  db: DbClient,
  id: number,
  fields: Partial<Pick<EnvKey, 'name' | 'description' | 'note' | 'is_secure' | 'is_locked'>>
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (fields.name !== undefined) { validateName(fields.name, 'Key'); sets.push('name = ?'); params.push(fields.name); }
  if (fields.description !== undefined) { sets.push('description = ?'); params.push(fields.description); }
  if (fields.note !== undefined) { sets.push('note = ?'); params.push(fields.note); }
  if (fields.is_secure !== undefined) { sets.push('is_secure = ?'); params.push(fields.is_secure); }
  if (fields.is_locked !== undefined) { sets.push('is_locked = ?'); params.push(fields.is_locked); }

  if (sets.length === 0) return;
  sets.push("updated_at = datetime('now')");
  params.push(id);

  await db.execute(`UPDATE keys SET ${sets.join(', ')} WHERE id = ?`, params);
}

export async function deleteKey(db: DbClient, id: number): Promise<void> {
  await db.execute('DELETE FROM keys WHERE id = ?', [id]);
}
