import { MapViewState } from './view-state';
import { normalizeBackground } from './background';
import '../style.css';
import './galaxy.css';
import { activeMap, blankMap, deleteMap, libraryLocked, switchMap, advance, blankCampaign, challengeLink, demoCampaign, endJourney, insertEncounter, resolveEncounter, routeBetween, routeFor, scheduleEncounter, startJourney, uid, type Archive, type Campaign, type Destination, type Encounter, type EncounterTable, type Route } from './model';
import { importCampaigns, exportCampaign, parseArchive, readArchive, validateArchive, writeArchive } from './storage';

const root = document.querySelector<HTMLDivElement>('#app')!;
document.title = 'Galaxy Grown · Galaxy Map';
let archive: Archive;
let storageProblem = '';
let recovery = false;
try { archive = readArchive(localStorage) ?? initial(); }
catch (e) { archive = initial(); storageProblem = `Saved data could not be loaded: ${message(e)}. Existing storage has been preserved. Import a backup or explicitly replace it in GM preparation.`; recovery = true; }
function initial(): Archive { const c = demoCampaign(); return { version: 2, selected: c.id, campaigns: [c] }; }
const viewState = new MapViewState();
const failedArt = new Set<string>();
const artUrl = (name: string) => new URL(`art/${name}.webp`, document.baseURI).href;
function decoration(name: string, x: number, y: number, width: number, height: number, className: string) {
  const url = artUrl(name);
  return failedArt.has(url) ? '' : `<image class="${className}" data-art="${escape(url)}" href="${escape(url)}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="${className === 'map-scenery' ? 'xMidYMid slice' : 'xMidYMid meet'}" pointer-events="none" aria-hidden="true"/>`;
}
let preparing = false;
const failedBackgrounds = new Set<string>();
const visibleBackground = () => { const image = activeMap(campaign()).backgroundImage; return image && !failedBackgrounds.has(image) ? image : ''; };
let backgroundRequest = 0;
let selected = '';
let destinationListOpen = false;
let plotted: string[] = [];
let status = '';
let editor: 'destinations' | 'routes' | 'encounters' | 'tables' = 'destinations';
let editing = '';
const campaign = () => archive.campaigns.find(c => c.id === archive.selected)!;
const escape = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
function message(e: unknown) { return e instanceof Error ? e.message : String(e); }
const nameOf = (id: string) => activeMap(campaign()).destinations.find(d => d.id === id)?.name ?? 'Unknown';
const option = (value: string, label: string, current = '') => `<option value="${escape(value)}" ${value === current ? 'selected' : ''}>${escape(label)}</option>`;
const choices = (values: string[], current = '') => values.map(s => option(s, s, current)).join('');
const destOptions = (current = '') => activeMap(campaign()).destinations.filter(d => d.navigable !== false).map(d => option(d.id, d.name, current)).join('');
const encounterOptions = (current = '') => campaign().encounters.map(e => option(e.id, e.title, current)).join('');
function editorItems(c: Campaign) { return editor === 'destinations' || editor === 'routes' ? activeMap(c)[editor] : c[editor]; }
function editLocked() { return editor === 'encounters' || editor === 'tables' ? libraryLocked(campaign()) : activeTravel(); }
function resetSelection() { selected = ''; plotted = []; editing = ''; }
function browseMap(id: string) { change(c => { switchMap(c, id); resetSelection(); }); }
function persist() {
  if (recovery) return;
  try { writeArchive(localStorage, archive); storageProblem = ''; }
  catch (e) { storageProblem = `Changes are in memory only: ${message(e)}. Export a backup before leaving this page.`; }
}
function change(action: (c: Campaign) => void) {
  const previous = structuredClone(archive);
  try { action(campaign()); archive = validateArchive(archive); persist(); status = ''; }
  catch (e) { archive = previous; status = message(e); }
  render();
}
function field(name: string, label: string, value = '', type = 'text', extra = '') { return `<label>${label}<input name="${name}" type="${type}" value="${escape(value)}" ${extra}></label>`; }
function select(name: string, label: string, options: string) { return `<label>${label}<select name="${name}">${options}</select></label>`; }
function area(name: string, label: string, value = '') { return `<label>${label}<textarea name="${name}" rows="3">${escape(value)}</textarea></label>`; }
function form(id: string, content: string, button: string) { return `<form id="${id}" class="map-form">${content}<button class="primary">${button}</button></form>`; }
function activeTravel() { return !!activeMap(campaign()).journey && !activeMap(campaign()).journey!.arrived; }
function mapSvg() {
  const c = campaign(), j = activeMap(c).journey;
  const background = visibleBackground();
  const path = activeTravel() ? j!.stops : plotted.length ? plotted : j?.stops ?? [];
  const routeIsPlotted = (r: Route) => path.slice(1).some((s, i) => routeBetween(c, path[i], s)?.id === r.id);
  let marker = '';
  if (j && !j.arrived) {
    const a = activeMap(c).destinations.find(d => d.id === j.stops[j.leg])!, b = activeMap(c).destinations.find(d => d.id === j.stops[j.leg + 1])!;
    const t = j.step / routeFor(c).steps;
    marker = `<circle cx="${a.x + (b.x-a.x)*t}" cy="${a.y + (b.y-a.y)*t}" r="12" class="ship-marker"/><text x="${a.x + (b.x-a.x)*t}" y="${a.y + (b.y-a.y)*t-22}" class="ship-label">YOU</text>`;
  } else if (activeMap(c).location) {
    const d = activeMap(c).destinations.find(d => d.id === activeMap(c).location)!; marker = `<circle cx="${d.x}" cy="${d.y}" r="31" class="ship-marker"/>`;
  }
  return `<svg id="sector" class="${background?'illustrated-map':''}" viewBox="0 0 900 500" aria-label="${escape(activeMap(c).name)} destinations and travel routes" role="group"><defs><pattern id="stars" width="83" height="73" patternUnits="userSpaceOnUse"><circle cx="12" cy="18" r="1" fill="#91a4ca"/><circle cx="65" cy="53" r=".6" fill="#bba6ff"/></pattern></defs><rect width="900" height="500" fill="url(#stars)"/>${background?`<image id="map-background" href="${escape(background)}" x="0" y="0" width="900" height="500" preserveAspectRatio="xMidYMid meet" pointer-events="none" aria-hidden="true"/>`: decoration('space',0,0,900,500,'map-scenery')}${activeMap(c).decoration === 'orbits' ? '<g class="orbit-decoration" aria-hidden="true"><ellipse cx="450" cy="220" rx="330" ry="100"/><ellipse cx="450" cy="220" rx="390" ry="150"/></g>' : ''}
  ${activeMap(c).routes.map(r => { const a = activeMap(c).destinations.find(d => d.id === r.from)!, b = activeMap(c).destinations.find(d => d.id === r.to)!; return `<g><line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="${routeIsPlotted(r) ? 'plotted' : 'connection'}"/><text x="${(a.x+b.x)/2}" y="${(a.y+b.y)/2-9}" class="route-label">${r.steps} · ${r.risk}${r.provisional?' · proposal':''}</text></g>`; }).join('')}
  ${activeMap(c).destinations.map(d => `<g class="destination node-${d.type} ${d.navigable === false ? 'reference-marker' : ''} ${d.id === selected ? 'selected' : ''}" data-destination="${escape(d.id)}" tabindex="0" role="button" aria-pressed="${d.id === selected}" aria-label="Select ${escape(d.name)}${d.navigable === false ? ' — reference only' : ''}${d.id === activeMap(c).location ? ' — current location' : ''}"><circle cx="${d.x}" cy="${d.y}" r="${background ? ({planet:52,star:43,ship:40,station:30,system:40,point:21}[d.type]) : 23}"/><text x="${d.x}" y="${d.y+5}" class="node-symbol">${{planet:'●',ship:'▲',station:'◇',point:'✦',system:'◎',star:'☀'}[d.type]}</text>${!background ? decoration(({planet:'planet',ship:'player',station:'station',point:'star',system:'planet',star:'star'} as const)[d.type],d.x-21,d.y-21,42,42,'destination-art') : ''}${d.id === selected ? `<path class="selection-brackets" d="M${d.x-29} ${d.y-17}v-12h12 M${d.x+17} ${d.y-29}h12v12 M${d.x+29} ${d.y+17}v12h-12 M${d.x-17} ${d.y+29}h-12v-12"/>` : ''}<text x="${d.x}" y="${d.y+(background ? ({planet:73,star:64,ship:61,station:51,system:61,point:44}[d.type]) : 44)}" class="node-label">${escape(d.name)}</text></g>`).join('')}${marker}</svg>`;
}
function journeyPanel() {
  const c = campaign(), j = activeMap(c).journey;
  const e = c.encounters.find(e => e.id === j?.active);
  const progress = j ? `<p class="journey-progress">${j.arrived ? 'Arrived · ' : j.active ? 'Paused · ' : ''}Leg ${j.leg+1} of ${j.stops.length-1} · Step ${j.step} of ${routeFor(c).steps}</p>` : '';
  if (e) return `<section class="panel encounter-card" aria-labelledby="encounter-title"><p class="eyebrow">TRAVEL PAUSED · ${escape(e.type.toUpperCase())}</p><h2 id="encounter-title">${escape(e.title)}</h2>${progress}<p class="prompt">${escape(e.prompt)}</p>${e.type === 'VTT' ? '<p>Continue in your already-open Maps VTT session.</p>' : ''}${e.type === 'minigame' ? `<p>Players: open the challenge, choose your station and enter the GM-requested roll. Report your results to the GM.</p><label>Player challenge link<input id="challenge-link" readonly value="${escape(challengeLink(location.href, e.situation))}"></label><button id="copy-link">Copy challenge link</button>` : ''}${form('resolve', area('note','Outcome note (optional)'), 'Resolve and resume')}<p class="help">The GM decides all consequences. Resuming does not advance another step.</p></section>`;
  if (j && !j.arrived) return `<section class="panel"><p class="eyebrow">JOURNEY UNDERWAY</p><h2>${escape(nameOf(j.stops[j.leg]))} → ${escape(nameOf(j.stops[j.leg+1]))}</h2>${progress}<p>${routeFor(c).risk} risk</p><button id="advance" class="primary">Advance one step</button>${activeMap(c).location ? '<button id="end">End journey / replan here</button>' : ''}<p class="help">One encounter check per step. Travel waits for the GM.</p></section>`;
  return `<section class="panel"><p class="eyebrow">${j?.arrived ? 'COURSE COMPLETE' : 'PLOT YOUR COURSE'}</p><h2>${j?.arrived ? `Arrived at ${escape(nameOf(activeMap(c).location!))}` : 'Where to next?'}</h2><p>${activeMap(c).location ? `Current destination: ${escape(nameOf(activeMap(c).location!))}.` : 'Select your starting destination.'} Select connected stops to build a course.</p><ol>${plotted.map((s, i) => `<li>${escape(nameOf(s))}${i ? ` · ${routeBetween(c, plotted[i-1],s)!.steps} steps · ${routeBetween(c,plotted[i-1],s)!.risk} risk` : ''}</li>`).join('')}</ol><p>${plotted.slice(1).reduce((n,s,i) => n+routeBetween(c,plotted[i],s)!.steps,0)} total travel steps</p><div class="map-actions"><button id="confirm-course" class="primary" ${plotted.length<2 ? 'disabled' : ''}>Confirm course</button><button id="undo-stop" ${!plotted.length?'disabled':''}>Undo stop</button><button id="clear-course">Clear course</button></div></section>`;
}
function destinationPanel() {
  const d = activeMap(campaign()).destinations.find(d => d.id === selected);
  if (!d) return '<p class="help">Select a destination on the map or from the accessible list below.</p>';
  return `<section class="destination-detail"><p class="eyebrow">${escape(d.type)}</p><h2>${escape(d.name)}</h2><p>${escape(d.description)}</p><p class="help">Connections: ${activeMap(campaign()).routes.filter(r => r.from === d.id || r.to === d.id).map(r => `${escape(nameOf(r.from===d.id?r.to:r.from))} (${r.steps} steps, ${r.risk})`).join(' · ') || 'None'}</p>${d.navigable === false ? '<p class="help">Reference marker · unavailable for travel</p>' : !activeTravel() ? '<button id="add-stop">Add selected stop to course</button>' : ''}${d.detailMapId ? `<button id="open-detail">Open detail map</button>` : ''}</section>`;
}
function editorPanel() {
  const c = campaign();
  const item = editorItems(c).find(x => x.id === editing);
  let fields = '';
  if (editor === 'destinations') {
    const d = item as Destination | undefined;
    fields = field('name','Name',d?.name,'text','required maxlength="100"') + select('type','Type', choices(['planet','ship','station','point','system','star'],d?.type??'planet')) + field('x','X (40–860)',String(d?.x??450),'number','min="40" max="860" required') + field('y','Y (50–450)',String(d?.y??250),'number','min="50" max="450" required') + area('description','Player description',d?.description) + select('navigable','Travel access',option('yes','Travel destination',d?.navigable === false ? 'no' : 'yes') + option('no','Reference marker only',d?.navigable === false ? 'no' : 'yes')) + select('detailMapId','Linked detail map',option('','None',d?.detailMapId) + c.maps.filter(m => m.id !== c.activeMap).map(m => option(m.id,m.name,d?.detailMapId)).join(''));
  } else if (editor === 'routes') {
    const r = item as Route | undefined;
    fields = select('from','From',destOptions(r?.from)) + select('to','To',destOptions(r?.to)) + field('steps','Travel steps',String(r?.steps??1),'number','min="1" max="1000" required') + select('risk','Risk',choices(['Low','Medium','High'],r?.risk??'Medium')) + select('table','Encounter table',option('','None',r?.table)+c.tables.map(t=>option(t.id,t.name,r?.table)).join('')) + select('provisional','Route status',choices(['Established','Provisional proposal'],r?.provisional ? 'Provisional proposal' : 'Established'));
  } else if (editor === 'encounters') {
    const e = item as Encounter | undefined;
    fields = field('title','Title',e?.title,'text','required maxlength="100"') + select('type','Encounter type',choices(['narrative','VTT','minigame'],e?.type??'narrative')) + area('prompt','Revealed player prompt',e?.prompt) + area('notes','GM notes (preparation only)',e?.notes) + select('situation','Minigame situation',option('asteroid-field','Asteroid Field',e?.situation??'asteroid-field')+option('space-battle','Space Battle',e?.situation));
  } else {
    const t = item as EncounterTable | undefined;
    fields = field('name','Table name',t?.name,'text','required maxlength="100"') + '<p class="help">Weight 0 excludes a card. Positive weights control its relative chance after a successful risk roll.</p>' + c.encounters.map(e => field(`weight:${e.id}`,escape(e.title),String(t?.entries.find(x=>x.encounter===e.id)?.weight??0),'number','min="0" max="1000000" required')).join('');
  }
  return `<section class="panel"><h2>Sector editor</h2><p class="help">Map editing is locked during its journey; shared libraries are locked while any map has a journey. End at a destination before editing. For position placement, select Destinations then click empty map space.</p><label>Edit category<select id="editor-kind">${choices(['destinations','routes','encounters','tables'],editor)}</select></label><fieldset ${editLocked()?'disabled':''}><label>Edit existing<select id="editor-item">${option('','＋ Create new',editing)}${editorItems(c).map(x=>option(x.id,'name' in x? x.name : 'title' in x? x.title : `${nameOf(x.from)} ↔ ${nameOf(x.to)}`,editing)).join('')}</select></label>${form('editor',fields,editing?'Save changes':'Create')}<button id="delete-item" ${!editing?'disabled':''}>Delete selected item</button></fieldset></section>`;
}
function prepPanel() {
  const c = campaign(), j = activeMap(c).journey;
  const warnings = activeMap(c).routes.filter(r=>!c.tables.find(t=>t.id===r.table)?.entries.length);
  return `<section class="prep-area"><p class="eyebrow">GM PREPARATION · LOCAL TO THIS BROWSER</p><p class="help">Leave screen sharing before preparing surprises. Presentation hides this content; it is not password protected. Export backups before clearing browser data or changing devices.</p>
  <div class="prep-grid"><section class="panel"><h2>Campaign saves</h2><label>Active campaign<select id="campaign-select">${archive.campaigns.map(c=>option(c.id,c.name,archive.selected)).join('')}</select></label>${form('rename',field('name','Campaign name',c.name,'text','required maxlength="100"'),'Rename campaign')}${form('new-campaign',field('name','New campaign name','','text','required maxlength="100"')+select('starter','Start from',choices(['Demo sector','Blank map'])),'Create campaign')}<button id="delete-campaign">Delete this campaign</button><button id="export">Export this campaign</button><label>Import campaign backup (adds independent copies)<input id="import" type="file" accept=".json,application/json"></label>${recovery?'<button id="recover">Replace unreadable browser save with current in-memory campaigns</button>':''}</section>
  ${mapPreparation()}
  ${editorPanel()}
  <section class="panel"><h2>Encounter control</h2>${j && !j.arrived ? `<fieldset ${j.active?'disabled':''}>${form('insert',select('encounter','Insert now',encounterOptions()),'Insert encounter now')}</fieldset><p class="help">Only available when no encounter is active. Scheduling targets this confirmed course, including repeated route occurrences.</p>${form('schedule',select('encounter','Scheduled encounter',encounterOptions())+select('leg','Course leg',j.stops.slice(1).map((s,i)=>option(String(i),`${i+1}: ${nameOf(j.stops[i])} → ${nameOf(s)}`)).join(''))+field('step','Step within leg','1','number','min="1" required'),'Schedule encounter')}<ul>${activeMap(c).schedules.map(s=>`<li>Leg ${s.leg+1}, step ${s.step}: ${escape(c.encounters.find(e=>e.id===s.encounter)!.title)} ${s.consumed?'(revealed)':`<button data-remove-schedule="${escape(s.id)}">Remove</button>`}</li>`).join('')}</ul>` : '<p>Confirm a course to insert or schedule encounters.</p>'}
  ${j?.active ? `<h3>Active encounter GM notes</h3><p class="prompt">${escape(c.encounters.find(e=>e.id===j.active)?.notes)}</p>`:''}<h3>Route warnings</h3><p class="help">${warnings.length ? warnings.map(r=>`${escape(nameOf(r.from))} ↔ ${escape(nameOf(r.to))}: no usable encounter table`).join('<br>') : 'All routes have usable tables.'}</p><p class="help">Provisional risk per step: Low 10%, Medium 25%, High 50%. Scheduled encounters replace the random check.</p></section>
  <section class="panel"><h2>Journey log</h2><ol>${activeMap(c).log.map(line=>`<li>${escape(line)}</li>`).join('')}</ol></section></div></section>`;
}
function mapNavigation() {
  const c = campaign(), m = activeMap(c);
  const parents = c.maps.filter(parent => parent.destinations.some(d => d.detailMapId === m.id));
  return `<nav class="map-navigation" aria-label="Campaign maps"><label>Viewing map<select id="map-select">${c.maps.map(map=>option(map.id,map.name,c.activeMap)).join('')}</select></label>${parents.map(parent=>`<button data-open-map="${escape(parent.id)}">Back to ${escape(parent.name)}</button>`).join('')}<p class="help">Browsing changes the view only. Each map keeps its own travel state.</p></nav>`;
}
function mapPreparation() {
  const m = activeMap(campaign());
  return `<section class="panel"><h2>Maps in this campaign</h2>${form('new-map',field('name','New map name','','text','required maxlength="100"'),'Create map')}<fieldset ${activeTravel()?'disabled':''}>${form('map-metadata',field('name','Map name',m.name,'text','required maxlength="100"')+area('description','Map description / limitations',m.description)+select('decoration','Decoration',choices(['none','orbits'],m.decoration)),'Save map details')}<label>Upload background<input id="background-upload" type="file" accept="image/png,image/jpeg,image/webp"></label><button id="remove-background" ${!m.backgroundImage?'disabled':''}>Remove background</button><p class="help">Use a text-free image aligned to your destinations. Images fit a 9:5 map with padding when needed; exports include the artwork. Uploads: PNG, JPEG or WebP under 10 MB; saved images: up to 750 KB.</p></fieldset><button id="delete-map">Delete this map</button><p class="help">Remove incoming destination links before deleting a map. Export includes every map and its journey.</p></section>`;
}
function render() {
  const focus = viewState.capture(root);
  const c = campaign();
  root.innerHTML = `<header><a href="./" class="brand">✦ <span>GALAXY GROWN</span></a><span class="tag">GALAXY MAP · PROTOTYPE</span></header><nav class="surface-nav" aria-label="App sections"><a href="./">Flight Deck</a><a href="#/map" aria-current="page">Galaxy Map</a></nav><main class="galaxy-main"><div class="map-heading"><div><p class="eyebrow">CHART YOUR NEXT CHAPTER</p><h1 id="map-title" tabindex="-1">${escape(c.name)}</h1></div><button id="toggle-prep">${preparing?'Present to players':'GM preparation'}</button></div><p class="help">Browser-local saves · Abstract travel steps · GM-controlled encounters</p>${mapNavigation()}<p class="prompt map-description">${escape(activeMap(c).description)}</p><p id="map-status" role="status" aria-live="polite">${escape(status)}</p>${storageProblem?`<p class="storage-error" role="alert">${escape(storageProblem)}</p>`:''}<div class="map-layout"><section class="map-board"><div class="map-canvas">${mapSvg()}</div><p class="map-legend"><span>⌜ ⌟ Selected</span><span>○ Current location / travel position</span><span>◌ Reference only</span><span>━ Plotted course</span></p><p class="help map-pan-hint">Swipe the map sideways, or choose a stop from the destination list.</p><details id="destination-picker" ${destinationListOpen?'open':''}><summary>Destination list</summary><div class="destination-list">${activeMap(c).destinations.map(d=>`<button data-destination="${escape(d.id)}" aria-pressed="${d.id === selected}">${escape(d.name)}${d.id === activeMap(c).location ? ' · Here' : ''}${d.navigable === false ? ' · Reference' : ''}</button>`).join('') || '<p>No destinations yet. Open GM preparation to create one.</p>'}</div></details>${destinationPanel()}</section><aside data-focus-region="journey">${journeyPanel()}</aside></div>${preparing?prepPanel():''}</main><footer>One crew. A galaxy of possibilities.<span>Layouts are schematic. Travel risk and minigame scoring are provisional.</span></footer>`;
  bind();
  viewState.restore(root, c.id, c.activeMap, focus);
}
function on(id: string, fn: () => void) { document.getElementById(id)?.addEventListener('click', fn); }
function submit(id: string, fn: (f: FormData) => void) { document.getElementById(id)?.addEventListener('submit', e => { e.preventDefault(); try { fn(new FormData(e.currentTarget as HTMLFormElement)); } catch(e) { status=message(e);render(); } }); }
function download(text: string, filename: string) { const url=URL.createObjectURL(new Blob([text],{type:'application/json'})); const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
function addStop() {
  const c=campaign();
  if (activeTravel() || !activeMap(c).destinations.some(d => d.id === selected && d.navigable !== false)) return;
  if (!plotted.length && activeMap(c).location && selected!==activeMap(c).location) { status='Start at your current destination.';render();return; }
  if (plotted.length && !routeBetween(c,plotted.at(-1)!,selected)) { status='That stop is not connected to the last stop in your course.';render();return; }
  plotted.push(selected);status='';render();
}
function bind() {
  root.querySelectorAll<SVGImageElement>('[data-art]').forEach(image => {
    image.addEventListener('load', () => image.closest('.destination')?.classList.add('art-loaded'));
    image.addEventListener('error', () => { failedArt.add(image.dataset.art!); image.closest('.destination')?.classList.remove('art-loaded'); image.remove(); });
  });
  document.getElementById('map-background')?.addEventListener('error',e=>{
    const image=(e.currentTarget as SVGImageElement).getAttribute('href');
    if(!image)return;
    failedBackgrounds.add(image);
    if(activeMap(campaign()).backgroundImage!==image)return;
    status='Background could not be displayed. The schematic map remains usable; re-upload or remove the image in GM preparation.';
    render();
  });
  document.getElementById('background-upload')?.addEventListener('change',async e=>{
    const file=(e.target as HTMLInputElement).files?.[0];if(!file)return;
    const campaignId=campaign().id,mapId=campaign().activeMap,request=++backgroundRequest;
    try {
      if(activeTravel())throw Error('End this map’s journey before changing its background.');
      const image=await normalizeBackground(file);
      if(request!==backgroundRequest)return;
      if(campaign().id!==campaignId || campaign().activeMap!==mapId)throw Error('Map changed while preparing the image. Select the intended map and upload again.');
      change(c=>{if(activeTravel())throw Error('End this map’s journey before changing its background.');failedBackgrounds.delete(image);activeMap(c).backgroundImage=image;});
    } catch(e) { if(request===backgroundRequest){status=message(e);render();} }
  });
  on('remove-background',()=>{backgroundRequest++;change(c=>{if(activeTravel())throw Error('End this map’s journey before changing its background.');delete activeMap(c).backgroundImage;});});
  document.getElementById('destination-picker')?.addEventListener('toggle',e=>{destinationListOpen=(e.currentTarget as HTMLDetailsElement).open;});
  document.getElementById('map-select')?.addEventListener('change',e=>browseMap((e.target as HTMLSelectElement).value));
  document.querySelectorAll<HTMLElement>('[data-open-map]').forEach(el=>el.addEventListener('click',()=>browseMap(el.dataset.openMap!)));
  on('open-detail',()=>{const d=activeMap(campaign()).destinations.find(d=>d.id===selected);if(d?.detailMapId)browseMap(d.detailMapId);});
  submit('new-map',f=>change(c=>{const m=blankMap(String(f.get('name')).trim());c.maps.push(m);switchMap(c,m.id);resetSelection();}));
  submit('map-metadata',f=>change(c=>{if(activeTravel())throw Error('End this map’s journey before editing.');const m=activeMap(c);m.name=String(f.get('name')).trim();m.description=String(f.get('description')).trim();m.decoration=String(f.get('decoration')) as typeof m.decoration;}));
  on('delete-map',()=>{if(confirm('Delete this map? Export a backup first.'))change(c=>{deleteMap(c,c.activeMap);resetSelection();});});
  on('toggle-prep',()=>{preparing=!preparing;status='';render();});
  document.querySelectorAll<HTMLElement>('[data-destination]').forEach(el=>{
    const choose=()=>{selected=el.dataset.destination!;status='';render();}; el.addEventListener('click',choose); el.addEventListener('keydown',e=>{if(el.tagName.toLowerCase() !== 'button' && (e.key==='Enter'||e.key===' ')){e.preventDefault();choose();}});
  });
  document.getElementById('sector')?.addEventListener('click',e=>{
    if(!preparing || editor!=='destinations' || activeTravel() || (e.target as Element).closest('[data-destination]')) return;
    const svg=e.currentTarget as SVGSVGElement, pt=svg.createSVGPoint();pt.x=(e as MouseEvent).clientX;pt.y=(e as MouseEvent).clientY;
    const matrix=svg.getScreenCTM();if(!matrix)return;const p=pt.matrixTransform(matrix.inverse());
    const f=document.getElementById('editor') as HTMLFormElement;
    (f.elements.namedItem('x') as HTMLInputElement).value=String(Math.round(Math.max(40,Math.min(860,p.x))));
    (f.elements.namedItem('y') as HTMLInputElement).value=String(Math.round(Math.max(50,Math.min(450,p.y))));
  });
  on('add-stop',addStop);on('clear-course',()=>{plotted=[];render();});on('undo-stop',()=>{plotted.pop();render();});
  on('confirm-course',()=>change(c=>{startJourney(c,plotted);plotted=[];}));on('advance',()=>change(advance));on('end',()=>change(c=>{endJourney(c);plotted=[];}));
  submit('resolve',f=>change(c=>resolveEncounter(c,String(f.get('note')??''))));
  on('copy-link',async()=>{const input=document.getElementById('challenge-link') as HTMLInputElement;try{await navigator.clipboard.writeText(input.value);document.getElementById('map-status')!.textContent='Challenge link copied.';}catch{input.focus();input.select();document.getElementById('map-status')!.textContent='Select and copy the challenge link manually.';}});
  document.getElementById('campaign-select')?.addEventListener('change',e=>{archive.selected=(e.target as HTMLSelectElement).value;selected='';plotted=[];editing='';persist();render();});
  submit('rename',f=>change(c=>{c.name=String(f.get('name')).trim();}));
  submit('new-campaign',f=>change(()=>{const c=f.get('starter')==='Demo sector'?demoCampaign(String(f.get('name')).trim()):blankCampaign(String(f.get('name')).trim());archive.campaigns.push(c);archive.selected=c.id;plotted=[];selected='';editing='';}));
  on('delete-campaign',()=>{if(!confirm('Delete this campaign and its journey? Export a backup first.'))return;change(c=>{archive.campaigns=archive.campaigns.filter(x=>x.id!==c.id);if(!archive.campaigns.length)archive.campaigns.push(blankCampaign('New campaign'));archive.selected=archive.campaigns[0].id;plotted=[];selected='';editing='';});});
  on('export',()=>download(exportCampaign(campaign()),'galaxy-campaign.json'));
  document.getElementById('import')?.addEventListener('change',async e=>{try{const file=(e.target as HTMLInputElement).files?.[0];if(!file)return;if(file.size>10000000)throw Error('Save is too large (10 MB maximum).');const imported=parseArchive(await file.text());change(()=>{archive=importCampaigns(archive,imported);plotted=[];selected='';editing='';});}catch(e){status=`Import failed: ${message(e)} Existing saves were preserved.`;render();}});
  on('recover',()=>{if(confirm('Replace the unreadable browser save? Your in-memory campaigns will be saved.')){recovery=false;persist();render();}});
  document.getElementById('editor-kind')?.addEventListener('change',e=>{editor=(e.target as HTMLSelectElement).value as typeof editor;editing='';render();});
  document.getElementById('editor-item')?.addEventListener('change',e=>{editing=(e.target as HTMLSelectElement).value;render();});
  submit('editor',f=>change(c=>{
    if(editLocked())throw Error('End the affected journeys before editing.');
    if(activeMap(c).journey?.arrived) endJourney(c);
    const str=(key:string)=>String(f.get(key)??'').trim(); const id=editing||uid();let item: Destination|Route|Encounter|EncounterTable;
    if(editor==='destinations')item={id,name:str('name'),type:str('type') as Destination['type'],x:Number(f.get('x')),y:Number(f.get('y')),description:str('description'),navigable:str('navigable')!=='no',...(str('detailMapId')?{detailMapId:str('detailMapId')}:{})};
    else if(editor==='routes')item={id,from:str('from'),to:str('to'),steps:Number(f.get('steps')),risk:str('risk') as Route['risk'],table:str('table'),provisional:str('provisional')==='Provisional proposal'};
    else if(editor==='encounters')item={id,title:str('title'),prompt:str('prompt'),notes:str('notes'),type:str('type') as Encounter['type'],situation:str('situation') as Encounter['situation']};
    else item={id,name:str('name'),entries:c.encounters.map(e=>({encounter:e.id,weight:Number(f.get(`weight:${e.id}`))})).filter(e=>e.weight!==0)};
    const items=editorItems(c) as (typeof item)[];const i=items.findIndex(x=>x.id===id);if(i>=0)items[i]=item;else items.push(item);editing=id;plotted=[];
  }));
  on('delete-item',()=>{if(!confirm('Delete selected item? Referenced items must be disconnected first.'))return;change(c=>{
    if(editLocked())throw Error('End the affected journeys before editing.');
    // Completed journeys retain references. End them before deleting their data.
    if(activeMap(c).journey){endJourney(c);}
    if(editor==='destinations' && activeMap(c).location===editing)throw Error('Cannot delete the current destination.');
    if(editor==='tables')c.maps.forEach(m=>m.routes.forEach(r=>{if(r.table===editing)r.table='';}));
    const items=editorItems(c);items.splice(items.findIndex(x=>x.id===editing),1);editing='';selected='';plotted=[];
  });});
  submit('insert',f=>change(c=>insertEncounter(c,String(f.get('encounter')))));
  submit('schedule',f=>change(c=>scheduleEncounter(c,Number(f.get('leg')),Number(f.get('step')),String(f.get('encounter')))));
  document.querySelectorAll<HTMLElement>('[data-remove-schedule]').forEach(el=>el.addEventListener('click',()=>change(c=>{activeMap(c).schedules=activeMap(c).schedules.filter(s=>s.id!==el.dataset.removeSchedule || s.consumed);} )));
}
render();
