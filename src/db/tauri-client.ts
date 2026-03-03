import Database from '@tauri-apps/plugin-sql';
import type { DbClient } from './client';
import type { QueryResult } from '../types';
import { SCHEMA_STATEMENTS, MIGRATIONS } from './schema';

export class TauriDbClient implements DbClient {
  private db: Database;

  private constructor(db: Database) {
    this.db = db;
  }

  static async open(path = 'sqlite:aws-env-manager.db'): Promise<TauriDbClient> {
    const db = await Database.load(path);
    const client = new TauriDbClient(db);
    await client.migrate();
    return client;
  }

  private async migrate(): Promise<void> {
    await this.execute('PRAGMA foreign_keys = ON');
    for (const sql of SCHEMA_STATEMENTS) {
      await this.execute(sql);
    }
    // Run ALTER TABLE migrations (ignore "duplicate column" errors for already-migrated DBs)
    for (const sql of MIGRATIONS) {
      try {
        await this.execute(sql);
      } catch (e) {
        const msg = String(e).toLowerCase();
        if (!msg.includes('duplicate column') && !msg.includes('already exists')) {
          throw e;
        }
      }
    }
  }

  async execute(sql: string, params: unknown[] = []): Promise<QueryResult> {
    const result = await this.db.execute(sql, params);
    return {
      rowsAffected: result.rowsAffected,
      lastInsertId: Number(result.lastInsertId),
    };
  }

  async select<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.db.select<T[]>(sql, params);
  }

  async transaction<T>(fn: (db: DbClient) => Promise<T>): Promise<T> {
    // ⚠️ NOT ATOMIC: tauri-plugin-sql uses a sqlx connection pool — each
    // execute() may run on a different connection, so BEGIN/COMMIT across
    // IPC calls is unreliable. Individual statements are still atomic
    // (SQLite guarantee), but a crash between statements can leave data
    // partially written. True multi-statement atomicity requires a
    // dedicated Rust-side Tauri command.
    return fn(this);
  }

  async close(): Promise<void> {
    await this.db.close();
  }
}
