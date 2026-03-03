import { describe, it, expect } from 'vitest';
import { validateName } from '../../src/db/validate';

describe('validateName', () => {
  it('accepts valid names', () => {
    expect(() => validateName('dev', 'Test')).not.toThrow();
    expect(() => validateName('my-project', 'Test')).not.toThrow();
    expect(() => validateName('key_name', 'Test')).not.toThrow();
    expect(() => validateName('v1.2.3', 'Test')).not.toThrow();
  });

  it('rejects empty string', () => {
    expect(() => validateName('', 'Test')).toThrow('cannot be empty');
  });

  it('rejects whitespace-only string', () => {
    expect(() => validateName('   ', 'Test')).toThrow('cannot be empty');
  });

  it('rejects names containing slashes', () => {
    expect(() => validateName('a/b', 'Test')).toThrow('slashes or whitespace');
  });

  it('rejects names containing spaces', () => {
    expect(() => validateName('a b', 'Test')).toThrow('slashes or whitespace');
  });

  it('rejects names containing tabs', () => {
    expect(() => validateName('a\tb', 'Test')).toThrow('slashes or whitespace');
  });

  it('includes entity name in error message', () => {
    expect(() => validateName('', 'Namespace')).toThrow('Namespace name');
    expect(() => validateName('a/b', 'Key')).toThrow('Key name');
  });
});
