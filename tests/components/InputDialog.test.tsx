import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InputDialog } from '../../src/components/InputDialog';

function renderDialog(overrides: Partial<Parameters<typeof InputDialog>[0]> = {}) {
  const props = {
    title: 'New project',
    label: 'Project name',
    placeholder: 'e.g. api-service',
    submitLabel: 'Create',
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  return { ...render(<InputDialog {...props} />), props };
}

describe('InputDialog', () => {
  it('renders title and label', () => {
    renderDialog();
    expect(screen.getByText('New project')).toBeTruthy();
    expect(screen.getByText('Project name')).toBeTruthy();
  });

  it('renders placeholder', () => {
    renderDialog();
    expect(screen.getByPlaceholderText('e.g. api-service')).toBeTruthy();
  });

  it('submit button is disabled when input is empty', () => {
    renderDialog();
    expect((screen.getByText('Create') as HTMLButtonElement).disabled).toBe(true);
  });

  it('submit button enables when value is entered', () => {
    renderDialog();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'my-project' } });
    expect((screen.getByText('Create') as HTMLButtonElement).disabled).toBe(false);
  });

  it('calls onSubmit with trimmed value on button click', () => {
    const { props } = renderDialog();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  my-project  ' } });
    fireEvent.click(screen.getByText('Create'));
    expect(props.onSubmit).toHaveBeenCalledWith('my-project');
  });

  it('calls onSubmit when Enter is pressed', () => {
    const { props } = renderDialog();
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'my-project' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onSubmit).toHaveBeenCalledWith('my-project');
  });

  it('does not call onSubmit on Enter when input is empty', () => {
    const { props } = renderDialog();
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it('does not call onSubmit when input is whitespace only', () => {
    const { props } = renderDialog();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } });
    fireEvent.click(screen.getByText('Create'));
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it('calls onCancel when Cancel is clicked', () => {
    const { props } = renderDialog();
    fireEvent.click(screen.getByText('Cancel'));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Escape is pressed', () => {
    const { props } = renderDialog();
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when overlay is clicked', () => {
    const { props } = renderDialog();
    fireEvent.click(screen.getByRole('dialog').parentElement!);
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it('does not call onCancel when dialog content is clicked', () => {
    const { props } = renderDialog();
    fireEvent.click(screen.getByRole('dialog'));
    expect(props.onCancel).not.toHaveBeenCalled();
  });

  it('uses custom submitLabel', () => {
    renderDialog({ submitLabel: 'Add' });
    expect(screen.getByText('Add')).toBeTruthy();
  });
});
