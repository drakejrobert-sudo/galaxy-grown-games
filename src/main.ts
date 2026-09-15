import type Phaser from 'phaser';
import './style.css';
import './bomber.css';
import type { FlightScene } from './game/scene';
import { createBomberInput, createGunnerInput, createInput, createLifeSupportInput, createSpaceBomberInput } from './game/input';
import {
  bomberResultText, bomberScoreFor, difficultyFor, parseTotal, resultText, scoreFor,
  gunnerResultText, gunnerScoreFor, spaceBattlePilotResultText, spaceBattlePilotScoreFor,
  spaceBattleBomberResultText, spaceBattleBomberScoreFor,
  lifeSupportResultText, lifeSupportScoreFor, LIFE_SUPPORT_MAX_INTEGRITY,
  DURATION, WIDTH, HEIGHT, type FlightConfig, type Role, type Situation,
} from './game/rules';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
<header><a href="./" class="brand">✦ <span>GALAXY GROWN</span></a><span class="tag">FLIGHT DECK · PROTOTYPE</span></header>
<main>
<section id="setup" class="setup">
  <div class="intro"><p class="eyebrow">CREW CHALLENGE 01</p><h1>A steady hand.<br>A galaxy of trouble.</h1><p class="lede">Choose your station, face the danger ahead, and bring your individual score back to the GM.</p><div class="details"><span>60-second challenge</span><span>Role-specific systems</span><span>Solo run</span></div></div>
  <form id="flight-form" class="panel">
    <h2>Prepare for flight</h2>
    <div class="fields"><label>Situation<select id="situation"><option>Asteroid Field</option><option>Space Battle</option><option disabled>Boarding Party — in design</option></select></label><label>Crew position<select id="role"><option>Pilot</option><option id="role-gunner">Gunner</option><option id="role-bomber">Bomber</option><option id="role-life-support">Life Support</option></select></label></div>
    <label for="total">Check total <span class="muted">including modifiers</span></label>
    <input id="total" name="total" type="text" autocomplete="off" placeholder="Enter your final total" aria-describedby="total-help error" required />
    <p id="total-help" class="help">Roll the check your GM requests, add your modifiers, and enter the total here. Negative totals are allowed.</p>
    <label class="check"><input type="checkbox" id="natural-one" /> I rolled a natural 1</label>
    <div class="readout" aria-live="polite"><span>CHALLENGE DIFFICULTY</span><strong id="difficulty">Awaiting check</strong><p id="impairment">Standard engine</p></div>
    <p id="error" class="error" role="alert"></p>
    <button id="start" class="primary" type="submit"><span id="start-label">Start challenge</span> <span>↗</span></button>
    <p id="load-status" class="help" role="status" aria-live="polite"></p>
    <p id="controls-help" class="help">Arrow keys / WASD to steer. On touch screens, hold and drag in the flight area. The ship follows at its movement speed.</p>
  </form>
