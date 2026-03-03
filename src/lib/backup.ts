import { deflate, inflate } from 'pako';
import type { DbClient } from '../db/client';
import type { BackupData } from '../types';
import { getAllNamespaces } from '../db/repositories/namespaces';
import { getEnvironmentsByNamespace } from '../db/repositories/environments';
import { getProjectsByNamespace } from '../db/repositories/projects';
import { getKeysByProject } from '../db/repositories/keys';
import { getKeyValuesByProject } from '../db/repositories/key-values';
import { getLinksByNamespace } from '../db/repositories/key-links';
import { getSettings } from '../db/repositories/settings';

const BACKUP_VERSION = 1;

/**
 * Exports the entire database to a BackupData object.
 */
export async function exportDb(db: DbClient): Promise<BackupData> {
  const namespaces = await getAllNamespaces(db);

  const environments: BackupData['environments'] = [];
  const projects: BackupData['projects'] = [];
  const keys: BackupData['keys'] = [];
  const keyValues: BackupData['keyValues'] = [];
  const keyLinks: BackupData['keyLinks'] = [];

  for (const ns of namespaces) {
    const nsEnvironments = await getEnvironmentsByNamespace(db, ns.id);
    environments.push(...nsEnvironments);

    const nsProjects = await getProjectsByNamespace(db, ns.id);
    projects.push(...nsProjects);

    const nsLinks = await getLinksByNamespace(db, ns.id);
    keyLinks.push(...nsLinks);

    for (const project of nsProjects) {
      const projectKeys = await getKeysByProject(db, project.id);
      keys.push(...projectKeys);

      const projectValues = await getKeyValuesByProject(db, project.id);
      keyValues.push(...projectValues);
    }
  }

  let settings: BackupData['settings'] = null;
  try {
    settings = await getSettings(db);
  } catch {
    // settings row may not exist in edge cases
  }

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    namespaces,
    environments,
    projects,
    keys,
    keyValues,
    keyLinks,
    settings,
  };
}

/**
 * Serializes a BackupData object to a JSON string.
 */
export function serializeBackup(data: BackupData): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Compresses a JSON backup string using gzip (pako deflate).
 * Returns a Uint8Array suitable for upload.
 */
export function compressBackup(json: string): Uint8Array {
  return deflate(json, { level: 6 });
}

/**
 * Decompresses and parses a gzip-compressed backup.
 */
export function decompressBackup(compressed: Uint8Array): BackupData {
  const json = new TextDecoder().decode(inflate(compressed));
  return JSON.parse(json) as BackupData;
}

/**
 * Validates that a BackupData object has the expected shape before restoring.
 * Throws if the structure is invalid.
 */
export function validateBackup(data: unknown): asserts data is BackupData {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid backup: not an object.');
  }
  const d = data as Record<string, unknown>;
  if (d.version !== BACKUP_VERSION) {
    throw new Error(`Unsupported backup version: ${d.version} (expected ${BACKUP_VERSION}).`);
  }
  const requiredArrays = ['namespaces', 'environments', 'projects', 'keys', 'keyValues', 'keyLinks'] as const;
  for (const field of requiredArrays) {
    if (!Array.isArray(d[field])) {
      throw new Error(`Invalid backup: "${field}" must be an array.`);
    }
  }
}

/**
 * Restores a backup by clearing all tables and re-inserting the backup data.
 * Insertion order respects foreign key constraints.
 *
 * WARNING: This operation is NOT atomic. tauri-plugin-sql uses a connection
 * pool, so multi-statement transactions across IPC are unreliable. A crash
 * between statements can leave the DB partially restored. Export a backup
 * before restoring to mitigate data loss.
 */
export async function restoreDb(db: DbClient, data: BackupData): Promise<void> {
  validateBackup(data);
  // Delete in reverse dependency order (foreign keys)
  await db.execute('DELETE FROM key_links');
  await db.execute('DELETE FROM key_values');
  await db.execute('DELETE FROM keys');
  await db.execute('DELETE FROM projects');
  await db.execute('DELETE FROM environments');
  await db.execute('DELETE FROM namespaces');

  // Insert in dependency order, preserving original IDs
  for (const ns of data.namespaces) {
    await db.execute(
      'INSERT INTO namespaces (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
      [ns.id, ns.name, ns.created_at, ns.updated_at]
    );
  }
  for (const env of data.environments) {
    await db.execute(
      'INSERT INTO environments (id, namespace_id, name, sort_order) VALUES (?, ?, ?, ?)',
      [env.id, env.namespace_id, env.name, env.sort_order]
    );
  }
  for (const proj of data.projects) {
    await db.execute(
      'INSERT INTO projects (id, namespace_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [proj.id, proj.namespace_id, proj.name, proj.created_at, proj.updated_at]
    );
  }
  for (const key of data.keys) {
    await db.execute(
      'INSERT INTO keys (id, project_id, name, description, note, is_secure, is_locked, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [key.id, key.project_id, key.name, key.description, key.note, key.is_secure, key.is_locked, key.created_at, key.updated_at]
    );
  }
  for (const kv of data.keyValues) {
    await db.execute(
      'INSERT INTO key_values (id, key_id, environment_id, value, updated_at) VALUES (?, ?, ?, ?, ?)',
      [kv.id, kv.key_id, kv.environment_id, kv.value, kv.updated_at]
    );
  }
  for (const link of data.keyLinks) {
    await db.execute(
      'INSERT INTO key_links (id, source_key_id, target_key_id, rule, created_at) VALUES (?, ?, ?, ?, ?)',
      [link.id, link.source_key_id, link.target_key_id, link.rule, link.created_at]
    );
  }

  // Restore settings (update the existing row)
  if (data.settings) {
    await db.execute(
      `UPDATE settings SET credentials_file_path = ?, ssm_profile = ?, s3_profile = ?, s3_bucket = ?, s3_backup_prefix = ?, aws_region = ?, updated_at = ? WHERE id = 1`,
      [
        data.settings.credentials_file_path,
        data.settings.ssm_profile,
        data.settings.s3_profile,
        data.settings.s3_bucket,
        data.settings.s3_backup_prefix,
        data.settings.aws_region,
        data.settings.updated_at,
      ]
    );
  }
}

/**
 * Generates the S3 key (filename) for a backup.
 * e.g., backups/2026-03-02T14:30:00.000Z.json.gz
 */
export function buildBackupS3Key(prefix: string): string {
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const normalizedPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`;
  return `${normalizedPrefix}${timestamp}.json.gz`;
}
