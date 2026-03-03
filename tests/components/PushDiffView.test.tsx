import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PushDiffView } from '../../src/components/PushDiffView';
import type { DiffItem } from '../../src/types';

const createItem: DiffItem = {
  action: 'create',
  path: '/ns/proj/dev/NEW_KEY',
  localValue: 'new-value',
};

const updateItem: DiffItem = {
  action: 'update',
  path: '/ns/proj/dev/CHANGED_KEY',
  localValue: 'new-val',
  remoteValue: 'old-val',
  remoteLastModified: new Date('2026-01-15'),
};

const deleteItem: DiffItem = {
  action: 'delete',
  path: '/ns/proj/dev/OLD_KEY',
  remoteValue: 'old-value',
  remoteLastModified: new Date('2025-11-01'),
};

describe('PushDiffView — push mode', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <PushDiffView diff={[createItem]} isOpen={false} mode="push" onConfirm={vi.fn()} onCancel={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders "nothing to push" message when diff is empty', () => {
    render(<PushDiffView diff={[]} isOpen={true} mode="push" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText(/nothing to push/i)).toBeTruthy();
  });

  it('renders create item with localValue', () => {
    render(<PushDiffView diff={[createItem]} isOpen={true} mode="push" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('+ NEW')).toBeTruthy();
    expect(screen.getByText('/ns/proj/dev/NEW_KEY')).toBeTruthy();
    expect(screen.getByText('→ new-value')).toBeTruthy();
  });

  it('renders update item: was=remote, now=local', () => {
    render(<PushDiffView diff={[updateItem]} isOpen={true} mode="push" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('~ CHANGED')).toBeTruthy();
    expect(screen.getByText(/old-val/)).toBeTruthy();
    expect(screen.getByText(/new-val/)).toBeTruthy();
  });

  it('renders delete item', () => {
    render(<PushDiffView diff={[deleteItem]} isOpen={true} mode="push" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('- DELETE')).toBeTruthy();
    expect(screen.getByText('/ns/proj/dev/OLD_KEY')).toBeTruthy();
  });

  it('shows summary counts', () => {
    const diff = [createItem, updateItem, deleteItem];
    render(<PushDiffView diff={diff} isOpen={true} mode="push" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText(/1 new.*1 changed.*1 to delete/i)).toBeTruthy();
  });

  it('calls onConfirm when Confirm Push clicked', () => {
    const onConfirm = vi.fn();
    render(<PushDiffView diff={[createItem]} isOpen={true} mode="push" onConfirm={onConfirm} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByText(/confirm push/i));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Cancel clicked', () => {
    const onCancel = vi.fn();
    render(<PushDiffView diff={[createItem]} isOpen={true} mode="push" onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Close clicked on empty diff', () => {
    const onCancel = vi.fn();
    render(<PushDiffView diff={[]} isOpen={true} mode="push" onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Close'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('PushDiffView — pull mode', () => {
  const pullCreateItem: DiffItem = {
    action: 'create',
    path: '/ns/proj/dev/SSM_ONLY',
    remoteValue: 'from-ssm',
  };

  const pullUpdateItem: DiffItem = {
    action: 'update',
    path: '/ns/proj/dev/UPDATED_KEY',
    remoteValue: 'ssm-val',
    localValue: 'local-val',
    keyId: 1,
    environmentId: 1,
  };

  const pullDeleteItem: DiffItem = {
    action: 'delete',
    path: '/ns/proj/dev/LOCAL_ONLY',
    localValue: 'local-value',
    keyId: 2,
    environmentId: 1,
  };

  it('renders "nothing to pull" message when diff is empty', () => {
    render(<PushDiffView diff={[]} isOpen={true} mode="pull" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText(/nothing to pull/i)).toBeTruthy();
  });

  it('renders Pull Diff title', () => {
    render(<PushDiffView diff={[pullCreateItem]} isOpen={true} mode="pull" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('Pull Diff')).toBeTruthy();
  });

  it('renders create item with remoteValue', () => {
    render(<PushDiffView diff={[pullCreateItem]} isOpen={true} mode="pull" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('→ from-ssm')).toBeTruthy();
  });

  it('renders update item: was=local, now=remote', () => {
    render(<PushDiffView diff={[pullUpdateItem]} isOpen={true} mode="pull" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText(/local-val/)).toBeTruthy();
    expect(screen.getByText(/ssm-val/)).toBeTruthy();
  });

  it('renders delete item with localValue', () => {
    render(<PushDiffView diff={[pullDeleteItem]} isOpen={true} mode="pull" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('- DELETE')).toBeTruthy();
    expect(screen.getByText(/local-value/)).toBeTruthy();
  });

  it('calls onConfirm when Confirm Pull clicked', () => {
    const onConfirm = vi.fn();
    render(<PushDiffView diff={[pullCreateItem]} isOpen={true} mode="pull" onConfirm={onConfirm} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByText(/confirm pull/i));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
