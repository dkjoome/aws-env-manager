import { useState, useEffect, useRef } from 'react';
import type { EnvKey, Environment, KeyValue, KeyLink } from '../types';

interface KeyDetailPanelProps {
  envKey: EnvKey | null;
  environments: Environment[];
  keyValues: KeyValue[];
  keyLinks: KeyLink[];
  resolveKeyName?: (keyId: number) => string;
  onSave: (
    keyId: number,
    fields: { name: string; description: string; note: string; is_secure: boolean },
    values: Record<number, string | null>
  ) => void;
  onClose: () => void;
  onDeleteLink: (linkId: number) => void;
  onCreateLink: (keyId: number) => void;
}

function generateApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export function KeyDetailPanel({
  envKey,
  environments,
  keyValues,
  keyLinks,
  resolveKeyName,
  onSave,
  onClose,
  onDeleteLink,
  onCreateLink,
}: KeyDetailPanelProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [note, setNote] = useState('');
  const [isSecure, setIsSecure] = useState(false);
  const [values, setValues] = useState<Record<number, string | null>>({});
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!envKey) return;
    setName(envKey.name);
    setDescription(envKey.description ?? '');
    setNote(envKey.note ?? '');
    setIsSecure(envKey.is_secure === 1);
    setCopied(false);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);

    const vals: Record<number, string | null> = {};
    for (const kv of keyValues) {
      if (kv.key_id === envKey.id) {
        vals[kv.environment_id] = kv.value;
      }
    }
    setValues(vals);
  }, [envKey, keyValues]);

  if (!envKey) return null;

  const isLocked = envKey.is_locked === 1;

  const myLinks = keyLinks.filter(
    (l) => l.source_key_id === envKey.id || l.target_key_id === envKey.id
  );

  function handleSave() {
    if (!envKey) return;
    onSave(envKey.id, { name, description, note, is_secure: isSecure }, values);
  }

  function handleGenerateKey() {
    const key = generateApiKey();
    navigator.clipboard.writeText(key).catch(() => {});
    setCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 2000);
  }


  return (
    <div className="key-detail-panel">
      <div className="panel-header">
        <h3>{isLocked ? 'View Key' : 'Edit Key'}</h3>
        <button className="icon-btn" onClick={onClose} aria-label="Close panel">✕</button>
      </div>

      {isLocked && (
        <div className="panel-locked-banner">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          This key is locked. Unlock to edit.
        </div>
      )}

      <div className="panel-body">
        <div className="form-group">
          <label htmlFor="key-name">Key name</label>
          <input
            id="key-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="form-input"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={isLocked}
          />
        </div>

        <div className="form-group">
          <label htmlFor="key-description">Description</label>
          <input
            id="key-description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="form-input"
            placeholder="What this key is for"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={isLocked}
          />
        </div>

        <div className="form-group">
          <label htmlFor="key-note">Note</label>
          <textarea
            id="key-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="form-textarea"
            rows={2}
            placeholder="Additional notes"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={isLocked}
          />
        </div>

        <div className="form-group form-check">
          <label>
            <input
              type="checkbox"
              checked={isSecure}
              onChange={(e) => setIsSecure(e.target.checked)}
              disabled={isLocked}
            />
            {' '}Encrypted (SecureString)
          </label>
        </div>

        <div className="section-title-row">
          <h4 className="section-title">Values by environment</h4>
          {!isLocked && (
            <>
              <button
                type="button"
                className="action-btn"
                title="Generate a random 32-char API key and copy to clipboard"
                onClick={handleGenerateKey}
              >
                ⟳ Generate key
              </button>
              {copied && <span className="copied-badge">✓ Copied</span>}
            </>
          )}
        </div>

        {environments.map((env) => (
          <div key={env.id} className="form-group">
            <label htmlFor={`env-val-${env.id}`}>{env.name}</label>
            <input
              id={`env-val-${env.id}`}
              type="text"
              value={values[env.id] ?? ''}
              onChange={(e) =>
                setValues((v) => ({ ...v, [env.id]: e.target.value.trim() || null }))
              }
              className="form-input"
              placeholder={`Value for ${env.name}`}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              disabled={isLocked}
            />
          </div>
        ))}

        <div className="section-title-row">
          <h4 className="section-title">Links</h4>
          {!isLocked && (
            <button
              type="button"
              className="action-btn"
              onClick={() => onCreateLink(envKey.id)}
              aria-label="Create link"
            >
              + Link
            </button>
          )}
        </div>
        {myLinks.length > 0 ? (
          <ul className="link-list">
            {myLinks.map((link) => {
              const otherId = link.source_key_id === envKey.id ? link.target_key_id : link.source_key_id;
              const otherLabel = resolveKeyName ? resolveKeyName(otherId) : `key #${otherId}`;
              return (
              <li key={link.id} className="link-item">
                <span className="link-rule">{link.rule}</span>
                <span className="link-target">
                  ↔ {otherLabel}
                </span>
                {!isLocked && (
                  <button
                    className="icon-btn danger"
                    onClick={() => onDeleteLink(link.id)}
                    aria-label="Remove link"
                  >
                    ✕
                  </button>
                )}
              </li>
              );
            })}
          </ul>
        ) : (
          <p className="link-empty">No links yet.</p>
        )}
      </div>

      <div className="panel-footer">
        <button className="action-btn" onClick={onClose}>Cancel</button>
        <button className="action-btn primary" onClick={handleSave} disabled={isLocked}>Save</button>
      </div>
    </div>
  );
}
