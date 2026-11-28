import { surfaceNavigation } from '../site-navigation';
import '../style.css';
import './blackjack.css';
import {
  affordableWager, cardRank, cardSuit, deal, handValue, hit, minimumOpening, openSession,
  requestCashOut, settlementReport, stand, type Outcome, type Session,
} from './rules';
import { readSession, writeSession } from './session';

document.title = 'Casino Corrupt · Blackjack · Galaxy Grown';
document.querySelector('#app')!.innerHTML = `
<header><a href="./" class="brand">✦ <span>GALAXY GROWN</span></a></header>
${surfaceNavigation('Casino Corrupt')}
<main class="blackjack">
  <h1>Casino Corrupt Blackjack</h1>
  <section class="blackjack-table" aria-label="Blackjack table">
    <div class="blackjack-scene" aria-hidden="true">
      <img src="${import.meta.env.BASE_URL}art/casino-corrupt-dealer.webp" width="1280" height="720" alt="" decoding="async">
    </div>
    <div class="blackjack-felt">
      <form id="bj-opening" hidden novalidate>
        <label for="bj-gold">Opening balance (gp)</label>
        <input id="bj-gold" inputmode="numeric" autocomplete="off" aria-describedby="bj-minimum bj-input-error">
        <p id="bj-minimum">At least ${minimumOpening} gp in campaign gold.</p>
        <p id="bj-input-error" class="error" role="alert"></p>
        <button type="submit">Start session</button>
      </form>

      <div id="bj-hands" hidden>
        <section>
          <h2>Dealer <span id="bj-dealer-total"></span></h2>
          <ul class="blackjack-cards" id="bj-dealer" aria-label="Dealer cards"></ul>
        </section>
        <section>
          <h2>Your hand <span id="bj-player-total"></span></h2>
          <ul class="blackjack-cards" id="bj-player" aria-label="Your cards"></ul>
        </section>
      </div>
      <p id="bj-status" class="blackjack-status" role="status"></p>

      <div id="bj-playing" hidden>
        <div class="blackjack-bankroll">
          <p id="bj-balance"></p>
          <p id="bj-stake" hidden></p>
        </div>
        <form id="bj-wager-form" class="blackjack-controls" hidden novalidate>
          <div>
            <label for="bj-wager">Wager (gp)</label>
            <input id="bj-wager" inputmode="numeric" autocomplete="off" value="1" aria-describedby="bj-wager-error">
          </div>
          <button type="submit">Deal</button>
        </form>
        <p id="bj-wager-error" class="error" role="alert"></p>
        <div class="blackjack-controls">
          <button id="bj-hit" type="button" hidden>Hit</button>
          <button id="bj-stand" type="button" hidden>Stand</button>
          <button id="bj-cash" type="button" aria-describedby="bj-cash-help">Cash out</button>
        </div>
        <p id="bj-cash-help" hidden>Cashing out stands on this hand and settles the wager.</p>
      </div>

      <section id="bj-settlement" aria-labelledby="bj-settlement-title" hidden>
        <h2 id="bj-settlement-title" tabindex="-1">GM settlement</h2>
        <dl class="blackjack-totals">
          <div><dt>Starting gold</dt><dd id="bj-start"></dd></div>
          <div><dt>Final gold</dt><dd id="bj-final"></dd></div>
          <div><dt>Net</dt><dd id="bj-net"></dd></div>
        </dl>
        <div class="blackjack-controls">
          <button id="bj-copy" type="button">Copy report</button>
          <button id="bj-new" type="button">New session</button>
        </div>
        <p id="bj-copy-status" role="status"></p>
        <label for="bj-report" id="bj-report-label" hidden>Settlement report</label>
        <textarea id="bj-report" rows="4" readonly hidden></textarea>
      </section>

      <div id="bj-save-error" hidden>
        <p id="bj-save-message" role="alert"></p>
        <button id="bj-retry" type="button">Retry</button>
        <button id="bj-clear" type="button" hidden>Discard unreadable session</button>
      </div>
    </div>
  </section>
  <p class="blackjack-help">Get closer to 21 than the dealer. Going over 21 loses the wager. A win pays 1:1,
    an opening blackjack pays 3:2, and a tie returns your wager.</p>
</main>`;

