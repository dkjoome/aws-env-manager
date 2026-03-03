import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmDialog } from '../../src/components/ConfirmDialog';

describe('ConfirmDialog', () => {
  it('renders title and message', () => {
    render(<ConfirmDialog title="Delete namespace" message="Are you sure?" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('Delete namespace')).toBeTruthy();
    expect(screen.getByText('Are you sure?')).toBeTruthy();
  });

  it('uses default confirmLabel "Delete"', () => {
    render(<ConfirmDialog title="t" message="m" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('Delete')).toBeTruthy();
  });

  it('uses custom confirmLabel', () => {
    render(<ConfirmDialog title="t" message="m" confirmLabel="Remove" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText('Remove')).toBeTruthy();
  });

  it('calls onConfirm when confirm button clicked', () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog title="t" message="m" onConfirm={onConfirm} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByText('Delete'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Cancel button clicked', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog title="t" message="m" onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when overlay is clicked', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog title="t" message="m" onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('dialog').parentElement!);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('does not call onCancel when dialog content is clicked', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog title="t" message="m" onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('does not call onConfirm when Cancel clicked', () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog title="t" message="m" onConfirm={onConfirm} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
