import { describe, it, expect } from 'vitest';
import { parseEnvFile, serializeEnvFile } from '../../src/lib/env-parser';

describe('parseEnvFile', () => {
  it('parses simple key=value pairs', () => {
    const { entries, errors } = parseEnvFile('KEY=value\nOTHER=123');
    expect(entries).toEqual({ KEY: 'value', OTHER: '123' });
    expect(errors).toHaveLength(0);
  });

  it('skips blank lines and comments', () => {
    const content = `
# This is a comment
KEY=value

# another comment
FOO=bar
`;
    const { entries } = parseEnvFile(content);
    expect(Object.keys(entries)).toEqual(['KEY', 'FOO']);
  });

  it('handles double-quoted values', () => {
    const { entries } = parseEnvFile('KEY="hello world"');
    expect(entries.KEY).toBe('hello world');
  });

  it('handles single-quoted values', () => {
    const { entries } = parseEnvFile("KEY='hello world'");
    expect(entries.KEY).toBe('hello world');
  });

  it('strips inline comments from unquoted values', () => {
    const { entries } = parseEnvFile('KEY=value #comment');
    expect(entries.KEY).toBe('value');
  });

  it('preserves spaces in quoted values', () => {
    const { entries } = parseEnvFile('KEY="  spaced  "');
    expect(entries.KEY).toBe('  spaced  ');
  });

  it('preserves hash in quoted values', () => {
    const { entries } = parseEnvFile('KEY="value#notacomment"');
    expect(entries.KEY).toBe('value#notacomment');
  });

  it('errors on missing =', () => {
    const { errors } = parseEnvFile('KEYONLY');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/missing '='/);
  });

  it('errors on empty key', () => {
    const { errors } = parseEnvFile('=value');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/empty key/);
  });

  it('errors on invalid key format', () => {
    const { errors } = parseEnvFile('123BAD=value');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/invalid key/);
  });

  it('errors on unclosed double quote', () => {
    const { errors } = parseEnvFile('KEY="unclosed');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/unclosed double quote/);
  });

  it('errors on unclosed single quote', () => {
    const { errors } = parseEnvFile("KEY='unclosed");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/unclosed single quote/);
  });

  it('returns empty entries for empty string', () => {
    const { entries, errors } = parseEnvFile('');
    expect(entries).toEqual({});
    expect(errors).toHaveLength(0);
  });

  it('handles Windows-style line endings', () => {
    const { entries } = parseEnvFile('KEY=value\r\nOTHER=123');
    expect(entries).toEqual({ KEY: 'value', OTHER: '123' });
  });

  it('allows underscores in key names', () => {
    const { entries, errors } = parseEnvFile('MY_SECRET_KEY=abc');
    expect(entries.MY_SECRET_KEY).toBe('abc');
    expect(errors).toHaveLength(0);
  });
});

describe('serializeEnvFile', () => {
  it('serializes simple pairs', () => {
    const result = serializeEnvFile({ KEY: 'value', FOO: 'bar' });
    expect(result).toContain('KEY=value');
    expect(result).toContain('FOO=bar');
  });

  it('quotes values with spaces', () => {
    const result = serializeEnvFile({ KEY: 'hello world' });
    expect(result).toBe('KEY="hello world"');
  });

  it('quotes empty values', () => {
    const result = serializeEnvFile({ KEY: '' });
    expect(result).toBe('KEY=""');
  });

  it('quotes values containing #', () => {
    const result = serializeEnvFile({ KEY: 'val#comment' });
    expect(result).toBe('KEY="val#comment"');
  });

  it('escapes double quotes inside values', () => {
    const result = serializeEnvFile({ KEY: 'say "hi"' });
    expect(result).toBe('KEY="say \\"hi\\""');
  });
});
