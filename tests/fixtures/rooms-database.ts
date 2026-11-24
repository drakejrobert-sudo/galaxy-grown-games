import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

export function applyDashboardMigration(database: DatabaseSync) {
  database.exec(readFileSync(new URL('../../drizzle/0001_station_dashboard.sql', import.meta.url), 'utf8'));
}

export function roomsDatabase(includeDashboard = true) {
  const database = new DatabaseSync(':memory:');
  database.exec(readFileSync(new URL('../../drizzle/0000_rooms.sql', import.meta.url), 'utf8'));
  if (includeDashboard) applyDashboardMigration(database);
  return {
    database,
    binding: {
      prepare(sql: string) {
        const statement = database.prepare(sql);
        let params: SQLInputValue[] = [];
        const query = {
          bind(...values: SQLInputValue[]) {
            params = values;
            return query;
          },
          async first<T>() { return (statement.get(...params) as T | undefined) ?? null; },
          async all<T>() { return { results: statement.all(...params) as T[] }; },
        };
        return query;
      },
    },
  };
}
