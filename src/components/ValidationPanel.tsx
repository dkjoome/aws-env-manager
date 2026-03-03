import type { ValidationError } from '../types';

interface ValidationPanelProps {
  errors: ValidationError[];
  isOpen: boolean;
  onClose: () => void;
  onNavigateToKey: (keyId: number) => void;
}

export function ValidationPanel({
  errors,
  isOpen,
  onClose,
  onNavigateToKey,
}: ValidationPanelProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal validation-modal">
        <div className="modal-header">
          <h2>Validation Errors ({errors.length})</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="modal-body">
          {errors.length === 0 ? (
            <p className="no-errors">No validation errors — all links are consistent.</p>
          ) : (
            <ul className="validation-list">
              {errors.map((err, i) => (
                <li key={i} className="validation-item">
                  <div className="validation-env">
                    <span className="env-badge">{err.environmentName}</span>
                  </div>
                  <div className="validation-keys">
                    <button
                      className="key-link-btn"
                      onClick={() => onNavigateToKey(err.sourceKeyId)}
                    >
                      {err.sourceKeyName}
                    </button>
                    <span className="validation-rule">≠</span>
                    <button
                      className="key-link-btn"
                      onClick={() => onNavigateToKey(err.targetKeyId)}
                    >
                      {err.targetKeyName}
                    </button>
                  </div>
                  <div className="validation-values">
                    <span className="val-source">
                      {err.sourceValue === null ? '(empty)' : `"${err.sourceValue}"`}
                    </span>
                    <span className="val-sep">vs</span>
                    <span className="val-target">
                      {err.targetValue === null ? '(empty)' : `"${err.targetValue}"`}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="modal-footer">
          <button className="action-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
