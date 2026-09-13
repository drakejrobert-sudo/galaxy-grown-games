import Phaser from 'phaser';
import './style.css';
import { FlightScene } from './game/scene';
import { createGunnerInput, createInput } from './game/input';
import {
  difficultyFor, parseTotal, resultText, scoreFor, gunnerResultText,
  gunnerScoreFor, DURATION, WIDTH, HEIGHT, type FlightConfig, type Role,
} from './game/rules';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
<header><a href="./" class="brand">✦ <span>GALAXY GROWN</span></a><span class="tag">FLIGHT DECK · PROTOTYPE</span></header>
<main>
<section id="setup" class="setup">
  <div class="intro"><p class="eyebrow">CREW CHALLENGE 01</p><h1>A steady hand.<br>A field of trouble.</h1><p class="lede">Choose your station, face the asteroid field, and bring your individual score back to the GM.</p><div class="details"><span>60-second challenge</span><span>3 hull points</span><span>Solo run</span></div></div>
  <form id="flight-form" class="panel">
    <h2>Prepare for flight</h2>
    <div class="fields"><label>Situation<select id="situation"><option>Asteroid Field</option><option disabled>Space Battle — in development</option><option disabled>Boarding Party — in design</option></select></label><label>Crew position<select id="role"><option>Pilot</option><option>Gunner</option><option disabled>Bomber — in development</option><option disabled>Life Support — in development</option></select></label></div>
    <label for="total">Check total <span class="muted">including modifiers</span></label>
    <input id="total" name="total" type="text" autocomplete="off" placeholder="Enter your final total" aria-describedby="total-help error" required />
    <p id="total-help" class="help">Roll the check your GM requests, add your modifiers, and enter the total here. Negative totals are allowed.</p>
    <label class="check"><input type="checkbox" id="natural-one" /> I rolled a natural 1</label>
    <div class="readout" aria-live="polite"><span>CHALLENGE DIFFICULTY</span><strong id="difficulty">Awaiting check</strong><p id="impairment">Standard engine</p></div>
    <p id="error" class="error" role="alert"></p>
    <button class="primary" type="submit">Start challenge <span>↗</span></button>
    <p id="controls-help" class="help">Arrow keys / WASD to steer. On touch screens, hold and drag in the flight area. The ship follows at its movement speed.</p>
  </form>
</section>
<section id="play" hidden>
  <div class="play-heading"><div><p id="mode-label" class="eyebrow">ASTEROID FIELD / PILOT</p><h2 id="mode-heading">Keep your hull intact.</h2></div><button id="pause" type="button">Pause</button></div>
  <div class="hud"><div><span>TIME LEFT</span><strong id="time">60s</strong></div><div><span>HULL</span><strong id="hull">3 / 3</strong></div><div><span>SCORE</span><strong id="score">300</strong></div></div>
  <p id="flight-status" class="flight-status"></p>
  <div class="flight-wrap"><div id="canvas" aria-label="Asteroid field. Steer with arrow keys, WASD, or touch." role="application" tabindex="0"></div><div id="pause-overlay" hidden><h2>Challenge paused</h2><p>Your timer is stopped.</p><button id="resume" class="primary" type="button">Resume challenge</button><button id="abandon" type="button">Back to setup</button></div></div>
  <p id="play-help" class="help center">Avoid asteroids · Arrow keys / WASD · Hold and drag to steer</p>
</section>
<section id="results" class="panel results" hidden>
  <p class="eyebrow">FLIGHT REPORT</p><h1 id="outcome"></h1><div class="final-score"><strong id="final-score"></strong><span>POINTS</span></div>
  <textarea id="summary" readonly aria-label="Flight result summary" rows="6"></textarea>
  <p class="help">Share this report with your GM. They decide what happens next.</p>
  <div class="actions"><button id="copy" class="primary" type="button">Copy score report</button><button id="again" type="button">Back to setup</button></div><p id="copy-status" role="status"></p>
