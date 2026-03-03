import type { DbClient } from '../client';
import type { KeyLink } from '../../types';

export async function getLinksByKey(db: DbClient, keyId: number): Promise<KeyLink[]> {
  return db.select<KeyLink>(
    `SELECT * FROM key_links WHERE source_key_id = ? OR target_key_id = ?`,
    [keyId, keyId]
  );
}

export async function getLinksByNamespace(db: DbClient, namespaceId: number): Promise<KeyLink[]> {
  return db.select<KeyLink>(
    `SELECT kl.* FROM key_links kl
     JOIN keys sk ON sk.id = kl.source_key_id
     JOIN projects sp ON sp.id = sk.project_id
     WHERE sp.namespace_id = ?`,
    [namespaceId]
  );
}

export async function getLinkById(db: DbClient, id: number): Promise<KeyLink | null> {
  const rows = await db.select<KeyLink>('SELECT * FROM key_links WHERE id = ?', [id]);
  return rows[0] ?? null;
}

export async function createLink(
  db: DbClient,
  sourceKeyId: number,
  targetKeyId: number,
  rule = 'eq'
): Promise<KeyLink> {
  // Check for existing link in either direction
  const existing = await db.select<KeyLink>(
    `SELECT * FROM key_links
     WHERE (source_key_id = ? AND target_key_id = ?)
        OR (source_key_id = ? AND target_key_id = ?)`,
    [sourceKeyId, targetKeyId, targetKeyId, sourceKeyId]
  );
  if (existing.length > 0) {
    throw new Error('A link between these two keys already exists.');
  }
  const result = await db.execute(
    `INSERT INTO key_links (source_key_id, target_key_id, rule) VALUES (?, ?, ?)`,
    [sourceKeyId, targetKeyId, rule]
  );
  const link = await getLinkById(db, result.lastInsertId);
  if (!link) throw new Error('Failed to create key link');
  return link;
}

export async function deleteLink(db: DbClient, id: number): Promise<void> {
  await db.execute('DELETE FROM key_links WHERE id = ?', [id]);
}

/** Returns all transitively connected key IDs (full chain), excluding the starting key. */
export async function getAllLinkedKeyIds(db: DbClient, keyId: number): Promise<number[]> {
  const rows = await db.select<{ key_id: number }>(
    `WITH RECURSIVE linked(key_id) AS (
      SELECT ?
      UNION
      SELECT CASE WHEN kl.source_key_id = linked.key_id THEN kl.target_key_id ELSE kl.source_key_id END
      FROM key_links kl, linked
      WHERE kl.source_key_id = linked.key_id OR kl.target_key_id = linked.key_id
    )
    SELECT key_id FROM linked WHERE key_id != ?`,
    [keyId, keyId]
  );
  return rows.map((r) => r.key_id);
}
