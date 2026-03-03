import { useState } from 'react';

interface DebugLogProps {
  entries: string[];
  onClear: () => void;
}

export function DebugLog({ entries, onClear }: DebugLogProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="debug-panel">
      <div className="debug-panel-header" onClick={() => setOpen((o) => !o)}>
        <span className="debug-panel-title">
          Debug Log{entries.length > 0 ? ` (${entries.length})` : ''}
        </span>
        <div className="debug-panel-controls">
          {entries.length > 0 && (
            <button
              className="debug-clear-btn"
              onClick={(e) => { e.stopPropagation(); onClear(); }}
            >
              Clear
            </button>
          )}
          <span className="debug-chevron">{open ? '▼' : '▲'}</span>
        </div>
      </div>

      {open && (
        <div className="debug-panel-body">
          {entries.length === 0 ? (
            <span className="debug-empty">No log entries yet.</span>
          ) : (
            entries.map((entry, i) => (
              <div key={i} className={`debug-entry ${entryClass(entry)}`}>
                {entry}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function entryClass(entry: string): string {
  if (entry.includes('⚠') || entry.includes('FAILED') || entry.includes('ERROR')) return 'debug-warn';
  if (entry.includes('✓') || entry.includes('Done')) return 'debug-ok';
  return '';
}