</section>
</main><footer>One crew. A galaxy of possibilities.<span>Playtest build · Scoring and balance are provisional.</span></footer>`;
const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const total = get<HTMLInputElement>('total'), natural = get<HTMLInputElement>('natural-one');
const roleSelect = get<HTMLSelectElement>('role');
const scene = new FlightScene('flight');
const canvas = get('canvas');
const input = createInput(canvas);
const gunnerInput = createGunnerInput(canvas);
scene.readInput = input.read;
scene.readGunnerInput = gunnerInput.read;
let game: Phaser.Game | null = null;
let config: FlightConfig = { total: 10, naturalOne: false };
let role: Role = 'Pilot';
let inFlight = false;
let paused = false;
function show(section: string) {
  for (const id of ['setup', 'play', 'results']) get(id).hidden = id !== section;
}
function refreshSetup() {
  const parsed = parseTotal(total.value);
  get('difficulty').textContent = parsed === null ? 'Awaiting valid check' : difficultyFor(parsed);
  const selectedRole = roleSelect.value as Role;
  get('impairment').textContent = selectedRole === 'Pilot'
    ? natural.checked ? 'Overloaded engine · 60% movement speed (playtest)' : 'Standard engine'
    : natural.checked ? 'Overheated gun · half normal fire rate (playtest)' : 'Standard weapon cooling';
  get('controls-help').textContent = selectedRole === 'Pilot'
    ? 'Arrow keys / WASD to steer. On touch screens, hold and drag in the flight area. The ship follows at its movement speed.'
    : 'Touch: tap, hold, or drag to aim and fire. Mouse: move to aim, then click or hold to fire.';
  get('error').textContent = '';
}
total.addEventListener('input', refreshSetup); natural.addEventListener('change', refreshSetup);
roleSelect.addEventListener('change', refreshSetup);
function setPaused(value: boolean) {
  if (!inFlight) return;
  paused = value; scene.activeFlight = !value;
  input.enable(!value && role === 'Pilot'); gunnerInput.enable(!value && role === 'Gunner');
  get('pause-overlay').hidden = !value;
  get('pause').textContent = value ? 'Resume' : 'Pause';
  if (value) get('resume').focus(); else get('canvas').focus();
}
get('pause').addEventListener('click', () => setPaused(!paused));
get('resume').addEventListener('click', () => setPaused(false));
window.addEventListener('keydown', e => { if (inFlight && e.code === 'Escape') { e.preventDefault(); setPaused(!paused); } });
window.addEventListener('blur', () => { if (inFlight) setPaused(true); });
document.addEventListener('visibilitychange', () => { if (document.hidden && inFlight) setPaused(true); });
function resetSetup() {
  inFlight = false; scene.activeFlight = false; input.enable(false); gunnerInput.enable(false); paused = false;
  get('pause-overlay').hidden = true; show('setup'); total.focus();
}
get('abandon').addEventListener('click', resetSetup); get('again').addEventListener('click', resetSetup);
function launch() {
  scene.begin(config, role);
  input.enable(role === 'Pilot'); gunnerInput.enable(role === 'Gunner'); inFlight = true; paused = false;
  get('pause').textContent = 'Pause'; get('pause-overlay').hidden = true;
  get('mode-label').textContent = `ASTEROID FIELD / ${role.toUpperCase()}`;
  get('mode-heading').textContent = role === 'Pilot' ? 'Keep your hull intact.' : 'Clear the path ahead.';
  get('play-help').textContent = role === 'Pilot'
    ? 'Avoid asteroids · Arrow keys / WASD · Hold and drag to steer'
    : 'Destroy asteroids · Touch to aim/fire · Mouse to aim, click to fire';
  canvas.setAttribute('aria-label', role === 'Pilot'
    ? 'Asteroid field. Steer with arrow keys, WASD, or touch.'
    : 'Asteroid gunner station. Tap, hold, or drag with touch; move a mouse to aim and click or hold to fire.');
  const impairment = role === 'Pilot' ? 'overloaded engine' : 'overheated gun';
  get('flight-status').textContent = `${difficultyFor(config.total)} · Check ${config.total} · ${config.naturalOne ? `Natural 1: ${impairment}` : role === 'Pilot' ? 'Standard engine' : 'Standard weapon cooling'}`;
  get('canvas').focus();
}
get('flight-form').addEventListener('submit', e => {
  e.preventDefault(); const parsed = parseTotal(total.value);
  if (parsed === null) { get('error').textContent = 'Enter a whole-number check total, including modifiers.'; total.focus(); return; }
  config = { total: parsed, naturalOne: natural.checked }; role = roleSelect.value as Role; show('play');
  if (!game) {
    // Scene plugins (including events) do not exist until Phaser boots.
    // A plain callback is safe to assign before constructing the game.
    scene.onReady = launch;
    try {
      game = new Phaser.Game({ type: Phaser.CANVAS, parent: 'canvas', width: WIDTH, height: HEIGHT,
      backgroundColor: '#101528', scene: [scene], banner: false,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      render: { antialias: true } });
    } catch (error) {
      console.error('Flight startup failed', error);
      game = null;
      resetSetup();
      get('error').textContent = 'The flight could not start. Please reload the page and try again.';
    }
  } else { game.scale.refresh(); launch(); }
});
scene.onFlightStep = s => {
  get('time').textContent = `${Math.ceil(DURATION - s.elapsed)}s`;
  get('hull').textContent = `${s.hull} / 3`;
  get('score').textContent = String(scoreFor(s));
  if (s.finished) {
    inFlight = false; input.enable(false); gunnerInput.enable(false); show('results');
    get('outcome').textContent = s.hull > 0 ? 'Course complete.' : 'Hull depleted.';
    get('final-score').textContent = String(scoreFor(s));
    get<HTMLTextAreaElement>('summary').value = resultText(config, s);
    get('copy-status').textContent = ''; get('copy').focus();
  }
};
scene.onGunnerStep = s => {
  get('time').textContent = `${Math.ceil(DURATION - s.elapsed)}s`;
  get('hull').textContent = `${s.hull} / 3`;
  get('score').textContent = String(gunnerScoreFor(s));
  if (s.finished) {
    inFlight = false; input.enable(false); gunnerInput.enable(false); show('results');
    get('outcome').textContent = s.hull > 0 ? 'Field cleared.' : 'Hull depleted.';
    get('final-score').textContent = String(gunnerScoreFor(s));
    get<HTMLTextAreaElement>('summary').value = gunnerResultText(config, s);
    get('copy-status').textContent = ''; get('copy').focus();
  }
};
get('copy').addEventListener('click', async () => {
  const summary = get<HTMLTextAreaElement>('summary');
  try { await navigator.clipboard.writeText(summary.value); get('copy-status').textContent = 'Copied. Share it with your GM.'; }
  catch { summary.focus(); summary.select(); get('copy-status').textContent = 'Report selected. Copy it manually, or take a screenshot.'; }
});
