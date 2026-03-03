import { useRef, useState } from 'react';
import type { Environment } from '../types';

interface ImportEnvDialogProps {
  environments: Environment[];
  onSubmit: (content: string, environmentId: number) => void;
  onCancel: () => void;
}

export function ImportEnvDialog({ environments, onSubmit, onCancel }: ImportEnvDialogProps) {
  const [content, setContent] = useState('');
  const [envId, setEnvId] = useState<number | ''>(environments[0]?.id ?? '');
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSubmit = content.trim().length > 0 && envId !== '';

  const [fileError, setFileError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Only allow .env or .env.* files
    if (!/^\.env(\..+)?$/.test(file.name)) {
      setFileError('Only .env or .env.* files are allowed.');
      e.target.value = '';
      return;
    }
    setFileError(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setContent((ev.target?.result as string) ?? '');
    };
    reader.readAsText(file);
    // Reset so the same file can be re-selected
    e.target.value = '';
  }

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit(content, envId as number);
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" role="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Import .env</h2>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Environment</label>
            <select
              className="form-input"
              value={envId}
              onChange={(e) => setEnvId(Number(e.target.value))}
            >
              {environments.map((env) => (
                <option key={env.id} value={env.id}>{env.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>.env file</label>
            <div className="import-file-row">
              <button
                type="button"
                className="action-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                Choose file…
              </button>
              <span className="import-file-name">
                {fileName ?? 'No file chosen'}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".env"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </div>
            {fileError && <span className="form-error">{fileError}</span>}
            <span className="form-hint">Or paste contents directly below</span>
          </div>

          <div className="form-group">
            <label>Contents</label>
            <textarea
              className="form-textarea"
              rows={10}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={'KEY=value\nANOTHER_KEY=another_value'}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="action-btn" onClick={onCancel}>Cancel</button>
          <button className="action-btn primary" onClick={handleSubmit} disabled={!canSubmit}>
            Import
          </button>
        </div>
      </div>
    </div>
  );
}
