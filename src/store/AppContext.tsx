import { createContext, useContext, useReducer, type ReactNode } from 'react';
import type {
  Namespace, Environment, Project, EnvKey, KeyValue,
  KeyLink, Settings, ValidationError, DiffItem,
} from '../types';

export interface AppState {
  namespaces: Namespace[];
  selectedNamespaceId: number | null;
  environments: Environment[];
  projects: Project[];
  selectedProjectId: number | null;
  keys: EnvKey[];
  keyValues: KeyValue[];
  keyLinks: KeyLink[];
  settings: Settings | null;
  validationErrors: ValidationError[];
  pendingDiff: DiffItem[];
  isLoading: boolean;
  error: string | null;
}

type AppAction =
  | { type: 'SET_NAMESPACES'; namespaces: Namespace[] }
  | { type: 'SELECT_NAMESPACE'; id: number | null; environments: Environment[]; projects: Project[] }
  | { type: 'SELECT_PROJECT'; id: number | null; keys: EnvKey[]; keyValues: KeyValue[]; keyLinks: KeyLink[] }
  | { type: 'SET_KEYS'; keys: EnvKey[]; keyValues: KeyValue[]; keyLinks: KeyLink[] }
  | { type: 'SET_SETTINGS'; settings: Settings }
  | { type: 'SET_VALIDATION_ERRORS'; errors: ValidationError[] }
  | { type: 'SET_PENDING_DIFF'; diff: DiffItem[] }
  | { type: 'CLEAR_PENDING_DIFF' }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ERROR'; error: string | null };

const initialState: AppState = {
  namespaces: [],
  selectedNamespaceId: null,
  environments: [],
  projects: [],
  selectedProjectId: null,
  keys: [],
  keyValues: [],
  keyLinks: [],
  settings: null,
  validationErrors: [],
  pendingDiff: [],
  isLoading: false,
  error: null,
};

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_NAMESPACES':
      return { ...state, namespaces: action.namespaces };
    case 'SELECT_NAMESPACE':
      return {
        ...state,
        selectedNamespaceId: action.id,
        environments: action.environments,
        projects: action.projects,
        selectedProjectId: null,
        keys: [],
        keyValues: [],
        keyLinks: [],
      };
    case 'SELECT_PROJECT':
      return {
        ...state,
        selectedProjectId: action.id,
        keys: action.keys,
        keyValues: action.keyValues,
        keyLinks: action.keyLinks,
      };
    case 'SET_KEYS':
      return { ...state, keys: action.keys, keyValues: action.keyValues, keyLinks: action.keyLinks };
    case 'SET_SETTINGS':
      return { ...state, settings: action.settings };
    case 'SET_VALIDATION_ERRORS':
      return { ...state, validationErrors: action.errors };
    case 'SET_PENDING_DIFF':
      return { ...state, pendingDiff: action.diff };
    case 'CLEAR_PENDING_DIFF':
      return { ...state, pendingDiff: [] };
    case 'SET_LOADING':
      return { ...state, isLoading: action.loading };
    case 'SET_ERROR':
      return { ...state, error: action.error };
    default:
      return state;
  }
}

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  // Derived helpers
  selectedNamespace: Namespace | null;
  selectedProject: Project | null;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const selectedNamespace =
    state.namespaces.find((n) => n.id === state.selectedNamespaceId) ?? null;
  const selectedProject =
    state.projects.find((p) => p.id === state.selectedProjectId) ?? null;

  return (
    <AppContext.Provider value={{ state, dispatch, selectedNamespace, selectedProject }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppState(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used within AppProvider');
  return ctx;
}

export function useAppDispatch() {
  return useAppState().dispatch;
}

