import type { DbClient } from '../client';
import type { Project } from '../../types';
import { validateName } from '../validate';

export async function getProjectsByNamespace(
  db: DbClient,
  namespaceId: number
): Promise<Project[]> {
  return db.select<Project>(
    'SELECT * FROM projects WHERE namespace_id = ? ORDER BY name',
    [namespaceId]
  );
}

export async function getProjectById(db: DbClient, id: number): Promise<Project | null> {
  const rows = await db.select<Project>('SELECT * FROM projects WHERE id = ?', [id]);
  return rows[0] ?? null;
}

export async function createProject(
  db: DbClient,
  namespaceId: number,
  name: string
): Promise<Project> {
  validateName(name, 'Project');
  const result = await db.execute(
    `INSERT INTO projects (namespace_id, name) VALUES (?, ?)`,
    [namespaceId, name]
  );
  const project = await getProjectById(db, result.lastInsertId);
  if (!project) throw new Error(`Failed to create project: ${name}`);
  return project;
}

export async function deleteProject(db: DbClient, id: number): Promise<void> {
  await db.execute('DELETE FROM projects WHERE id = ?', [id]);
}
