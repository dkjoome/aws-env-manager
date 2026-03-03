/**
 * Builds the Parameter Store path for a given key.
 * Convention: /<namespace>/<project>/<env>/<KEY>
 */
export function buildPath(
  namespace: string,
  project: string,
  env: string,
  key: string
): string {
  const parts = [namespace, project, env, key];
  for (const part of parts) {
    if (!part || part.trim() === '') {
      throw new Error(`Invalid path segment: "${part}"`);
    }
    if (part.includes('/')) {
      throw new Error(`Path segment must not contain "/": "${part}"`);
    }
  }
  return `/${parts.join('/')}`;
}

/**
 * Parses a Parameter Store path back into its components.
 * Returns null if the path doesn't match the expected structure.
 */
export function parsePath(
  path: string
): { namespace: string; project: string; env: string; key: string } | null {
  const match = path.match(/^\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)$/);
  if (!match) return null;
  return {
    namespace: match[1],
    project: match[2],
    env: match[3],
    key: match[4],
  };
}

/**
 * Builds the path prefix for all keys in a project+env combination.
 * Useful for listing all params under a project/env.
 */
export function buildProjectEnvPrefix(
  namespace: string,
  project: string,
  env: string
): string {
  return `/${namespace}/${project}/${env}/`;
}

/**
 * Builds the path prefix for all keys in a namespace.
 */
export function buildNamespacePrefix(namespace: string): string {
  return `/${namespace}/`;
}

/**
 * Builds the path prefix for all keys in a project (across all environments).
 */
export function buildProjectPrefix(namespace: string, project: string): string {
  return `/${namespace}/${project}/`;
}