function element<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(`bj-${id}`) as T;
}

const opening = element<HTMLFormElement>('opening');
const gold = element<HTMLInputElement>('gold');
const wagerForm = element<HTMLFormElement>('wager-form');
const wager = element<HTMLInputElement>('wager');
const dealerCards = element('dealer');
const playerCards = element('player');
const hitButton = element<HTMLButtonElement>('hit');
const standButton = element<HTMLButtonElement>('stand');
const cashButton = element<HTMLButtonElement>('cash');
const report = element<HTMLTextAreaElement>('report');
const retryButton = element<HTMLButtonElement>('retry');
const clearButton = element<HTMLButtonElement>('clear');

let session: Session | null = null;
let retry: (() => void) | null = null;
let unreadable = false;
const outcomeMessage: Record<Outcome, string> = {
  blackjack: 'Blackjack! You win.', win: 'You win.', push: 'Push. Your wager was returned.',
  loss: 'Dealer wins.', bust: 'You busted. Dealer wins.',
};
const suitNames = { '♠': 'spades', '♥': 'hearts', '♣': 'clubs', '♦': 'diamonds' };

function renderCards(list: HTMLElement, cards: number[], hideLast = false) {
  list.replaceChildren(...cards.map((card, index) => {
    const item = document.createElement('li');
    if (hideLast && index === 1) {
      item.className = 'face-down';
      item.textContent = '?';
      item.setAttribute('aria-label', 'Face-down card');
      return item;
    }
    const rank = cardRank(card);
    const suit = cardSuit(card);
    const rankLabel = document.createElement('span');
    rankLabel.textContent = rank;
    const suitLabel = document.createElement('span');
    suitLabel.textContent = suit;
    item.append(rankLabel, suitLabel);
    item.setAttribute('aria-label', `${rank} of ${suitNames[suit]}`);
    item.classList.toggle('red-suit', suit === '♥' || suit === '♦');
    return item;
  }));
}

function render() {
  const current = session;
  const playing = current?.phase === 'playing';
  const ready = current?.phase === 'ready';
  const finished = current?.phase === 'finished';
  const currentHand = playing ? current.hand : current?.round;
  const available = ready ? affordableWager(current.balance) : 0;
  opening.hidden = current !== null || unreadable;
  element('playing').hidden = !playing && !ready;
  element('settlement').hidden = !finished;
  element('hands').hidden = !currentHand;
  element('save-error').hidden = retry === null;
  clearButton.hidden = !unreadable;
  wagerForm.hidden = !ready || available < 1;
  hitButton.hidden = standButton.hidden = !playing;
  element('cash-help').hidden = !playing;

  document.querySelectorAll<HTMLButtonElement | HTMLInputElement>(
    '#bj-opening input, #bj-opening button, #bj-playing input, #bj-playing button, #bj-new',
  ).forEach(control => { control.disabled = retry !== null; });

  if (ready && Number(wager.value) > available) wager.value = '1';
  if (current) element('balance').textContent = `Current balance: ${current.balance / 2} gp`;
  element('stake').hidden = !playing;
  element('stake').textContent = playing ? `In play: ${current.hand.wager} gp` : '';
  if (currentHand) {
    renderCards(dealerCards, currentHand.dealer, playing);
    renderCards(playerCards, currentHand.player);
    element('dealer-total').textContent = playing ? '' : String(handValue(currentHand.dealer).total);
    element('player-total').textContent = String(handValue(currentHand.player).total);
  }
  const status = element('status');
  const message = playing ? `Your total is ${handValue(current.hand.player).total}. Hit or stand.` :
    current?.round ? outcomeMessage[current.round.outcome] : '';
  const statusText = ready && available < 1 ? `${message} Cash out to settle your balance.`.trim() : message;
  if (status.textContent !== statusText) status.textContent = statusText;

  if (finished) {
    const net = current.balance / 2 - current.startingGold;
    element('start').textContent = `${current.startingGold} gp`;
    element('final').textContent = `${current.balance / 2} gp`;
    element('net').textContent = `${net > 0 ? '+' : net < 0 ? '−' : ''}${Math.abs(net)} gp`;
    report.value = settlementReport(current);
  }
}