</section>
<section id="play" hidden>
  <div class="play-heading"><div><p id="mode-label" class="eyebrow">ASTEROID FIELD / PILOT</p><h2 id="mode-heading">Keep your hull intact.</h2></div><div class="play-actions"><button id="pause" type="button">Pause</button></div></div>
  <div class="hud"><div><span>TIME LEFT</span><strong id="time">60s</strong></div><div><span id="health-label">HULL</span><strong id="hull">3 / 3</strong></div><div id="fuel-wrap" hidden><span>FUEL</span><strong id="fuel">18.0s</strong></div><div><span>SCORE</span><strong id="score">300</strong></div></div>
  <p id="flight-status" class="flight-status"></p>
  <div class="flight-stage"><div class="flight-wrap"><div id="canvas" aria-label="Asteroid field. Steer with arrow keys, WASD, or touch." role="application" tabindex="0"></div><div id="pause-overlay" hidden><h2>Challenge paused</h2><p>Your timer is stopped.</p><button id="resume" class="primary" type="button">Resume challenge</button><button id="abandon" type="button">Back to setup</button></div></div><div id="action-rail" class="action-rail" hidden><button id="fire-action" class="action action-fire" type="button" hidden>Fire missile</button><button id="action" class="action action-mine" type="button" hidden>Drop mine</button></div></div>
  <div id="route-controls" class="route-controls" aria-label="Life Support routing switch" hidden><button id="route-thrusters" type="button" aria-pressed="false"><span>▲</span>Thrusters<small>1</small></button><button id="route-shields" type="button" aria-pressed="true"><span>●</span>Shields<small>2</small></button><button id="route-guns" type="button" aria-pressed="false"><span>✛</span>Guns<small>3</small></button></div>
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
const situationSelect = get<HTMLSelectElement>('situation');
let scene: FlightScene | null = null;
const canvas = get('canvas');
const action = get<HTMLButtonElement>('action');
const fireAction = get<HTMLButtonElement>('fire-action');
const actionRail = get('action-rail');
const routeControls = get('route-controls');
const routeButtons = [get<HTMLButtonElement>('route-thrusters'), get<HTMLButtonElement>('route-shields'), get<HTMLButtonElement>('route-guns')];
const input = createInput(canvas);
const gunnerInput = createGunnerInput(canvas);
const bomberInput = createBomberInput(canvas, action);
const spaceBomberInput = createSpaceBomberInput(canvas, fireAction, action);
const lifeSupportInput = createLifeSupportInput(routeButtons);
let game: Phaser.Game | null = null;
let loading = false;
let launchPending = false;
let pauseOnReady = false;
let config: FlightConfig = { total: 10, naturalOne: false };
let role: Role = 'Pilot';
let situation: Situation = 'Asteroid Field';
let inFlight = false;
let paused = false;
function show(section: string) {
  for (const id of ['setup', 'play', 'results']) get(id).hidden = id !== section;
}
function refreshSetup() {
  const parsed = parseTotal(total.value);
  get('difficulty').textContent = parsed === null ? 'Awaiting valid check' : difficultyFor(parsed);
  const selectedSituation: Situation = situationSelect.value === 'Space Battle' ? 'Space Battle' : 'Asteroid Field';
  const gunnerOption = get<HTMLOptionElement>('role-gunner');
  const bomberOption = get<HTMLOptionElement>('role-bomber');
  const lifeSupportOption = get<HTMLOptionElement>('role-life-support');
  gunnerOption.disabled = selectedSituation === 'Space Battle';
  bomberOption.disabled = false;
  lifeSupportOption.disabled = selectedSituation === 'Space Battle';
  if (selectedSituation === 'Space Battle' && !['Pilot', 'Bomber'].includes(roleSelect.value)) roleSelect.value = 'Pilot';
  const selectedRole = roleSelect.value as Role;
  get('impairment').textContent = selectedRole === 'Pilot'
    ? natural.checked ? 'Overloaded engine · 60% movement speed (playtest)' : 'Standard engine'
    : selectedRole === 'Gunner'
      ? natural.checked ? 'Overheated gun · half normal fire rate (playtest)' : 'Standard weapon cooling'
      : selectedRole === 'Bomber'
        ? natural.checked ? 'Mine blast target · half normal area (playtest)' : 'Standard mine blast target'
        : natural.checked ? 'Half heart packets · extra overload packets (playtest)' : 'Standard repair and overload packet mix';
  get('controls-help').textContent = selectedRole === 'Pilot'
    ? 'Arrow keys / WASD to steer. On touch screens, hold and drag in the flight area. The ship follows at its movement speed.'
    : selectedRole === 'Gunner'
      ? 'Ship flies automatically. Touch: tap, hold, or drag to aim and fire. Mouse: move to aim, then click or hold to fire.'
      : selectedRole === 'Bomber'
        ? selectedSituation === 'Space Battle'
          ? 'Ship flies automatically. Touch, mouse, or Arrow keys / WASD aims missiles ahead; Space or Fire missile launches from the nose. Enter, Shift, or Drop mine releases a mine directly behind the ship.'
          : 'Ship flies automatically. Time your drops as the ship sweeps across the field. Hold Drop mine, Space, or Enter to release mines directly behind the ship. Only ship collisions cost hull; missed asteroids pass safely.'
        : 'Use Left/Right or A/D to turn the routing switch. Use 1, 2, or 3 to choose a system directly. Touch players can tap a system button.';
  get('error').textContent = '';
}
total.addEventListener('input', refreshSetup); natural.addEventListener('change', refreshSetup);
roleSelect.addEventListener('change', refreshSetup);
situationSelect.addEventListener('change', refreshSetup);
function setPaused(value: boolean) {
  if (!inFlight) return;
  paused = value; scene!.activeFlight = !value;
  input.enable(!value && role === 'Pilot');
  gunnerInput.enable(!value && situation === 'Asteroid Field' && role === 'Gunner');
  bomberInput.enable(!value && situation === 'Asteroid Field' && role === 'Bomber');
  spaceBomberInput.enable(!value && situation === 'Space Battle' && role === 'Bomber');
  lifeSupportInput.enable(!value && situation === 'Asteroid Field' && role === 'Life Support');
  get('pause-overlay').hidden = !value;
  get('pause').textContent = value ? 'Resume' : 'Pause';
  if (value) get('resume').focus(); else get('canvas').focus();
}
get('pause').addEventListener('click', () => setPaused(!paused));
get('resume').addEventListener('click', () => setPaused(false));
window.addEventListener('keydown', e => { if (inFlight && e.code === 'Escape') { e.preventDefault(); setPaused(!paused); } });
window.addEventListener('blur', () => { if (inFlight) setPaused(true); else if (launchPending) pauseOnReady = true; });
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return;
  if (inFlight) setPaused(true); else if (launchPending) pauseOnReady = true;
});
function resetSetup() {
  launchPending = false; pauseOnReady = false;
  inFlight = false; if (scene) scene.activeFlight = false; input.enable(false); gunnerInput.enable(false); bomberInput.enable(false); spaceBomberInput.enable(false); lifeSupportInput.enable(false); paused = false;
  get('pause-overlay').hidden = true; show('setup'); total.focus();
}
get('abandon').addEventListener('click', resetSetup); get('again').addEventListener('click', resetSetup);
function preparePlayLayout() {
  get('play').setAttribute('data-role', role);
  action.hidden = role !== 'Bomber';
  fireAction.hidden = role !== 'Bomber' || situation !== 'Space Battle';
  actionRail.hidden = role !== 'Bomber';
  routeControls.hidden = role !== 'Life Support';
}
function launch() {
  const startPaused = pauseOnReady || document.hidden;
  launchPending = false;
  pauseOnReady = false;
  scene!.begin(config, situation, role);
  lifeSupportInput.reset();
  input.enable(role === 'Pilot');
  gunnerInput.enable(situation === 'Asteroid Field' && role === 'Gunner');
  bomberInput.enable(situation === 'Asteroid Field' && role === 'Bomber');
  spaceBomberInput.enable(situation === 'Space Battle' && role === 'Bomber');
  lifeSupportInput.enable(situation === 'Asteroid Field' && role === 'Life Support');
  inFlight = true; paused = false;
  get('pause').textContent = 'Pause'; get('pause-overlay').hidden = true;
  get('fuel-wrap').hidden = situation !== 'Space Battle' || role !== 'Pilot';
  get('health-label').textContent = role === 'Life Support' ? 'INTEGRITY' : 'HULL';
  get('hull').textContent = role === 'Life Support' ? `${LIFE_SUPPORT_MAX_INTEGRITY} / ${LIFE_SUPPORT_MAX_INTEGRITY}` : '3 / 3';
  get('mode-label').textContent = `${situation.toUpperCase()} / ${role.toUpperCase()}`;
  get('mode-heading').textContent = situation === 'Space Battle'
    ? role === 'Bomber' ? 'Break the enemy formation.' : 'Collect fuel. Evade enemy fire.'
    : role === 'Pilot' ? 'Keep your hull intact.'
      : role === 'Gunner' ? 'Clear the path ahead.'
        : role === 'Bomber' ? 'Lay mines in their path.' : 'Route power to the right system.';
  get('play-help').textContent = role === 'Pilot'
    ? situation === 'Space Battle'
      ? 'Collect fuel cells · Evade ships and fire · Arrow keys / WASD or hold and drag'
      : 'Avoid asteroids · Arrow keys / WASD · Hold and drag to steer'
    : role === 'Gunner'
      ? 'Automatic flight · Touch to aim/fire · Mouse to aim, click to fire'
      : role === 'Bomber'
        ? situation === 'Space Battle'
          ? 'Automatic flight · Aim missiles ahead: touch, mouse, arrows/WASD · Space: fire · Enter/Shift: drop mine behind ship'
          : 'Automatic flight · Time your mine drops · Space / Enter or Drop mine releases behind ship · Only ship hits cost hull'
        : 'Match packet symbols · Left/Right or A/D · 1/2/3 · Tap a system';
  canvas.setAttribute('aria-label', situation === 'Space Battle'
    ? role === 'Bomber'
      ? 'Space battle bomber station. Ship flies automatically. Aim missiles ahead with touch, mouse, arrow keys or WASD. Space fires from the nose; Enter or Shift drops mines directly behind the ship. Touch uses two weapon buttons.'
      : 'Space battle pilot station. Collect fuel and evade enemy ships and fire with arrow keys, WASD, or touch.'
    : role === 'Pilot' ? 'Asteroid field. Steer with arrow keys, WASD, or touch.'
    : role === 'Gunner' ? 'Asteroid gunner station. Ship flies automatically. Tap, hold, or drag with touch; move a mouse to aim and click or hold to fire.'
    : role === 'Bomber' ? 'Asteroid bomber station. Ship flies automatically. Time mine releases with Space, Enter, or Drop mine. Mines always drop directly behind the ship.'
    : 'Asteroid Life Support station. Route matching packets with Left and Right, A and D, number keys 1 through 3, or the three touch buttons.');
  const impairment = role === 'Pilot' ? 'overloaded engine'
    : role === 'Gunner' ? 'overheated gun'
      : role === 'Bomber' ? 'half-area mine blast target' : 'half hearts and extra overloads';
  const standard = role === 'Pilot' ? 'Standard engine'
    : role === 'Gunner' ? 'Standard weapon cooling'
      : role === 'Bomber' ? 'Standard mine blast target' : 'Standard packet mix';
  get('flight-status').textContent = `${difficultyFor(config.total)} · Check ${config.total} · ${config.naturalOne ? `Natural 1: ${impairment}` : standard}`;
  if (startPaused) setPaused(true); else get('canvas').focus();
}
function setLoading(value: boolean) {
  loading = value;
  get<HTMLButtonElement>('start').disabled = value;
  total.disabled = value; natural.disabled = value; roleSelect.disabled = value; situationSelect.disabled = value;
  get('start-label').textContent = value ? 'Loading flight…' : 'Start challenge';
  get('load-status').textContent = value ? 'Preparing the game. Your challenge will start when it is ready.' : '';
}
get('flight-form').addEventListener('submit', async e => {
  e.preventDefault();
  if (loading) return;
  const parsed = parseTotal(total.value);
  if (parsed === null) { get('error').textContent = 'Enter a whole-number check total, including modifiers.'; total.focus(); return; }
  config = { total: parsed, naturalOne: natural.checked };
  situation = situationSelect.value === 'Space Battle' ? 'Space Battle' : 'Asteroid Field';
  role = roleSelect.value as Role;
  launchPending = true;
  if (!game) {
    setLoading(true);
    try {
      const { Phaser, FlightScene } = await import('./game/runtime');
      if (!scene) {
        scene = new FlightScene('flight');
        scene.readInput = input.read;
        scene.readGunnerInput = gunnerInput.read;
        scene.readBomberInput = bomberInput.read;
        scene.readSpaceBomberInput = spaceBomberInput.read;
        scene.readLifeSupportInput = lifeSupportInput.read;
        attachSceneCallbacks(scene);
      }
      preparePlayLayout();
      show('play');
      get('flight-status').textContent = 'Starting challenge…';
      // Scene plugins (including events) do not exist until Phaser boots.
      scene.onReady = launch;
      game = new Phaser.Game({ type: Phaser.CANVAS, parent: 'canvas', width: WIDTH, height: HEIGHT,
        backgroundColor: '#101528', scene: [scene], banner: false,
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        render: { antialias: true } });
    } catch (error) {
      console.error('Flight startup failed', error);
      game = null;
      scene = null;
      canvas.replaceChildren();
      resetSetup();
      get('error').textContent = 'The flight could not start. Try again, or reload the page if it keeps happening.';
    } finally {
      setLoading(false);
    }
  } else { preparePlayLayout(); show('play'); game.scale.refresh(); launch(); }
});
function attachSceneCallbacks(scene: FlightScene) {
scene.onFlightStep = s => {
  get('time').textContent = `${Math.ceil(DURATION - s.elapsed)}s`;
  get('hull').textContent = `${s.hull} / 3`;
  get('score').textContent = String(scoreFor(s));
  if (s.finished) {
    inFlight = false; input.enable(false); gunnerInput.enable(false); bomberInput.enable(false); spaceBomberInput.enable(false); lifeSupportInput.enable(false); show('results');
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
    inFlight = false; input.enable(false); gunnerInput.enable(false); bomberInput.enable(false); spaceBomberInput.enable(false); lifeSupportInput.enable(false); show('results');
    get('outcome').textContent = s.hull > 0 ? 'Field cleared.' : 'Hull depleted.';
    get('final-score').textContent = String(gunnerScoreFor(s));
    get<HTMLTextAreaElement>('summary').value = gunnerResultText(config, s);
    get('copy-status').textContent = ''; get('copy').focus();
  }
};
scene.onBomberStep = s => {
  get('time').textContent = `${Math.ceil(DURATION - s.elapsed)}s`;
  get('hull').textContent = `${s.hull} / 3`;
  get('score').textContent = String(bomberScoreFor(s));
  if (s.finished) {
    inFlight = false; input.enable(false); gunnerInput.enable(false); bomberInput.enable(false); spaceBomberInput.enable(false); lifeSupportInput.enable(false); show('results');
    get('outcome').textContent = s.hull > 0 ? 'Field cleared.' : 'Hull depleted.';
    get('final-score').textContent = String(bomberScoreFor(s));
    get<HTMLTextAreaElement>('summary').value = bomberResultText(config, s);
    get('copy-status').textContent = ''; get('copy').focus();
  }
};
scene.onLifeSupportStep = s => {
  get('time').textContent = `${Math.ceil(DURATION - s.elapsed)}s`;
  get('hull').textContent = `${s.integrity} / ${LIFE_SUPPORT_MAX_INTEGRITY}`;
  get('score').textContent = String(lifeSupportScoreFor(s));
  const routes = ['Thrusters', 'Shields', 'Guns'];
  routeButtons.forEach((button, index) => button.setAttribute('aria-pressed', String(routes[index] === s.selectedRoute)));
  if (s.finished) {
    inFlight = false; input.enable(false); gunnerInput.enable(false); bomberInput.enable(false); spaceBomberInput.enable(false); lifeSupportInput.enable(false); show('results');
    get('outcome').textContent = s.integrity > 0 ? 'Systems stabilized.' : 'Systems failed.';
    get('final-score').textContent = String(lifeSupportScoreFor(s));
    get<HTMLTextAreaElement>('summary').value = lifeSupportResultText(config, s);
    get('copy-status').textContent = ''; get('copy').focus();
  }
};
scene.onSpacePilotStep = s => {
  get('time').textContent = `${Math.ceil(DURATION - s.elapsed)}s`;
  get('hull').textContent = `${s.hull} / 3`;
  get('fuel').textContent = `${s.fuel.toFixed(1)}s`;
  get('score').textContent = String(spaceBattlePilotScoreFor(s));
  if (s.finished) {
    inFlight = false; input.enable(false); gunnerInput.enable(false); bomberInput.enable(false); spaceBomberInput.enable(false); lifeSupportInput.enable(false); show('results');
    get('outcome').textContent = s.endReason === 'time' ? 'Battle run complete.' : s.endReason === 'fuel' ? 'Fuel depleted.' : 'Hull depleted.';
    get('final-score').textContent = String(spaceBattlePilotScoreFor(s));
    get<HTMLTextAreaElement>('summary').value = spaceBattlePilotResultText(config, s);
    get('copy-status').textContent = ''; get('copy').focus();
  }
};
scene.onSpaceBomberStep = s => {
  get('time').textContent = `${Math.ceil(DURATION - s.elapsed)}s`;
  get('hull').textContent = `${s.hull} / 3`;
  get('score').textContent = String(spaceBattleBomberScoreFor(s));
  if (s.finished) {
    inFlight = false; input.enable(false); gunnerInput.enable(false); bomberInput.enable(false); spaceBomberInput.enable(false); lifeSupportInput.enable(false); show('results');
    get('outcome').textContent = s.hull > 0 ? 'Bombing run complete.' : 'Hull depleted.';
    get('final-score').textContent = String(spaceBattleBomberScoreFor(s));
    get<HTMLTextAreaElement>('summary').value = spaceBattleBomberResultText(config, s);
    get('copy-status').textContent = ''; get('copy').focus();
  }
};
}
get('copy').addEventListener('click', async () => {
  const summary = get<HTMLTextAreaElement>('summary');
  try { await navigator.clipboard.writeText(summary.value); get('copy-status').textContent = 'Copied. Share it with your GM.'; }
  catch { summary.focus(); summary.select(); get('copy-status').textContent = 'Report selected. Copy it manually, or take a screenshot.'; }
});
