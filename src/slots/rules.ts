export const symbols = [
  { name: 'Frost Chip', glyph: '⬡', stops: 16, triple: 4 },
  { name: 'Snowflake', glyph: '❄', stops: 8, triple: 13 },
  { name: 'Icicle', glyph: '▼', stops: 4, triple: 30 },
  { name: 'Ice Crystal', glyph: '◆', stops: 3, triple: 50 },
  { name: 'Frozen Crown', glyph: '♛', stops: 1, triple: 100 },
] as const;

export const minimumOpening = 5;
export const maximumWager = 5;
const maximumMultiplier = 100;
const stopCount = symbols.reduce((total, symbol) => total + symbol.stops, 0);

type SymbolIndex = 0 | 1 | 2 | 3 | 4;
type Reels = readonly [SymbolIndex, SymbolIndex, SymbolIndex];
type Spin = { reels: Reels; wager: number };
type Session = { startingGold: number; balance: number; lastSpin: Spin | null };
export type SlotSession = Session & (
  { phase: 'ready' | 'finished' } |
  { phase: 'spinning'; pending: Spin; cashOut: boolean }
);

export function symbolAtStop(stop: number): SymbolIndex {
  let index = 0;
  while (stop >= symbols[index].stops) {
    stop -= symbols[index].stops;
    index++;
  }
  return index as SymbolIndex;
}

export function multiplier([left, center, right]: Reels): number {
  if (left === center && center === right) return symbols[left].triple;
  return left === 0 && center === 0 ? 1 : 0;
}

export function drawReels(random = Math.random): Reels {
  const draw = () => symbolAtStop(Math.floor(random() * stopCount));
  return [draw(), draw(), draw()];
}

export function openSession(startingGold: number): SlotSession | null {
  if (!Number.isSafeInteger(startingGold) || startingGold < minimumOpening) return null;
  return { phase: 'ready', startingGold, balance: startingGold, lastSpin: null };
}

export function affordableWagers(balance: number): number {
  // Leave room to credit the largest possible payout without losing integer precision.
  const headroom = Math.floor((Number.MAX_SAFE_INTEGER - balance) / (maximumMultiplier - 1));
  return Math.min(balance, maximumWager, headroom);
}

export function beginSpin(session: SlotSession, wager: number, random = Math.random): SlotSession {
  if (session.phase !== 'ready' || !Number.isInteger(wager) || wager < 1 ||
      wager > affordableWagers(session.balance)) return session;
  return {
    ...session, phase: 'spinning', balance: session.balance - wager,
    pending: { reels: drawReels(random), wager }, cashOut: false,
  };
}

export function requestCashOut(session: SlotSession): SlotSession {
  if (session.phase === 'finished') return session;
  if (session.phase === 'spinning') return session.cashOut ? session : { ...session, cashOut: true };
  return { ...session, phase: 'finished' };
}

export function settleSpin(session: SlotSession): SlotSession {
  if (session.phase !== 'spinning') return session;
  const { startingGold, balance, pending, cashOut } = session;
  const finalBalance = balance + pending.wager * multiplier(pending.reels);
  return {
    phase: cashOut || finalBalance === 0 ? 'finished' : 'ready',
    balance: finalBalance, startingGold, lastSpin: pending,
  };
}

export function signedGold(amount: number): string {
  return `${amount > 0 ? '+' : amount < 0 ? '−' : ''}${Math.abs(amount)} gp`;
}

export function settlementReport(session: SlotSession): string {
  return [
    'Casino Coolio — Slot Machine',
    `Starting gold: ${session.startingGold} gp`,
    `Final gold: ${session.balance} gp`,
    `Net: ${signedGold(session.balance - session.startingGold)}`,
  ].join('\n');
}
