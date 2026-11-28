import { affordableWagers, maximumWager, minimumOpening, type SlotSession, symbols } from './rules';

import { roomIdPattern } from '../rooms/types';

export const sessionKey = 'galaxy-grown-casino-coolio';
type SessionStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function spin(value: unknown): boolean {
  return record(value) && typeof value.wager === 'number' &&
    Number.isInteger(value.wager) && value.wager >= 1 && value.wager <= maximumWager &&
    Array.isArray(value.reels) && value.reels.length === 3 &&
    value.reels.every(symbol => Number.isInteger(symbol) && symbol >= 0 && symbol < symbols.length);
}

function validDelivery(value: unknown): boolean {
  return value === undefined || (record(value) &&
    [value.roomId, value.seatId, value.sessionId].every(id => typeof id === 'string' && roomIdPattern.test(id)) &&
    (value.sent === undefined || typeof value.sent === 'boolean'));
}

function validSession(value: unknown): value is SlotSession {
  if (!record(value) || typeof value.startingGold !== 'number' || typeof value.balance !== 'number' ||
      !Number.isSafeInteger(value.startingGold) || value.startingGold < minimumOpening ||
      !Number.isSafeInteger(value.balance) || value.balance < 0 ||
      (value.lastSpin !== null && !spin(value.lastSpin)) || !validDelivery(value.delivery)) return false;
  if (value.phase === 'ready') return value.balance > 0;
  if (value.phase === 'finished') return true;
  if (value.phase !== 'spinning' || typeof value.cashOut !== 'boolean' ||
      !record(value.pending) || !spin(value.pending)) return false;
  const wager = value.pending.wager as number;
  return wager <= affordableWagers(value.balance + wager);
}

export function readSession(storage: SessionStorage): SlotSession | null {
  const raw = storage.getItem(sessionKey);
  if (raw === null) return null;
  const saved: unknown = JSON.parse(raw);
  if (!record(saved) || saved.version !== 1 || !validSession(saved.session)) {
    throw new Error('Invalid Casino Coolio session');
  }
  return saved.session;
}

export function writeSession(storage: SessionStorage, session: SlotSession | null): void {
  if (session) storage.setItem(sessionKey, JSON.stringify({ version: 1, session }));
  else storage.removeItem(sessionKey);
}
