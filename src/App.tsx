import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AppProvider, useAppState, useAppDispatch } from './store/AppContext';
import { TauriDbClient } from './db/tauri-client';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { KeyTable } from './components/KeyTable';
import { KeyDetailPanel } from './components/KeyDetailPanel';
import { PushDiffView } from './components/PushDiffView';
import { SettingsScreen } from './components/SettingsScreen';
import { ValidationPanel } from './components/ValidationPanel';
import { ExportEnvDialog } from './components/ExportEnvDialog';
import type { DbClient } from './db/client';
import type { EnvKey } from './types';
import { getAllNamespaces, createNamespace, deleteNamespace } from './db/repositories/namespaces';
import { getEnvironmentsByNamespace, createEnvironment, deleteEnvironment, reorderEnvironments } from './db/repositories/environments';
import { getProjectsByNamespace, createProject, deleteProject } from './db/repositories/projects';
import { getKeysByProject, getKeyById, createKey, updateKey, deleteKey } from './db/repositories/keys';
import { getKeyValuesByProject, getKeyValuesByKey, upsertKeyValue, deleteKeyValue } from './db/repositories/key-values';
import { getLinksByKey, deleteLink, createLink, getAllLinkedKeyIds } from './db/repositories/key-links';
import { getSettings, updateSettings } from './db/repositories/settings';
import { validateLinks } from './lib/link-validator';
import { ConfirmDialog } from './components/ConfirmDialog';
import { InputDialog } from './components/InputDialog';
import { CreateNamespaceDialog } from './components/CreateNamespaceDialog';
import { ImportEnvDialog } from './components/ImportEnvDialog';
import { CreateLinkDialog } from './components/CreateLinkDialog';
import { ManageEnvironmentsDialog } from './components/ManageEnvironmentsDialog';
import { DebugLog } from './components/DebugLog';
import './App.css';

interface AppShellProps {
  db: DbClient;
}

