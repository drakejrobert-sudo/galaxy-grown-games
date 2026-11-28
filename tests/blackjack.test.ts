import assert from 'node:assert/strict';
import test from 'node:test';
import {
  affordableWager, deal, dealerShouldHit, handValue, hit, openSession, requestCashOut,
  settlementReport, shuffleDeck, stand, type Session,
} from '../src/blackjack/rules';
import { readSession, sessionKey, writeSession } from '../src/blackjack/session';

const opening = () => openSession(10)!;

function stackedDeck(...prefix: number[]) {
  return [...prefix, ...Array.from({ length: 52 }, (_, index) => index).filter(index => !prefix.includes(index))];
}

function expectRound(session: Session, outcome: string, finalGold: number, phase = 'ready') {
  assert.notEqual(session.phase, 'playing');
  if (session.phase === 'playing') throw new Error('Expected a settled round');
  assert.equal(session.phase, phase);
  assert.equal(session.round?.outcome, outcome);
  assert.equal(session.balance, finalGold * 2);
}

test('requires at least 10 whole gp and accepts only affordable whole-gp wagers', () => {
  for (const gold of [NaN, Infinity, -1, 9, 9.9, 10.5, Number.MAX_SAFE_INTEGER]) {
    assert.equal(openSession(gold), null);
  }
  const session = opening();
  assert.equal(affordableWager(session.balance), 10);
  for (const wager of [0, -1, 0.5, 1.1, 11, NaN, Infinity]) {
    assert.equal(deal(session, wager), session);
  }
  const allIn = deal(session, 10, stackedDeck(9, 8, 5, 20));
  assert.equal(allIn.phase, 'playing');
  assert.equal(allIn.balance, 0);
  assert.equal(deal(allIn, 1), allIn);
  assert.equal(new Set(shuffleDeck(() => 0.25)).size, 52);
});

test('aces make soft totals only while they fit, and dealer hits only soft 17', () => {
  assert.deepEqual(handValue([0, 13, 8]), { total: 21, soft: true, natural: false });
  assert.deepEqual(handValue([0, 5, 9]), { total: 17, soft: false, natural: false });
  assert.equal(dealerShouldHit([0, 5]), true);
  assert.equal(dealerShouldHit([0, 5], false), false);
  assert.equal(dealerShouldHit([0, 5, 9]), false);
  assert.equal(dealerShouldHit([0, 6]), false);
  const round = deal(opening(), 2, stackedDeck(9, 0, 6, 5, 3));
  expectRound(stand(round), 'loss', 8);
  expectRound(stand(round, false), 'push', 10);
});

test('naturals settle on the deal, with exact 3:2 winnings and a push when both have blackjack', () => {
  expectRound(deal(opening(), 1, stackedDeck(0, 8, 9, 7)), 'blackjack', 11.5);
  expectRound(deal(opening(), 2, stackedDeck(0, 13, 9, 22)), 'push', 10);
  expectRound(deal(opening(), 2, stackedDeck(9, 0, 14, 22)), 'loss', 8);
});

test('hit, stand, dealer bust, and ordinary 21 settle once at the correct payout', () => {
  const round = deal(opening(), 2, stackedDeck(9, 8, 5, 6, 4, 21));
  const settled = hit(round);
  expectRound(settled, 'win', 12);
  assert.equal(hit(settled), settled);
  assert.equal(stand(settled), settled);
  expectRound(stand(deal(opening(), 2, stackedDeck(9, 8, 5, 6, 21))), 'win', 12);
  const drawn21 = hit(deal(opening(), 1, stackedDeck(9, 22, 7, 20, 2)));
  expectRound(drawn21, 'win', 11);
});

test('cash-out stands on an active hand and reports zero, half gold, and unplayed balances', () => {
  const allIn = deal(opening(), 10, stackedDeck(9, 8, 5, 20, 22));
  const finished = requestCashOut(allIn);
  expectRound(finished, 'loss', 0, 'finished');
  assert.equal(requestCashOut(finished), finished);
  assert.match(settlementReport(finished), /Starting gold: 10 gp\nFinal gold: 0 gp\nNet: −10 gp/);
  const busted = hit(deal(opening(), 10, stackedDeck(9, 8, 7, 6, 22)));
  expectRound(busted, 'bust', 0, 'finished');
  const halfGold = deal(opening(), 1, stackedDeck(0, 8, 9, 7));
  const lastHand = stand(deal(halfGold, 11, stackedDeck(9, 22, 5, 20)));
  expectRound(lastHand, 'loss', 0.5, 'finished');
  assert.match(settlementReport(lastHand), /Final gold: 0\.5 gp\nNet: −9\.5 gp/);
  assert.match(settlementReport(requestCashOut(halfGold)), /Net: \+1\.5 gp/);
  assert.match(settlementReport(requestCashOut(opening())), /Net: 0 gp/);
});

test('restoring an active hand preserves the drawn cards and wager, then restores its settled report', () => {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); },
    removeItem: (key: string) => { data.delete(key); },
  };
  const round = hit(deal(opening(), 5, stackedDeck(2, 22, 4, 20, 3, 8)));
  assert.equal(round.phase, 'playing');
  writeSession(storage, round);
  assert.deepEqual(readSession(storage), round);

  const settled = requestCashOut(readSession(storage)!);
  expectRound(settled, 'loss', 5, 'finished');
  writeSession(storage, settled);
  assert.deepEqual(readSession(storage), settled);
  writeSession(storage, null);
  assert.equal(readSession(storage), null);
  storage.setItem(sessionKey, JSON.stringify({ version: 1, session: { ...round, hand: {} } }));
  assert.throws(() => readSession(storage), /Invalid blackjack session/);
});
