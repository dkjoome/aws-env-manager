import { useState, useEffect } from 'react';
import type { Settings } from '../types';

interface SettingsScreenProps {
  settings: Settings | null;
  isOpen: boolean;
  onSave: (settings: Partial<Omit<Settings, 'id' | 'updated_at'>>) => void;
  onClose: () => void;
}

export function SettingsScreen({ settings, isOpen, onSave, onClose }: SettingsScreenProps) {
  const [credentialsFilePath, setCredentialsFilePath] = useState('');
  const [ssmProfile, setSsmProfile] = useState('');
  const [s3Profile, setS3Profile] = useState('');
  const [s3Bucket, setS3Bucket] = useState('');
  const [s3BackupPrefix, setS3BackupPrefix] = useState('');
  const [awsRegion, setAwsRegion] = useState('');

  useEffect(() => {
    if (!settings) return;
    setCredentialsFilePath(settings.credentials_file_path ?? '');
    setSsmProfile(settings.ssm_profile ?? '');
    setS3Profile(settings.s3_profile ?? '');
    setS3Bucket(settings.s3_bucket ?? '');
    setS3BackupPrefix(settings.s3_backup_prefix ?? '');
    setAwsRegion(settings.aws_region ?? '');
  }, [settings]);

  if (!isOpen) return null;

  function handleSave() {
    onSave({
      credentials_file_path: credentialsFilePath || null,
      ssm_profile: ssmProfile || null,
      s3_profile: s3Profile || null,
      s3_bucket: s3Bucket || null,
      s3_backup_prefix: s3BackupPrefix || null,
      aws_region: awsRegion || null,
    });
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal settings-modal">
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close settings">✕</button>
        </div>

        <div className="modal-body">
          <h3 className="section-title">AWS Credentials</h3>

          <div className="form-group">
            <label htmlFor="creds-path">Credentials file path</label>
            <input
              id="creds-path"
              type="text"
              value={credentialsFilePath}
              onChange={(e) => setCredentialsFilePath(e.target.value)}
              className="form-input"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="~/.aws/credentials"
            />
            <small className="form-hint">Leave blank to use default (~/.aws/credentials)</small>
          </div>

          <div className="form-group">
            <label htmlFor="ssm-profile">SSM profile name</label>
            <input
              id="ssm-profile"
              type="text"
              value={ssmProfile}
              onChange={(e) => setSsmProfile(e.target.value)}
              className="form-input"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="default"
            />
          </div>

          <div className="form-group">
            <label htmlFor="aws-region">AWS region</label>
            <input
              id="aws-region"
              type="text"
              value={awsRegion}
              onChange={(e) => setAwsRegion(e.target.value)}
              className="form-input"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="us-east-1"
            />
            <small className="form-hint">Region for SSM and S3 (default: us-east-1)</small>
          </div>

          <h3 className="section-title">S3 Backup</h3>

          <div className="form-group">
            <label htmlFor="s3-profile">S3 profile name</label>
            <input
              id="s3-profile"
              type="text"
              value={s3Profile}
              onChange={(e) => setS3Profile(e.target.value)}
              className="form-input"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="default"
            />
          </div>

          <div className="form-group">
            <label htmlFor="s3-bucket">S3 bucket</label>
            <input
              id="s3-bucket"
              type="text"
              value={s3Bucket}
              onChange={(e) => setS3Bucket(e.target.value)}
              className="form-input"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="my-backup-bucket"
            />
          </div>

          <div className="form-group">
            <label htmlFor="s3-prefix">Backup prefix (path in bucket)</label>
            <input
              id="s3-prefix"
              type="text"
              value={s3BackupPrefix}
              onChange={(e) => setS3BackupPrefix(e.target.value)}
              className="form-input"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="aws-env-manager/backups/"
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="action-btn" onClick={onClose}>Cancel</button>
          <button className="action-btn primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}
