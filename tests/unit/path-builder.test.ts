import { describe, it, expect } from 'vitest';
import {
  buildPath,
  parsePath,
  buildProjectEnvPrefix,
  buildNamespacePrefix,
  buildProjectPrefix,
} from '../../src/lib/path-builder';

describe('buildPath', () => {
  it('builds a correct path', () => {
    expect(buildPath('hello', 'projectA', 'dev', 'API_KEY')).toBe('/hello/projectA/dev/API_KEY');
  });

  it('builds path with underscores and caps', () => {
    expect(buildPath('my_ns', 'svc-b', 'staging', 'DB_PASSWORD')).toBe('/my_ns/svc-b/staging/DB_PASSWORD');
  });

  it('throws on empty segment', () => {
    expect(() => buildPath('', 'proj', 'dev', 'KEY')).toThrow();
    expect(() => buildPath('ns', '', 'dev', 'KEY')).toThrow();
    expect(() => buildPath('ns', 'proj', '', 'KEY')).toThrow();
    expect(() => buildPath('ns', 'proj', 'dev', '')).toThrow();
  });

  it('throws on whitespace-only segment', () => {
    expect(() => buildPath('  ', 'proj', 'dev', 'KEY')).toThrow();
  });

  it('throws on segment containing /', () => {
    expect(() => buildPath('ns/extra', 'proj', 'dev', 'KEY')).toThrow();
    expect(() => buildPath('ns', 'proj', 'dev', 'KEY/EXTRA')).toThrow();
  });
});

describe('parsePath', () => {
  it('parses a valid path', () => {
    expect(parsePath('/hello/projectA/dev/API_KEY')).toEqual({
      namespace: 'hello',
      project: 'projectA',
      env: 'dev',
      key: 'API_KEY',
    });
  });

  it('returns null for paths with wrong segment count', () => {
    expect(parsePath('/hello/projectA/dev')).toBeNull();
    expect(parsePath('/hello/projectA/dev/KEY/extra')).toBeNull();
    expect(parsePath('hello/projectA/dev/KEY')).toBeNull();
    expect(parsePath('')).toBeNull();
  });

  it('is inverse of buildPath', () => {
    const args = ['ns', 'proj', 'staging', 'MY_KEY'] as const;
    const path = buildPath(...args);
    const parsed = parsePath(path);
    expect(parsed).toEqual({
      namespace: 'ns',
      project: 'proj',
      env: 'staging',
      key: 'MY_KEY',
    });
  });
});

describe('buildProjectEnvPrefix', () => {
  it('builds prefix ending with /', () => {
    expect(buildProjectEnvPrefix('ns', 'proj', 'dev')).toBe('/ns/proj/dev/');
  });
});

describe('buildNamespacePrefix', () => {
  it('builds namespace prefix', () => {
    expect(buildNamespacePrefix('hello')).toBe('/hello/');
  });
});

describe('buildProjectPrefix', () => {
  it('builds project prefix', () => {
    expect(buildProjectPrefix('my-ns', 'api-service')).toBe('/my-ns/api-service/');
  });
});
