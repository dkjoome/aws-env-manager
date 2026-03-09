import { useState, useEffect, useRef } from 'react';
import type { EnvKey, Environment, KeyValue, KeyLink, ValidationError } from '../types';
import { NA_VALUE } from '../types';

interface KeyTableProps {
  keys: EnvKey[];
  environments: Environment[];
  keyValues: KeyValue[];
  keyLinks: KeyLink[];
  validationErrors: ValidationError[];
  onSelectKey: (key: EnvKey) => void;
  onDeleteKeys: (keyIds: number[]) => void;
  onToggleLock: (keyId: number, locked: boolean) => void;
}

const DEFAULT_KEY_COL_WIDTH = 160;
const DEFAULT_ENV_COL_WIDTH = 110;

// SVG Icons (Lucide-style)
const EyeIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const EyeOffIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

const LockIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

const UnlockIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
  </svg>
);

const LinkIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  </svg>
);

export function KeyTable({
  keys,
  environments,
  keyValues,
  keyLinks,
  validationErrors,
  onSelectKey,
  onDeleteKeys,
  onToggleLock,
}: KeyTableProps) {
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const [selectedKeyIds, setSelectedKeyIds] = useState<Set<number>>(new Set());
  const [lastClickedId, setLastClickedId] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [copiedCell, setCopiedCell] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [revealedKeyIds, setRevealedKeyIds] = useState<Set<number>>(new Set());
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close context menu when clicking outside
  useEffect(() => {
    if (!contextMenu) return;
    function handleClick(e: MouseEvent) {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [contextMenu]);

  function handleCopyCell(mapKey: string, _keyName: string, value: string) {
    navigator.clipboard.writeText(value);
    setCopiedCell(mapKey);
    setTimeout(() => setCopiedCell((prev) => prev === mapKey ? null : prev), 1500);
  }

  function toggleReveal(keyId: number) {
    setRevealedKeyIds((prev) => {
      const next = new Set(prev);
      if (next.has(keyId)) next.delete(keyId);
      else next.add(keyId);
      return next;
    });
  }

  // Build lookup: keyId + envId -> KeyValue
  const valueMap = new Map<string, KeyValue>();
  for (const kv of keyValues) {
    valueMap.set(`${kv.key_id}:${kv.environment_id}`, kv);
  }

  // Keys with links
  const linkedKeyIds = new Set(
    keyLinks.flatMap((l) => [l.source_key_id, l.target_key_id])
  );

  // Keys with validation errors
  const errorKeyIds = new Set([
    ...validationErrors.map((e) => e.sourceKeyId),
    ...validationErrors.map((e) => e.targetKeyId),
  ]);

  // Search filter (always uses real values, not masked)
  const query = searchQuery.trim().toLowerCase();
  const filteredKeys = query
    ? keys.filter((key) => {
        if (key.name.toLowerCase().includes(query)) return true;
        for (const env of environments) {
          const kv = valueMap.get(`${key.id}:${env.id}`);
          if (kv?.value && kv.value !== NA_VALUE && kv.value.toLowerCase().includes(query)) return true;
        }
        return false;
      })
    : keys;

  // Sort
  const sortedKeys = sortCol
    ? [...filteredKeys].sort((a, b) => {
        let cmp = 0;
        if (sortCol === 'key') {
          cmp = a.name.localeCompare(b.name);
        } else {
          // env column: sort by value text
          const envId = sortCol.replace('env-', '');
          const valA = valueMap.get(`${a.id}:${envId}`)?.value ?? null;
          const valB = valueMap.get(`${b.id}:${envId}`)?.value ?? null;
          if (valA === null && valB === null) cmp = 0;
          else if (valA === null) cmp = 1;
          else if (valB === null) cmp = -1;
          else cmp = valA.localeCompare(valB);
        }
        return sortDir === 'desc' ? -cmp : cmp;
      })
    : filteredKeys;

  function handleHeaderClick(colId: string) {
    if (sortCol === colId) {
      if (sortDir === 'asc') {
        setSortDir('desc');
      } else {
        setSortCol(null);
        setSortDir('asc');
      }
    } else {
      setSortCol(colId);
      setSortDir('asc');
    }
  }

  function sortIndicator(colId: string): string {
    if (sortCol !== colId) return '';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  }

  // Diff detection: does a key have differing values across envs?
  // Uses real values regardless of masking
  function hasDifferingValues(key: EnvKey): boolean {
    const values = new Set<string>();
    for (const env of environments) {
      const kv = valueMap.get(`${key.id}:${env.id}`);
      if (kv?.value != null && kv.value !== NA_VALUE) values.add(kv.value);
    }
    return values.size > 1;
  }

  function getWidth(colId: string, defaultWidth: number): number {
    return colWidths[colId] ?? defaultWidth;
  }

  function startResize(colId: string, currentWidth: number, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = currentWidth;

    function onMove(ev: MouseEvent) {
      const newWidth = Math.max(60, startWidth + ev.clientX - startX);
      setColWidths((prev) => ({ ...prev, [colId]: newWidth }));
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function handleRowClick(e: React.MouseEvent, key: EnvKey) {
    const id = key.id;

    if (e.shiftKey && lastClickedId !== null) {
      // Range select
      const keyIds = keys.map((k) => k.id);
      const lastIdx = keyIds.indexOf(lastClickedId);
      const curIdx = keyIds.indexOf(id);
      const [from, to] = lastIdx < curIdx ? [lastIdx, curIdx] : [curIdx, lastIdx];
      setSelectedKeyIds(new Set(keyIds.slice(from, to + 1)));
    } else if (e.metaKey || e.ctrlKey) {
      // Toggle individual
      setSelectedKeyIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      setLastClickedId(id);
    } else {
      // Plain click: select only this row + open detail panel
      setSelectedKeyIds(new Set([id]));
      setLastClickedId(id);
      onSelectKey(key);
    }
  }

  function handleRowContextMenu(e: React.MouseEvent, key: EnvKey) {
    e.preventDefault();
    // If right-clicking an unselected row, select it first
    if (!selectedKeyIds.has(key.id)) {
      setSelectedKeyIds(new Set([key.id]));
      setLastClickedId(key.id);
    }
    setContextMenu({ x: e.clientX, y: e.clientY });
  }

  function handleDeleteSelected() {
    setContextMenu(null);
    onDeleteKeys(Array.from(selectedKeyIds));
    setSelectedKeyIds(new Set());
  }

  if (keys.length === 0) {
    return (
      <div className="key-table-empty">
        <p>No keys yet.</p>
      </div>
    );
  }

  return (
    <div className="key-table-container">
      <div className="key-search-bar">
        <div className="key-search-input-wrap">
          <input
            ref={searchInputRef}
            className="key-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search keys and values…"
            onKeyDown={(e) => {
              if (e.key === 'Escape') setSearchQuery('');
            }}
          />
          {searchQuery && (
            <button
              className="key-search-clear"
              onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
        {query && (
          <span className="key-search-count">
            {filteredKeys.length} of {keys.length} keys
          </span>
        )}
      </div>

      <table className="key-table" style={{ tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <th className="col-icons" style={{ width: 80 }}></th>
            <th
              className="col-key col-sortable"
              style={{ width: getWidth('key', DEFAULT_KEY_COL_WIDTH) }}
              onClick={() => handleHeaderClick('key')}
            >
              Key{sortIndicator('key')}
              <div
                className="col-resize-handle"
                onMouseDown={(e) => startResize('key', getWidth('key', DEFAULT_KEY_COL_WIDTH), e)}
              />
            </th>
            {environments.map((env) => {
              const colId = `env-${env.id}`;
              const w = getWidth(colId, DEFAULT_ENV_COL_WIDTH);
              return (
                <th
                  key={env.id}
                  className="col-env col-sortable"
                  style={{ width: w }}
                  onClick={() => handleHeaderClick(colId)}
                >
                  {env.name}{sortIndicator(colId)}
                  <div
                    className="col-resize-handle"
                    onMouseDown={(e) => startResize(colId, w, e)}
                  />
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedKeys.map((key) => {
            const isSelected = selectedKeyIds.has(key.id);
            const hasError = errorKeyIds.has(key.id);
            const differs = environments.length > 1 && hasDifferingValues(key);
            const isMasked = key.is_secure === 1 && !revealedKeyIds.has(key.id);
            const isLocked = key.is_locked === 1;
            return (
              <tr
                key={key.id}
                className={`key-row${hasError ? ' has-error' : ''}${isSelected ? ' selected' : ''}${isLocked ? ' locked' : ''}`}
                onClick={(e) => handleRowClick(e, key)}
                onContextMenu={(e) => handleRowContextMenu(e, key)}
              >
                <td className="col-icons">
                  {key.is_secure === 1 && (
                    <button
                      className="table-icon-btn"
                      onClick={(e) => { e.stopPropagation(); toggleReveal(key.id); }}
                      title={isMasked ? 'Reveal values' : 'Mask values'}
                      aria-label={isMasked ? `Reveal ${key.name}` : `Mask ${key.name}`}
                    >
                      {isMasked ? EyeOffIcon : EyeIcon}
                    </button>
                  )}
                  <button
                    className={`table-icon-btn${isLocked ? ' active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); onToggleLock(key.id, !isLocked); }}
                    title={isLocked ? 'Unlock key' : 'Lock key'}
                    aria-label={isLocked ? `Unlock ${key.name}` : `Lock ${key.name}`}
                  >
                    {isLocked ? LockIcon : UnlockIcon}
                  </button>
                  {linkedKeyIds.has(key.id) && (
                    <span
                      className={`table-icon-btn link-btn linked${hasError ? ' error' : ''}`}
                      title={hasError ? 'Link validation failed' : 'Linked key'}
                      aria-label={`Linked ${key.name}`}
                    >
                      {LinkIcon}
                    </span>
                  )}
                </td>
                <td className="col-key" title={key.description ?? undefined}>
                  <span className="key-name">{key.name}</span>
                </td>

                {environments.map((env) => {
                  const mapKey = `${key.id}:${env.id}`;
                  const kv = valueMap.get(mapKey);
                  const hasRecord = kv !== undefined;
                  const value = hasRecord ? kv!.value : undefined;
                  const isNAValue = value === NA_VALUE;

                  const copyIcon = copiedCell === mapKey
                    ? <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0z"/></svg>
                    : <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><rect x="5" y="1" width="9" height="11" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5"/><rect x="2" y="4" width="9" height="11" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>;

                  const isMissing = !hasRecord || !value || isNAValue;
                  const displayValue = isMasked && value && !isNAValue ? '••••••' : value;

                  return (
                    <td key={env.id} className={`col-env${differs ? ' value-differs' : ''}${isMissing ? ' value-missing' : ''}${isNAValue ? ' value-na' : ''}`}>
                      {isNAValue ? (
                        <span className="na-badge">NA</span>
                      ) : !hasRecord ? (
                        <span className="value-unset">—</span>
                      ) : !value ? (
                        <span className="value-empty">NULL</span>
                      ) : (
                        <span className="value-cell">
                          <span className={`value-text${isMasked ? ' masked' : ''}`}>{displayValue}</span>
                          <button
                            className="copy-cell-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyCell(mapKey, key.name, value as string);
                            }}
                            title={`Copy value`}
                            aria-label={`Copy ${key.name} for ${env.name}`}
                          >
                            {copyIcon}
                          </button>
                        </span>
                      )}
                    </td>
                  );
                })}

              </tr>
            );
          })}
        </tbody>
      </table>

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="context-menu"
          style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x }}
        >
          <button className="context-menu-item danger" onClick={handleDeleteSelected}>
            🗑 Delete {selectedKeyIds.size > 1 ? `${selectedKeyIds.size} keys` : 'key'}
          </button>
        </div>
      )}
    </div>
  );
}
