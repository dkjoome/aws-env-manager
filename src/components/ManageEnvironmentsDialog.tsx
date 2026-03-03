import { useState, useRef, useEffect } from 'react';
import type { Environment } from '../types';

interface ManageEnvironmentsDialogProps {
  environments: Environment[];
  onAdd: (name: string) => void;
  onDelete: (id: number) => void;
  onReorder: (orderedIds: number[]) => void;
  onClose: () => void;
}

export function ManageEnvironmentsDialog({
  environments,
  onAdd,
  onDelete,
  onReorder,
  onClose,
}: ManageEnvironmentsDialogProps) {
  const [newName, setNewName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const trimmed = newName.trim();
  const duplicate = environments.some((e) => e.name === trimmed);
  const hasSlash = trimmed.includes('/');
  const canAdd = trimmed.length > 0 && !duplicate && !hasSlash;

  function handleAdd() {
    if (!canAdd) return;
    onAdd(trimmed);
    setNewName('');
    inputRef.current?.focus();
  }

  function handleMoveUp(index: number) {
    if (index === 0) return;
    const ids = environments.map((e) => e.id);
    [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
    onReorder(ids);
  }

  function handleMoveDown(index: number) {
    if (index === environments.length - 1) return;
    const ids = environments.map((e) => e.id);
    [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
    onReorder(ids);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-sm" role="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Manage environments</h2>
        </div>
        <div className="modal-body">
          {environments.length === 0 && (
            <div style={{ color: 'var(--text-muted)', marginBottom: 8 }}>No environments yet.</div>
          )}
          {environments.length > 0 && (
            <ul className="env-list">
              {environments.map((env, i) => (
                <li key={env.id} className="env-list-item">
                  <span className="env-list-name">{env.name}</span>
                  <div className="env-list-actions">
                    <button
                      className="env-list-move"
                      onClick={() => handleMoveUp(i)}
                      disabled={i === 0}
                      title={`Move ${env.name} up`}
                      aria-label={`Move ${env.name} up`}
                    >
                      ▲
                    </button>
                    <button
                      className="env-list-move"
                      onClick={() => handleMoveDown(i)}
                      disabled={i === environments.length - 1}
                      title={`Move ${env.name} down`}
                      aria-label={`Move ${env.name} down`}
                    >
                      ▼
                    </button>
                    <button
                      className="env-list-delete"
                      onClick={() => onDelete(env.id)}
                      title={`Delete ${env.name}`}
                      aria-label={`Delete ${env.name}`}
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="env-add-row">
            <input
              ref={inputRef}
              className="form-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New environment name"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
                if (e.key === 'Escape') onClose();
              }}
            />
            <button className="action-btn primary" onClick={handleAdd} disabled={!canAdd}>
              Add
            </button>
          </div>
          {duplicate && <span className="form-hint form-error">Name already exists.</span>}
          {hasSlash && <span className="form-hint form-error">Name must not contain "/".</span>}
        </div>
        <div className="modal-footer">
          <button className="action-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
