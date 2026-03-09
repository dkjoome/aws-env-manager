import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KeyTable } from '../../src/components/KeyTable';
import type { EnvKey, Environment, KeyValue, KeyLink, ValidationError } from '../../src/types';

const devEnv: Environment = { id: 1, namespace_id: 1, name: 'dev', sort_order: 0 };
const prodEnv: Environment = { id: 2, namespace_id: 1, name: 'prod', sort_order: 1 };

const keyA: EnvKey = {
  id: 1, project_id: 1, name: 'API_KEY',
  description: 'The API key', note: null, is_secure: 0, is_locked: 0,
  created_at: '', updated_at: '',
};
const keyB: EnvKey = {
  id: 2, project_id: 1, name: 'DB_HOST',
  description: null, note: null, is_secure: 1, is_locked: 0,
  created_at: '', updated_at: '',
};
const kvDevA: KeyValue = { id: 1, key_id: 1, environment_id: 1, value: 'abc123', updated_at: '' };
const kvProdA: KeyValue = { id: 2, key_id: 1, environment_id: 2, value: 'secret', updated_at: '' };
const kvDevB: KeyValue = { id: 3, key_id: 2, environment_id: 1, value: 'db-host-val', updated_at: '' };

function renderTable(overrides: Partial<Parameters<typeof KeyTable>[0]> = {}) {
  const props = {
    keys: [keyA, keyB],
    environments: [devEnv, prodEnv],
    keyValues: [kvDevA, kvProdA, kvDevB],
    keyLinks: [] as KeyLink[],
    validationErrors: [] as ValidationError[],
    onSelectKey: vi.fn(),
    onDeleteKeys: vi.fn(),
    onToggleLock: vi.fn(),
    ...overrides,
  };
  return { ...render(<KeyTable {...props} />), props };
}

