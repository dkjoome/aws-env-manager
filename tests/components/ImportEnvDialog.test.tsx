import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImportEnvDialog } from '../../src/components/ImportEnvDialog';
import type { Environment } from '../../src/types';

const devEnv: Environment = { id: 1, namespace_id: 1, name: 'dev', sort_order: 0 };
const prodEnv: Environment = { id: 2, namespace_id: 1, name: 'prod', sort_order: 1 };

function renderDialog(overrides: Partial<Parameters<typeof ImportEnvDialog>[0]> = {}) {
  const props = {
    environments: [devEnv, prodEnv],
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  return { ...render(<ImportEnvDialog {...props} />), props };
}

describe('ImportEnvDialog', () => {
  it('renders the title', () => {
    renderDialog();
    expect(screen.getByText('Import .env')).toBeTruthy();
  });

  it('renders all environment options in the select', () => {
    renderDialog();
    expect(screen.getByText('dev')).toBeTruthy();
    expect(screen.getByText('prod')).toBeTruthy();
  });

  it('submit button disabled when textarea is empty', () => {
    renderDialog();
    expect((screen.getByText('Import') as HTMLButtonElement).disabled).toBe(true);
  });

  it('submit button enabled when textarea has content', () => {
    renderDialog();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'KEY=value' } });
    expect((screen.getByText('Import') as HTMLButtonElement).disabled).toBe(false);
  });

  it('defaults to the first environment', () => {
    const { props } = renderDialog();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'KEY=value' } });
    fireEvent.click(screen.getByText('Import'));
    expect(props.onSubmit).toHaveBeenCalledWith('KEY=value', 1);
  });

  it('calls onSubmit with content and selected environmentId', () => {
    const { props } = renderDialog();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '2' } });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'KEY=value\nOTHER=123' } });
    fireEvent.click(screen.getByText('Import'));
    expect(props.onSubmit).toHaveBeenCalledWith('KEY=value\nOTHER=123', 2);
  });

  it('renders Choose file button', () => {
    renderDialog();
    expect(screen.getByText('Choose file…')).toBeTruthy();
  });

  it('renders file name placeholder before file chosen', () => {
    renderDialog();
    expect(screen.getByText('No file chosen')).toBeTruthy();
  });

  it('calls onCancel when Cancel is clicked', () => {
    const { props } = renderDialog();
    fireEvent.click(screen.getByText('Cancel'));
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

  it('submit disabled when no environments provided', () => {
    renderDialog({ environments: [] });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'KEY=value' } });
    expect((screen.getByText('Import') as HTMLButtonElement).disabled).toBe(true);
  });

  it('renders without crashing when environments list is empty', () => {
    renderDialog({ environments: [] });
    expect(screen.getByText('Import .env')).toBeTruthy();
  });

  it('rejects non-.env files', () => {
    renderDialog();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['binary'], 'image.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByText('Only .env or .env.* files are allowed.')).toBeTruthy();
  });

  it('accepts .env files', () => {
    renderDialog();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['KEY=val'], '.env', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.queryByText('Only .env or .env.* files are allowed.')).toBeNull();
  });

  it('accepts .env.production files', () => {
    renderDialog();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['KEY=val'], '.env.production', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.queryByText('Only .env or .env.* files are allowed.')).toBeNull();
  });
});
