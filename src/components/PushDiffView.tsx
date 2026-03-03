import type { DiffItem } from '../types';

interface PushDiffViewProps {
  diff: DiffItem[];
  isOpen: boolean;
  mode: 'push' | 'pull';
  onConfirm: () => void;
  onCancel: () => void;
}

const ACTION_LABEL: Record<DiffItem['action'], string> = {
  create: '+ NEW',
  update: '~ CHANGED',
  delete: '- DELETE',
};

const ACTION_CLASS: Record<DiffItem['action'], string> = {
  create: 'diff-create',
  update: 'diff-update',
  delete: 'diff-delete',
};

export function PushDiffView({ diff, isOpen, mode, onConfirm, onCancel }: PushDiffViewProps) {
  if (!isOpen) return null;

  const creates = diff.filter((d) => d.action === 'create');
  const updates = diff.filter((d) => d.action === 'update');
  const deletes = diff.filter((d) => d.action === 'delete');

  const title = mode === 'push' ? 'Push Diff' : 'Pull Diff';
  const emptyMessage =
    mode === 'push'
      ? 'Nothing to push — Parameter Store is already up to date.'
      : 'Nothing to pull — local is already up to date with Parameter Store.';
  const confirmLabel =
    mode === 'push'
      ? `Confirm Push (${diff.length} changes)`
      : `Confirm Pull (${diff.length} changes)`;

  if (diff.length === 0) {
    return (
      <div className="modal-overlay" role="dialog" aria-modal="true">
        <div className="modal push-diff-modal">
          <div className="modal-header">
            <h2>{title}</h2>
          </div>
          <div className="modal-body">
            <p className="no-changes">{emptyMessage}</p>
          </div>
          <div className="modal-footer">
            <button className="action-btn" onClick={onCancel}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal push-diff-modal">
        <div className="modal-header">
          <h2>{title}</h2>
          <p className="modal-subtitle">
            {creates.length} new · {updates.length} changed · {deletes.length} to delete
          </p>
        </div>

        <div className="modal-body diff-list">
          {diff.map((item, i) => (
            <div key={i} className={`diff-item ${ACTION_CLASS[item.action]}`}>
              <span className="diff-action">{ACTION_LABEL[item.action]}</span>
              <span className="diff-path">{item.path}</span>
              <div className="diff-values">
                {item.action === 'create' && (
                  <span className="diff-local">
                    → {mode === 'push' ? item.localValue : item.remoteValue}
                  </span>
                )}
                {item.action === 'update' && mode === 'push' && (
                  <>
                    <span className="diff-remote">
                      was: {item.remoteValue}
                      {item.remoteLastModified && (
                        <small> ({item.remoteLastModified.toLocaleDateString()})</small>
                      )}
                    </span>
                    <span className="diff-local">now: {item.localValue}</span>
                  </>
                )}
                {item.action === 'update' && mode === 'pull' && (
                  <>
                    <span className="diff-remote">was: {item.localValue}</span>
                    <span className="diff-local">now: {item.remoteValue}</span>
                  </>
                )}
                {item.action === 'delete' && (
                  <span className="diff-remote">
                    {mode === 'push' ? item.remoteValue : item.localValue}
                    {mode === 'push' && item.remoteLastModified && (
                      <small> (last updated {item.remoteLastModified.toLocaleDateString()})</small>
                    )}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="modal-footer">
          <button className="action-btn" onClick={onCancel}>Cancel</button>
          <button className="action-btn danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