describe('KeyTable', () => {
  it('renders key names', () => {
    renderTable();
    expect(screen.getByText('API_KEY')).toBeTruthy();
    expect(screen.getByText('DB_HOST')).toBeTruthy();
  });

  it('renders environment column headers', () => {
    renderTable();
    expect(screen.getByText('dev')).toBeTruthy();
    expect(screen.getByText('prod')).toBeTruthy();
  });

  it('shows non-sensitive value directly', () => {
    renderTable();
    expect(screen.getByText('abc123')).toBeTruthy();
  });

  it('shows non-secure values as plain text', () => {
    renderTable();
    expect(screen.getByText('abc123')).toBeTruthy();
    expect(screen.getByText('secret')).toBeTruthy();
  });

  it('shows link icon for keys with links', () => {
    const link: KeyLink = { id: 1, source_key_id: 1, target_key_id: 2, rule: 'eq', created_at: '' };
    renderTable({ keyLinks: [link] });
    const linkIcons = screen.getAllByTitle('Linked key');
    expect(linkIcons.length).toBeGreaterThan(0);
  });

  it('shows error link icon when key has validation error', () => {
    const link: KeyLink = { id: 1, source_key_id: 1, target_key_id: 2, rule: 'eq', created_at: '' };
    const error: ValidationError = {
      sourceKeyId: 1, targetKeyId: 2,
      sourceKeyName: 'p.API_KEY', targetKeyName: 'p.DB_HOST',
      sourceProjectName: 'p', targetProjectName: 'p',
      environmentName: 'dev', rule: 'eq',
      sourceValue: 'a', targetValue: 'b',
    };
    renderTable({ keyLinks: [link], validationErrors: [error] });
    const errorIcons = screen.getAllByTitle('Link validation failed');
    expect(errorIcons.length).toBeGreaterThan(0);
  });

  it('calls onSelectKey when row clicked', () => {
    const { props } = renderTable();
    fireEvent.click(screen.getByText('API_KEY'));
    expect(props.onSelectKey).toHaveBeenCalledWith(keyA);
  });

  it('calls onDeleteKeys via context menu', () => {
    const { props } = renderTable();
    fireEvent.contextMenu(screen.getByText('API_KEY'));
    fireEvent.click(screen.getByText(/Delete key/));
    expect(props.onDeleteKeys).toHaveBeenCalledWith([1]);
  });

  it('renders empty state when no keys', () => {
    renderTable({ keys: [] });
    expect(screen.getByText('No keys yet.')).toBeTruthy();
  });

  it('shows key description as tooltip when present', () => {
    renderTable();
    expect(screen.getByTitle('The API key')).toBeTruthy();
  });

  it('shows dash for missing values', () => {
    renderTable({ keyValues: [] });
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('shows NULL label for null-value record (not dash), no copy button', () => {
    const kvNull: KeyValue = { id: 99, key_id: 1, environment_id: 1, value: null, updated_at: '' };
    renderTable({ keyValues: [kvNull] });
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBe(3);
    expect(screen.getByText('NULL')).toBeTruthy();
    expect(screen.queryByLabelText('Copy API_KEY for dev')).toBeNull();
  });

  it('selects row on plain click', () => {
    renderTable();
    const row = screen.getByText('API_KEY').closest('tr')!;
    fireEvent.click(screen.getByText('API_KEY'));
    expect(row.classList.contains('selected')).toBe(true);
  });

  it('context menu shows plural label when multiple rows selected', () => {
    renderTable();
    fireEvent.click(screen.getByText('API_KEY'));
    fireEvent.click(screen.getByText('DB_HOST'), { shiftKey: true });
    fireEvent.contextMenu(screen.getByText('DB_HOST'));
    expect(screen.getByText(/Delete 2 keys/)).toBeTruthy();
  });

  it('renders copy button for cells with values', () => {
    renderTable();
    expect(screen.getByLabelText('Copy API_KEY for dev')).toBeTruthy();
    expect(screen.getByLabelText('Copy API_KEY for prod')).toBeTruthy();
    expect(screen.getByLabelText('Copy DB_HOST for dev')).toBeTruthy();
  });

  it('does not render copy button for unset cells', () => {
    renderTable({ keyValues: [] });
    expect(screen.queryByLabelText(/^Copy /)).toBeNull();
  });

  it('copies value only to clipboard on copy button click', () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    renderTable();
    fireEvent.click(screen.getByLabelText('Copy API_KEY for dev'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('abc123');
  });
});

describe('KeyTable search', () => {
  it('renders search input', () => {
    renderTable();
    expect(screen.getByPlaceholderText('Search keys and values…')).toBeTruthy();
  });

  it('filters keys by name', () => {
    renderTable();
    fireEvent.change(screen.getByPlaceholderText('Search keys and values…'), { target: { value: 'API' } });
    expect(screen.getByText('API_KEY')).toBeTruthy();
    expect(screen.queryByText('DB_HOST')).toBeNull();
  });

  it('filters keys by env value', () => {
    renderTable();
    fireEvent.change(screen.getByPlaceholderText('Search keys and values…'), { target: { value: 'db-host' } });
    expect(screen.queryByText('API_KEY')).toBeNull();
    expect(screen.getByText('DB_HOST')).toBeTruthy();
  });

  it('shows result count when filtering', () => {
    renderTable();
    fireEvent.change(screen.getByPlaceholderText('Search keys and values…'), { target: { value: 'API' } });
    expect(screen.getByText('1 of 2 keys')).toBeTruthy();
  });

  it('clears search on Escape', () => {
    renderTable();
    const input = screen.getByPlaceholderText('Search keys and values…');
    fireEvent.change(input, { target: { value: 'API' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.getByText('API_KEY')).toBeTruthy();
    expect(screen.getByText('DB_HOST')).toBeTruthy();
  });

  it('shows clear button when search has text', () => {
    renderTable();
    fireEvent.change(screen.getByPlaceholderText('Search keys and values…'), { target: { value: 'x' } });
    expect(screen.getByLabelText('Clear search')).toBeTruthy();
  });

  it('clears search when clear button is clicked', () => {
    renderTable();
    fireEvent.change(screen.getByPlaceholderText('Search keys and values…'), { target: { value: 'API' } });
    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(screen.getByText('API_KEY')).toBeTruthy();
    expect(screen.getByText('DB_HOST')).toBeTruthy();
  });

  it('search is case-insensitive', () => {
    renderTable();
    fireEvent.change(screen.getByPlaceholderText('Search keys and values…'), { target: { value: 'api_key' } });
    expect(screen.getByText('API_KEY')).toBeTruthy();
  });
});

describe('KeyTable sort', () => {
  it('sorts by key name ascending on first click', () => {
    renderTable({ keys: [keyB, keyA] });
    // Before sort: DB_HOST first, API_KEY second
    const rows = screen.getAllByRole('row');
    expect(rows[1].textContent).toContain('DB_HOST');

    // Click Key header to sort asc
    fireEvent.click(screen.getByText('Key'));
    const sortedRows = screen.getAllByRole('row');
    expect(sortedRows[1].textContent).toContain('API_KEY');
    expect(sortedRows[2].textContent).toContain('DB_HOST');
  });

  it('sorts descending on second click', () => {
    renderTable({ keys: [keyA, keyB] });
    fireEvent.click(screen.getByText('Key'));
    fireEvent.click(screen.getByText(/Key/));
    const rows = screen.getAllByRole('row');
    expect(rows[1].textContent).toContain('DB_HOST');
    expect(rows[2].textContent).toContain('API_KEY');
  });

  it('resets sort on third click', () => {
    renderTable({ keys: [keyB, keyA] });
    fireEvent.click(screen.getByText('Key'));
    fireEvent.click(screen.getByText(/Key/));
    fireEvent.click(screen.getByText(/Key/));
    // Back to original order: DB_HOST first
    const rows = screen.getAllByRole('row');
    expect(rows[1].textContent).toContain('DB_HOST');
  });

  it('sorts by env column value', () => {
    // keyA dev=abc123, keyB dev=db-host-val
    renderTable({ keys: [keyB, keyA] });
    fireEvent.click(screen.getByText('dev'));
    const rows = screen.getAllByRole('row');
    // asc: abc123 < db-host-val
    expect(rows[1].textContent).toContain('API_KEY');
    expect(rows[2].textContent).toContain('DB_HOST');
  });

  it('sorts nulls/unset last when sorting by env column', () => {
    // keyA has prod value, keyB has no prod value
    renderTable({ keys: [keyB, keyA] });
    fireEvent.click(screen.getByText('prod'));
    const rows = screen.getAllByRole('row');
    // asc: keyA (has value) comes first, keyB (no value) last
    expect(rows[1].textContent).toContain('API_KEY');
    expect(rows[2].textContent).toContain('DB_HOST');
  });
});

describe('KeyTable value-diff cue', () => {
  it('adds value-differs class when env values differ', () => {
    // keyA: dev=abc123, prod=secret → different values
    renderTable();
    const row = screen.getByText('API_KEY').closest('tr')!;
    const envCells = row.querySelectorAll('.col-env');
    expect(envCells[0].classList.contains('value-differs')).toBe(true);
    expect(envCells[1].classList.contains('value-differs')).toBe(true);
  });

  it('does not add value-differs class when only one env has a value', () => {
    // keyB: dev=db-host-val, prod=unset → only 1 distinct value
    renderTable();
    const row = screen.getByText('DB_HOST').closest('tr')!;
    const envCells = row.querySelectorAll('.col-env');
    expect(envCells[0].classList.contains('value-differs')).toBe(false);
    expect(envCells[1].classList.contains('value-differs')).toBe(false);
  });

  it('does not add value-differs when all env values are identical', () => {
    const kvSame: KeyValue[] = [
      { id: 1, key_id: 1, environment_id: 1, value: 'same', updated_at: '' },
      { id: 2, key_id: 1, environment_id: 2, value: 'same', updated_at: '' },
    ];
    renderTable({ keys: [keyA], keyValues: kvSame });
    const row = screen.getByText('API_KEY').closest('tr')!;
    const envCells = row.querySelectorAll('.col-env');
    expect(envCells[0].classList.contains('value-differs')).toBe(false);
  });

  it('does not add value-differs with single environment', () => {
    renderTable({ environments: [devEnv] });
    const row = screen.getByText('API_KEY').closest('tr')!;
    const envCells = row.querySelectorAll('.col-env');
    expect(envCells[0].classList.contains('value-differs')).toBe(false);
  });
});

describe('KeyTable value-missing cue', () => {
  it('adds value-missing class to unset cells', () => {
    // keyB has no prod value (unset)
    renderTable();
    const row = screen.getByText('DB_HOST').closest('tr')!;
    const envCells = row.querySelectorAll('.col-env');
    // dev has value → no missing
    expect(envCells[0].classList.contains('value-missing')).toBe(false);
    // prod is unset → missing
    expect(envCells[1].classList.contains('value-missing')).toBe(true);
  });

  it('adds value-missing class to null-value cells', () => {
    const kvNull: KeyValue = { id: 99, key_id: 1, environment_id: 1, value: null, updated_at: '' };
    renderTable({ keys: [keyA], keyValues: [kvNull] });
    const row = screen.getByText('API_KEY').closest('tr')!;
    const envCells = row.querySelectorAll('.col-env');
    // dev has null record → missing
    expect(envCells[0].classList.contains('value-missing')).toBe(true);
    // prod has no record → missing
    expect(envCells[1].classList.contains('value-missing')).toBe(true);
  });

  it('does not add value-missing to cells with values', () => {
    renderTable();
    const row = screen.getByText('API_KEY').closest('tr')!;
    const envCells = row.querySelectorAll('.col-env');
    // Both dev and prod have values
    expect(envCells[0].classList.contains('value-missing')).toBe(false);
    expect(envCells[1].classList.contains('value-missing')).toBe(false);
  });
});

describe('KeyTable masking', () => {
  it('masks secure key values by default', () => {
    renderTable();
    // keyB is secure → its dev value should be masked
    expect(screen.queryByText('db-host-val')).toBeNull();
    expect(screen.getAllByText('••••••').length).toBeGreaterThan(0);
  });

  it('does not mask non-secure key values', () => {
    renderTable();
    expect(screen.getByText('abc123')).toBeTruthy();
    expect(screen.getByText('secret')).toBeTruthy();
  });

  it('reveals value when eye icon is clicked', () => {
    renderTable();
    // keyB (DB_HOST) is secure → masked
    expect(screen.queryByText('db-host-val')).toBeNull();
    // Click the reveal button
    fireEvent.click(screen.getByLabelText('Reveal DB_HOST'));
    expect(screen.getByText('db-host-val')).toBeTruthy();
  });

  it('masks value again when eye icon is toggled back', () => {
    renderTable();
    fireEvent.click(screen.getByLabelText('Reveal DB_HOST'));
    expect(screen.getByText('db-host-val')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Mask DB_HOST'));
    expect(screen.queryByText('db-host-val')).toBeNull();
  });

  it('does not show eye icon for non-secure keys', () => {
    renderTable();
    expect(screen.queryByLabelText('Reveal API_KEY')).toBeNull();
    expect(screen.queryByLabelText('Mask API_KEY')).toBeNull();
  });

  it('copies real value even when masked', () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    renderTable();
    // keyB dev value is masked but copy should use real value
    fireEvent.click(screen.getByLabelText('Copy DB_HOST for dev'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('db-host-val');
  });

  it('search uses real values regardless of masking', () => {
    renderTable();
    // keyB dev value is masked, but search should find it
    fireEvent.change(screen.getByPlaceholderText('Search keys and values…'), { target: { value: 'db-host' } });
    expect(screen.getByText('DB_HOST')).toBeTruthy();
  });
});

describe('KeyTable N/A values', () => {
  const kvNA: KeyValue = { id: 10, key_id: 1, environment_id: 1, value: '<NA>', updated_at: '' };

  it('renders NA badge for <NA> value', () => {
    renderTable({ keys: [keyA], keyValues: [kvNA] });
    expect(screen.getByText('NA')).toBeTruthy();
    const badge = screen.getByText('NA');
    expect(badge.classList.contains('na-badge')).toBe(true);
  });

  it('adds value-na class to NA cells', () => {
    renderTable({ keys: [keyA], keyValues: [kvNA] });
    const row = screen.getByText('API_KEY').closest('tr')!;
    const envCells = row.querySelectorAll('.col-env');
    expect(envCells[0].classList.contains('value-na')).toBe(true);
  });

  it('does not render copy button for NA cells', () => {
    renderTable({ keys: [keyA], keyValues: [kvNA] });
    expect(screen.queryByLabelText('Copy API_KEY for dev')).toBeNull();
  });

  it('hasDifferingValues ignores NA values', () => {
    // dev=<NA>, prod=secret → only 1 real value → no differs
    const kvs: KeyValue[] = [
      { id: 10, key_id: 1, environment_id: 1, value: '<NA>', updated_at: '' },
      { id: 11, key_id: 1, environment_id: 2, value: 'secret', updated_at: '' },
    ];
    renderTable({ keys: [keyA], keyValues: kvs });
    const row = screen.getByText('API_KEY').closest('tr')!;
    const envCells = row.querySelectorAll('.col-env');
    expect(envCells[1].classList.contains('value-differs')).toBe(false);
  });

  it('search does not match NA values', () => {
    renderTable({ keys: [keyA, keyB], keyValues: [kvNA, kvDevB] });
    fireEvent.change(screen.getByPlaceholderText('Search keys and values…'), { target: { value: '<NA>' } });
    expect(screen.queryByText('API_KEY')).toBeNull();
    expect(screen.queryByText('DB_HOST')).toBeNull();
  });

  it('treats NA cell as value-missing', () => {
    renderTable({ keys: [keyA], keyValues: [kvNA] });
    const row = screen.getByText('API_KEY').closest('tr')!;
    const envCells = row.querySelectorAll('.col-env');
    expect(envCells[0].classList.contains('value-missing')).toBe(true);
  });
});

describe('KeyTable lock', () => {
  it('renders lock icon for all keys', () => {
    renderTable();
    expect(screen.getByLabelText('Lock API_KEY')).toBeTruthy();
    expect(screen.getByLabelText('Lock DB_HOST')).toBeTruthy();
  });

  it('shows locked state for locked keys', () => {
    const lockedKey: EnvKey = { ...keyA, is_locked: 1 };
    renderTable({ keys: [lockedKey] });
    expect(screen.getByLabelText('Unlock API_KEY')).toBeTruthy();
  });

  it('calls onToggleLock when lock icon clicked', () => {
    const { props } = renderTable();
    fireEvent.click(screen.getByLabelText('Lock API_KEY'));
    expect(props.onToggleLock).toHaveBeenCalledWith(1, true);
  });

  it('calls onToggleLock to unlock when unlocking a locked key', () => {
    const lockedKey: EnvKey = { ...keyA, is_locked: 1 };
    const { props } = renderTable({ keys: [lockedKey] });
    fireEvent.click(screen.getByLabelText('Unlock API_KEY'));
    expect(props.onToggleLock).toHaveBeenCalledWith(1, false);
  });

  it('adds locked class to locked key row', () => {
    const lockedKey: EnvKey = { ...keyA, is_locked: 1 };
    renderTable({ keys: [lockedKey] });
    const row = screen.getByText('API_KEY').closest('tr')!;
    expect(row.classList.contains('locked')).toBe(true);
  });
});

describe('KeyTable link indicator', () => {
  it('does not show link icon for unlinked keys', () => {
    renderTable();
    expect(screen.queryByLabelText('Linked API_KEY')).toBeNull();
    expect(screen.queryByLabelText('Linked DB_HOST')).toBeNull();
  });

  it('shows link icon only for linked keys', () => {
    const link: KeyLink = { id: 1, source_key_id: 1, target_key_id: 99, rule: 'eq', created_at: '' };
    renderTable({ keyLinks: [link] });
    expect(screen.getByLabelText('Linked API_KEY')).toBeTruthy();
    expect(screen.queryByLabelText('Linked DB_HOST')).toBeNull();
  });

  it('shows "Linked key" title for linked keys', () => {
    const link: KeyLink = { id: 1, source_key_id: 1, target_key_id: 99, rule: 'eq', created_at: '' };
    renderTable({ keyLinks: [link] });
    expect(screen.getByTitle('Linked key')).toBeTruthy();
  });

  it('link icon is not a button (display-only)', () => {
    const link: KeyLink = { id: 1, source_key_id: 1, target_key_id: 99, rule: 'eq', created_at: '' };
    renderTable({ keyLinks: [link] });
    const icon = screen.getByLabelText('Linked API_KEY');
    expect(icon.tagName).toBe('SPAN');
  });
});
