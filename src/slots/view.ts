import { isSitesBuild, surfaceNavigation } from '../site-navigation';
import { casinoAssignment, casinoRoomPath, type CasinoSettlement } from '../rooms/casino';
import { roomRequest } from '../rooms/client';
import '../style.css';
import './slots.css';
import {
  affordableWagers, beginSpin, maximumWager, minimumOpening, multiplier, openSession,
  requestCashOut, settlementReport, settleSpin, signedGold, symbols, type SlotSession,
} from './rules';
import { connectLever } from './lever';
import { readSession, writeSession } from './session';

document.title = 'Casino Coolio · Galaxy Grown';
document.querySelector('#app')!.innerHTML = `
<header><a href="./" class="brand">✦ <span>GALAXY GROWN</span></a></header>
${surfaceNavigation('Casino Coolio')}
<main class="slots">
  <div class="slots-error" id="slots-save-error" hidden>
    <p role="alert" id="slots-save-message"></p>
    <button type="button" id="slots-retry">Retry save</button>
  </div>
  <section class="slots-cabinet" aria-label="Slot machine">
    <div class="slots-band slots-marquee">
      <h1>Casino Coolio</h1>
    </div>
    <div class="slots-band slots-machine">
      <div class="slots-reels" aria-label="Center payline">
        ${[0, 1, 2].map(index => `
        <div class="slots-reel">
          <div class="slots-reel-result">
            <span aria-hidden="true">✦</span><small>—</small>
          </div>
          <div class="slots-strip" aria-hidden="true">
            ${[0, 1, 2, 3].map(turn => symbols.map((_, step) =>
              `<span>${symbols[(index + step + turn) % symbols.length].glyph}</span>`).join('')).join('')}
            <span class="slots-strip-end"></span>
          </div>
        </div>`).join('')}
      </div>
      <button class="slots-lever" id="slots-spin" type="button" aria-label="Spin" hidden>
        <span class="slots-lever-pivot" aria-hidden="true"></span>
        <span class="slots-lever-arm" aria-hidden="true"></span>
        <span class="slots-lever-label" aria-hidden="true">Spin</span>
      </button>
    </div>
    <div class="slots-band slots-deck">
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
        <div class="slots-betting">
          <fieldset class="slots-wagers">
            <legend>Wager</legend>
            <div class="slots-wager-buttons">
              ${Array.from({ length: maximumWager }, (_, i) => `
                <label><input type="radio" name="slots-wager" value="${i + 1}" ${i === 0 ? 'checked' : ''}>
                  <span>${i + 1}<small> gp</small></span></label>`).join('')}
            </div>
          </fieldset>
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
          <button class="slots-action" id="slots-send" type="button" hidden>Send to DM</button>
          <button class="slots-action" id="slots-copy" type="button">Copy report</button>
          <button id="slots-new" type="button">New session</button>
        </div>
        <p class="slots-report-help" id="slots-report-help" hidden>To send a future report, open Casino Coolio from your seat in Rooms before starting.</p>
        <p id="slots-send-status" role="status"></p>
        <p id="slots-copy-status" role="status"></p>
        <label id="slots-report-label" for="slots-report" hidden>Settlement report</label>
        <textarea id="slots-report" rows="4" readonly hidden></textarea>
      </section>
    </div>
    <div class="slots-paytable">
      <div class="slots-band slots-paytable-content">
        <h2>Rules &amp; paytable</h2>
        <table>
          <thead><tr><th scope="col">Matching symbols</th><th scope="col">Payout</th></tr></thead>
          <tbody>${symbols.map(symbol => `<tr><th scope="row"><span aria-hidden="true">${symbol.glyph}</span> 3 ${symbol.name}s</th><td>${symbol.triple}×</td></tr>`).join('')}
          <tr><th scope="row"><span aria-hidden="true">⬡</span> 2 Frost Chips on the left</th><td>1×</td></tr></tbody>
        </table>
        <p>Only the center line pays. Payouts include any returned wager.</p>
      </div>
    </div>
    <div class="slots-band slots-base" aria-hidden="true"></div>
  </section>
</main>`;

function element<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

const opening = element<HTMLFormElement>('slots-opening');
const gold = element<HTMLInputElement>('slots-gold');
const openingError = element('slots-opening-error');
const playing = element('slots-playing');
const wagers = Array.from(document.querySelectorAll<HTMLInputElement>('.slots-wagers input'));
const spin = element<HTMLButtonElement>('slots-spin');
const cash = element<HTMLButtonElement>('slots-cash');
const settlement = element('slots-settlement');
const send = element<HTMLButtonElement>('slots-send');
const sendStatus = element('slots-send-status');
const assignedRoom = isSitesBuild ? casinoAssignment(window.location.search) : null;
const report = element<HTMLTextAreaElement>('slots-report');
const copyStatus = element('slots-copy-status');
const saveError = element('slots-save-error');
const retry = element<HTMLButtonElement>('slots-retry');
const reels = document.querySelectorAll<HTMLElement>('.slots-reel');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let session: SlotSession | null = null;
let retrySave: (() => void) | null = null;
let revealTimer: number | undefined;
let sending = false;

