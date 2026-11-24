import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import type { CampaignEnvironment } from '../../src/campaigns/api.ts';
export function campaignEnvironment() {
  const database = new DatabaseSync(':memory:');
  database.exec('PRAGMA foreign_keys=ON');
  database.exec(readFileSync(new URL('../../drizzle/0002_campaign_saves.sql', import.meta.url), 'utf8'));
  function prepare(sql: string) {
    const statement = database.prepare(sql); let params: SQLInputValue[] = [];
    const query = {
      bind(...values: SQLInputValue[]) { params = values; return query; },
      async first<T>() { return (statement.get(...params) as T | undefined) ?? null; },
      async all<T>() { return { results: statement.all(...params) as T[] }; },
      execute() { return { results: statement.all(...params) }; },
    };
    return query;
  }
  const objects = new Map<string, Uint8Array>();
  const env: Required<CampaignEnvironment> = {
    DB: { prepare, async batch(statements) {
      database.exec('BEGIN');
      try { const result = statements.map(s => (s as ReturnType<typeof prepare>).execute()); database.exec('COMMIT'); return result; }
      catch (e) { database.exec('ROLLBACK'); throw e; }
    } },
    BUCKET: {
      async put(key, value) { objects.set(key, value.slice()); },
      async get(key) { const bytes = objects.get(key); return bytes ? { async arrayBuffer() { return bytes.slice().buffer; } } : null; },
      async delete(key) { objects.delete(key); },
    },
  };
  return { database, env, objects };
}
