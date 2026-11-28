import { surfaceNavigation } from '../site-navigation';
import '../style.css';
import './slots.css';
import {
  affordableWagers, beginSpin, maximumWager, minimumOpening, multiplier, openSession,
  requestCashOut, settlementReport, settleSpin, signedGold, symbols, type SlotSession,
} from './rules';
import { readSession, writeSession } from './session';

document.title = 'Casino Coolio · Galaxy Grown';
document.querySelector('#app')!.innerHTML = `
<header><a href="./" class="brand">✦ <span>GALAXY GROWN</span></a></header>
${surfaceNavigation('Casino Coolio')}
<main class="slots">
  <div class="slots-heading">
    <h1>Casino Coolio</h1>
    <p>Slot Machine</p>
  </div>
  <div class="slots-error" id="slots-save-error" hidden>
    <p role="alert" id="slots-save-message"></p>
    <button type="button" id="slots-retry">Retry save</button>
  </div>
  <div class="slots-layout">
    <section class="slots-cabinet" aria-label="Slot machine">
      <div class="slots-reels" aria-label="Reels">
        ${[1, 2, 3].map(() => '<div class="slots-reel"><span aria-hidden="true">✦</span><small>—</small></div>').join('')}
      </div>
      <p class="slots-status" id="slots-status" role="status"></p>
      <form class="slots-controls" id="slots-opening" hidden novalidate>
        <div>
          <label for="slots-gold">Opening balance</label>
          <input id="slots-gold" type="text" inputmode="numeric" aria-describedby="slots-opening-help slots-opening-error" autocomplete="off">
          <p id="slots-opening-help">At least ${minimumOpening} gp in campaign gold.</p>
          <p class="error" id="slots-opening-error" role="alert"></p>
        </div>
        <button class="slots-action" type="submit">Start session</button>
      </form>
      <div id="slots-playing" hidden>
        <dl class="slots-totals">
          <div><dt>Current balance</dt><dd id="slots-balance"></dd></div>
          <div><dt>Last payout</dt><dd id="slots-payout"></dd></div>
        </dl>
        <div class="slots-controls">
          <div>
            <label for="slots-wager">Wager</label>
            <select id="slots-wager">
              ${Array.from({ length: maximumWager }, (_, i) => `<option value="${i + 1}">${i + 1} gp</option>`).join('')}
            </select>
          </div>
          <button class="slots-action" id="slots-spin" type="button">Spin</button>
          <button id="slots-cash" type="button">Cash out</button>
        </div>
      </div>
      <section id="slots-settlement" aria-labelledby="slots-settlement-title" hidden>
        <h2 id="slots-settlement-title" tabindex="-1">GM settlement</h2>
        <dl class="slots-totals">
          <div><dt>Starting gold</dt><dd id="slots-starting"></dd></div>
          <div><dt>Final gold</dt><dd id="slots-final"></dd></div>
          <div><dt>Net</dt><dd id="slots-net"></dd></div>
        </dl>
        <div class="slots-controls">
          <button class="slots-action" id="slots-copy" type="button">Copy report</button>
          <button id="slots-new" type="button">New session</button>
        </div>
        <p id="slots-copy-status" role="status"></p>
        <label id="slots-report-label" for="slots-report" hidden>Settlement report</label>
        <textarea id="slots-report" rows="4" readonly hidden></textarea>
      </section>
    </section>
    <aside class="slots-paytable">
      <h2>Paytable</h2>
      <table>
        <thead><tr><th scope="col">Matching symbols</th><th scope="col">Payout</th></tr></thead>
        <tbody>${symbols.map(symbol => `<tr><th scope="row"><span aria-hidden="true">${symbol.glyph}</span> 3 ${symbol.name}s</th><td>${symbol.triple}×</td></tr>`).join('')}
        <tr><th scope="row"><span aria-hidden="true">⬡</span> 2 Frost Chips on the left</th><td>1×</td></tr></tbody>
      </table>
      <p>Payouts include any returned wager. Other results pay 0.</p>
    </aside>
  </div>
</main>`;

function element<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

const opening = element<HTMLFormElement>('slots-opening');
const gold = element<HTMLInputElement>('slots-gold');
const openingError = element('slots-opening-error');
const playing = element('slots-playing');
const wager = element<HTMLSelectElement>('slots-wager');
const spin = element<HTMLButtonElement>('slots-spin');
const cash = element<HTMLButtonElement>('slots-cash');
const settlement = element('slots-settlement');
const report = element<HTMLTextAreaElement>('slots-report');
const copyStatus = element('slots-copy-status');
const saveError = element('slots-save-error');
const retry = element<HTMLButtonElement>('slots-retry');
const reels = document.querySelectorAll<HTMLElement>('.slots-reel');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let session: SlotSession | null = null;
let retrySave: (() => void) | null = null;
let revealTimer: number | undefined;

