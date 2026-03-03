import { useState } from 'react';
import type { EnvKey, Environment, KeyValue } from '../types';

interface ExportEnvDialogProps {
  keys: EnvKey[];
  environments: Environment[];
  keyValues: KeyValue[];
  onClose: () => void;
}

export function ExportEnvDialog({ keys, environments, keyValues, onClose }: ExportEnvDialogProps) {
  const [envId, setEnvId] = useState<number>(environments[0]?.id ?? 0);
  const [includeDescriptions, setIncludeDescriptions] = useState(false);
  const [copied, setCopied] = useState(false);

  const lines: string[] = [];
  for (const key of keys) {
    const kv = keyValues.find((v) => v.key_id === key.id && v.environment_id === envId);
    if (!kv) continue; // unset — skip
    const value = kv.value ?? '';
    let line = `${key.name}=${value}`;
    if (includeDescriptions && key.description) {
      line += ` # ${key.description}`;
    }
    lines.push(line);
  }

  const output = lines.join('\n');

  function handleCopy() {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" role="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Export .env</h2>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Environment</label>
            <select
              className="form-input"
              value={envId}
              onChange={(e) => { setEnvId(Number(e.target.value)); setCopied(false); }}
            >
              {environments.map((env) => (
                <option key={env.id} value={env.id}>{env.name}</option>
              ))}
            </select>
          </div>

          <div className="form-check">
            <label>
              <input
                type="checkbox"
                checked={includeDescriptions}
                onChange={(e) => { setIncludeDescriptions(e.target.checked); setCopied(false); }}
              />
              Include descriptions as comments
            </label>
          </div>

          <div className="form-group">
            <label>Output ({lines.length} {lines.length === 1 ? 'entry' : 'entries'})</label>
            <textarea
              className="form-textarea"
              rows={12}
              value={output}
              readOnly
              style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="action-btn" onClick={onClose}>Close</button>
          <button className="action-btn primary" onClick={handleCopy} disabled={lines.length === 0}>
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
}
