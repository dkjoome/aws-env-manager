import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TopBar } from '../../src/components/TopBar';

function renderTopBar(overrides: Partial<Parameters<typeof TopBar>[0]> = {}) {
  const props = {
    onCreateNamespace: vi.fn(),
    ...overrides,
  };
  return { ...render(<TopBar {...props} />), props };
}

describe('TopBar', () => {
  it('renders + Namespace button', () => {
    renderTopBar();
    expect(screen.getByText('+ Namespace')).toBeTruthy();
  });

  it('calls onCreateNamespace when + Namespace clicked', () => {
    const { props } = renderTopBar();
    fireEvent.click(screen.getByText('+ Namespace'));
    expect(props.onCreateNamespace).toHaveBeenCalledTimes(1);
  });

  it('does not render Pull button', () => {
    renderTopBar();
    expect(screen.queryByText(/Pull/i)).toBeNull();
  });

  it('does not render Push button', () => {
    renderTopBar();
    expect(screen.queryByText(/Push/i)).toBeNull();
  });

  it('does not render namespace dropdown', () => {
    renderTopBar();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('does not render Backup button', () => {
    renderTopBar();
    expect(screen.queryByText(/Backup/i)).toBeNull();
  });

  it('does not render AWS Console button', () => {
    renderTopBar();
    expect(screen.queryByText(/AWS Console/i)).toBeNull();
  });
});