function render() {
  const spinning = session?.phase === 'spinning';
  const finished = session?.phase === 'finished';
  const result = session?.lastSpin;
  const payout = result && result.wager * multiplier(result.reels);
  const available = session ? affordableWagers(session.balance) : 0;
  const waitingToExit = session?.phase === 'spinning' && session.cashOut;
  opening.hidden = session !== null;
  playing.hidden = session === null || finished;
  settlement.hidden = !finished;
  saveError.hidden = retrySave === null;

  reels.forEach((reel, index) => {
    const symbol = result ? symbols[result.reels[index]] : undefined;
    reel.classList.toggle('is-spinning', spinning && !retrySave);
    reel.querySelector('span')!.textContent = spinning ? '✧' : symbol?.glyph ?? '✦';
    reel.querySelector('small')!.textContent = spinning ? '—' : symbol?.name ?? '—';
  });

  const reelNames = result?.reels.map(index => symbols[index].name).join(', ');
  const status = element('slots-status');
  const message = spinning ? (waitingToExit ? 'Cashing out after this spin…' : 'Reels spinning…') :
    result ? `${reelNames}. ${payout} gp payout.` : '';
  if (status.textContent !== message) status.textContent = message;

  for (const control of [gold, ...Array.from(opening.querySelectorAll('button')), element<HTMLButtonElement>('slots-new')]) {
    control.disabled = retrySave !== null;
  }
  wager.disabled = spinning || available < 1 || retrySave !== null;
  if (!spinning) {
    for (const option of Array.from(wager.options)) option.disabled = Number(option.value) > available;
    if (Number(wager.value) > available) wager.value = '1';
  }
  spin.setAttribute('aria-disabled', String(spinning || available < 1 || retrySave !== null));
  cash.setAttribute('aria-disabled', String(waitingToExit || retrySave !== null));

  if (!session) return;
  element('slots-balance').textContent = `${session.balance} gp`;
  element('slots-payout').textContent = payout === null || payout === undefined ? '—' : `${payout} gp`;
  if (finished) {
    element('slots-starting').textContent = `${session.startingGold} gp`;
    element('slots-final').textContent = `${session.balance} gp`;
    element('slots-net').textContent = signedGold(session.balance - session.startingGold);
    report.value = settlementReport(session);
  } else if (!spinning && available < 1) {
    status.textContent = 'Balance is too large to spin safely. Cash out to settle with the GM.';
  }
}

function saveFailed(action: () => void, message: string) {
  retrySave = action;
  window.clearTimeout(revealTimer);
  revealTimer = undefined;
  element('slots-save-message').textContent = message;
  render();
  retry.focus();
}

function commit(next: SlotSession | null, after: () => void = () => {}) {
  const wasFinished = session?.phase === 'finished';
  const wasRetrying = retrySave !== null;
  try {
    writeSession(window.sessionStorage, next);
  } catch {
    saveFailed(() => commit(next, after), 'The game could not save this action. Retry to continue from your last saved balance.');
    return;
  }
  retrySave = null;
  session = next;
  render();
  if (next?.phase === 'finished' && !wasFinished) element('slots-settlement-title').focus();
  else if (wasRetrying && next?.phase === 'spinning') cash.focus();
  else if (wasRetrying && next?.phase === 'ready') spin.focus();
  after();
}

function settle() {
  revealTimer = undefined;
  if (session?.phase === 'spinning' && !retrySave) commit(settleSpin(session));
}

function scheduleReveal() {
  window.clearTimeout(revealTimer);
  if (reducedMotion.matches) settle();
  else revealTimer = window.setTimeout(settle, 750);
}

function restore() {
  try {
    session = readSession(window.sessionStorage);
  } catch {
    retry.textContent = 'Retry loading';
    saveFailed(restore, 'The game could not load its saved session. Retry to continue.');
    return;
  }
  retry.textContent = 'Retry save';
  retrySave = null;
  if (session?.phase === 'spinning') settle();
  else render();
}

opening.addEventListener('submit', event => {
  event.preventDefault();
  if (retrySave || session) return;
  const input = gold.value.trim();
  const next = /^\d+$/.test(input) ? openSession(Number(input)) : null;
  gold.setAttribute('aria-invalid', String(!next));
  openingError.textContent = next ? '' : `Enter a whole number of gp, at least ${minimumOpening}.`;
  if (next) commit(next, () => (affordableWagers(next.balance) ? spin : cash).focus());
  else gold.focus();
});

spin.addEventListener('click', () => {
  if (!session || retrySave) return;
  const pending = beginSpin(session, Number(wager.value));
  if (pending !== session) commit(pending, scheduleReveal);
});

cash.addEventListener('click', () => {
  if (!session || retrySave) return;
  const next = requestCashOut(session);
  if (next === session) return;
  commit(next, () => {
    if (next.phase === 'spinning' && revealTimer === undefined) scheduleReveal();
  });
});

retry.addEventListener('click', () => retrySave?.());
element('slots-new').addEventListener('click', () => {
  if (session?.phase !== 'finished' || retrySave) return;
  commit(null, () => {
    gold.value = '';
    gold.removeAttribute('aria-invalid');
    openingError.textContent = '';
    wager.value = '1';
    report.hidden = true;
    element('slots-report-label').hidden = true;
    copyStatus.textContent = '';
    gold.focus();
  });
});

element('slots-copy').addEventListener('click', async () => {
  if (session?.phase !== 'finished') return;
  const copiedSession = session;
  try {
    await navigator.clipboard.writeText(report.value);
    if (session === copiedSession) copyStatus.textContent = 'Report copied.';
  } catch {
    if (session !== copiedSession) return;
    element('slots-report-label').hidden = false;
    report.hidden = false;
    report.focus();
    report.select();
    copyStatus.textContent = 'Select and copy the report to share it.';
  }
});

restore();
