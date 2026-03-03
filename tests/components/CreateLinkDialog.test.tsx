import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateLinkDialog } from '../../src/components/CreateLinkDialog';
import type { Project, EnvKey, Environment, KeyValue } from '../../src/types';

const envDev: Environment = { id: 1, namespace_id: 1, name: 'dev', sort_order: 0 };
const envProd: Environment = { id: 2, namespace_id: 1, name: 'prod', sort_order: 1 };

const projectA: Project = { id: 10, namespace_id: 1, name: 'project-a', created_at: '', updated_at: '' };
const projectB: Project = { id: 20, namespace_id: 1, name: 'project-b', created_at: '', updated_at: '' };
const projectC: Project = { id: 30, namespace_id: 1, name: 'project-c', created_at: '', updated_at: '' };

const targetKeyX: EnvKey = {
  id: 100, project_id: 20, name: 'SHARED_KEY',
  description: null, note: null, is_secure: 0, is_locked: 0,
  created_at: '', updated_at: '',
};
const targetKeyY: EnvKey = {
  id: 101, project_id: 20, name: 'OTHER_KEY',
  description: null, note: null, is_secure: 0, is_locked: 0,
  created_at: '', updated_at: '',
};

function renderDialog(overrides: Partial<Parameters<typeof CreateLinkDialog>[0]> = {}) {
  const props = {
    sourceKeyId: 1,
    sourceKeyName: 'API_KEY',
    sourceIsSecure: false,
    currentProjectId: 10,
    projects: [projectA, projectB, projectC],
    environments: [envDev, envProd],
    loadKeysAndValues: vi.fn().mockResolvedValue({ keys: [], keyValues: [] }),
    sourceValues: { 1: 'val-dev', 2: 'val-prod' } as Record<number, string | null>,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  return { ...render(<CreateLinkDialog {...props} />), props };
}

describe('CreateLinkDialog', () => {
  it('renders source key label', () => {
    renderDialog();
    expect(screen.getByText('API_KEY')).toBeTruthy();
  });

  it('renders project dropdown excluding current project', () => {
    renderDialog();
    const select = screen.getByLabelText('Target project') as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.text);
    expect(options).toContain('project-b');
    expect(options).toContain('project-c');
    expect(options).not.toContain('project-a');
  });

  it('shows error when namespace has only one project', () => {
    renderDialog({ projects: [projectA] });
    expect(screen.getByText(/Need at least two projects/)).toBeTruthy();
  });

  it('loads keys when a project is selected', async () => {
    const loadKeysAndValues = vi.fn().mockResolvedValue({
      keys: [targetKeyX, targetKeyY],
      keyValues: [],
    });
    renderDialog({ loadKeysAndValues });

    fireEvent.change(screen.getByLabelText('Target project'), { target: { value: '20' } });

    await waitFor(() => {
      expect(loadKeysAndValues).toHaveBeenCalledWith(20);
    });
  });

  it('shows key dropdown after project is selected and keys are loaded', async () => {
    const loadKeysAndValues = vi.fn().mockResolvedValue({
      keys: [targetKeyX, targetKeyY],
      keyValues: [],
    });
    renderDialog({ loadKeysAndValues });

    fireEvent.change(screen.getByLabelText('Target project'), { target: { value: '20' } });

    await waitFor(() => {
      expect(screen.getByLabelText('Target key')).toBeTruthy();
    });

    const keySelect = screen.getByLabelText('Target key') as HTMLSelectElement;
    const options = Array.from(keySelect.options).map((o) => o.text);
    expect(options).toContain('SHARED_KEY');
    expect(options).toContain('OTHER_KEY');
  });

  it('shows value mismatch error when values differ across environments', async () => {
    const targetKvDev: KeyValue = { id: 50, key_id: 100, environment_id: 1, value: 'different', updated_at: '' };
    const targetKvProd: KeyValue = { id: 51, key_id: 100, environment_id: 2, value: 'val-prod', updated_at: '' };

    const loadKeysAndValues = vi.fn().mockResolvedValue({
      keys: [targetKeyX],
      keyValues: [targetKvDev, targetKvProd],
    });
    renderDialog({ loadKeysAndValues });

    fireEvent.change(screen.getByLabelText('Target project'), { target: { value: '20' } });

    await waitFor(() => {
      expect(screen.getByLabelText('Target key')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Target key'), { target: { value: '100' } });

    expect(screen.getByText(/Values do not match/)).toBeTruthy();
  });

  it('enables Create Link button when values match', async () => {
    const targetKvDev: KeyValue = { id: 50, key_id: 100, environment_id: 1, value: 'val-dev', updated_at: '' };
    const targetKvProd: KeyValue = { id: 51, key_id: 100, environment_id: 2, value: 'val-prod', updated_at: '' };

    const loadKeysAndValues = vi.fn().mockResolvedValue({
      keys: [targetKeyX],
      keyValues: [targetKvDev, targetKvProd],
    });
    renderDialog({ loadKeysAndValues });

    fireEvent.change(screen.getByLabelText('Target project'), { target: { value: '20' } });

    await waitFor(() => {
      expect(screen.getByLabelText('Target key')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Target key'), { target: { value: '100' } });

    const createBtn = screen.getByRole('button', { name: 'Create Link' }) as HTMLButtonElement;
    expect(createBtn.disabled).toBe(false);
  });

  it('disables Create Link button when no key is selected', () => {
    renderDialog();
    const createBtn = screen.getByRole('button', { name: 'Create Link' }) as HTMLButtonElement;
    expect(createBtn.disabled).toBe(true);
  });

  it('calls onConfirm with correct key IDs when confirmed', async () => {
    const targetKvDev: KeyValue = { id: 50, key_id: 100, environment_id: 1, value: 'val-dev', updated_at: '' };
    const targetKvProd: KeyValue = { id: 51, key_id: 100, environment_id: 2, value: 'val-prod', updated_at: '' };

    const loadKeysAndValues = vi.fn().mockResolvedValue({
      keys: [targetKeyX],
      keyValues: [targetKvDev, targetKvProd],
    });
    const { props } = renderDialog({ loadKeysAndValues });

    fireEvent.change(screen.getByLabelText('Target project'), { target: { value: '20' } });

    await waitFor(() => {
      expect(screen.getByLabelText('Target key')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Target key'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Link' }));

    expect(props.onConfirm).toHaveBeenCalledWith(1, 100);
  });

  it('calls onCancel when Cancel button is clicked', () => {
    const { props } = renderDialog();
    fireEvent.click(screen.getByText('Cancel'));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when overlay is clicked', () => {
    const { props } = renderDialog();
    // Click the overlay (parent of modal)
    const overlay = screen.getByRole('dialog').parentElement!;
    fireEvent.click(overlay);
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it('does not call onCancel when modal content is clicked', () => {
    const { props } = renderDialog();
    fireEvent.click(screen.getByRole('dialog'));
    expect(props.onCancel).not.toHaveBeenCalled();
  });

  it('shows success message when values match', async () => {
    const targetKvDev: KeyValue = { id: 50, key_id: 100, environment_id: 1, value: 'val-dev', updated_at: '' };
    const targetKvProd: KeyValue = { id: 51, key_id: 100, environment_id: 2, value: 'val-prod', updated_at: '' };

    const loadKeysAndValues = vi.fn().mockResolvedValue({
      keys: [targetKeyX],
      keyValues: [targetKvDev, targetKvProd],
    });
    renderDialog({ loadKeysAndValues });

    fireEvent.change(screen.getByLabelText('Target project'), { target: { value: '20' } });

    await waitFor(() => {
      expect(screen.getByLabelText('Target key')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Target key'), { target: { value: '100' } });

    expect(screen.getByText(/Ready to link/)).toBeTruthy();
  });

  it('shows "No keys" message when selected project has no keys', async () => {
    const loadKeysAndValues = vi.fn().mockResolvedValue({ keys: [], keyValues: [] });
    renderDialog({ loadKeysAndValues });

    fireEvent.change(screen.getByLabelText('Target project'), { target: { value: '20' } });

    await waitFor(() => {
      expect(screen.getByText(/No keys in project/)).toBeTruthy();
    });
  });

  it('treats both null values as matching', async () => {
    // Source has no values for both envs (null)
    // Target also has no values (null)
    const loadKeysAndValues = vi.fn().mockResolvedValue({
      keys: [targetKeyX],
      keyValues: [], // no values = null for both envs
    });
    renderDialog({
      loadKeysAndValues,
      sourceValues: { 1: null, 2: null },
    });

    fireEvent.change(screen.getByLabelText('Target project'), { target: { value: '20' } });

    await waitFor(() => {
      expect(screen.getByLabelText('Target key')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Target key'), { target: { value: '100' } });

    expect(screen.getByText(/Ready to link/)).toBeTruthy();
    const createBtn = screen.getByRole('button', { name: 'Create Link' }) as HTMLButtonElement;
    expect(createBtn.disabled).toBe(false);
  });

  it('shows encryption mismatch error when source is secure but target is not', async () => {
    const targetKvDev: KeyValue = { id: 50, key_id: 100, environment_id: 1, value: 'val-dev', updated_at: '' };
    const targetKvProd: KeyValue = { id: 51, key_id: 100, environment_id: 2, value: 'val-prod', updated_at: '' };

    const loadKeysAndValues = vi.fn().mockResolvedValue({
      keys: [targetKeyX], // targetKeyX has is_secure: 0
      keyValues: [targetKvDev, targetKvProd],
    });
    renderDialog({ loadKeysAndValues, sourceIsSecure: true });

    fireEvent.change(screen.getByLabelText('Target project'), { target: { value: '20' } });

    await waitFor(() => {
      expect(screen.getByLabelText('Target key')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Target key'), { target: { value: '100' } });

    expect(screen.getByText(/Cannot link.*encrypted.*plaintext/)).toBeTruthy();
    const createBtn = screen.getByRole('button', { name: 'Create Link' }) as HTMLButtonElement;
    expect(createBtn.disabled).toBe(true);
  });

  it('shows encryption mismatch error when source is plaintext but target is secure', async () => {
    const secureTarget: EnvKey = {
      id: 102, project_id: 20, name: 'SECURE_KEY',
      description: null, note: null, is_secure: 1, is_locked: 0,
      created_at: '', updated_at: '',
    };
    const targetKvDev: KeyValue = { id: 50, key_id: 102, environment_id: 1, value: 'val-dev', updated_at: '' };
    const targetKvProd: KeyValue = { id: 51, key_id: 102, environment_id: 2, value: 'val-prod', updated_at: '' };

    const loadKeysAndValues = vi.fn().mockResolvedValue({
      keys: [secureTarget],
      keyValues: [targetKvDev, targetKvProd],
    });
    renderDialog({ loadKeysAndValues, sourceIsSecure: false });

    fireEvent.change(screen.getByLabelText('Target project'), { target: { value: '20' } });

    await waitFor(() => {
      expect(screen.getByLabelText('Target key')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Target key'), { target: { value: '102' } });

    expect(screen.getByText(/Cannot link.*plaintext.*encrypted/)).toBeTruthy();
    const createBtn = screen.getByRole('button', { name: 'Create Link' }) as HTMLButtonElement;
    expect(createBtn.disabled).toBe(true);
  });

  it('allows linking when both source and target are secure', async () => {
    const secureTarget: EnvKey = {
      id: 102, project_id: 20, name: 'SECURE_KEY',
      description: null, note: null, is_secure: 1, is_locked: 0,
      created_at: '', updated_at: '',
    };
    const targetKvDev: KeyValue = { id: 50, key_id: 102, environment_id: 1, value: 'val-dev', updated_at: '' };
    const targetKvProd: KeyValue = { id: 51, key_id: 102, environment_id: 2, value: 'val-prod', updated_at: '' };

    const loadKeysAndValues = vi.fn().mockResolvedValue({
      keys: [secureTarget],
      keyValues: [targetKvDev, targetKvProd],
    });
    renderDialog({ loadKeysAndValues, sourceIsSecure: true });

    fireEvent.change(screen.getByLabelText('Target project'), { target: { value: '20' } });

    await waitFor(() => {
      expect(screen.getByLabelText('Target key')).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText('Target key'), { target: { value: '102' } });

    expect(screen.getByText(/Ready to link/)).toBeTruthy();
    const createBtn = screen.getByRole('button', { name: 'Create Link' }) as HTMLButtonElement;
    expect(createBtn.disabled).toBe(false);
  });
});
