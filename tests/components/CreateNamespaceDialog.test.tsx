import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CreateNamespaceDialog } from '../../src/components/CreateNamespaceDialog';

function renderDialog(overrides: Partial<Parameters<typeof CreateNamespaceDialog>[0]> = {}) {
  const props = {
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  return { ...render(<CreateNamespaceDialog {...props} />), props };
}

describe('CreateNamespaceDialog', () => {
  it('renders the title', () => {
    renderDialog();
    expect(screen.getByText('New namespace')).toBeTruthy();
  });

  it('renders the name input field', () => {
    renderDialog();
    expect(screen.getByPlaceholderText('e.g. myapp')).toBeTruthy();
  });

  it('submit button disabled when name is empty', () => {
    renderDialog();
    expect((screen.getByText('Create') as HTMLButtonElement).disabled).toBe(true);
  });

  it('submit button enabled when name is filled', () => {
    renderDialog();
    fireEvent.change(screen.getByPlaceholderText('e.g. myapp'), { target: { value: 'myapp' } });
    expect((screen.getByText('Create') as HTMLButtonElement).disabled).toBe(false);
  });

  it('calls onSubmit with trimmed name', () => {
    const { props } = renderDialog();
    fireEvent.change(screen.getByPlaceholderText('e.g. myapp'), { target: { value: '  myapp  ' } });
    fireEvent.click(screen.getByText('Create'));
    expect(props.onSubmit).toHaveBeenCalledWith('myapp');
  });

  it('submits on Enter key', () => {
    const { props } = renderDialog();
    const input = screen.getByPlaceholderText('e.g. myapp');
    fireEvent.change(input, { target: { value: 'myapp' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onSubmit).toHaveBeenCalledWith('myapp');
  });

  it('does not submit on Enter when name is empty', () => {
    const { props } = renderDialog();
    const input = screen.getByPlaceholderText('e.g. myapp');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it('calls onCancel when Cancel is clicked', () => {
    const { props } = renderDialog();
    fireEvent.click(screen.getByText('Cancel'));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Escape pressed in name field', () => {
    const { props } = renderDialog();
    fireEvent.keyDown(screen.getByPlaceholderText('e.g. myapp'), { key: 'Escape' });
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when overlay is clicked', () => {
    const { props } = renderDialog();
    fireEvent.click(screen.getByRole('dialog').parentElement!);
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });
});
