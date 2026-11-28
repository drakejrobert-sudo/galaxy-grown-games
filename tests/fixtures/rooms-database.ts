import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

export function applyDashboardMigration(database: DatabaseSync) {
  database.exec(readFileSync(new URL('../../drizzle/0001_station_dashboard.sql', import.meta.url), 'utf8'));
}

export function roomsDatabase(includeDashboard = true) {
  const database = new DatabaseSync(':memory:');
  database.exec(readFileSync(new URL('../../drizzle/0000_rooms.sql', import.meta.url), 'utf8'));
  if (includeDashboard) applyDashboardMigration(database);
  database.exec(readFileSync(new URL('../../drizzle/0003_room_route_proposals.sql', import.meta.url), 'utf8'));
  database.exec(readFileSync(new URL('../../drizzle/0004_room_map_artwork.sql', import.meta.url), 'utf8'));
  database.exec(readFileSync(new URL('../../drizzle/0005_room_shopfronts.sql', import.meta.url), 'utf8'));
  database.exec(readFileSync(new URL('../../drizzle/0006_demo_shops.sql', import.meta.url), 'utf8'));
  database.exec(readFileSync(new URL('../../drizzle/0007_casino_reports.sql', import.meta.url), 'utf8'));
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
