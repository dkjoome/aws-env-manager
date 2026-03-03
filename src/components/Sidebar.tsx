import { useState, useEffect, useRef } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import type { Namespace, Project, ValidationError } from '../types';

interface SidebarProps {
  namespaces: Namespace[];
  selectedNamespaceId: number | null;
  projects: Project[];
  selectedProjectId: number | null;
  validationErrors: ValidationError[];
  awsRegion?: string | null;
  onSelectNamespace: (id: number) => void;
  onDeleteNamespace: (id: number) => void;
  onManageEnvironments: (namespaceId: number) => void;
  onCreateProject: (namespaceId: number) => void;
  onDeleteProject: (id: number) => void;
  onSelectProject: (id: number) => void;
  onBackup: () => void;
  isBackingUp?: boolean;
  onRestore: () => void;
  isRestoring?: boolean;
  onOpenSettings: () => void;
}

type ContextMenuState = {
  type: 'namespace' | 'project';
  id: number;
  x: number;
  y: number;
} | null;

export function Sidebar({
  namespaces,
  selectedNamespaceId,
  projects,
  selectedProjectId,
  validationErrors,
  awsRegion,
  onSelectNamespace,
  onDeleteNamespace,
  onManageEnvironments,
  onCreateProject,
  onDeleteProject,
  onSelectProject,
  onBackup,
  isBackingUp,
  onRestore,
  isRestoring,
  onOpenSettings,
}: SidebarProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const region = awsRegion || 'us-east-1';
  const consoleUrl = `https://console.aws.amazon.com/systems-manager/parameters/?region=${region}`;

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

  const projectsWithErrors = new Set(
    validationErrors.flatMap((e) => [e.sourceProjectName, e.targetProjectName])
  );

  function handleNsContextMenu(e: React.MouseEvent, ns: Namespace) {
    e.preventDefault();
    setContextMenu({ type: 'namespace', id: ns.id, x: e.clientX, y: e.clientY });
  }

  function handleProjectContextMenu(e: React.MouseEvent, project: Project) {
    e.preventDefault();
    setContextMenu({ type: 'project', id: project.id, x: e.clientX, y: e.clientY });
  }

  function handleContextAction(action: () => void) {
    setContextMenu(null);
    action();
  }

  return (
    <div className="sidebar">
      <div className="ns-tree">
        {namespaces.length === 0 && (
          <div className="sidebar-hint">No namespaces yet</div>
        )}
        {namespaces.map((ns) => {
          const isExpanded = ns.id === selectedNamespaceId;
          return (
            <div key={ns.id}>
              <div
                className={`ns-row${isExpanded ? ' expanded' : ''}`}
                onClick={() => onSelectNamespace(ns.id)}
                onContextMenu={(e) => handleNsContextMenu(e, ns)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onSelectNamespace(ns.id)}
                aria-expanded={isExpanded}
              >
                <span className="ns-chevron">{isExpanded ? '▼' : '▶'}</span>
                <span className="ns-name">{ns.name}</span>
              </div>
              {isExpanded && (
                <ul className="project-list">
                  {projects.length === 0 && (
                    <li className="sidebar-hint">No projects</li>
                  )}
                  {projects.map((p) => (
                    <li key={p.id}>
                      <div
                        className={`project-row${p.id === selectedProjectId ? ' selected' : ''}`}
                        onClick={() => onSelectProject(p.id)}
                        onContextMenu={(e) => handleProjectContextMenu(e, p)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && onSelectProject(p.id)}
                      >
                        <span className="project-name">
                          {p.name}
                          {projectsWithErrors.has(p.name) && (
                            <span className="error-badge" title="Has validation errors">●</span>
                          )}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <div className="sidebar-footer">
        <button
          className="sidebar-footer-btn"
          onClick={onBackup}
          disabled={isBackingUp}
          title="Backup to S3"
        >
          {isBackingUp ? 'Backing up…' : '☁ S3 Backup'}
        </button>
        <button
          className="sidebar-footer-btn"
          onClick={onRestore}
          disabled={isRestoring}
          title="Restore from backup file"
        >
          {isRestoring ? 'Restoring…' : '⟳ Restore'}
        </button>
        <button
          className="sidebar-footer-btn"
          onClick={() => openUrl(consoleUrl)}
          title={`Open SSM Parameter Store in AWS Console (${region})`}
        >
          ↗ AWS Console
        </button>
        <button className="sidebar-footer-btn" onClick={onOpenSettings}>
          ⚙ Settings
        </button>
      </div>

      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="context-menu"
          style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x }}
        >
          {contextMenu.type === 'namespace' ? (
            <>
              <button
                className="context-menu-item"
                onClick={() => handleContextAction(() => onCreateProject(contextMenu.id))}
              >
                + Add project
              </button>
              <button
                className="context-menu-item"
                onClick={() => handleContextAction(() => onManageEnvironments(contextMenu.id))}
              >
                Manage environments
              </button>
              <button
                className="context-menu-item danger"
                onClick={() => handleContextAction(() => onDeleteNamespace(contextMenu.id))}
              >
                Delete namespace
              </button>
            </>
          ) : (
            <button
              className="context-menu-item danger"
              onClick={() => handleContextAction(() => onDeleteProject(contextMenu.id))}
            >
              Delete project
            </button>
          )}
        </div>
      )}
    </div>
  );
}
