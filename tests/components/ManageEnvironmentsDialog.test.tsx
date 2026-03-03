import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ManageEnvironmentsDialog } from '../../src/components/ManageEnvironmentsDialog';
import type { Environment } from '../../src/types';

const devEnv: Environment = { id: 1, namespace_id: 1, name: 'dev', sort_order: 0 };
const prodEnv: Environment = { id: 2, namespace_id: 1, name: 'prod', sort_order: 1 };
const stagingEnv: Environment = { id: 3, namespace_id: 1, name: 'staging', sort_order: 2 };

function renderDialog(overrides: Partial<Parameters<typeof ManageEnvironmentsDialog>[0]> = {}) {
  const props = {
    environments: [devEnv, prodEnv],
    onAdd: vi.fn(),
    onDelete: vi.fn(),
    onReorder: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  return { ...render(<ManageEnvironmentsDialog {...props} />), props };
}

describe('ManageEnvironmentsDialog', () => {
  it('renders the title', () => {
    renderDialog();
    expect(screen.getByText('Manage environments')).toBeTruthy();
  });

  it('renders existing environment names', () => {
    renderDialog();
    expect(screen.getByText('dev')).toBeTruthy();
    expect(screen.getByText('prod')).toBeTruthy();
  });

  it('shows "No environments yet" when list is empty', () => {
    renderDialog({ environments: [] });
    expect(screen.getByText('No environments yet.')).toBeTruthy();
  });

  it('renders delete button for each environment', () => {
    renderDialog();
    expect(screen.getByLabelText('Delete dev')).toBeTruthy();
    expect(screen.getByLabelText('Delete prod')).toBeTruthy();
  });

  it('calls onDelete with env id when delete button is clicked', () => {
    const { props } = renderDialog();
    fireEvent.click(screen.getByLabelText('Delete dev'));
    expect(props.onDelete).toHaveBeenCalledWith(1);
  });

  it('Add button disabled when input is empty', () => {
    renderDialog();
    expect((screen.getByText('Add') as HTMLButtonElement).disabled).toBe(true);
  });

  it('Add button enabled when name is valid', () => {
    renderDialog();
    fireEvent.change(screen.getByPlaceholderText('New environment name'), { target: { value: 'staging' } });
    expect((screen.getByText('Add') as HTMLButtonElement).disabled).toBe(false);
  });

  it('Add button disabled when name is duplicate', () => {
    renderDialog();
    fireEvent.change(screen.getByPlaceholderText('New environment name'), { target: { value: 'dev' } });
    expect((screen.getByText('Add') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Name already exists.')).toBeTruthy();
  });

  it('Add button disabled when name contains slash', () => {
    renderDialog();
    fireEvent.change(screen.getByPlaceholderText('New environment name'), { target: { value: 'dev/test' } });
    expect((screen.getByText('Add') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Name must not contain "/".')).toBeTruthy();
  });

  it('calls onAdd with trimmed name when Add is clicked', () => {
    const { props } = renderDialog();
    fireEvent.change(screen.getByPlaceholderText('New environment name'), { target: { value: '  staging  ' } });
    fireEvent.click(screen.getByText('Add'));
    expect(props.onAdd).toHaveBeenCalledWith('staging');
  });

  it('calls onAdd on Enter key', () => {
    const { props } = renderDialog();
    const input = screen.getByPlaceholderText('New environment name');
    fireEvent.change(input, { target: { value: 'staging' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onAdd).toHaveBeenCalledWith('staging');
  });

  it('calls onClose when Close is clicked', () => {
    const { props } = renderDialog();
    fireEvent.click(screen.getByText('Close'));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape is pressed', () => {
    const { props } = renderDialog();
    const input = screen.getByPlaceholderText('New environment name');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when overlay is clicked', () => {
    const { props } = renderDialog();
    fireEvent.click(screen.getByRole('dialog').parentElement!);
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  // Reorder tests

  it('renders up/down buttons for each environment', () => {
    renderDialog();
    expect(screen.getByLabelText('Move dev up')).toBeTruthy();
    expect(screen.getByLabelText('Move dev down')).toBeTruthy();
    expect(screen.getByLabelText('Move prod up')).toBeTruthy();
    expect(screen.getByLabelText('Move prod down')).toBeTruthy();
  });

  it('disables up button for the first environment', () => {
    renderDialog();
    expect((screen.getByLabelText('Move dev up') as HTMLButtonElement).disabled).toBe(true);
  });

  it('disables down button for the last environment', () => {
    renderDialog();
    expect((screen.getByLabelText('Move prod down') as HTMLButtonElement).disabled).toBe(true);
  });

  it('calls onReorder with swapped ids when moving down', () => {
    const { props } = renderDialog();
    fireEvent.click(screen.getByLabelText('Move dev down'));
    expect(props.onReorder).toHaveBeenCalledWith([2, 1]);
  });

  it('calls onReorder with swapped ids when moving up', () => {
    const { props } = renderDialog();
    fireEvent.click(screen.getByLabelText('Move prod up'));
    expect(props.onReorder).toHaveBeenCalledWith([2, 1]);
  });

  it('does not call onReorder when clicking disabled up button on first item', () => {
    const { props } = renderDialog();
    fireEvent.click(screen.getByLabelText('Move dev up'));
    expect(props.onReorder).not.toHaveBeenCalled();
  });

  it('does not call onReorder when clicking disabled down button on last item', () => {
    const { props } = renderDialog();
    fireEvent.click(screen.getByLabelText('Move prod down'));
    expect(props.onReorder).not.toHaveBeenCalled();
  });

  it('calls onReorder with correct ids for middle item', () => {
    const { props } = renderDialog({ environments: [devEnv, stagingEnv, prodEnv] });
    fireEvent.click(screen.getByLabelText('Move staging down'));
    expect(props.onReorder).toHaveBeenCalledWith([1, 2, 3]);
  });
});
