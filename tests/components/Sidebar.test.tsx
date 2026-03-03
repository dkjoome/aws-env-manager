import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '../../src/components/Sidebar';
import type { Namespace, Project, ValidationError } from '../../src/types';

const ns1: Namespace = { id: 1, name: 'my-company', created_at: '', updated_at: '' };
const ns2: Namespace = { id: 2, name: 'another-org', created_at: '', updated_at: '' };

const proj1: Project = { id: 10, namespace_id: 1, name: 'projectA', created_at: '', updated_at: '' };
const proj2: Project = { id: 11, namespace_id: 1, name: 'projectB', created_at: '', updated_at: '' };

const noErrors: ValidationError[] = [];

function renderSidebar(overrides: Partial<Parameters<typeof Sidebar>[0]> = {}) {
  const props = {
    namespaces: [ns1, ns2],
    selectedNamespaceId: 1,
    projects: [proj1, proj2],
    selectedProjectId: null,
    validationErrors: noErrors,
    awsRegion: 'us-east-1',
    onSelectNamespace: vi.fn(),
    onDeleteNamespace: vi.fn(),
    onManageEnvironments: vi.fn(),
    onCreateProject: vi.fn(),
    onDeleteProject: vi.fn(),
    onSelectProject: vi.fn(),
    onBackup: vi.fn(),
    isBackingUp: false,
    onRestore: vi.fn(),
    isRestoring: false,
    onOpenSettings: vi.fn(),
    ...overrides,
  };
  return { ...render(<Sidebar {...props} />), props };
}

describe('Sidebar — namespace tree', () => {
  it('renders all namespace names', () => {
    renderSidebar();
    expect(screen.getByText('my-company')).toBeTruthy();
    expect(screen.getByText('another-org')).toBeTruthy();
  });

  it('shows expanded chevron for selected namespace', () => {
    const { container } = renderSidebar({ selectedNamespaceId: 1 });
    const expandedRow = container.querySelector('.ns-row.expanded');
    expect(expandedRow).toBeTruthy();
  });

  it('shows collapsed chevron for non-selected namespace', () => {
    const { container } = renderSidebar({ selectedNamespaceId: 1 });
    const allRows = container.querySelectorAll('.ns-row');
    // ns1 is expanded, ns2 is not
    expect(allRows[0].className).toContain('expanded');
    expect(allRows[1].className).not.toContain('expanded');
  });

  it('calls onSelectNamespace when namespace row is clicked', () => {
    const { props } = renderSidebar();
    fireEvent.click(screen.getByText('another-org'));
    expect(props.onSelectNamespace).toHaveBeenCalledWith(2);
  });

  it('shows projects under the expanded namespace', () => {
    renderSidebar({ selectedNamespaceId: 1 });
    expect(screen.getByText('projectA')).toBeTruthy();
    expect(screen.getByText('projectB')).toBeTruthy();
  });

  it('does not show projects for collapsed namespaces', () => {
    renderSidebar({ selectedNamespaceId: 2, projects: [] });
    expect(screen.queryByText('projectA')).toBeNull();
  });

  it('shows "No projects" hint when expanded namespace has no projects', () => {
    renderSidebar({ selectedNamespaceId: 1, projects: [] });
    expect(screen.getByText('No projects')).toBeTruthy();
  });

  it('shows "No namespaces yet" hint when namespace list is empty', () => {
    renderSidebar({ namespaces: [], selectedNamespaceId: null });
    expect(screen.getByText('No namespaces yet')).toBeTruthy();
  });
});

describe('Sidebar — project selection', () => {
  it('calls onSelectProject when project row is clicked', () => {
    const { props } = renderSidebar();
    fireEvent.click(screen.getByText('projectA'));
    expect(props.onSelectProject).toHaveBeenCalledWith(10);
  });

  it('marks selected project with selected class', () => {
    renderSidebar({ selectedProjectId: 10 });
    const row = screen.getByText('projectA').closest('.project-row');
    expect(row?.className).toContain('selected');
  });

  it('does not mark unselected project with selected class', () => {
    renderSidebar({ selectedProjectId: 10 });
    const row = screen.getByText('projectB').closest('.project-row');
    expect(row?.className).not.toContain('selected');
  });
});

