import type { DbClient } from '../client';
import type { Namespace } from '../../types';
import { validateName } from '../validate';

export async function getAllNamespaces(db: DbClient): Promise<Namespace[]> {
  return db.select<Namespace>('SELECT * FROM namespaces ORDER BY name');
}

export async function getNamespaceById(db: DbClient, id: number): Promise<Namespace | null> {
  const rows = await db.select<Namespace>('SELECT * FROM namespaces WHERE id = ?', [id]);
  return rows[0] ?? null;
}

export async function getNamespaceByName(db: DbClient, name: string): Promise<Namespace | null> {
  const rows = await db.select<Namespace>('SELECT * FROM namespaces WHERE name = ?', [name]);
  return rows[0] ?? null;
}

export async function createNamespace(db: DbClient, name: string): Promise<Namespace> {
  validateName(name, 'Namespace');
  const result = await db.execute(
    `INSERT INTO namespaces (name) VALUES (?)`,
    [name]
  );
  const ns = await getNamespaceById(db, result.lastInsertId);
  if (!ns) throw new Error(`Failed to create namespace: ${name}`);
  return ns;
}

export async function deleteNamespace(db: DbClient, id: number): Promise<void> {
  await db.execute('DELETE FROM namespaces WHERE id = ?', [id]);
}
