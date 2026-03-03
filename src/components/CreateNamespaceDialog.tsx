import { useState, useRef, useEffect } from 'react';

interface CreateNamespaceDialogProps {
  onSubmit: (name: string) => void;
  onCancel: () => void;
}

export function CreateNamespaceDialog({ onSubmit, onCancel }: CreateNamespaceDialogProps) {
  const [name, setName] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const canSubmit = name.trim().length > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit(name.trim());
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal modal-sm" role="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>New namespace</h2>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Namespace name</label>
            <input
              ref={nameRef}
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. myapp"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit();
                if (e.key === 'Escape') onCancel();
              }}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="action-btn" onClick={onCancel}>Cancel</button>
          <button className="action-btn primary" onClick={handleSubmit} disabled={!canSubmit}>
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
