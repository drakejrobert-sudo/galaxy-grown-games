export const themes = { armorer: 'Armorer', wizard: 'Wizard shop', weapons: 'Weapons dealer' } as const;
export type Theme = keyof typeof themes;
export interface StockItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  quantity: number;
}
export interface Inventory {
  version: 1;
  name: string;
  theme: Theme;
  items: StockItem[];
}
export interface ShopSummary { id: string; name: string }
export interface SavedShop { id: string; revision: number; inventory: Inventory }
export const maxShopBytes = 256_000;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a JSON object.');
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new Error(label + ' must contain 1–' + max + ' characters.');
  }
  return value.trim();
}

export function readInventory(input: unknown): Inventory {
  const shop = record(input);
  if (shop.version !== 1) throw new Error('Use shop file version 1.');
  const name = text(shop.name, 'Shop name', 80);
  if (typeof shop.theme !== 'string' || !Object.hasOwn(themes, shop.theme)) throw new Error('Choose a supported shop theme.');
  if (!Array.isArray(shop.items) || shop.items.length > 100) throw new Error('Provide a list of up to 100 items.');
  const ids = new Set<string>();
  const items = shop.items.map((entry, index) => {
    const item = record(entry);
    const label = 'Item ' + (index + 1);
    const id = text(item.id, label + ' ID', 80);
    if (ids.has(id)) throw new Error(label + ' repeats an item ID.');
    ids.add(id);
    const name = text(item.name, label + ' name', 100);
    const currency = text(item.currency, name + ' currency', 24);
    const { price, quantity } = item;
    if (typeof price !== 'number' || !Number.isFinite(price) || price < 0 || price > Number.MAX_SAFE_INTEGER) {
      throw new Error(name + ' needs a nonnegative price.');
    }
    if (typeof quantity !== 'number' || !Number.isSafeInteger(quantity) || quantity < 0) {
      throw new Error(name + ' needs a nonnegative whole-number quantity.');
    }
    const description = item.description === undefined || item.description === '' ? undefined
      : text(item.description, name + ' description', 400);
    return { id, name, description, price, currency, quantity };
  });
  return { version: 1, name, theme: shop.theme as Theme, items };
}
