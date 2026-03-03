import BetterSqlite3 from 'better-sqlite3';
import type { DbClient } from '../../src/db/client';
import type { QueryResult } from '../../src/types';
import { SCHEMA_SQL } from '../../src/db/schema';

export class TestDbClient implements DbClient {
  private db: BetterSqlite3.Database;

  constructor(path = ':memory:') {
    this.db = new BetterSqlite3(path);
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('journal_mode = WAL');
    this.db.exec(SCHEMA_SQL);
  }

  async execute(sql: string, params: unknown[] = []): Promise<QueryResult> {
    const result = this.db.prepare(sql).run(params);
    return {
      rowsAffected: result.changes,
      lastInsertId: Number(result.lastInsertRowid),
    };
  }

  async select<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.db.prepare(sql).all(params) as T[];
  }

  async transaction<T>(fn: (db: DbClient) => Promise<T>): Promise<T> {
    this.db.exec('BEGIN TRANSACTION');
    try {
      const result = await fn(this);
      this.db.exec('COMMIT');
      return result;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

export function createTestDb(): TestDbClient {
  return new TestDbClient();
}
