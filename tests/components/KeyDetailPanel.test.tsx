import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KeyDetailPanel } from '../../src/components/KeyDetailPanel';
import type { EnvKey, Environment, KeyValue, KeyLink } from '../../src/types';

function makeKey(overrides: Partial<EnvKey> = {}): EnvKey {
  return {
    id: 1,
    project_id: 10,
    name: 'API_KEY',
    description: 'My API key',
    note: 'Keep secret',
    is_secure: 0,
    is_locked: 0,
    created_at: '',
    updated_at: '',
    ...overrides,
  };
}

const envDev: Environment = { id: 100, namespace_id: 1, name: 'dev', sort_order: 0 };
const envProd: Environment = { id: 101, namespace_id: 1, name: 'prod', sort_order: 1 };

const kvDev: KeyValue = { id: 1, key_id: 1, environment_id: 100, value: 'dev-value', updated_at: '' };
const kvProd: KeyValue = { id: 2, key_id: 1, environment_id: 101, value: 'prod-value', updated_at: '' };

describe('KeyDetailPanel', () => {
  beforeEach(() => {
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('renders nothing when envKey is null', () => {
    const { container } = render(
      <KeyDetailPanel
        envKey={null}
        environments={[]}
        keyValues={[]}
        keyLinks={[]}
        onSave={vi.fn()}
        onClose={vi.fn()}
        onDeleteLink={vi.fn()}
        onCreateLink={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('pre-fills key name, description, and note from envKey', () => {
    render(
      <KeyDetailPanel
        envKey={makeKey()}
        environments={[]}
        keyValues={[]}
        keyLinks={[]}
        onSave={vi.fn()}
        onClose={vi.fn()}
        onDeleteLink={vi.fn()}
        onCreateLink={vi.fn()}
      />
    );
    expect((screen.getByLabelText('Key name') as HTMLInputElement).value).toBe('API_KEY');
    expect((screen.getByLabelText('Description') as HTMLInputElement).value).toBe('My API key');
    expect((screen.getByLabelText('Note') as HTMLTextAreaElement).value).toBe('Keep secret');
  });

  it('pre-fills is_secure checkbox from envKey', () => {
    render(
      <KeyDetailPanel
        envKey={makeKey({ is_secure: 1 })}
        environments={[]}
        keyValues={[]}
        keyLinks={[]}
        onSave={vi.fn()}
        onClose={vi.fn()}
        onDeleteLink={vi.fn()}
        onCreateLink={vi.fn()}
      />
    );
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it('pre-fills environment value inputs from keyValues', () => {
    render(
      <KeyDetailPanel
        envKey={makeKey()}
        environments={[envDev, envProd]}
        keyValues={[kvDev, kvProd]}
        keyLinks={[]}
        onSave={vi.fn()}
        onClose={vi.fn()}
        onDeleteLink={vi.fn()}
        onCreateLink={vi.fn()}
      />
    );
    expect((screen.getByLabelText('dev') as HTMLInputElement).value).toBe('dev-value');
    // is_secure=0 so both render as text type
    expect((screen.getByLabelText('prod') as HTMLInputElement).value).toBe('prod-value');
  });

  it('calls onSave with correct payload when Save is clicked', () => {
    const onSave = vi.fn();
    render(
      <KeyDetailPanel
        envKey={makeKey()}
        environments={[envDev]}
        keyValues={[kvDev]}
        keyLinks={[]}
        onSave={onSave}
        onClose={vi.fn()}
        onDeleteLink={vi.fn()}
        onCreateLink={vi.fn()}
      />
    );
    fireEvent.change(screen.getByLabelText('Key name'), { target: { value: 'NEW_KEY' } });
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledTimes(1);
    const [keyId, fields, values] = onSave.mock.calls[0];
    expect(keyId).toBe(1);
    expect(fields.name).toBe('NEW_KEY');
    expect(fields.description).toBe('My API key');
    expect(fields.is_secure).toBe(false);
    expect(values[100]).toBe('dev-value');
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(
      <KeyDetailPanel
        envKey={makeKey()}
        environments={[]}
        keyValues={[]}
        keyLinks={[]}
        onSave={vi.fn()}
        onClose={onClose}
        onDeleteLink={vi.fn()}
        onCreateLink={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when ✕ button is clicked', () => {
    const onClose = vi.fn();
    render(
      <KeyDetailPanel
        envKey={makeKey()}
        environments={[]}
        keyValues={[]}
        keyLinks={[]}
        onSave={vi.fn()}
        onClose={onClose}
        onDeleteLink={vi.fn()}
        onCreateLink={vi.fn()}
      />
    );
    fireEvent.click(screen.getByLabelText('Close panel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders links that involve the current key', () => {
    const link: KeyLink = {
      id: 5,
      source_key_id: 1,
      target_key_id: 2,
      rule: 'eq',
      created_at: '',
    };
    render(
      <KeyDetailPanel
        envKey={makeKey()}
        environments={[]}
        keyValues={[]}
        keyLinks={[link]}
        onSave={vi.fn()}
        onClose={vi.fn()}
        onDeleteLink={vi.fn()}
        onCreateLink={vi.fn()}
      />
    );
    expect(screen.getByText('eq')).toBeTruthy();
    expect(screen.getByLabelText('Remove link')).toBeTruthy();
  });

  it('displays resolved key name when resolveKeyName is provided', () => {
    const link: KeyLink = { id: 5, source_key_id: 1, target_key_id: 2, rule: 'eq', created_at: '' };
    render(
      <KeyDetailPanel
        envKey={makeKey()}
        environments={[]}
        keyValues={[]}
        keyLinks={[link]}
        resolveKeyName={(id) => id === 2 ? 'project-b / SHARED_KEY' : `key #${id}`}
        onSave={vi.fn()}
        onClose={vi.fn()}
        onDeleteLink={vi.fn()}
        onCreateLink={vi.fn()}
      />
    );
    expect(screen.getByText(/project-b \/ SHARED_KEY/)).toBeTruthy();
  });

  it('falls back to key #id when resolveKeyName is not provided', () => {
    const link: KeyLink = { id: 5, source_key_id: 1, target_key_id: 2, rule: 'eq', created_at: '' };
    render(
      <KeyDetailPanel
        envKey={makeKey()}
        environments={[]}
        keyValues={[]}
        keyLinks={[link]}
        onSave={vi.fn()}
        onClose={vi.fn()}
        onDeleteLink={vi.fn()}
        onCreateLink={vi.fn()}
      />
    );
    expect(screen.getByText(/key #2/)).toBeTruthy();
  });

  it('always renders Links section header even with no links', () => {
    render(
      <KeyDetailPanel
        envKey={makeKey()}
        environments={[]}
        keyValues={[]}
        keyLinks={[]}
        onSave={vi.fn()}
        onClose={vi.fn()}
        onDeleteLink={vi.fn()}
        onCreateLink={vi.fn()}
      />
    );
    expect(screen.getByText('Links')).toBeTruthy();
    expect(screen.getByText('No links yet.')).toBeTruthy();
  });

  it('calls onDeleteLink with the link id when remove is clicked', () => {
    const onDeleteLink = vi.fn();
    const link: KeyLink = { id: 5, source_key_id: 1, target_key_id: 2, rule: 'eq', created_at: '' };
    render(
      <KeyDetailPanel
        envKey={makeKey()}
        environments={[]}
        keyValues={[]}
        keyLinks={[link]}
        onSave={vi.fn()}
        onClose={vi.fn()}
        onDeleteLink={onDeleteLink}
        onCreateLink={vi.fn()}
      />
    );
    fireEvent.click(screen.getByLabelText('Remove link'));
    expect(onDeleteLink).toHaveBeenCalledWith(5);
  });

  it('renders Generate key button', () => {
    render(
      <KeyDetailPanel
        envKey={makeKey()}
        environments={[envDev]}
        keyValues={[]}
        keyLinks={[]}
        onSave={vi.fn()}
        onClose={vi.fn()}
        onDeleteLink={vi.fn()}
        onCreateLink={vi.fn()}
      />
    );
    expect(screen.getByText(/Generate key/)).toBeTruthy();
  });

  it('copies to clipboard and shows Copied when Generate key is clicked', async () => {
    render(
      <KeyDetailPanel
        envKey={makeKey()}
        environments={[envDev]}
        keyValues={[]}
        keyLinks={[]}
        onSave={vi.fn()}
        onClose={vi.fn()}
        onDeleteLink={vi.fn()}
        onCreateLink={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText(/Generate key/));
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Copied/)).toBeTruthy();
  });

  it('renders all env inputs as plain text (no masking)', () => {
    render(
      <KeyDetailPanel
        envKey={makeKey({ is_secure: 1 })}
        environments={[envDev, envProd]}
        keyValues={[kvDev, kvProd]}
        keyLinks={[]}
        onSave={vi.fn()}
        onClose={vi.fn()}
        onDeleteLink={vi.fn()}
        onCreateLink={vi.fn()}
      />
    );
    const devInput = screen.getByLabelText('dev') as HTMLInputElement;
    const prodInput = screen.getByLabelText('prod') as HTMLInputElement;
    expect(devInput.type).toBe('text');
    expect(prodInput.type).toBe('text');
  });
});

describe('KeyDetailPanel locked state', () => {
  it('shows "View Key" title when locked', () => {
    render(
      <KeyDetailPanel
        envKey={makeKey({ is_locked: 1 })}
        environments={[]}
        keyValues={[]}
        keyLinks={[]}
        onSave={vi.fn()}
        onClose={vi.fn()}
        onDeleteLink={vi.fn()}
        onCreateLink={vi.fn()}
      />
    );
    expect(screen.getByText('View Key')).toBeTruthy();
  });

  it('shows locked banner when locked', () => {
    render(
      <KeyDetailPanel
        envKey={makeKey({ is_locked: 1 })}
        environments={[]}
        keyValues={[]}
        keyLinks={[]}
        onSave={vi.fn()}
        onClose={vi.fn()}
        onDeleteLink={vi.fn()}
        onCreateLink={vi.fn()}
      />
    );
    expect(screen.getByText(/This key is locked/)).toBeTruthy();
  });

  it('disables all form inputs when locked', () => {
    render(
      <KeyDetailPanel
        envKey={makeKey({ is_locked: 1 })}
        environments={[envDev]}
        keyValues={[kvDev]}
        keyLinks={[]}
        onSave={vi.fn()}
        onClose={vi.fn()}
        onDeleteLink={vi.fn()}
        onCreateLink={vi.fn()}
      />
    );
    expect((screen.getByLabelText('Key name') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText('Description') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText('Note') as HTMLTextAreaElement).disabled).toBe(true);
    expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText('dev') as HTMLInputElement).disabled).toBe(true);
  });

  it('disables Save button when locked', () => {
    render(
      <KeyDetailPanel
        envKey={makeKey({ is_locked: 1 })}
        environments={[]}
        keyValues={[]}
        keyLinks={[]}
        onSave={vi.fn()}
        onClose={vi.fn()}
        onDeleteLink={vi.fn()}
        onCreateLink={vi.fn()}
      />
    );
    expect((screen.getByText('Save') as HTMLButtonElement).disabled).toBe(true);
  });

  it('hides Generate key button when locked', () => {
    render(
      <KeyDetailPanel
        envKey={makeKey({ is_locked: 1 })}
        environments={[envDev]}
        keyValues={[]}
        keyLinks={[]}
        onSave={vi.fn()}
        onClose={vi.fn()}
        onDeleteLink={vi.fn()}
        onCreateLink={vi.fn()}
      />
    );
    expect(screen.queryByText(/Generate key/)).toBeNull();
  });

  it('hides Remove link button when locked', () => {
    const link: KeyLink = { id: 5, source_key_id: 1, target_key_id: 2, rule: 'eq', created_at: '' };
    render(
      <KeyDetailPanel
        envKey={makeKey({ is_locked: 1 })}
        environments={[]}
        keyValues={[]}
        keyLinks={[link]}
        onSave={vi.fn()}
        onClose={vi.fn()}
        onDeleteLink={vi.fn()}
        onCreateLink={vi.fn()}
      />
    );
    expect(screen.queryByLabelText('Remove link')).toBeNull();
  });

  it('shows "Edit Key" title when not locked', () => {
    render(
      <KeyDetailPanel
        envKey={makeKey({ is_locked: 0 })}
        environments={[]}
        keyValues={[]}
        keyLinks={[]}
        onSave={vi.fn()}
        onClose={vi.fn()}
        onDeleteLink={vi.fn()}
        onCreateLink={vi.fn()}
      />
    );
    expect(screen.getByText('Edit Key')).toBeTruthy();
  });

  it('hides + Link button when locked', () => {
    render(
      <KeyDetailPanel
        envKey={makeKey({ is_locked: 1 })}
        environments={[]}
        keyValues={[]}
        keyLinks={[]}
        onSave={vi.fn()}
        onClose={vi.fn()}
        onDeleteLink={vi.fn()}
        onCreateLink={vi.fn()}
      />
    );
    expect(screen.queryByLabelText('Create link')).toBeNull();
  });
});

describe('KeyDetailPanel create link button', () => {
  it('renders + Link button when not locked', () => {
    render(
      <KeyDetailPanel
        envKey={makeKey()}
        environments={[]}
        keyValues={[]}
        keyLinks={[]}
        onSave={vi.fn()}
        onClose={vi.fn()}
        onDeleteLink={vi.fn()}
        onCreateLink={vi.fn()}
      />
    );
    expect(screen.getByLabelText('Create link')).toBeTruthy();
    expect(screen.getByText('+ Link')).toBeTruthy();
  });

  it('calls onCreateLink with key id when + Link is clicked', () => {
    const onCreateLink = vi.fn();
    render(
      <KeyDetailPanel
        envKey={makeKey({ id: 42 })}
        environments={[]}
        keyValues={[]}
        keyLinks={[]}
        onSave={vi.fn()}
        onClose={vi.fn()}
        onDeleteLink={vi.fn()}
        onCreateLink={onCreateLink}
      />
    );
    fireEvent.click(screen.getByLabelText('Create link'));
    expect(onCreateLink).toHaveBeenCalledWith(42);
  });
});
