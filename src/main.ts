import Phaser from 'phaser';
import './style.css';
import { FlightScene } from './game/scene';
import { createInput } from './game/input';
import { difficultyFor, parseTotal, resultText, scoreFor, DURATION, WIDTH, HEIGHT, type FlightConfig } from './game/rules';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
<header><a href="./" class="brand">✦ <span>GALAXY GROWN</span></a><span class="tag">FLIGHT DECK · PROTOTYPE</span></header>
<main>
<section id="setup" class="setup">
  <div class="intro"><p class="eyebrow">CREW CHALLENGE 01</p><h1>A steady hand.<br>A field of trouble.</h1><p class="lede">Take the pilot’s seat. Thread your ship through the asteroid field and bring your score back to the GM.</p><div class="details"><span>60-second flight</span><span>3 hull points</span><span>Solo run</span></div></div>
  <form id="flight-form" class="panel">
    <h2>Prepare for flight</h2>
    <div class="fields"><label>Situation<select id="situation"><option>Asteroid Field</option><option disabled>Space Battle — in development</option><option disabled>Boarding Party — in design</option></select></label><label>Crew position<select id="role"><option>Pilot</option><option disabled>Gunner — in development</option><option disabled>Bomber — in development</option><option disabled>Life Support — in development</option></select></label></div>
    <label for="total">Check total <span class="muted">including modifiers</span></label>
    <input id="total" name="total" type="text" autocomplete="off" placeholder="Enter your final total" aria-describedby="total-help error" required />
    <p id="total-help" class="help">Roll the check your GM requests, add your modifiers, and enter the total here. Negative totals are allowed.</p>
    <label class="check"><input type="checkbox" id="natural-one" /> I rolled a natural 1</label>
    <div class="readout" aria-live="polite"><span>FLIGHT DIFFICULTY</span><strong id="difficulty">Awaiting check</strong><p id="impairment">Standard engine</p></div>
    <p id="error" class="error" role="alert"></p>
    <button class="primary" type="submit">Launch flight <span>↗</span></button>
    <p class="help">Arrow keys / WASD to steer. On touch screens, hold and drag in the flight area. The ship follows at its movement speed.</p>
  </form>
</section>
<section id="play" hidden>
  <div class="play-heading"><div><p class="eyebrow">ASTEROID FIELD / PILOT</p><h2>Keep your hull intact.</h2></div><button id="pause" type="button">Pause</button></div>
  <div class="hud"><div><span>TIME LEFT</span><strong id="time">60s</strong></div><div><span>HULL</span><strong id="hull">3 / 3</strong></div><div><span>SCORE</span><strong id="score">300</strong></div></div>
  <p id="flight-status" class="flight-status"></p>
  <div class="flight-wrap"><div id="canvas" aria-label="Asteroid field. Steer with arrow keys, WASD, or touch." role="application" tabindex="0"></div><div id="pause-overlay" hidden><h2>Flight paused</h2><p>Your timer is stopped.</p><button id="resume" class="primary" type="button">Resume flight</button><button id="abandon" type="button">Back to setup</button></div></div>
  <p class="help center">Avoid asteroids · Arrow keys / WASD · Hold and drag to steer</p>
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
const scene = new FlightScene('flight');
const input = createInput(get('canvas'));
scene.readInput = input.read;
let game: Phaser.Game | null = null;
let config: FlightConfig = { total: 10, naturalOne: false };
let inFlight = false;
let paused = false;
function show(section: string) {
  for (const id of ['setup', 'play', 'results']) get(id).hidden = id !== section;
}
function refreshSetup() {
  const parsed = parseTotal(total.value);
  get('difficulty').textContent = parsed === null ? 'Awaiting valid check' : difficultyFor(parsed);
  get('impairment').textContent = natural.checked ? 'Overloaded engine · 60% movement speed (playtest)' : 'Standard engine';
  get('error').textContent = '';
}
total.addEventListener('input', refreshSetup); natural.addEventListener('change', refreshSetup);
function setPaused(value: boolean) {
  if (!inFlight) return;
  paused = value; scene.activeFlight = !value; input.enable(!value);
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
  inFlight = false; scene.activeFlight = false; input.enable(false); paused = false;
  get('pause-overlay').hidden = true; show('setup'); total.focus();
}
get('abandon').addEventListener('click', resetSetup); get('again').addEventListener('click', resetSetup);
function launch() {
  scene.begin(config); input.enable(true); inFlight = true; paused = false;
  get('pause').textContent = 'Pause'; get('pause-overlay').hidden = true;
  get('flight-status').textContent = `${difficultyFor(config.total)} · Check ${config.total} · ${config.naturalOne ? 'Natural 1: overloaded engine' : 'Standard engine'}`;
  get('canvas').focus();
}
get('flight-form').addEventListener('submit', e => {
  e.preventDefault(); const parsed = parseTotal(total.value);
  if (parsed === null) { get('error').textContent = 'Enter a whole-number check total, including modifiers.'; total.focus(); return; }
  config = { total: parsed, naturalOne: natural.checked }; show('play');
  if (!game) {
    scene.events.once(Phaser.Scenes.Events.CREATE, launch);
    game = new Phaser.Game({ type: Phaser.CANVAS, parent: 'canvas', width: WIDTH, height: HEIGHT,
      backgroundColor: '#101528', scene: [scene], banner: false,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      render: { antialias: true } });
  } else { game.scale.refresh(); launch(); }
});
scene.onStep = s => {
  get('time').textContent = `${Math.ceil(DURATION - s.elapsed)}s`;
  get('hull').textContent = `${s.hull} / 3`;
  get('score').textContent = String(scoreFor(s));
  if (s.finished) {
    inFlight = false; input.enable(false); show('results');
    get('outcome').textContent = s.hull > 0 ? 'Course complete.' : 'Hull depleted.';
    get('final-score').textContent = String(scoreFor(s));
    get<HTMLTextAreaElement>('summary').value = resultText(config, s);
    get('copy-status').textContent = ''; get('copy').focus();
  }
};
get('copy').addEventListener('click', async () => {
  const summary = get<HTMLTextAreaElement>('summary');
  try { await navigator.clipboard.writeText(summary.value); get('copy-status').textContent = 'Copied. Share it with your GM.'; }
  catch { summary.focus(); summary.select(); get('copy-status').textContent = 'Report selected. Copy it manually, or take a screenshot.'; }
});
