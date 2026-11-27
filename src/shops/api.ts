import type { RoomEnvironment } from '../rooms/api';
import { roomIdPattern } from '../rooms/types';
import { readInventory } from './inventory';

type DB = NonNullable<RoomEnvironment['DB']>;
type Stored = { id: string; inventory: string; revision: number };

export async function shopAction(db: DB, dmId: string, roomId: string | undefined, shopId: string | undefined,
  method: string, body: Record<string, unknown> | null, now: number) {
  const response = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'private, no-store' } });
  if (roomId && method === 'PUT') {
    const id = body?.shopId;
    if (id !== null && (typeof id !== 'string' || !roomIdPattern.test(id))) return response({ error: 'Choose a saved shop.' }, 400);
    const changed = await db.prepare(`
      UPDATE rooms SET shop_id = ? WHERE id = ? AND owner_id = ? AND closed_at IS NULL AND expires_at > ?
      AND (? IS NULL OR EXISTS (SELECT 1 FROM shops WHERE id = ? AND owner_id = ?)) RETURNING id
    `).bind(id, roomId, dmId, now, id, id, dmId).first();
    return changed ? response(changed) : response({ error: 'Room or shop unavailable.' }, 404);
  }
  if (!shopId) return response({ error: 'Unknown shop action.' }, 404);
  if (method === 'GET') {
    const row = await db.prepare('SELECT id, inventory, revision FROM shops WHERE id = ? AND owner_id = ?')
      .bind(shopId, dmId).first<Stored>();
    return row ? response({ ...row, inventory: JSON.parse(row.inventory) }) : response({ error: 'Shop unavailable.' }, 404);
  }
  if (method !== 'PUT') return response({ error: 'Unknown shop action.' }, 404);
  let inventory;
  try { inventory = readInventory(body?.inventory); }
  catch (cause) { return response({ error: cause instanceof Error ? cause.message : 'Invalid inventory.' }, 400); }
  const revision = body?.revision;
  if (typeof revision !== 'number' || !Number.isSafeInteger(revision) || revision < 0) return response({ error: 'Invalid revision.' }, 400);
  const json = JSON.stringify(inventory);
  const result = revision === 0
    ? await db.prepare('INSERT INTO shops(id, owner_id, inventory) VALUES (?, ?, ?) ON CONFLICT DO NOTHING RETURNING revision')
      .bind(shopId, dmId, json).first<{ revision: number }>()
    : await db.prepare('UPDATE shops SET inventory = ?, revision = revision + 1 WHERE id = ? AND owner_id = ? AND revision = ? RETURNING revision')
      .bind(json, shopId, dmId, revision).first<{ revision: number }>();
  return result ? response({ id: shopId, revision: result.revision, inventory })
    : response({ error: 'The shop changed. Export your draft, then reopen the saved shop before editing.' }, 409);
}
