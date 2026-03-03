import type { QueryResult } from '../types';

export interface DbClient {
  execute(sql: string, params?: unknown[]): Promise<QueryResult>;
  select<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  transaction<T>(fn: (db: DbClient) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