function saveFailed(action: () => void, message: string) {
  retry = action;
  element('save-message').textContent = message;
  render();
  retryButton.focus();
}

function focusCurrent() {
  if (!session) gold.focus();
  else if (session.phase === 'playing') hitButton.focus();
  else if (session.phase === 'finished') element('settlement-title').focus();
  else if (wagerForm.hidden) cashButton.focus();
  else wager.focus();
}

function commit(next: Session | null) {
  const focusChanged = retry !== null || session?.phase !== next?.phase || session === null || next === null;
  try {
    writeSession(window.sessionStorage, next);
  } catch {
    saveFailed(() => commit(next), 'The action could not be saved. Retry to continue from your last saved balance.');
    return;
  }
  retry = null;
  unreadable = false;
  session = next;
  if (next === null) {
    opening.reset();
    wagerForm.reset();
    setError(gold, 'input-error', '');
    setError(wager, 'wager-error', '');
    report.hidden = element('report-label').hidden = true;
    element('copy-status').textContent = '';
  }
  render();
  if (focusChanged) focusCurrent();
}

function restore() {
  try {
    session = readSession(window.sessionStorage);
  } catch {
    unreadable = true;
    saveFailed(restore, 'The saved blackjack session could not be loaded.');
    return;
  }
  const wasRetrying = retry !== null;
  retry = null;
  unreadable = false;
  render();
  if (wasRetrying) focusCurrent();
}

function parseGold(input: HTMLInputElement) {
  const value = input.value.trim();
  return /^\d+$/.test(value) ? Number(value) : NaN;
}

function setError(input: HTMLInputElement, id: string, message: string) {
  input.setAttribute('aria-invalid', String(Boolean(message)));
  element(id).textContent = message;
  if (message) input.focus();
}

opening.addEventListener('submit', event => {
  event.preventDefault();
  if (session || retry) return;
  const next = openSession(parseGold(gold));
  setError(gold, 'input-error', next ? '' : `Enter a whole number of gp, at least ${minimumOpening}, within the supported balance range.`);
  if (next) commit(next);
});
wagerForm.addEventListener('submit', event => {
  event.preventDefault();
  if (session?.phase !== 'ready' || retry) return;
  const next = deal(session, parseGold(wager));
  setError(wager, 'wager-error', next === session ? `Enter a whole-gp wager from 1 to ${affordableWager(session.balance)}.` : '');
  if (next !== session) commit(next);
});
hitButton.addEventListener('click', () => {
  if (session?.phase === 'playing' && !retry) commit(hit(session));
});
standButton.addEventListener('click', () => {
  if (session?.phase === 'playing' && !retry) commit(stand(session));
});
cashButton.addEventListener('click', () => {
  if (session && session.phase !== 'finished' && !retry) commit(requestCashOut(session));
});
retryButton.addEventListener('click', () => retry?.());
clearButton.addEventListener('click', () => { if (unreadable) commit(null); });
element('new').addEventListener('click', () => { if (session?.phase === 'finished' && !retry) commit(null); });
element('copy').addEventListener('click', async () => {
  const status = element('copy-status');
  try {
    await navigator.clipboard.writeText(report.value);
    status.textContent = 'Copied. Share it with your GM.';
  } catch {
    report.hidden = element('report-label').hidden = false;
    report.focus();
    report.select();
    status.textContent = 'Report selected. Copy it manually or take a screenshot.';
  }
});

restore();
