import type { RoomEnvironment } from '../rooms/api';
import type { Inventory, StockItem } from './inventory';

function stock(id: string, name: string, price: number, quantity: number): StockItem {
  return { id, name, price, quantity, currency: 'gp' };
}

const demos: Inventory[] = [
  { version: 1, theme: 'armorer', name: 'Lantern Dock Armory', items: [
    stock('shield', 'Shield', 10, 4), stock('leather', 'Leather armor', 10, 3),
    stock('studded', 'Studded leather armor', 45, 2), stock('chain', 'Chain mail', 75, 1),
  ] },
  { version: 1, theme: 'wizard', name: 'The Violet Orbit', items: [
    stock('sand', 'Pouch of fine sand', 1, 4), stock('crystal', 'Crystal arcane focus', 10, 3),
    stock('components', 'Component pouch', 25, 2), stock('spellbook', 'Blank spellbook', 50, 1),
  ] },
  { version: 1, theme: 'weapons', name: 'Comet’s Edge', items: [
    stock('dagger', 'Dagger', 2, 6), stock('spear', 'Spear', 1, 4),
    stock('shortsword', 'Shortsword', 10, 3), stock('longbow', 'Longbow', 50, 2),
  ] },
];

export async function loadDemoShops(db: NonNullable<RoomEnvironment['DB']>, owner: string) {
  const rows = demos.flatMap(shop => [crypto.randomUUID(), owner, shop.theme, JSON.stringify(shop)]);
  const result = await db.prepare(`
    INSERT INTO shops(id, owner_id, demo_key, inventory) VALUES (?,?,?,?), (?,?,?,?), (?,?,?,?)
    ON CONFLICT(owner_id, demo_key) DO NOTHING RETURNING id
  `).bind(...rows).all();
  return result.results.length;
}
