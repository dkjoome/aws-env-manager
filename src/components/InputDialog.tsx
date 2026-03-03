import { useState, useRef, useEffect } from 'react';

interface InputDialogProps {
  title: string;
  label: string;
  placeholder?: string;
  submitLabel?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export function InputDialog({
  title,
  label,
  placeholder,
  submitLabel = 'Create',
  onSubmit,
  onCancel,
}: InputDialogProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal modal-sm" role="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>{label}</label>
            <input
              ref={inputRef}
              className="form-input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
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
          <button
            className="action-btn primary"
            onClick={handleSubmit}
            disabled={!value.trim()}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
