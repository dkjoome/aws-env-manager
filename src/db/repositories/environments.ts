import type { DbClient } from '../client';
import type { Environment } from '../../types';
import { validateName } from '../validate';

export async function getEnvironmentsByNamespace(
  db: DbClient,
  namespaceId: number
): Promise<Environment[]> {
  return db.select<Environment>(
    'SELECT * FROM environments WHERE namespace_id = ? ORDER BY sort_order, name',
    [namespaceId]
  );
}

export async function getEnvironmentById(db: DbClient, id: number): Promise<Environment | null> {
  const rows = await db.select<Environment>('SELECT * FROM environments WHERE id = ?', [id]);
  return rows[0] ?? null;
}

export async function createEnvironment(
  db: DbClient,
  namespaceId: number,
  name: string,
  sortOrder: number
): Promise<Environment> {
  validateName(name, 'Environment');
  const result = await db.execute(
    `INSERT INTO environments (namespace_id, name, sort_order) VALUES (?, ?, ?)`,
    [namespaceId, name, sortOrder]
  );
  const env = await getEnvironmentById(db, result.lastInsertId);
  if (!env) throw new Error(`Failed to create environment: ${name}`);
  return env;
}

export async function deleteEnvironment(db: DbClient, id: number): Promise<void> {
  await db.execute('DELETE FROM environments WHERE id = ?', [id]);
}

export async function reorderEnvironments(
  db: DbClient,
  orderedIds: number[]
): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await db.execute('UPDATE environments SET sort_order = ? WHERE id = ?', [i, orderedIds[i]]);
  }
}
