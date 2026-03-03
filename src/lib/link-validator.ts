import type { DbClient } from '../db/client';
import type { ValidationError } from '../types';
import { getLinksByNamespace } from '../db/repositories/key-links';
import { getKeyById } from '../db/repositories/keys';
import { getProjectById } from '../db/repositories/projects';
import { getEnvironmentsByNamespace } from '../db/repositories/environments';
import { getKeyValue } from '../db/repositories/key-values';

/**
 * Validates all key links in a namespace.
 * For each link, checks all environments and verifies the rule is satisfied.
 * Currently only 'eq' rule is supported.
 */
export async function validateLinks(
  db: DbClient,
  namespaceId: number
): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];

  const [links, environments] = await Promise.all([
    getLinksByNamespace(db, namespaceId),
    getEnvironmentsByNamespace(db, namespaceId),
  ]);

  for (const link of links) {
    const [sourceKey, targetKey] = await Promise.all([
      getKeyById(db, link.source_key_id),
      getKeyById(db, link.target_key_id),
    ]);

    if (!sourceKey || !targetKey) continue;

    const [sourceProject, targetProject] = await Promise.all([
      getProjectById(db, sourceKey.project_id),
      getProjectById(db, targetKey.project_id),
    ]);

    if (!sourceProject || !targetProject) continue;

    for (const env of environments) {
      const [sourceVal, targetVal] = await Promise.all([
        getKeyValue(db, sourceKey.id, env.id),
        getKeyValue(db, targetKey.id, env.id),
      ]);

      const sv = sourceVal?.value ?? null;
      const tv = targetVal?.value ?? null;

      const isValid = checkRule(link.rule, sv, tv);
      if (!isValid) {
        errors.push({
          sourceKeyId: sourceKey.id,
          targetKeyId: targetKey.id,
          sourceKeyName: `${sourceProject.name}.${sourceKey.name}`,
          targetKeyName: `${targetProject.name}.${targetKey.name}`,
          sourceProjectName: sourceProject.name,
          targetProjectName: targetProject.name,
          environmentName: env.name,
          rule: link.rule,
          sourceValue: sv,
          targetValue: tv,
        });
      }
    }
  }

  return errors;
}

function checkRule(rule: string, a: string | null, b: string | null): boolean {
  switch (rule) {
    case 'eq':
      return a === b;
    default:
      return true;
  }
}
