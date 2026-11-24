import { surfaceNavigation } from '../site-navigation';
import '../style.css';
import './tanks.css';
import { active, createMatch, defaultDirection, DEFAULT_ELEVATION, DEFAULT_POWER, drive, fire, nextSurvivor, TANK_WIDTH, type Aim, type Match } from './rules';
import { BATTLEFIELDS, type Battlefield } from './terrain';
import { battlefield, COLORS } from './scene';

document.title = 'Galaxy Grown · Hillside Tanks';
const root = document.querySelector<HTMLElement>('#app')!;
root.innerHTML = `<header><a href="./" class="brand">✦ <span>GALAXY GROWN</span></a></header>
${surfaceNavigation('Tanks')}
<main class="tanks"><h1>Hillside Tanks</h1>
<section id="tank-setup"><p>Share this window with the table. Each player calls their move, direction, angle and power. Last tank standing wins.</p>
<form><label>Battlefield <select id="battlefield"></select></label><label>Players <select id="count"></select></label><div id="seats"></div>
<button class="primary">Start match</button></form></section>
<section id="tank-match" hidden><div class="tank-heading"><h2 id="turn"></h2><button id="pause-tanks">Pause</button></div>
<div id="hills" role="img" aria-label="Shared battlefield with numbered tanks"></div>
<p id="report" role="status"></p>
<fieldset id="station"><legend>Shot controls</legend>
<div class="tank-controls"><div><span>Drive · <b id="distance"></b></span><div><button id="left">Drive left</button> <button id="right">Drive right</button></div></div>
<label>Direction<select id="direction"><option value="-1">Left</option><option value="1">Right</option></select></label>
<label>Elevation · <output for="angle" id="degrees"></output><input id="angle" type="range" min="10" max="90" step="1"></label>
<label>Power · <output for="power" id="percent"></output><input id="power" type="range" min="1" max="100" step="1"></label>
<label>Ammo<select id="ammo"><option value="standard">Plasma bolt</option><option value="heavy">Heavy shell</option><option value="starburst">Starburst</option></select></label>
<button id="shoot" class="primary">Fire</button></div></fieldset>
<div id="finished" hidden><button id="rematch" class="primary">Rematch</button> <button id="setup-again">Change players</button></div>
<h3>Turn order</h3><ol id="roster"></ol><p id="stock"></p></section></main>`;
function el<T extends HTMLElement = HTMLElement>(id: string) { return document.getElementById(id) as T; }
const count = el<HTMLSelectElement>('count'), seats = el('seats');
const mapSelect = el<HTMLSelectElement>('battlefield');
for (const [id, name] of Object.entries(BATTLEFIELDS)) mapSelect.add(new Option(name, id));
const names = ['DM', 'Player 2', 'Player 3', 'Player 4', 'Player 5', 'Player 6', 'Player 7', 'Player 8'];
let dm = 0;
for (let n = 2; n <= 8; n++) count.add(new Option(String(n),String(n)));
count.value = '3';
function drawSeats() {
  seats.replaceChildren();
  if (dm >= Number(count.value)) dm = 0;
  names.slice(0,Number(count.value)).forEach((name,i) => {
    const row = document.createElement('div'), label = document.createElement('label');
    label.textContent = 'Tank ' + (i+1);
    const input = document.createElement('input');
    input.type = 'text'; input.required = true; input.maxLength = 22; input.value = name;
    input.setCustomValidity(name.trim() ? '' : 'Enter a player name.');
    input.addEventListener('input', () => {
      names[i] = input.value; input.setCustomValidity(input.value.trim() ? '' : 'Enter a player name.');
    });
    label.append(input);
    const owner = document.createElement('label'), radio = document.createElement('input');
    radio.type = 'radio'; radio.name = 'dm'; radio.checked = i === dm;
    radio.addEventListener('change', () => { dm = i; });
    owner.append(radio, ' DM rival'); row.append(label,owner); seats.append(row);
  });
}
drawSeats();
count.onchange = drawSeats;
let match: Match, game: ReturnType<typeof battlefield> | undefined, paused = false;
const aim: Aim = {direction:1,angle:DEFAULT_ELEVATION,power:DEFAULT_POWER,ammo:'standard'};
const direction = el<HTMLSelectElement>('direction'), ammo = el<HTMLSelectElement>('ammo');
const angle = el<HTMLInputElement>('angle'), power = el<HTMLInputElement>('power');
function readAim() {
  aim.angle = Number(angle.value); aim.power = Number(power.value);
  aim.direction = direction.value === '-1' ? -1 : 1; aim.ammo = ammo.value as Aim['ammo'];
  el('degrees').textContent = aim.angle + '°'; el('percent').textContent = aim.power + '%';
}
function restoreAim() {
  const tank = match.tanks[active(match)];
  direction.value = String(defaultDirection(match, tank));
  angle.value = String(tank.angle);
  power.value = String(tank.power);
  ammo.value = 'standard';
  readAim();
}
for (const input of [angle,power,ammo,direction]) input.oninput = readAim;
function refresh() {
  const id = active(match), player = match.tanks[id], over = match.phase === 'over';
  const winner = match.tanks.find(t => t.hull > 0);
  el('turn').textContent = over ? (winner ? winner.name + ' wins' : 'Draw — all tanks eliminated') :
    paused ? 'Match paused' : (id + 1) + ' · ' + player.name + (match.phase === 'shot' ? ' · shot in flight' : '’s turn');
  const next = 'Up next · ' + match.tanks[match.order[nextSurvivor(match)]].name;
  const report = paused ? 'Resume to continue this turn.' : over ? match.report :
    match.phase === 'aim' && match.report ? match.report + ' · ' + next : next;
  const status = el('report');
  if (status.textContent !== report) status.textContent = report;
  el<HTMLFieldSetElement>('station').disabled = paused || match.phase !== 'aim';
  el('station').hidden = over;
  el('finished').hidden = !over; el('pause-tanks').hidden = over;
  el('pause-tanks').textContent = paused ? 'Resume' : 'Pause';
  el('distance').textContent = (match.drive / TANK_WIDTH) + ' lengths left';
  ammo.options[1].disabled = id !== dm || !match.heavy;
  ammo.options[2].disabled = id !== dm || !match.starburst;
  el('stock').textContent = match.tanks[dm].name + ' · DM arsenal · ' + match.heavy + ' heavy · ' + match.starburst + ' starburst';
  const roster = el('roster');
  roster.replaceChildren(...match.order.map(i => {
    const tank = match.tanks[i], li = document.createElement('li');
    li.style.setProperty('--tank-color','#'+COLORS[i].toString(16).padStart(6,'0'));
    li.classList.toggle('current',i === id && !over); li.classList.toggle('out',!tank.hull);
    li.textContent = (i+1) + ' · ' + tank.name + (i === dm ? ' (DM)' : '') + ' · ' + (tank.hull ? tank.hull + '/3' : 'Out');
    return li;
  }));
}
function start() {
  game?.destroy(true);
  const map = mapSelect.value as Battlefield;
  match = createMatch(names.slice(0,Number(count.value)), dm, crypto.getRandomValues(new Uint32Array(1))[0], map);
  const planetary = map === 'planets';
  el('hills').setAttribute('aria-label', BATTLEFIELDS[map] + ' battlefield with numbered tanks');
  el('left').textContent = planetary ? '↶ Drive' : 'Drive left';
  el('right').textContent = planetary ? 'Drive ↷' : 'Drive right';
  el('left').setAttribute('aria-label', planetary ? 'Drive counterclockwise' : 'Drive left');
  el('right').setAttribute('aria-label', planetary ? 'Drive clockwise' : 'Drive right');
  direction.options[0].text = planetary ? '↶ CCW' : 'Left';
  direction.options[1].text = planetary ? '↷ CW' : 'Right';
  direction.options[0].setAttribute('aria-label', planetary ? 'Counterclockwise' : 'Left');
  direction.options[1].setAttribute('aria-label', planetary ? 'Clockwise' : 'Right');
  paused = false;
  restoreAim();
  el('tank-setup').hidden = true; el('tank-match').hidden = false;
  window.scrollTo(0, 0);
  refresh();
  game = battlefield(el('hills'),match,aim,() => paused,() => {
    if (match.phase === 'aim') restoreAim();
    refresh();
    el(match.phase === 'over' ? 'rematch' : 'left').focus({preventScroll:true});
  });
  el('left').focus({preventScroll:true});
}
root.querySelector('form')!.onsubmit = e => { e.preventDefault(); start(); };
for (const [id,d] of [['left',-1],['right',1]] as const) el(id).onclick = () => { drive(match,d); refresh(); };
el('shoot').onclick = () => { fire(match,aim); refresh(); };
el('pause-tanks').onclick = () => { paused = !paused; refresh(); };
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game && match.phase !== 'over') { paused = true; refresh(); }
});
el('rematch').onclick = start;
el('setup-again').onclick = () => {
  game?.destroy(true); game = undefined;
  el('tank-match').hidden = true; el('tank-setup').hidden = false; count.focus();
};