describe('Sidebar — context menus', () => {
  it('shows Add project, Manage environments, and Delete namespace on right-click of namespace', () => {
    renderSidebar();
    fireEvent.contextMenu(screen.getByText('my-company'));
    expect(screen.getByText('+ Add project')).toBeTruthy();
    expect(screen.getByText('Manage environments')).toBeTruthy();
    expect(screen.getByText('Delete namespace')).toBeTruthy();
  });

  it('calls onCreateProject with namespace id from context menu', () => {
    const { props } = renderSidebar();
    fireEvent.contextMenu(screen.getByText('my-company'));
    fireEvent.click(screen.getByText('+ Add project'));
    expect(props.onCreateProject).toHaveBeenCalledWith(1);
  });

  it('calls onManageEnvironments with namespace id from context menu', () => {
    const { props } = renderSidebar();
    fireEvent.contextMenu(screen.getByText('my-company'));
    fireEvent.click(screen.getByText('Manage environments'));
    expect(props.onManageEnvironments).toHaveBeenCalledWith(1);
  });

  it('calls onDeleteNamespace with namespace id from context menu', () => {
    const { props } = renderSidebar();
    fireEvent.contextMenu(screen.getByText('my-company'));
    fireEvent.click(screen.getByText('Delete namespace'));
    expect(props.onDeleteNamespace).toHaveBeenCalledWith(1);
  });

  it('shows Delete project on right-click of project', () => {
    renderSidebar();
    fireEvent.contextMenu(screen.getByText('projectA'));
    expect(screen.getByText('Delete project')).toBeTruthy();
  });

  it('calls onDeleteProject with project id from context menu', () => {
    const { props } = renderSidebar();
    fireEvent.contextMenu(screen.getByText('projectA'));
    fireEvent.click(screen.getByText('Delete project'));
    expect(props.onDeleteProject).toHaveBeenCalledWith(10);
  });

  it('does not show namespace context menu items on project right-click', () => {
    renderSidebar();
    fireEvent.contextMenu(screen.getByText('projectA'));
    expect(screen.queryByText('Delete namespace')).toBeNull();
  });
});

describe('Sidebar — validation errors', () => {
  it('shows error badge on project with validation errors', () => {
    const errors: ValidationError[] = [{
      sourceKeyId: 1, targetKeyId: 2,
      sourceKeyName: 'projectA.KEY', targetKeyName: 'projectB.KEY',
      sourceProjectName: 'projectA', targetProjectName: 'projectB',
      environmentName: 'dev', rule: 'eq',
      sourceValue: 'a', targetValue: 'b',
    }];
    renderSidebar({ validationErrors: errors });
    const badges = screen.getAllByTitle('Has validation errors');
    expect(badges.length).toBeGreaterThan(0);
  });
});

describe('Sidebar — footer', () => {
  it('renders Backup button', () => {
    renderSidebar();
    expect(screen.getByText('☁ S3 Backup')).toBeTruthy();
  });

  it('calls onBackup when Backup clicked', () => {
    const { props } = renderSidebar();
    fireEvent.click(screen.getByText('☁ S3 Backup'));
    expect(props.onBackup).toHaveBeenCalledTimes(1);
  });

  it('shows Backing up… and disables when isBackingUp', () => {
    renderSidebar({ isBackingUp: true });
    const btn = screen.getByText('Backing up…');
    expect(btn).toBeTruthy();
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('renders Restore button', () => {
    renderSidebar();
    expect(screen.getByText('⟳ Restore')).toBeTruthy();
  });

  it('calls onRestore when Restore clicked', () => {
    const { props } = renderSidebar();
    fireEvent.click(screen.getByText('⟳ Restore'));
    expect(props.onRestore).toHaveBeenCalledTimes(1);
  });

  it('shows Restoring… and disables when isRestoring', () => {
    renderSidebar({ isRestoring: true });
    const btn = screen.getByText('Restoring…');
    expect(btn).toBeTruthy();
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('renders AWS Console button', () => {
    renderSidebar();
    expect(screen.getByText('↗ AWS Console')).toBeTruthy();
  });

  it('renders Settings button', () => {
    renderSidebar();
    expect(screen.getByText('⚙ Settings')).toBeTruthy();
  });

  it('calls onOpenSettings when Settings clicked', () => {
    const { props } = renderSidebar();
    fireEvent.click(screen.getByText('⚙ Settings'));
    expect(props.onOpenSettings).toHaveBeenCalledTimes(1);
  });
});
