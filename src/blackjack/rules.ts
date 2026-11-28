export const minimumOpening = 10;
export const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;
export const suits = ['♠', '♥', '♣', '♦'] as const;
const deckSize = ranks.length * suits.length;

export function cardRank(card: number) {
  return ranks[card % ranks.length];
}

export function cardSuit(card: number) {
  return suits[Math.floor(card / ranks.length)];
}

export function shuffleDeck(random = Math.random): number[] {
  const deck = Array.from({ length: deckSize }, (_, card) => card);
  for (let index = deck.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [deck[index], deck[swap]] = [deck[swap], deck[index]];
  }
  return deck;
}

export function handValue(cards: readonly number[]) {
  let total = 0;
  let hasAce = false;
  for (const card of cards) {
    const rank = card % ranks.length + 1;
    total += Math.min(rank, 10);
    hasAce ||= rank === 1;
  }
  const soft = hasAce && total + 10 <= 21;
  if (soft) total += 10;
  return { total, soft, natural: cards.length === 2 && total === 21 };
}

export function dealerShouldHit(cards: readonly number[], hitSoft17 = true): boolean {
  const { total, soft } = handValue(cards);
  return total < 17 || (total === 17 && soft && hitSoft17);
}

export type Outcome = 'blackjack' | 'win' | 'push' | 'loss' | 'bust';
type Hand = { player: number[]; dealer: number[]; wager: number };
export type Round = Hand & { outcome: Outcome };
export type PendingHand = Hand & { deck: number[] };
export type Session = { startingGold: number; balance: number } & (
  { phase: 'ready' | 'finished'; round: Round | null } |
  { phase: 'playing'; hand: PendingHand }
);

export function openSession(startingGold: number): Session | null {
  const balance = startingGold * 2;
  if (!Number.isInteger(startingGold) || startingGold < minimumOpening || !Number.isSafeInteger(balance)) return null;
  return { phase: 'ready', startingGold, balance, round: null };
}

// Balances use half-gp units. Keep enough headroom for a natural blackjack payout.
export function affordableWager(balance: number): number {
  return Math.min(Math.floor(balance / 2), Math.floor((Number.MAX_SAFE_INTEGER - balance) / 3));
}

export function roundOutcome(player: readonly number[], dealer: readonly number[]): Outcome {
  const p = handValue(player);
  const d = handValue(dealer);
  if (p.total > 21) return 'bust';
  if (p.natural && !d.natural) return 'blackjack';
  if (d.natural && !p.natural) return 'loss';
  if (p.total === d.total) return 'push';
  return d.total > 21 || p.total > d.total ? 'win' : 'loss';
}

const returns: Record<Outcome, number> = { blackjack: 5, win: 4, push: 2, loss: 0, bust: 0 };

function finishHand(session: Session & { phase: 'playing' }, dealer: number[], cashOut: boolean): Session {
  const { startingGold, hand: { player, wager } } = session;
  const outcome = roundOutcome(player, dealer);
  const balance = session.balance + wager * returns[outcome];
  return {
    startingGold, balance, phase: cashOut || balance < 2 ? 'finished' : 'ready',
    round: { player, dealer, wager, outcome },
  };
}

export function deal(session: Session, wager: number, deck = shuffleDeck()): Session {
  if (session.phase !== 'ready' || !Number.isInteger(wager) || wager < 1 ||
      wager > affordableWager(session.balance)) return session;

  const player = [deck[0], deck[2]];
  const dealer = [deck[1], deck[3]];
  const playing = {
    phase: 'playing' as const, startingGold: session.startingGold, balance: session.balance - wager * 2,
    hand: { player, dealer, wager, deck },
  };
  if (handValue(player).natural || handValue(dealer).natural) return finishHand(playing, dealer, false);
  return playing;
}

export function stand(session: Session, hitSoft17 = true, cashOut = false): Session {
  if (session.phase !== 'playing') return session;
  const { player, dealer, deck } = session.hand;
  const completedDealer = [...dealer];
  while (dealerShouldHit(completedDealer, hitSoft17)) {
    completedDealer.push(deck[player.length + completedDealer.length]);
  }
  return finishHand(session, completedDealer, cashOut);
}

export function hit(session: Session, hitSoft17 = true): Session {
  if (session.phase !== 'playing') return session;
  const { player, dealer, deck } = session.hand;
  const next = { ...session, hand: { ...session.hand, player: [...player, deck[player.length + dealer.length]] } };
  const { total } = handValue(next.hand.player);
  if (total > 21) return finishHand(next, dealer, false);
  return total === 21 ? stand(next, hitSoft17) : next;
}

export function requestCashOut(session: Session): Session {
  if (session.phase === 'playing') return stand(session, true, true);
  return session.phase === 'ready' ? { ...session, phase: 'finished' } : session;
}

export function settlementReport(session: Pick<Session, 'balance' | 'startingGold'>) {
  const finalGold = session.balance / 2;
  const net = finalGold - session.startingGold;
  return [
    'Casino Corrupt — Blackjack',
    `Starting gold: ${session.startingGold} gp`,
    `Final gold: ${finalGold} gp`,
    `Net: ${net > 0 ? '+' : net < 0 ? '−' : ''}${Math.abs(net)} gp`,
  ].join('\n');
}
