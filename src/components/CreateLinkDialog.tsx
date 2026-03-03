import { useState, useEffect } from 'react';
import type { Project, EnvKey, Environment, KeyValue } from '../types';

interface CreateLinkDialogProps {
  sourceKeyId: number;
  sourceKeyName: string;
  sourceIsSecure: boolean;
  currentProjectId: number;
  projects: Project[];
  environments: Environment[];
  loadKeysAndValues: (projectId: number) => Promise<{ keys: EnvKey[]; keyValues: KeyValue[] }>;
  sourceValues: Record<number, string | null>; // environmentId -> value
  onConfirm: (sourceKeyId: number, targetKeyId: number) => void;
  onCancel: () => void;
}

export function CreateLinkDialog({
  sourceKeyId,
  sourceKeyName,
  sourceIsSecure,
  currentProjectId,
  projects,
  environments,
  loadKeysAndValues,
  sourceValues,
  onConfirm,
  onCancel,
}: CreateLinkDialogProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [targetKeys, setTargetKeys] = useState<EnvKey[]>([]);
  const [targetKeyValues, setTargetKeyValues] = useState<KeyValue[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const otherProjects = projects.filter((p) => p.id !== currentProjectId);

  // Load keys when a project is selected
  useEffect(() => {
    if (!selectedProjectId) {
      setTargetKeys([]);
      setTargetKeyValues([]);
      setSelectedKeyId(null);
      return;
    }
    setLoading(true);
    setError(null);
    loadKeysAndValues(selectedProjectId)
      .then(({ keys, keyValues }) => {
        setTargetKeys(keys);
        setTargetKeyValues(keyValues);
        setSelectedKeyId(null);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [selectedProjectId, loadKeysAndValues]);

  // Validate values match when a target key is selected
  const validationResult = (() => {
    if (!selectedKeyId) return null;

    const mismatches: Array<{ envName: string; sourceVal: string | null; targetVal: string | null }> = [];

    for (const env of environments) {
      const sourceVal = sourceValues[env.id] ?? null;
      const targetVal = targetKeyValues.find(
        (kv) => kv.key_id === selectedKeyId && kv.environment_id === env.id
      )?.value ?? null;

      if (sourceVal !== targetVal) {
        mismatches.push({ envName: env.name, sourceVal, targetVal });
      }
    }

    return mismatches;
  })();

  // Check encryption flag mismatch
  const encryptionMismatch = (() => {
    if (!selectedKeyId) return false;
    const target = targetKeys.find((k) => k.id === selectedKeyId);
    if (!target) return false;
    return sourceIsSecure !== (target.is_secure === 1);
  })();

  const canConfirm = selectedKeyId !== null && validationResult !== null && validationResult.length === 0 && !encryptionMismatch;

  const selectedProject = otherProjects.find((p) => p.id === selectedProjectId);
  const selectedKey = targetKeys.find((k) => k.id === selectedKeyId);

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" role="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create Link</h2>
        </div>
        <div className="modal-body">
          <p className="link-source-label">
            Source: <strong>{sourceKeyName}</strong>
          </p>

          {otherProjects.length === 0 ? (
            <p className="link-error">Need at least two projects in this namespace to create a link.</p>
          ) : (
            <>
              <div className="form-group">
                <label htmlFor="link-project">Target project</label>
                <select
                  id="link-project"
                  className="form-input"
                  value={selectedProjectId ?? ''}
                  onChange={(e) => setSelectedProjectId(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Select a project…</option>
                  {otherProjects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {loading && <p className="link-loading">Loading keys…</p>}

              {selectedProjectId && !loading && targetKeys.length === 0 && (
                <p className="link-error">No keys in project "{selectedProject?.name}".</p>
              )}

              {targetKeys.length > 0 && (
                <div className="form-group">
                  <label htmlFor="link-key">Target key</label>
                  <select
                    id="link-key"
                    className="form-input"
                    value={selectedKeyId ?? ''}
                    onChange={(e) => setSelectedKeyId(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">Select a key…</option>
                    {targetKeys.map((k) => (
                      <option key={k.id} value={k.id}>{k.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {validationResult !== null && validationResult.length > 0 && (
                <div className="link-validation-error">
                  <p>Values do not match across all environments:</p>
                  <ul>
                    {validationResult.map((m) => (
                      <li key={m.envName}>
                        <strong>{m.envName}</strong>: "{sourceKeyName}" = {m.sourceVal ?? '(empty)'} ≠ "{selectedKey?.name}" = {m.targetVal ?? '(empty)'}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {encryptionMismatch && (
                <p className="link-error">
                  Cannot link: source key is {sourceIsSecure ? 'encrypted' : 'plaintext'} but target key is {selectedKey?.is_secure === 1 ? 'encrypted' : 'plaintext'}.
                </p>
              )}

              {canConfirm && (
                <p className="link-success">Values match across all environments. Ready to link.</p>
              )}
            </>
          )}

          {error && <p className="link-error">{error}</p>}
        </div>
        <div className="modal-footer">
          <button className="action-btn" onClick={onCancel}>Cancel</button>
          <button
            className="action-btn primary"
            onClick={() => onConfirm(sourceKeyId, selectedKeyId!)}
            disabled={!canConfirm}
          >
            Create Link
          </button>
        </div>
      </div>
    </div>
  );
}