function AppShell({ db }: AppShellProps) {
  const { state, dispatch, selectedNamespace, selectedProject } = useAppState();
  const [selectedKey, setSelectedKey] = useState<EnvKey | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [pushDiffOpen, setPushDiffOpen] = useState(false);
  const [pendingPullDiff, setPendingPullDiff] = useState<import('./types').DiffItem[]>([]);
  const [pullDiffOpen, setPullDiffOpen] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);
  const [inputDialog, setInputDialog] = useState<{
    title: string;
    label: string;
    placeholder?: string;
    submitLabel?: string;
    onSubmit: (value: string) => void;
  } | null>(null);
  const [showCreateNamespace, setShowCreateNamespace] = useState(false);
  const [manageEnvsNamespaceId, setManageEnvsNamespaceId] = useState<number | null>(null);
  const [showImportEnv, setShowImportEnv] = useState(false);
  const [showExportEnv, setShowExportEnv] = useState(false);
  const [createLinkKeyId, setCreateLinkKeyId] = useState<number | null>(null);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [syncStatus, setSyncStatus] = useState<{
    inSync: boolean;
    changeCount: number;
    checkedAt: Date;
  } | null>(null);
  const [isSyncChecking, setIsSyncChecking] = useState(false);
  const [linkedKeyNames, setLinkedKeyNames] = useState<Record<number, string>>({});

  // Resolve linked key names (for keys in other projects)
  useEffect(() => {
    if (state.keyLinks.length === 0) {
      setLinkedKeyNames({});
      return;
    }
    const currentKeyIds = new Set(state.keys.map((k) => k.id));
    const otherKeyIds = new Set<number>();
    for (const link of state.keyLinks) {
      if (!currentKeyIds.has(link.source_key_id)) otherKeyIds.add(link.source_key_id);
      if (!currentKeyIds.has(link.target_key_id)) otherKeyIds.add(link.target_key_id);
    }
    // Build names for current project keys
    const names: Record<number, string> = {};
    for (const k of state.keys) {
      names[k.id] = k.name;
    }
    if (otherKeyIds.size === 0) {
      setLinkedKeyNames(names);
      return;
    }
    // Fetch other keys from DB
    Promise.all([...otherKeyIds].map((id) => getKeyById(db, id))).then((keys) => {
      for (const k of keys) {
        if (!k) continue;
        const proj = state.projects.find((p) => p.id === k.project_id);
        names[k.id] = proj ? `${proj.name} / ${k.name}` : k.name;
      }
      setLinkedKeyNames(names);
    });
  }, [state.keyLinks, state.keys, state.projects, db]);

  function logDebug(msg: string) {
    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setDebugLog((prev) => [`[${ts}] ${msg}`, ...prev]);
  }

  // Load initial data on mount
  useEffect(() => {
    (async () => {
      try {
        dispatch({ type: 'SET_LOADING', loading: true });
        const [namespaces, settings] = await Promise.all([
          getAllNamespaces(db),
          getSettings(db),
        ]);
        dispatch({ type: 'SET_NAMESPACES', namespaces });
        dispatch({ type: 'SET_SETTINGS', settings });
      } catch (e) {
        dispatch({ type: 'SET_ERROR', error: String(e) });
      } finally {
        dispatch({ type: 'SET_LOADING', loading: false });
      }
    })();
  }, [db, dispatch]);

  async function handleSelectNamespace(id: number) {
    try {
      const [environments, projects] = await Promise.all([
        getEnvironmentsByNamespace(db, id),
        getProjectsByNamespace(db, id),
      ]);
      dispatch({ type: 'SELECT_NAMESPACE', id, environments, projects });

      const errors = await validateLinks(db, id);
      dispatch({ type: 'SET_VALIDATION_ERRORS', errors });
    } catch (e) {
      dispatch({ type: 'SET_ERROR', error: String(e) });
    }
  }

  async function handleSelectProject(id: number) {
    try {
      const keys = await getKeysByProject(db, id);
      const [keyValues, linkArrays] = await Promise.all([
        getKeyValuesByProject(db, id),
        Promise.all(keys.map((k) => getLinksByKey(db, k.id))),
      ]);
      // Deduplicate links
      const seen = new Set<number>();
      const uniqueLinks = linkArrays.flat().filter((l) => {
        if (seen.has(l.id)) return false;
        seen.add(l.id);
        return true;
      });
      dispatch({ type: 'SELECT_PROJECT', id, keys, keyValues, keyLinks: uniqueLinks });
      setSyncStatus(null);
    } catch (e) {
      dispatch({ type: 'SET_ERROR', error: String(e) });
    }
  }

  function handleCreateNamespace() {
    setShowCreateNamespace(true);
  }

  async function handleCreateNamespaceSubmit(name: string) {
    setShowCreateNamespace(false);
    try {
      const ns = await createNamespace(db, name);
      const namespaces = await getAllNamespaces(db);
      dispatch({ type: 'SET_NAMESPACES', namespaces });
      await handleSelectNamespace(ns.id);
    } catch (e) {
      dispatch({ type: 'SET_ERROR', error: String(e) });
    }
  }

  function handleManageEnvironments(namespaceId: number) {
    setManageEnvsNamespaceId(namespaceId);
  }

  async function handleAddEnvironment(name: string) {
    if (!manageEnvsNamespaceId) return;
    try {
      const maxSort = state.environments.reduce((max, e) => Math.max(max, e.sort_order), -1);
      await createEnvironment(db, manageEnvsNamespaceId, name, maxSort + 1);
      const environments = await getEnvironmentsByNamespace(db, manageEnvsNamespaceId);
      dispatch({
        type: 'SELECT_NAMESPACE',
        id: manageEnvsNamespaceId,
        environments,
        projects: state.projects,
      });
    } catch (e) {
      dispatch({ type: 'SET_ERROR', error: String(e) });
    }
  }

  async function handleDeleteEnvironment(envId: number) {
    if (!manageEnvsNamespaceId) return;
    const env = state.environments.find((e) => e.id === envId);
    if (!env) return;
    setConfirmDialog({
      title: 'Delete environment',
      message: `Delete environment "${env.name}"?\n\nThis will remove all values for this environment across all projects in this namespace.`,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await deleteEnvironment(db, envId);
          const environments = await getEnvironmentsByNamespace(db, manageEnvsNamespaceId!);
          dispatch({
            type: 'SELECT_NAMESPACE',
            id: manageEnvsNamespaceId!,
            environments,
            projects: state.projects,
          });
          // Reload project data if one is selected (key values may have changed)
          if (state.selectedProjectId) {
            await reloadProjectData(state.selectedProjectId);
          }
        } catch (e) {
          dispatch({ type: 'SET_ERROR', error: String(e) });
        }
      },
    });
  }

  async function handleReorderEnvironments(orderedIds: number[]) {
    if (!manageEnvsNamespaceId) return;
    try {
      await reorderEnvironments(db, orderedIds);
      const environments = await getEnvironmentsByNamespace(db, manageEnvsNamespaceId);
      dispatch({
        type: 'SELECT_NAMESPACE',
        id: manageEnvsNamespaceId,
        environments,
        projects: state.projects,
      });
    } catch (e) {
      dispatch({ type: 'SET_ERROR', error: String(e) });
    }
  }

  async function handleDeleteNamespace(id: number) {
    const ns = state.namespaces.find((n) => n.id === id);
    if (!ns) return;
    if (!state.settings) {
      dispatch({ type: 'SET_ERROR', error: 'Configure AWS settings first.' });
      return;
    }

    // Block if any key in the namespace is locked
    const lockedRows = await db.select<{ cnt: number }>(
      'SELECT COUNT(*) as cnt FROM keys k JOIN projects p ON k.project_id = p.id WHERE p.namespace_id = ? AND k.is_locked = 1',
      [id]
    );
    if (lockedRows[0]?.cnt > 0) {
      dispatch({
        type: 'SET_ERROR',
        error: `Cannot delete namespace "${ns.name}": ${lockedRows[0].cnt} locked key(s). Unlock all keys first.`,
      });
      return;
    }

    let remoteParams: Array<{ path: string; value: string }> = [];
    try {
      const { buildNamespacePrefix } = await import('./lib/path-builder');
      remoteParams = await invoke<Array<{ path: string; value: string }>>('ssm_get_params', {
        profile: state.settings.ssm_profile ?? 'default',
        region: state.settings.aws_region ?? 'us-east-1',
        prefix: buildNamespacePrefix(ns.name),
        credentialsFilePath: state.settings.credentials_file_path ?? null,
      });
    } catch (e) {
      dispatch({ type: 'SET_ERROR', error: String(e) });
      return;
    }

    const count = remoteParams.length;
    let message: string;
    if (count === 0) {
      message = `Delete namespace "${ns.name}"?\n\nNo SSM parameters found.`;
    } else {
      const maxShow = 10;
      const paths = remoteParams.map((p) => p.path);
      const listed = paths.slice(0, maxShow).map((p) => `  ${p}`).join('\n');
      const suffix = count > maxShow ? `\n  … and ${count - maxShow} more` : '';
      message = `Delete namespace "${ns.name}"?\n\nSSM parameters to delete (${count}):\n${listed}${suffix}`;
    }

    setConfirmDialog({
      title: 'Delete namespace',
      message,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          // Remote first — retryable on failure
          if (count > 0) {
            await invoke('ssm_apply_diff', {
              profile: state.settings!.ssm_profile ?? 'default',
              region: state.settings!.aws_region ?? 'us-east-1',
              diff: remoteParams.map((p) => ({ action: 'delete', path: p.path })),
              credentialsFilePath: state.settings!.credentials_file_path ?? null,
            });
          }
          // Single DELETE with CASCADE — already atomic
          await deleteNamespace(db, id);
          const namespaces = await getAllNamespaces(db);
          dispatch({ type: 'SET_NAMESPACES', namespaces });
          if (state.selectedNamespaceId === id) {
            dispatch({ type: 'SELECT_NAMESPACE', id: null, environments: [], projects: [] });
          }
        } catch (e) {
          dispatch({ type: 'SET_ERROR', error: String(e) });
        }
      },
    });
  }

  function handleCreateProject(namespaceId: number) {
    setInputDialog({
      title: 'New project',
      label: 'Project name',
      placeholder: 'e.g. api-service',
      onSubmit: async (name: string) => {
        setInputDialog(null);
        try {
          const project = await createProject(db, namespaceId, name);
          const [environments, projects] = await Promise.all([
            getEnvironmentsByNamespace(db, namespaceId),
            getProjectsByNamespace(db, namespaceId),
          ]);
          dispatch({ type: 'SELECT_NAMESPACE', id: namespaceId, environments, projects });
          const errors = await validateLinks(db, namespaceId);
          dispatch({ type: 'SET_VALIDATION_ERRORS', errors });
          await handleSelectProject(project.id);
        } catch (e) {
          dispatch({ type: 'SET_ERROR', error: String(e) });
        }
      },
    });
  }

  async function handleDeleteProject(id: number) {
    const project = state.projects.find((p) => p.id === id);
    if (!project) return;
    const ns = state.namespaces.find((n) => n.id === project.namespace_id);
    if (!ns || !state.settings) {
      dispatch({ type: 'SET_ERROR', error: 'Configure AWS settings first.' });
      return;
    }

    // Block if any key in the project is locked
    const lockedRows = await db.select<{ cnt: number }>(
      'SELECT COUNT(*) as cnt FROM keys WHERE project_id = ? AND is_locked = 1',
      [id]
    );
    if (lockedRows[0]?.cnt > 0) {
      dispatch({
        type: 'SET_ERROR',
        error: `Cannot delete project "${project.name}": ${lockedRows[0].cnt} locked key(s). Unlock all keys first.`,
      });
      return;
    }

    let remoteParams: Array<{ path: string; value: string }> = [];
    try {
      const { buildProjectPrefix } = await import('./lib/path-builder');
      remoteParams = await invoke<Array<{ path: string; value: string }>>('ssm_get_params', {
        profile: state.settings.ssm_profile ?? 'default',
        region: state.settings.aws_region ?? 'us-east-1',
        prefix: buildProjectPrefix(ns.name, project.name),
        credentialsFilePath: state.settings.credentials_file_path ?? null,
      });
    } catch (e) {
      dispatch({ type: 'SET_ERROR', error: String(e) });
      return;
    }

    const count = remoteParams.length;
    let message: string;
    if (count === 0) {
      message = `Delete project "${project.name}"?\n\nNo SSM parameters found.`;
    } else {
      const maxShow = 10;
      const paths = remoteParams.map((p) => p.path);
      const listed = paths.slice(0, maxShow).map((p) => `  ${p}`).join('\n');
      const suffix = count > maxShow ? `\n  … and ${count - maxShow} more` : '';
      message = `Delete project "${project.name}"?\n\nSSM parameters to delete (${count}):\n${listed}${suffix}`;
    }

    // Check for cross-project links
    const projectKeys = await getKeysByProject(db, id);
    let hasExternalLinks = false;
    for (const key of projectKeys) {
      const links = await getLinksByKey(db, key.id);
      if (links.length > 0) {
        hasExternalLinks = true;
        break;
      }
    }
    if (hasExternalLinks) {
      message += '\n\nThis project has keys linked to other projects. Those links will be removed.';
    }

    setConfirmDialog({
      title: 'Delete project',
      message,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          // Remote first — retryable on failure
          if (count > 0) {
            await invoke('ssm_apply_diff', {
              profile: state.settings!.ssm_profile ?? 'default',
              region: state.settings!.aws_region ?? 'us-east-1',
              diff: remoteParams.map((p) => ({ action: 'delete', path: p.path })),
              credentialsFilePath: state.settings!.credentials_file_path ?? null,
            });
          }
          // Single DELETE with CASCADE — already atomic
          await deleteProject(db, id);
          if (!state.selectedNamespaceId) return;
          const projects = await getProjectsByNamespace(db, state.selectedNamespaceId);
          dispatch({
            type: 'SELECT_NAMESPACE',
            id: state.selectedNamespaceId,
            environments: state.environments,
            projects,
          });
          if (state.selectedProjectId === id) {
            dispatch({ type: 'SELECT_PROJECT', id: null, keys: [], keyValues: [], keyLinks: [] });
          }
        } catch (e) {
          dispatch({ type: 'SET_ERROR', error: String(e) });
        }
      },
    });
  }

  function handleAddKey() {
    if (!state.selectedProjectId) return;
    setInputDialog({
      title: 'New key',
      label: 'Key name',
      placeholder: 'e.g. API_KEY',
      onSubmit: async (name: string) => {
        setInputDialog(null);
        try {
          await createKey(db, state.selectedProjectId!, name, null, null, false);
          await reloadProjectData(state.selectedProjectId!);
        } catch (e) {
          dispatch({ type: 'SET_ERROR', error: String(e) });
        }
      },
    });
  }

  function handleImportEnv() {
    if (!state.selectedProjectId) return;
    setShowImportEnv(true);
  }

  async function handleImportEnvSubmit(content: string, environmentId: number) {
    setShowImportEnv(false);
    if (!state.selectedProjectId) return;

    const { parseEnvFile } = await import('./lib/env-parser');
    const { entries, errors } = parseEnvFile(content);

    if (errors.length > 0) {
      dispatch({ type: 'SET_ERROR', error: `Parse errors: ${errors.join(', ')}` });
      return;
    }

    const env = state.environments.find((e) => e.id === environmentId);
    if (!env) {
      dispatch({ type: 'SET_ERROR', error: 'Environment not found.' });
      return;
    }

    try {
      for (const [keyName, value] of Object.entries(entries)) {
        let key = state.keys.find((k) => k.name === keyName);
        if (!key) {
          key = await createKey(db, state.selectedProjectId!, keyName, null, null, false);
        }
        await upsertKeyValue(db, key.id, env.id, value.trim() || null);
      }
      await reloadProjectData(state.selectedProjectId!);
    } catch (e) {
      dispatch({ type: 'SET_ERROR', error: String(e) });
    }
  }

  async function handleSaveKey(
    keyId: number,
    fields: { name: string; description: string; note: string; is_secure: boolean },
    values: Record<number, string | null>
  ) {
    // Check if this key has links and values/is_secure changed
    const linkedKeyIds = await getAllLinkedKeyIds(db, keyId);
    if (linkedKeyIds.length > 0) {
      // Find which environments have changed values
      const currentValues = await getKeyValuesByKey(db, keyId);
      const changedEnvIds: number[] = [];
      for (const [envIdStr, newVal] of Object.entries(values)) {
        const envId = Number(envIdStr);
        const current = currentValues.find((kv) => kv.environment_id === envId);
        const oldVal = current?.value ?? null;
        if (oldVal !== newVal) {
          changedEnvIds.push(envId);
        }
      }

      // Check if is_secure changed
      const currentKey = state.keys.find((k) => k.id === keyId);
      const isSecureChanged = currentKey ? (currentKey.is_secure === 1) !== fields.is_secure : false;

      if (changedEnvIds.length > 0 || isSecureChanged) {
        const linkedKeyNames = linkedKeyIds.map((id) => `key #${id}`).join(', ');

        setConfirmDialog({
          title: 'Update linked keys',
          message: `This key is linked to ${linkedKeyNames}. Update both sides?`,
          confirmLabel: 'Update all',
          onConfirm: async () => {
            setConfirmDialog(null);
            try {
              await doSaveKey(keyId, fields, values);
              // Update linked keys for changed environments
              for (const linkedKeyId of linkedKeyIds) {
                for (const envId of changedEnvIds) {
                  await upsertKeyValue(db, linkedKeyId, envId, values[envId]);
                }
              }
              // Propagate is_secure change to linked keys
              if (isSecureChanged) {
                for (const linkedKeyId of linkedKeyIds) {
                  await updateKey(db, linkedKeyId, { is_secure: fields.is_secure ? 1 : 0 });
                }
              }
              await postSaveReload();
            } catch (e) {
              dispatch({ type: 'SET_ERROR', error: String(e) });
            }
          },
        });
        return;
      }
    }

    // No links or no value changes — save directly
    try {
      await doSaveKey(keyId, fields, values);
      await postSaveReload();
    } catch (e) {
      dispatch({ type: 'SET_ERROR', error: String(e) });
    }
  }

  async function doSaveKey(
    keyId: number,
    fields: { name: string; description: string; note: string; is_secure: boolean },
    values: Record<number, string | null>
  ) {
    await updateKey(db, keyId, {
      name: fields.name,
      description: fields.description || null,
      note: fields.note || null,
      is_secure: fields.is_secure ? 1 : 0,
    });
    for (const [envIdStr, value] of Object.entries(values)) {
      await upsertKeyValue(db, keyId, Number(envIdStr), value);
    }
  }

  async function postSaveReload() {
    setSelectedKey(null);
    if (state.selectedProjectId) {
      await reloadProjectData(state.selectedProjectId);
    }
    if (state.selectedNamespaceId) {
      const errors = await validateLinks(db, state.selectedNamespaceId);
      dispatch({ type: 'SET_VALIDATION_ERRORS', errors });
    }
  }

  async function handleDeleteKeys(keyIds: number[]) {
    // Block deletion of locked keys
    const lockedNames = keyIds
      .map((id) => state.keys.find((k) => k.id === id))
      .filter((k) => k && k.is_locked === 1)
      .map((k) => k!.name);
    if (lockedNames.length > 0) {
      dispatch({
        type: 'SET_ERROR',
        error: `Cannot delete locked key${lockedNames.length > 1 ? 's' : ''}: ${lockedNames.join(', ')}. Unlock first.`,
      });
      return;
    }

    // Check for linked keys (full chain traversal)
    const linkedTargetIds: number[] = [];
    for (const keyId of keyIds) {
      const allLinked = await getAllLinkedKeyIds(db, keyId);
      for (const id of allLinked) {
        if (!keyIds.includes(id) && !linkedTargetIds.includes(id)) {
          linkedTargetIds.push(id);
        }
      }
    }

    const names = keyIds.map((id) => state.keys.find((k) => k.id === id)?.name ?? `#${id}`);
    let message =
      keyIds.length === 1
        ? `Delete key "${names[0]}"?`
        : `Delete ${keyIds.length} keys?\n${names.map((n) => `• ${n}`).join('\n')}`;

    if (linkedTargetIds.length > 0) {
      message += `\n\nThis will also delete ${linkedTargetIds.length} linked key${linkedTargetIds.length > 1 ? 's' : ''} in other projects.`;
    }

    setConfirmDialog({
      title: keyIds.length === 1 ? 'Delete key' : `Delete ${keyIds.length} keys`,
      message,
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          // Delete linked keys too
          const allIds = [...keyIds, ...linkedTargetIds];
          const placeholders = allIds.map(() => '?').join(',');
          await db.execute(`DELETE FROM keys WHERE id IN (${placeholders})`, allIds);
          if (selectedKey && allIds.includes(selectedKey.id)) {
            setSelectedKey(null);
          }
          if (state.selectedProjectId) {
            await reloadProjectData(state.selectedProjectId);
          }
          if (state.selectedNamespaceId) {
            const errors = await validateLinks(db, state.selectedNamespaceId);
            dispatch({ type: 'SET_VALIDATION_ERRORS', errors });
          }
        } catch (e) {
          dispatch({ type: 'SET_ERROR', error: String(e) });
        }
      },
    });
  }

  async function handleToggleLock(keyId: number, locked: boolean) {
    try {
      await updateKey(db, keyId, { is_locked: locked ? 1 : 0 });
      if (state.selectedProjectId) {
        await reloadProjectData(state.selectedProjectId);
      }
      // Refresh selected key if it's open in the detail panel
      if (selectedKey && selectedKey.id === keyId) {
        const updated = state.keys.find((k) => k.id === keyId);
        if (updated) {
          setSelectedKey({ ...updated, is_locked: locked ? 1 : 0 });
        }
      }
    } catch (e) {
      dispatch({ type: 'SET_ERROR', error: String(e) });
    }
  }

  async function handleDeleteLink(linkId: number) {
    const link = state.keyLinks.find((l) => l.id === linkId);
    if (!link) return;

    const sourceKey = state.keys.find((k) => k.id === link.source_key_id);
    const targetKeyId = link.source_key_id === (sourceKey?.id ?? 0) ? link.target_key_id : link.source_key_id;
    const sourceLabel = sourceKey?.name ?? `#${link.source_key_id}`;
    const targetLabel = `key #${targetKeyId}`;

    setConfirmDialog({
      title: 'Remove link',
      message: `Remove the link between "${sourceLabel}" and "${targetLabel}"?`,
      confirmLabel: 'Remove',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await deleteLink(db, linkId);
          if (state.selectedProjectId) {
            await reloadProjectData(state.selectedProjectId);
          }
          if (state.selectedNamespaceId) {
            const errors = await validateLinks(db, state.selectedNamespaceId);
            dispatch({ type: 'SET_VALIDATION_ERRORS', errors });
          }
        } catch (e) {
          dispatch({ type: 'SET_ERROR', error: String(e) });
        }
      },
    });
  }

  function handleOpenCreateLink(keyId: number) {
    if (state.projects.length < 2) {
      dispatch({ type: 'SET_ERROR', error: 'Need at least two projects in this namespace to create a link.' });
      return;
    }
    setCreateLinkKeyId(keyId);
  }

  async function loadKeysAndValuesForProject(projectId: number) {
    const [keys, keyValues] = await Promise.all([
      getKeysByProject(db, projectId),
      getKeyValuesByProject(db, projectId),
    ]);
    return { keys, keyValues };
  }

  async function handleConfirmCreateLink(sourceKeyId: number, targetKeyId: number) {
    try {
      await createLink(db, sourceKeyId, targetKeyId, 'eq');
      setCreateLinkKeyId(null);
      if (state.selectedProjectId) {
        await reloadProjectData(state.selectedProjectId);
      }
      if (state.selectedNamespaceId) {
        const errors = await validateLinks(db, state.selectedNamespaceId);
        dispatch({ type: 'SET_VALIDATION_ERRORS', errors });
      }
    } catch (e) {
      dispatch({ type: 'SET_ERROR', error: String(e) });
    }
  }

  async function handleSaveSettings(fields: Parameters<typeof updateSettings>[1]) {
    try {
      const settings = await updateSettings(db, fields);
      dispatch({ type: 'SET_SETTINGS', settings });
      setShowSettings(false);
    } catch (e) {
      dispatch({ type: 'SET_ERROR', error: String(e) });
    }
  }

  async function handlePush() {
    if (!selectedNamespace || !selectedProject || !state.settings) {
      dispatch({ type: 'SET_ERROR', error: 'Select a project and configure AWS settings first.' });
      return;
    }

    setIsPushing(true);
    try {
      const { buildProjectPrefix } = await import('./lib/path-builder');
      const { buildLocalParams } = await import('./lib/local-params');
      const { computeDiff } = await import('./lib/diff-engine');

      const prefix = buildProjectPrefix(selectedNamespace.name, selectedProject.name);
      logDebug(`[PUSH] Querying SSM prefix: ${prefix}`);
      logDebug(`[PUSH] Profile: ${state.settings.ssm_profile ?? 'default'}  Region: ${state.settings.aws_region ?? 'us-east-1'}`);

      const remoteParams = await invoke<Array<{ path: string; value: string }>>('ssm_get_params', {
        profile: state.settings.ssm_profile ?? 'default',
        region: state.settings.aws_region ?? 'us-east-1',
        prefix,
        credentialsFilePath: state.settings.credentials_file_path ?? null,
      });
      logDebug(`[PUSH] SSM returned ${remoteParams.length} remote param(s)`);

      const localParams = buildLocalParams(
        selectedNamespace.name, selectedProject.name,
        state.keys, state.environments, state.keyValues,
        { skipNullValues: true, includeMetadata: true },
      );
      logDebug(`[PUSH] Built ${localParams.length} local param(s)`);

      const diff = computeDiff(localParams, remoteParams);
      const creates = diff.filter((d) => d.action === 'create').length;
      const updates = diff.filter((d) => d.action === 'update').length;
      const deletes = diff.filter((d) => d.action === 'delete').length;
      logDebug(`[PUSH] Diff: ${creates} create, ${updates} update, ${deletes} delete`);

      dispatch({ type: 'SET_PENDING_DIFF', diff });
      setPushDiffOpen(true);
      setIsPushing(false);
    } catch (e) {
      logDebug(`[PUSH] ERROR: ${String(e)}`);
      dispatch({ type: 'SET_ERROR', error: String(e) });
      setIsPushing(false);
    }
  }

  async function handleConfirmPush() {
    if (!state.settings) return;
    try {
      logDebug(`[PUSH] Applying diff (${state.pendingDiff.length} item(s))…`);
      const result = await invoke<{ created: number; updated: number; deleted: number }>('ssm_apply_diff', {
        profile: state.settings.ssm_profile ?? 'default',
        region: state.settings.aws_region ?? 'us-east-1',
        diff: state.pendingDiff,
        credentialsFilePath: state.settings.credentials_file_path ?? null,
      });
      logDebug(`[PUSH] ✓ Applied — created: ${result.created}, updated: ${result.updated}, deleted: ${result.deleted}`);
      dispatch({ type: 'CLEAR_PENDING_DIFF' });
      setPushDiffOpen(false);
      setSyncStatus(null);
    } catch (e) {
      logDebug(`[PUSH] FAILED to apply diff: ${String(e)}`);
      dispatch({ type: 'SET_ERROR', error: String(e) });
    }
  }

  async function handleSyncCheck() {
    if (!selectedNamespace || !selectedProject || !state.settings) {
      dispatch({ type: 'SET_ERROR', error: 'Configure AWS settings first.' });
      return;
    }

    setIsSyncChecking(true);
    try {
      const { buildProjectPrefix } = await import('./lib/path-builder');
      const { buildLocalParams } = await import('./lib/local-params');
      const { computeDiff } = await import('./lib/diff-engine');

      const prefix = buildProjectPrefix(selectedNamespace.name, selectedProject.name);
      logDebug(`[SYNC] Checking prefix: ${prefix}`);

      const remoteParams = await invoke<Array<{ path: string; value: string }>>('ssm_get_params', {
        profile: state.settings.ssm_profile ?? 'default',
        region: state.settings.aws_region ?? 'us-east-1',
        prefix,
        credentialsFilePath: state.settings.credentials_file_path ?? null,
      });

      const localParams = buildLocalParams(
        selectedNamespace.name, selectedProject.name,
        state.keys, state.environments, state.keyValues,
        { skipNullValues: true, includeMetadata: true },
      );

      const diff = computeDiff(localParams, remoteParams);
      const changeCount = diff.length;
      logDebug(`[SYNC] ${changeCount === 0 ? 'In sync' : `Out of sync (${changeCount} changes)`}`);

      setSyncStatus({
        inSync: changeCount === 0,
        changeCount,
        checkedAt: new Date(),
      });
    } catch (e) {
      logDebug(`[SYNC] ERROR: ${String(e)}`);
      dispatch({ type: 'SET_ERROR', error: String(e) });
    } finally {
      setIsSyncChecking(false);
    }
  }

  async function handlePull() {
    if (!selectedNamespace || !selectedProject || !state.settings) {
      dispatch({ type: 'SET_ERROR', error: 'Select a project and configure AWS settings first.' });
      return;
    }
    // Block pull if any key is locked
    const lockedKeys = state.keys.filter((k) => k.is_locked === 1);
    if (lockedKeys.length > 0) {
      dispatch({
        type: 'SET_ERROR',
        error: `Cannot pull: ${lockedKeys.length} locked key${lockedKeys.length > 1 ? 's' : ''}. Unlock all keys before pulling.`,
      });
      return;
    }
    setIsPulling(true);
    try {
      const { buildProjectPrefix, parsePath } = await import('./lib/path-builder');
      const { buildLocalParams } = await import('./lib/local-params');
      const { computePullDiff } = await import('./lib/diff-engine');

      const prefix = buildProjectPrefix(selectedNamespace.name, selectedProject.name);
      logDebug(`[PULL] Querying SSM prefix: ${prefix}`);
      logDebug(`[PULL] Profile: ${state.settings.ssm_profile ?? 'default'}  Region: ${state.settings.aws_region ?? 'us-east-1'}`);

      const remoteParams = await invoke<Array<{ path: string; value: string; description?: string | null }>>('ssm_get_params', {
        profile: state.settings.ssm_profile ?? 'default',
        region: state.settings.aws_region ?? 'us-east-1',
        prefix,
        credentialsFilePath: state.settings.credentials_file_path ?? null,
      });
      logDebug(`[PULL] SSM returned ${remoteParams.length} remote param(s)`);

      // Check env list mismatch between SSM and local namespace
      const ssmEnvNames = new Set<string>();
      for (const p of remoteParams) {
        const parsed = parsePath(p.path);
        if (parsed) ssmEnvNames.add(parsed.env);
      }
      const localEnvNames = new Set(state.environments.map((e) => e.name));

      const extraLocal = [...localEnvNames].filter((n) => !ssmEnvNames.has(n));
      const extraSsm = [...ssmEnvNames].filter((n) => !localEnvNames.has(n));

      if (extraLocal.length > 0 || extraSsm.length > 0) {
        const parts: string[] = ['Cannot pull: environment list mismatch.\n'];
        if (extraSsm.length > 0) {
          parts.push(`SSM has environments not in namespace: ${extraSsm.join(', ')}`);
        }
        if (extraLocal.length > 0) {
          parts.push(`Namespace has environments not in SSM: ${extraLocal.join(', ')}`);
        }
        parts.push('\nResolve environment differences first.');
        dispatch({ type: 'SET_ERROR', error: parts.join('\n') });
        return;
      }

      const localParams = buildLocalParams(
        selectedNamespace.name, selectedProject.name,
        state.keys, state.environments, state.keyValues,
        { skipNullValues: false, includeMetadata: false },
      );
      logDebug(`[PULL] Built ${localParams.length} local param(s)`);

      const diff = computePullDiff(remoteParams, localParams);
      const creates = diff.filter((d) => d.action === 'create').length;
      const updates = diff.filter((d) => d.action === 'update').length;
      const deletes = diff.filter((d) => d.action === 'delete').length;
      logDebug(`[PULL] Diff: ${creates} create, ${updates} update, ${deletes} delete`);

      setPendingPullDiff(diff);
      setPullDiffOpen(true);
    } catch (e) {
      logDebug(`[PULL] ERROR: ${String(e)}`);
      dispatch({ type: 'SET_ERROR', error: String(e) });
    } finally {
      setIsPulling(false);
    }
  }

  async function handleConfirmPull() {
    if (!selectedNamespace || !selectedProject) return;
    try {
      const { parsePath } = await import('./lib/path-builder');
      const knownEnvs = [...state.environments];
      const knownKeys = [...state.keys];

      // Each individual operation is atomic (SQLite guarantee).
      // True multi-statement transaction requires Rust-side support.
      for (const item of pendingPullDiff) {
        if (item.action === 'create') {
          const parsed = parsePath(item.path);
          if (!parsed) continue;

          let env = knownEnvs.find((e) => e.name === parsed.env);
          if (!env) {
            env = await createEnvironment(
              db,
              selectedNamespace.id,
              parsed.env,
              knownEnvs.length
            );
            knownEnvs.push(env);
          }

          let key = knownKeys.find((k) => k.name === parsed.key);
          if (!key) {
            key = await createKey(db, selectedProject.id, parsed.key, item.description ?? null, null, false);
            knownKeys.push(key);
          } else if (item.description && key.description !== item.description) {
            await updateKey(db, key.id, { description: item.description });
          }

          await upsertKeyValue(db, key.id, env.id, item.remoteValue ?? null);
          logDebug(`[PULL] create ${item.path} = ${item.remoteValue}`);
        } else if (item.action === 'update') {
          await upsertKeyValue(db, item.keyId!, item.environmentId!, item.remoteValue ?? null);
          // Update key description from SSM if present
          if (item.description) {
            const key = knownKeys.find((k) => k.id === item.keyId);
            if (key && key.description !== item.description) {
              await updateKey(db, key.id, { description: item.description });
            }
          }
          logDebug(`[PULL] update ${item.path} = ${item.remoteValue}`);
        } else if (item.action === 'delete') {
          await deleteKeyValue(db, item.keyId!, item.environmentId!);
          logDebug(`[PULL] delete ${item.path} (removed)`);
        }
      }

      // Propagate changes to linked keys
      const affectedKeyIds = new Set<number>();
      for (const item of pendingPullDiff) {
        if (item.keyId) affectedKeyIds.add(item.keyId);
        // For creates, find the key by path
        if (item.action === 'create') {
          const parsed = parsePath(item.path);
          if (parsed) {
            const key = knownKeys.find((k) => k.name === parsed.key);
            if (key) affectedKeyIds.add(key.id);
          }
        }
      }
      for (const keyId of affectedKeyIds) {
        const allLinked = await getAllLinkedKeyIds(db, keyId);
        if (allLinked.length === 0) continue;
        const pulledValues = await getKeyValuesByKey(db, keyId);
        for (const linkedKeyId of allLinked) {
          for (const pv of pulledValues) {
            await upsertKeyValue(db, linkedKeyId, pv.environment_id, pv.value);
          }
          logDebug(`[PULL] propagated values to linked key #${linkedKeyId}`);
        }
      }

      // Clean up orphaned keys (no values for any env after pull)
      const updatedKvs = await getKeyValuesByProject(db, selectedProject.id);
      for (const key of knownKeys) {
        const hasAnyValue = updatedKvs.some((kv) => kv.key_id === key.id);
        if (!hasAnyValue) {
          await deleteKey(db, key.id);
          logDebug(`[PULL] removed orphaned key "${key.name}"`);
        }
      }

      logDebug(`[PULL] ✓ Applied ${pendingPullDiff.length} change(s)`);
      setPendingPullDiff([]);
      setPullDiffOpen(false);
      setSyncStatus(null);
      if (selectedKey && !updatedKvs.some((kv) => kv.key_id === selectedKey.id)) {
        setSelectedKey(null);
      }
      await reloadProjectData(selectedProject.id);
      if (state.selectedNamespaceId) {
        const errors = await validateLinks(db, state.selectedNamespaceId);
        dispatch({ type: 'SET_VALIDATION_ERRORS', errors });
      }
    } catch (e) {
      logDebug(`[PULL] ERROR applying diff: ${String(e)}`);
      dispatch({ type: 'SET_ERROR', error: String(e) });
    }
  }

  async function handleBackup() {
    const bucket = state.settings?.s3_bucket?.trim();
    if (!bucket) {
      const msg = 'Configure S3 bucket in Settings first.';
      logDebug(`[BACKUP] ERROR: ${msg}`);
      dispatch({ type: 'SET_ERROR', error: msg });
      return;
    }
    setIsBackingUp(true);
    try {
      const { exportDb, serializeBackup, compressBackup, buildBackupS3Key } = await import('./lib/backup');

      const data = await exportDb(db);
      if (data.namespaces.length === 0) {
        dispatch({ type: 'SET_ERROR', error: 'Nothing to back up.' });
        return;
      }
      const json = serializeBackup(data);
      const compressed = compressBackup(json);
      const key = buildBackupS3Key(state.settings!.s3_backup_prefix ?? 'aws-env-manager/backups');
      logDebug(`[BACKUP] Uploading to s3://${bucket}/${key}`);
      logDebug(`[BACKUP] Profile: ${state.settings!.s3_profile ?? 'default'}  Region: ${state.settings!.aws_region ?? 'us-east-1'}`);
      await invoke('s3_upload_backup', {
        profile: state.settings!.s3_profile ?? 'default',
        region: state.settings!.aws_region ?? 'us-east-1',
        bucket,
        key,
        data: Array.from(compressed),
        credentialsFilePath: state.settings!.credentials_file_path ?? null,
      });
      logDebug(`[BACKUP] ✓ Done — uploaded ${compressed.length} bytes`);
      setSuccessMessage(`Backup uploaded: ${key}`);
    } catch (e) {
      logDebug(`[BACKUP] FAILED: ${String(e)}`);
      dispatch({ type: 'SET_ERROR', error: String(e) });
    } finally {
      setIsBackingUp(false);
    }
  }

  function handleRestore() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.gz,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      try {
        const arrayBuffer = await file.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);

        // Try decompressing first; if that fails, treat as raw JSON
        // (S3 downloads with content_encoding:gzip may arrive already decompressed)
        let data: import('./types').BackupData;
        try {
          const { decompressBackup } = await import('./lib/backup');
          data = decompressBackup(bytes);
        } catch {
          const json = new TextDecoder().decode(bytes);
          data = JSON.parse(json) as import('./types').BackupData;
        }

        if (!data.version || !data.namespaces) {
          dispatch({ type: 'SET_ERROR', error: 'Invalid backup file.' });
          return;
        }

        setConfirmDialog({
          title: 'Restore from backup',
          message: `This will overwrite all existing data with the backup from ${data.exportedAt}.\n\n${data.namespaces.length} namespace(s), ${data.projects.length} project(s), ${data.keys.length} key(s).\n\nContinue?`,
          confirmLabel: 'Restore',
          onConfirm: async () => {
            setConfirmDialog(null);
            setIsRestoring(true);
            try {
              const { restoreDb } = await import('./lib/backup');
              await restoreDb(db, data);

              // Reset all UI state, then reload from DB
              dispatch({ type: 'SELECT_PROJECT', id: null, keys: [], keyValues: [], keyLinks: [] });
              dispatch({ type: 'SELECT_NAMESPACE', id: null, environments: [], projects: [] });
              dispatch({ type: 'SET_VALIDATION_ERRORS', errors: [] });
              setSelectedKey(null);

              const [namespaces, settings] = await Promise.all([
                getAllNamespaces(db),
                getSettings(db),
              ]);
              dispatch({ type: 'SET_NAMESPACES', namespaces });
              dispatch({ type: 'SET_SETTINGS', settings });
              setSuccessMessage(`Restored from ${file.name}`);
            } catch (e) {
              dispatch({ type: 'SET_ERROR', error: `Restore failed: ${String(e)}` });
            } finally {
              setIsRestoring(false);
            }
          },
        });
      } catch (e) {
        dispatch({ type: 'SET_ERROR', error: `Failed to read backup file: ${String(e)}` });
      }
    };
    input.click();
  }

  async function reloadProjectData(projectId: number) {
    const [keys, keyValues] = await Promise.all([
      getKeysByProject(db, projectId),
      getKeyValuesByProject(db, projectId),
    ]);
    const linkArrays = await Promise.all(keys.map((k) => getLinksByKey(db, k.id)));
    const seen = new Set<number>();
    const keyLinks = linkArrays.flat().filter((l) => {
      if (seen.has(l.id)) return false;
      seen.add(l.id);
      return true;
    });
    dispatch({ type: 'SET_KEYS', keys, keyValues, keyLinks });
  }

  async function handleNavigateToKey(keyId: number) {
    const key = state.keys.find((k) => k.id === keyId);
    if (key) {
      setSelectedKey(key);
      setShowValidation(false);
    }
  }

  return (
    <div className="app-layout">
      <TopBar onCreateNamespace={handleCreateNamespace} />

      <div className="app-body">
        <Sidebar
          namespaces={state.namespaces}
          selectedNamespaceId={state.selectedNamespaceId}
          projects={state.projects}
          selectedProjectId={state.selectedProjectId}
          validationErrors={state.validationErrors}
          awsRegion={state.settings?.aws_region}
          onSelectNamespace={handleSelectNamespace}
          onDeleteNamespace={handleDeleteNamespace}
          onManageEnvironments={handleManageEnvironments}
          onCreateProject={handleCreateProject}
          onDeleteProject={handleDeleteProject}
          onSelectProject={handleSelectProject}
          onBackup={handleBackup}
          isBackingUp={isBackingUp}
          onRestore={handleRestore}
          isRestoring={isRestoring}
          onOpenSettings={() => setShowSettings(true)}
        />

        <main className="app-main">
          {state.error && (
            <div className="error-banner">
              <span>{state.error}</span>
              <button onClick={() => dispatch({ type: 'SET_ERROR', error: null })}>✕</button>
            </div>
          )}

          {successMessage && (
            <div className="success-banner">
              <span>{successMessage}</span>
              <button onClick={() => setSuccessMessage(null)}>✕</button>
            </div>
          )}

          {state.isLoading && <div className="loading-spinner">Loading…</div>}

          {!state.selectedProjectId && !state.isLoading && (
            <div className="empty-state">
              {state.selectedNamespaceId
                ? 'Select a project from the sidebar.'
                : 'Select or create a namespace to get started.'}
            </div>
          )}

          {state.selectedProjectId && selectedProject && (() => {
            const canPush = !!state.settings
              && state.keys.length > 0
              && state.keys.every((key) =>
                state.environments.every((env) =>
                  state.keyValues.some((kv) => kv.key_id === key.id && kv.environment_id === env.id && kv.value !== null)
                )
              );
            const pushTitle = canPush
              ? 'Push to Parameter Store (local wins)'
              : 'All keys must have values set for every environment';
            return (
            <>
              <div className="project-header">
                <h2 className="project-title">
                  /{selectedNamespace?.name}/{selectedProject.name}
                </h2>
                <button
                  className="action-btn primary"
                  onClick={handleAddKey}
                  title="Add a new key"
                >
                  + Key
                </button>
                <button
                  className="action-btn"
                  onClick={handlePull}
                  disabled={isPulling}
                  title="Pull from Parameter Store (SSM wins)"
                >
                  {isPulling ? 'Pulling…' : '↓ Pull'}
                </button>
                <button
                  className="action-btn"
                  onClick={handlePush}
                  disabled={!canPush || isPushing}
                  title={pushTitle}
                >
                  {isPushing ? 'Pushing…' : '↑ Push'}
                </button>
                <button
                  className="action-btn"
                  onClick={handleImportEnv}
                  title="Import a .env file into this project"
                >
                  ↩ Import
                </button>
                <button
                  className="action-btn"
                  onClick={() => setShowExportEnv(true)}
                  disabled={state.keys.length === 0}
                  title="Export keys as .env format"
                >
                  ↪ Export
                </button>
                {state.validationErrors.length > 0 && (
                  <button
                    className="validation-badge"
                    onClick={() => setShowValidation(true)}
                  >
                    ⚠ {state.validationErrors.length} validation{' '}
                    {state.validationErrors.length === 1 ? 'error' : 'errors'}
                  </button>
                )}

              </div>

              <KeyTable
                keys={state.keys}
                environments={state.environments}
                keyValues={state.keyValues}
                keyLinks={state.keyLinks}
                validationErrors={state.validationErrors}
                onSelectKey={(key) => setSelectedKey(key)}
                onDeleteKeys={handleDeleteKeys}
                onToggleLock={handleToggleLock}
              />
            </>
            );
          })()}

          {state.selectedProjectId && state.settings && (
            <div className="sync-status-bar">
              {syncStatus ? (
                <span className={`sync-badge ${syncStatus.inSync ? 'in-sync' : 'out-of-sync'}`}>
                  {syncStatus.inSync
                    ? '✓ In sync'
                    : `⚠ Out of sync (${syncStatus.changeCount} ${syncStatus.changeCount === 1 ? 'change' : 'changes'})`}
                  <span className="sync-time">
                    {' · '}checked {syncStatus.checkedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </span>
              ) : (
                <span className="sync-badge unchecked">Not checked</span>
              )}
              <button
                className="sync-refresh-btn"
                onClick={handleSyncCheck}
                disabled={isSyncChecking}
                title="Check sync status with Parameter Store"
                aria-label="Check sync status"
              >
                {isSyncChecking ? '⟳' : '↻'}
              </button>
            </div>
          )}
        </main>

        {selectedKey && (
          <KeyDetailPanel
            envKey={selectedKey}
            environments={state.environments}
            keyValues={state.keyValues}
            keyLinks={state.keyLinks}
            resolveKeyName={(keyId) => linkedKeyNames[keyId] ?? `key #${keyId}`}
            onSave={handleSaveKey}
            onClose={() => setSelectedKey(null)}
            onDeleteLink={handleDeleteLink}
            onCreateLink={handleOpenCreateLink}
          />
        )}
      </div>

      <DebugLog entries={debugLog} onClear={() => setDebugLog([])} />

      <PushDiffView
        diff={state.pendingDiff}
        isOpen={pushDiffOpen}
        mode="push"
        onConfirm={handleConfirmPush}
        onCancel={() => { dispatch({ type: 'CLEAR_PENDING_DIFF' }); setPushDiffOpen(false); }}
      />

      <PushDiffView
        diff={pendingPullDiff}
        isOpen={pullDiffOpen}
        mode="pull"
        onConfirm={handleConfirmPull}
        onCancel={() => { setPendingPullDiff([]); setPullDiffOpen(false); }}
      />

      <SettingsScreen
        settings={state.settings}
        isOpen={showSettings}
        onSave={handleSaveSettings}
        onClose={() => setShowSettings(false)}
      />

      <ValidationPanel
        errors={state.validationErrors}
        isOpen={showValidation}
        onClose={() => setShowValidation(false)}
        onNavigateToKey={handleNavigateToKey}
      />

      {showCreateNamespace && (
        <CreateNamespaceDialog
          onSubmit={handleCreateNamespaceSubmit}
          onCancel={() => setShowCreateNamespace(false)}
        />
      )}

      {manageEnvsNamespaceId !== null && (
        <ManageEnvironmentsDialog
          environments={state.environments}
          onAdd={handleAddEnvironment}
          onDelete={handleDeleteEnvironment}
          onReorder={handleReorderEnvironments}
          onClose={() => setManageEnvsNamespaceId(null)}
        />
      )}

      {showImportEnv && (
        <ImportEnvDialog
          environments={state.environments}
          onSubmit={handleImportEnvSubmit}
          onCancel={() => setShowImportEnv(false)}
        />
      )}

      {showExportEnv && (
        <ExportEnvDialog
          keys={state.keys}
          environments={state.environments}
          keyValues={state.keyValues}
          onClose={() => setShowExportEnv(false)}
        />
      )}

      {inputDialog && (
        <InputDialog
          title={inputDialog.title}
          label={inputDialog.label}
          placeholder={inputDialog.placeholder}
          submitLabel={inputDialog.submitLabel}
          onSubmit={inputDialog.onSubmit}
          onCancel={() => setInputDialog(null)}
        />
      )}

      {createLinkKeyId !== null && (() => {
        const sourceKey = state.keys.find((k) => k.id === createLinkKeyId);
        if (!sourceKey) return null;
        const sourceVals: Record<number, string | null> = {};
        for (const kv of state.keyValues) {
          if (kv.key_id === createLinkKeyId) {
            sourceVals[kv.environment_id] = kv.value;
          }
        }
        return (
          <CreateLinkDialog
            sourceKeyId={createLinkKeyId}
            sourceKeyName={sourceKey.name}
            sourceIsSecure={sourceKey.is_secure === 1}
            currentProjectId={state.selectedProjectId!}
            projects={state.projects}
            environments={state.environments}
            loadKeysAndValues={loadKeysAndValuesForProject}
            sourceValues={sourceVals}
            onConfirm={handleConfirmCreateLink}
            onCancel={() => setCreateLinkKeyId(null)}
          />
        );
      })()}

      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
}

function AppLoader() {
  const dispatch = useAppDispatch();
  const [db, setDb] = useState<DbClient | null>(null);

  useEffect(() => {
    TauriDbClient.open()
      .then((client) => setDb(client))
      .catch((e) => dispatch({ type: 'SET_ERROR', error: String(e) }));
  }, [dispatch]);

  if (!db) return <div className="loading-spinner">Initializing database…</div>;
  return <AppShell db={db} />;
}

export default function App() {
  return (
    <AppProvider>
      <AppLoader />
    </AppProvider>
  );
}
