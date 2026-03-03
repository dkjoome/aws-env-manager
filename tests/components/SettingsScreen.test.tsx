import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsScreen } from '../../src/components/SettingsScreen';
import type { Settings } from '../../src/types';

const defaultSettings: Settings = {
  id: 1,
  credentials_file_path: '/home/user/.aws/credentials',
  ssm_profile: 'my-ssm',
  s3_profile: 'my-s3',
  s3_bucket: 'my-bucket',
  s3_backup_prefix: 'backups/',
  aws_region: 'us-west-2',
  updated_at: '',
};

describe('SettingsScreen', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <SettingsScreen settings={null} isOpen={false} onSave={vi.fn()} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders settings form when isOpen is true', () => {
    render(<SettingsScreen settings={null} isOpen={true} onSave={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText('Settings')).toBeTruthy();
    expect(screen.getByLabelText('Credentials file path')).toBeTruthy();
    expect(screen.getByLabelText('SSM profile name')).toBeTruthy();
    expect(screen.getByLabelText('S3 profile name')).toBeTruthy();
    expect(screen.getByLabelText('S3 bucket')).toBeTruthy();
  });

  it('pre-fills inputs from settings prop', () => {
    render(
      <SettingsScreen settings={defaultSettings} isOpen={true} onSave={vi.fn()} onClose={vi.fn()} />
    );
    expect((screen.getByLabelText('Credentials file path') as HTMLInputElement).value).toBe(
      '/home/user/.aws/credentials'
    );
    expect((screen.getByLabelText('SSM profile name') as HTMLInputElement).value).toBe('my-ssm');
    expect((screen.getByLabelText('S3 profile name') as HTMLInputElement).value).toBe('my-s3');
    expect((screen.getByLabelText('S3 bucket') as HTMLInputElement).value).toBe('my-bucket');
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(<SettingsScreen settings={null} isOpen={true} onSave={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when ✕ button is clicked', () => {
    const onClose = vi.fn();
    render(<SettingsScreen settings={null} isOpen={true} onSave={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close settings'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onSave with form values when Save is clicked', () => {
    const onSave = vi.fn();
    render(<SettingsScreen settings={null} isOpen={true} onSave={onSave} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('SSM profile name'), {
      target: { value: 'new-profile' },
    });
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ ssm_profile: 'new-profile' })
    );
  });

  it('passes null for empty string fields', () => {
    const onSave = vi.fn();
    render(
      <SettingsScreen settings={defaultSettings} isOpen={true} onSave={onSave} onClose={vi.fn()} />
    );
    // Clear the SSM profile field
    fireEvent.change(screen.getByLabelText('SSM profile name'), { target: { value: '' } });
    fireEvent.click(screen.getByText('Save'));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ ssm_profile: null })
    );
  });

  it('updates when settings prop changes', () => {
    const { rerender } = render(
      <SettingsScreen settings={null} isOpen={true} onSave={vi.fn()} onClose={vi.fn()} />
    );
    expect((screen.getByLabelText('SSM profile name') as HTMLInputElement).value).toBe('');

    rerender(
      <SettingsScreen settings={defaultSettings} isOpen={true} onSave={vi.fn()} onClose={vi.fn()} />
    );
    expect((screen.getByLabelText('SSM profile name') as HTMLInputElement).value).toBe('my-ssm');
  });
});
