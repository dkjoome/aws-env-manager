import { useState, useRef, useEffect } from 'react';
import type { Namespace } from '../types';

interface NamespaceCredentialsDialogProps {
  namespace: Namespace;
  onSubmit: (ssmProfile: string, awsRegion: string) => void;
  onCancel: () => void;
}

export function NamespaceCredentialsDialog({ namespace, onSubmit, onCancel }: NamespaceCredentialsDialogProps) {
  const [profile, setProfile] = useState(namespace.ssm_profile ?? '');
  const [region, setRegion] = useState(namespace.aws_region ?? '');
  const profileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    profileRef.current?.focus();
  }, []);

  const canSubmit = profile.trim().length > 0 && region.trim().length > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit(profile.trim(), region.trim());
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSubmit();
    if (e.key === 'Escape') onCancel();
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal modal-sm" role="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Credentials — {namespace.name}</h2>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label htmlFor="ns-cred-profile">Profile name</label>
            <input
              id="ns-cred-profile"
              ref={profileRef}
              className="form-input"
              value={profile}
              onChange={(e) => setProfile(e.target.value)}
              placeholder="e.g. my-company-dev"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onKeyDown={handleKeyDown}
            />
            <small className="form-hint">Profile from your AWS credentials file</small>
          </div>
          <div className="form-group">
            <label htmlFor="ns-cred-region">AWS region</label>
            <input
              id="ns-cred-region"
              className="form-input"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="e.g. us-east-1"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onKeyDown={handleKeyDown}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="action-btn" onClick={onCancel}>Cancel</button>
          <button className="action-btn primary" onClick={handleSubmit} disabled={!canSubmit}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
