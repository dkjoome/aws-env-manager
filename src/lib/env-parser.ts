export interface ParsedEnvFile {
  entries: Record<string, string>;
  errors: string[];
}

/**
 * Parses the content of a .env file into key-value pairs.
 *
 * Supports:
 *   - KEY=value
 *   - KEY="quoted value"
 *   - KEY='single quoted'
 *   - # comments
 *   - blank lines
 *   - inline comments after unquoted values
 */
export function parseEnvFile(content: string): ParsedEnvFile {
  const entries: Record<string, string> = {};
  const errors: string[] = [];
  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNum = i + 1;

    // Skip blank lines and comments
    if (!line || line.startsWith('#')) continue;

    // Must contain '='
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) {
      errors.push(`Line ${lineNum}: missing '=' in "${line}"`);
      continue;
    }

    const key = line.slice(0, eqIdx).trim();
    if (!key) {
      errors.push(`Line ${lineNum}: empty key`);
      continue;
    }
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      errors.push(`Line ${lineNum}: invalid key "${key}"`);
      continue;
    }

    let raw = line.slice(eqIdx + 1);

    // Strip inline comment for unquoted values
    let value: string;
    if (raw.startsWith('"')) {
      // Double-quoted: consume until closing "
      const closing = raw.indexOf('"', 1);
      if (closing === -1) {
        errors.push(`Line ${lineNum}: unclosed double quote for key "${key}"`);
        continue;
      }
      value = raw.slice(1, closing);
    } else if (raw.startsWith("'")) {
      // Single-quoted: consume until closing '
      const closing = raw.indexOf("'", 1);
      if (closing === -1) {
        errors.push(`Line ${lineNum}: unclosed single quote for key "${key}"`);
        continue;
      }
      value = raw.slice(1, closing);
    } else {
      // Unquoted: strip inline comment (space or tab before #)
      const commentMatch = raw.search(/\s#/);
      value = (commentMatch !== -1 ? raw.slice(0, commentMatch) : raw).trim();
    }

    entries[key] = value;
  }

  return { entries, errors };
}

/**
 * Serializes a key-value map back to .env format.
 */
export function serializeEnvFile(entries: Record<string, string>): string {
  return Object.entries(entries)
    .map(([k, v]) => {
      // Quote values that contain spaces, #, or special chars
      const needsQuotes = /[\s#"'\\]/.test(v) || v === '';
      const val = needsQuotes ? `"${v.replace(/"/g, '\\"')}"` : v;
      return `${k}=${val}`;
    })
    .join('\n');
}