function render() {
  const spinning = session?.phase === 'spinning';
  const finished = session?.phase === 'finished';
  const result = session?.lastSpin;
  const payout = result && result.wager * multiplier(result.reels);
  const available = session ? affordableWagers(session.balance) : 0;
  const delivery = session?.delivery;
  const canSend = finished && delivery && delivery.roomId === assignedRoom?.roomId && delivery.seatId === assignedRoom.seatId;
  send.hidden = !canSend;
  element('slots-report-help').hidden = !isSitesBuild || !finished || Boolean(canSend);
  send.disabled = retrySave !== null || sending || Boolean(delivery?.sent);
  send.textContent = delivery?.sent ? 'Sent to DM' : 'Send to DM';
  const waitingToExit = session?.phase === 'spinning' && session.cashOut;
  spin.hidden = !session || finished;
  opening.hidden = session !== null;
  playing.hidden = session === null || finished;
  settlement.hidden = !finished;
  saveError.hidden = retrySave === null;

  const rolling = spinning && !reducedMotion.matches && !retrySave;
  spin.classList.toggle('is-spinning', rolling);
  reels.forEach((reel, index) => {
    const symbol = result ? symbols[result.reels[index]] : undefined;
    if (session?.phase === 'spinning') {
      reel.querySelector('.slots-strip-end')!.textContent = symbols[session.pending.reels[index]].glyph;
    }
    reel.classList.toggle('is-spinning', rolling);
    reel.querySelector('.slots-reel-result span')!.textContent = symbol?.glyph ?? '✦';
    reel.querySelector('small')!.textContent = symbol?.name ?? '—';
  });

  const reelNames = result?.reels.map(index => symbols[index].name).join(', ');
  const status = element('slots-status');
  const message = spinning ? (waitingToExit ? 'Cashing out after this spin…' : 'Reels spinning…') :
    result ? `${reelNames}. ${payout} gp payout.` : '';
  if (status.textContent !== message) status.textContent = message;

  for (const control of [gold, ...Array.from(opening.querySelectorAll('button'))]) {
    control.disabled = retrySave !== null;
  }
  element<HTMLButtonElement>('slots-new').disabled = retrySave !== null || sending;
  if (!spinning && wagers.some(wager => wager.checked && Number(wager.value) > available)) {
    wagers[0].checked = true;
  }
  for (const wager of wagers) {
    wager.disabled = spinning || Number(wager.value) > available || retrySave !== null;
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
  const next = /^\d+$/.test(input) ? openSession(Number(input), assignedRoom
    ? { ...assignedRoom, sessionId: crypto.randomUUID() } : undefined) : null;
  gold.setAttribute('aria-invalid', String(!next));
  openingError.textContent = next ? '' : `Enter a whole number of gp, at least ${minimumOpening}.`;
  if (next) commit(next, () => (affordableWagers(next.balance) ? spin : cash).focus());
  else gold.focus();
});

connectLever(spin, () => {
  if (!session || retrySave) return;
  const wager = wagers.find(option => option.checked);
  const pending = beginSpin(session, Number(wager?.value));
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
    wagers[0].checked = true;
    report.hidden = true;
    element('slots-report-label').hidden = true;
    copyStatus.textContent = '';
    sendStatus.textContent = '';
    gold.focus();
  });
});

send.addEventListener('click', async () => {
  const delivery = session?.delivery;
  if (send.hidden || send.disabled || !delivery || session?.phase !== 'finished') return;
  const finished = session;
  sending = true;
  sendStatus.textContent = 'Sending report…';
  render();
  try {
    const { sessionId } = delivery;
    await roomRequest<CasinoSettlement>(casinoRoomPath(delivery), 'POST', {
      sessionId, game: 'casino-coolio', startingGold: finished.startingGold, finalGold: finished.balance,
    } satisfies CasinoSettlement);
    commit({ ...finished, delivery: { ...delivery, sent: true } });
    sendStatus.textContent = 'Report sent to your DM for settlement.';
  } catch (cause) {
    sendStatus.textContent = cause instanceof Error ? cause.message : 'Could not send. Try again or copy the report.';
  } finally {
    sending = false;
    render();
  }
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

reducedMotion.addEventListener('change', event => {
  if (!event.matches) return;
  window.clearTimeout(revealTimer);
  settle();
});

restore();
