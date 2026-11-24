import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

export function roomsDatabase() {
  const database = new DatabaseSync(':memory:');
  database.exec(readFileSync(new URL('../../drizzle/0000_rooms.sql', import.meta.url), 'utf8'));
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
