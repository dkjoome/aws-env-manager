/**
 * Validates a name that will become an SSM parameter path segment.
 * Rejects empty/whitespace-only strings and strings containing slashes or whitespace.
 */
export function validateName(name: string, entity: string): void {
  if (!name || !name.trim()) {
    throw new Error(`${entity} name cannot be empty.`);
  }
  if (/[\/\s]/.test(name)) {
    throw new Error(`${entity} name cannot contain slashes or whitespace.`);
  }
}
