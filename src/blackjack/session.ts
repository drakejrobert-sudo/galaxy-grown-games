import { affordableWager, handValue, openSession, ranks, roundOutcome, suits, type Session } from './rules';

export const sessionKey = 'galaxy-grown-casino-corrupt-blackjack';
type TabStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const deckSize = ranks.length * suits.length;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function cards(value: unknown): value is number[] {
  return Array.isArray(value) && value.length >= 2 &&
    value.every(card => Number.isInteger(card) && card >= 0 && card < deckSize);
}

function validSession(value: unknown): value is Session {
  if (!record(value) || typeof value.startingGold !== 'number' || !openSession(value.startingGold) ||
      typeof value.balance !== 'number' || !Number.isSafeInteger(value.balance) || value.balance < 0) return false;

  const playing = value.phase === 'playing';
  if (!playing && value.phase !== 'ready' && value.phase !== 'finished') return false;
  if (value.phase === 'ready' && value.balance < 2) return false;
  const hand = playing ? value.hand : value.round;
  if (hand === null) return !playing;
  if (!record(hand) || typeof hand.wager !== 'number' || !Number.isSafeInteger(hand.wager) || hand.wager < 1 ||
      !cards(hand.player) || !cards(hand.dealer)) return false;
  const dealt = [...hand.player, ...hand.dealer];
  if (new Set(dealt).size !== dealt.length) return false;
  if (!playing) return hand.outcome === roundOutcome(hand.player, hand.dealer);

  const { deck, player, dealer, wager } = hand;
  if (!cards(deck) || deck.length !== deckSize || new Set(deck).size !== deckSize ||
      dealer.length !== 2 || handValue(dealer).natural || handValue(player).total >= 21 ||
      wager > affordableWager(value.balance + wager * 2)) return false;

  return [player[0], dealer[0], player[1], dealer[1], ...player.slice(2)]
    .every((card, index) => card === deck[index]);
}

export function readSession(storage: TabStorage): Session | null {
  const raw = storage.getItem(sessionKey);
  if (raw === null) return null;
  const saved: unknown = JSON.parse(raw);
  if (!record(saved) || saved.version !== 1 || !validSession(saved.session)) {
    throw new Error('Invalid blackjack session');
  }
  return saved.session;
}

export function writeSession(storage: TabStorage, session: Session | null): void {
  if (session === null) storage.removeItem(sessionKey);
  else storage.setItem(sessionKey, JSON.stringify({ version: 1, session }));
}
