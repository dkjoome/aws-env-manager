export interface Namespace {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Environment {
  id: number;
  namespace_id: number;
  name: string;
  sort_order: number;
}

export interface Project {
  id: number;
  namespace_id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface EnvKey {
  id: number;
  project_id: number;
  name: string;
  description: string | null;
  note: string | null;
  is_secure: number; // 0 | 1
  is_locked: number; // 0 | 1
  created_at: string;
  updated_at: string;
}

export interface KeyValue {
  id: number;
  key_id: number;
  environment_id: number;
  value: string | null;
  updated_at: string;
}

export interface KeyLink {
  id: number;
  source_key_id: number;
  target_key_id: number;
  rule: string;
  created_at: string;
}

export interface Settings {
  id: number;
  credentials_file_path: string | null;
  ssm_profile: string | null;
  s3_profile: string | null;
  s3_bucket: string | null;
  s3_backup_prefix: string | null;
  aws_region: string | null;
  updated_at: string;
}

export interface QueryResult {
  rowsAffected: number;
  lastInsertId: number;
}

// Diff types for push to Parameter Store
export type DiffAction = 'create' | 'update' | 'delete';

export interface DiffItem {
  action: DiffAction;
  path: string;
  localValue?: string | null;
  remoteValue?: string | null;
  remoteLastModified?: Date;
  keyId?: number;
  environmentId?: number;
  isSecure?: boolean;
  description?: string | null;
}

// Link validation
export interface ValidationError {
  sourceKeyId: number;
  targetKeyId: number;
  sourceKeyName: string;
  targetKeyName: string;
  sourceProjectName: string;
  targetProjectName: string;
  environmentName: string;
  rule: string;
  sourceValue: string | null;
  targetValue: string | null;
}

// DB backup
export interface BackupData {
  version: number;
  exportedAt: string;
  namespaces: Namespace[];
  environments: Environment[];
  projects: Project[];
  keys: EnvKey[];
  keyValues: KeyValue[];
  keyLinks: KeyLink[];
  settings: Settings | null;
}

// UI state helpers
export interface KeyWithValues {
  key: EnvKey;
  values: Record<number, KeyValue>; // environmentId -> KeyValue
  links: KeyLink[];
  hasValidationError: boolean;
}

export interface NamespaceWithProjects {
  namespace: Namespace;
  environments: Environment[];
  projects: Project[];
}
