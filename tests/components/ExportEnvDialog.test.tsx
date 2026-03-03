import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExportEnvDialog } from '../../src/components/ExportEnvDialog';
import type { EnvKey, Environment, KeyValue } from '../../src/types';

const devEnv: Environment = { id: 1, namespace_id: 1, name: 'dev', sort_order: 0 };
const prodEnv: Environment = { id: 2, namespace_id: 1, name: 'prod', sort_order: 1 };

const keyA: EnvKey = {
  id: 1, project_id: 1, name: 'API_KEY',
  description: 'The API key', note: null, is_secure: 0, is_locked: 0,
  created_at: '', updated_at: '',
};
const keyB: EnvKey = {
  id: 2, project_id: 1, name: 'DB_HOST',
  description: null, note: null, is_secure: 0, is_locked: 0,
  created_at: '', updated_at: '',
};

const kvDevA: KeyValue = { id: 1, key_id: 1, environment_id: 1, value: 'abc123', updated_at: '' };
const kvDevB: KeyValue = { id: 2, key_id: 2, environment_id: 1, value: 'localhost', updated_at: '' };
const kvProdA: KeyValue = { id: 3, key_id: 1, environment_id: 2, value: 'prod-key', updated_at: '' };
const kvNullVal: KeyValue = { id: 4, key_id: 2, environment_id: 2, value: null, updated_at: '' };

function renderDialog(overrides: Partial<Parameters<typeof ExportEnvDialog>[0]> = {}) {
  const props = {
    keys: [keyA, keyB],
    environments: [devEnv, prodEnv],
    keyValues: [kvDevA, kvDevB, kvProdA, kvNullVal],
    onClose: vi.fn(),
    ...overrides,
  };
  return { ...render(<ExportEnvDialog {...props} />), props };
}

describe('ExportEnvDialog', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('renders dialog with environment selector', () => {
    renderDialog();
    expect(screen.getByText('Export .env')).toBeTruthy();
    expect(screen.getByDisplayValue('dev')).toBeTruthy();
  });

  it('shows KEY=VALUE lines for selected environment', () => {
    renderDialog();
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toContain('API_KEY=abc123');
    expect(textarea.value).toContain('DB_HOST=localhost');
  });

  it('switches output when environment changes', () => {
    renderDialog();
    fireEvent.change(screen.getByDisplayValue('dev'), { target: { value: '2' } });
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toContain('API_KEY=prod-key');
    expect(textarea.value).toContain('DB_HOST=');
  });

  it('shows KEY= for null values', () => {
    renderDialog();
    fireEvent.change(screen.getByDisplayValue('dev'), { target: { value: '2' } });
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    // DB_HOST has null value in prod → KEY=
    expect(textarea.value).toContain('DB_HOST=');
    // But not DB_HOST=something
    const lines = textarea.value.split('\n');
    const dbLine = lines.find((l: string) => l.startsWith('DB_HOST='));
    expect(dbLine).toBe('DB_HOST=');
  });

  it('skips unset keys (no record for env)', () => {
    // Only kvDevA exists for dev — keyB has no record
    renderDialog({ keyValues: [kvDevA] });
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toContain('API_KEY=abc123');
    expect(textarea.value).not.toContain('DB_HOST');
  });

  it('includes descriptions as comments when checked', () => {
    renderDialog();
    fireEvent.click(screen.getByLabelText('Include descriptions as comments'));
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toContain('API_KEY=abc123 # The API key');
    // keyB has no description — no comment appended
    expect(textarea.value).toContain('DB_HOST=localhost');
    expect(textarea.value).not.toContain('DB_HOST=localhost #');
  });

  it('shows entry count', () => {
    renderDialog();
    expect(screen.getByText(/2 entries/)).toBeTruthy();
  });

  it('copies output to clipboard on Copy click', () => {
    renderDialog();
    fireEvent.click(screen.getByText('Copy'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('API_KEY=abc123\nDB_HOST=localhost');
  });

  it('shows Copied feedback after copy', () => {
    renderDialog();
    fireEvent.click(screen.getByText('Copy'));
    expect(screen.getByText('✓ Copied')).toBeTruthy();
  });

  it('disables Copy when no entries', () => {
    renderDialog({ keyValues: [] });
    expect((screen.getByText('Copy') as HTMLButtonElement).disabled).toBe(true);
  });

  it('calls onClose when Close clicked', () => {
    const { props } = renderDialog();
    fireEvent.click(screen.getByText('Close'));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});
