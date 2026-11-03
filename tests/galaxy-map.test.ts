import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advance, blankCampaign, challengeLink, demoCampaign, endJourney, insertEncounter, resolveEncounter, routeFor, scheduleEncounter, startJourney, weightedEncounter, type Archive } from '../src/galaxy/model.ts';
import { exportCampaign, parseArchive, readArchive, validateArchive, writeArchive } from '../src/galaxy/storage.ts';
const wrap = (c = demoCampaign()): Archive => ({ version: 1, selected: c.id, campaigns: [c] });

test('connected course supports bidirectional routes, rejects missing and disconnected stops', () => {
  const c=demoCampaign();
  assert.throws(()=>startJourney(c,['haven','blue']));assert.throws(()=>startJourney(c,['absent','haven']));
  startJourney(c,['cinder','haven']);assert.equal(routeFor(c).steps,2);
  assert.throws(()=>startJourney(c,['haven','cinder']));
});
test('clear passage advances through multiple legs; arrival needs exact steps',()=>{
  const c=demoCampaign();startJourney(c,['haven','cinder','echo']);
  advance(c,()=>.99);assert.equal(c.journey!.step,1);assert.equal(c.location,null);
  advance(c,()=>.99);assert.equal(c.location,'cinder');assert.equal(c.journey!.leg,1);assert.equal(c.journey!.step,0);
  endJourney(c);startJourney(c,['cinder','echo']);for(let i=0;i<3;i++)advance(c,()=>.99);
  assert.equal(c.journey!.arrived,true);assert.equal(c.location,'echo');assert.throws(()=>advance(c));
  assert.throws(()=>startJourney(c,['haven','cinder']));
});
test('risk boundaries and weighted selection are exact',()=>{
  for(const [risk,p] of [['Low',.1],['Medium',.25],['High',.5]] as const){
    for(const [roll,expected] of [[p-.0001,true],[p,false]] as const){const c=demoCampaign();c.routes[0].risk=risk;startJourney(c,['haven','cinder']);let n=0;advance(c,()=>n++?0:roll);assert.equal(!!c.journey!.active,expected);}
  }
  const t={id:'t',name:'t',entries:[{encounter:'a',weight:1},{encounter:'b',weight:3}]};
  assert.equal(weightedEncounter(t,()=>.249),'a');assert.equal(weightedEncounter(t,()=>.25),'b');assert.equal(weightedEncounter(t,()=>.999),'b');
  assert.equal(weightedEncounter(undefined,()=>0),null);assert.equal(weightedEncounter({...t,entries:[]},()=>0),null);
});
test('scheduled final-step encounter replaces random check and gates arrival',()=>{
  const c=demoCampaign();startJourney(c,['haven','cinder']);scheduleEncounter(c,0,2,'rocks');
  advance(c,()=>.99);advance(c,()=>{throw Error('must not roll');});
  assert.equal(c.journey!.active,'rocks');assert.equal(c.journey!.arrived,false);assert.equal(c.location,null);
  assert.throws(()=>advance(c));assert.throws(()=>insertEncounter(c,'signal'));assert.throws(()=>endJourney(c));
  resolveEncounter(c,'Crew reported; GM decided.');assert.equal(c.location,'cinder');assert.equal(c.journey!.arrived,true);assert.match(c.log.at(-2)!,/Crew reported/);
  assert.throws(()=>resolveEncounter(c,''));
});
test('schedules target route occurrences; invalid, duplicate and past steps rejected',()=>{
  const c=demoCampaign();startJourney(c,['haven','cinder','haven']);scheduleEncounter(c,1,1,'signal');
  assert.throws(()=>scheduleEncounter(c,1,1,'rocks'));assert.throws(()=>scheduleEncounter(c,5,1,'rocks'));assert.throws(()=>scheduleEncounter(c,0,3,'rocks'));assert.throws(()=>scheduleEncounter(c,0,1,'missing'));
  advance(c,()=>.99);assert.throws(()=>scheduleEncounter(c,0,1,'rocks'));advance(c,()=>.99);advance(c,()=>.99);
  assert.equal(c.journey!.active,'signal');assert.equal(c.schedules[0].consumed,true);
});
test('immediate VTT encounter pauses at departure and resumes without advancing',()=>{
  const c=demoCampaign();startJourney(c,['haven','cinder']);insertEncounter(c,'boarding');
  assert.equal(c.journey!.step,0);assert.throws(()=>advance(c));resolveEncounter(c,'');assert.equal(c.journey!.step,0);assert.equal(c.location,'haven');
  endJourney(c);assert.equal(c.journey,null);assert.deepEqual(c.schedules,[]);
});
test('missing/empty tables never create an encounter',()=>{
  for(const table of ['', 'missing','demo-table']){const c=demoCampaign();c.routes[0].table=table;c.tables[0].entries=[];startJourney(c,['haven','cinder']);advance(c,()=>0);assert.equal(c.journey!.active,null);validateArchive(wrap(c));}
});
test('reload round trip preserves consumed check and active encounter without rerolling',()=>{
  const c=demoCampaign();startJourney(c,['haven','cinder']);scheduleEncounter(c,0,1,'rocks');advance(c,()=>0);
  let raw='';const storage={getItem:()=>raw||null,setItem:(_k:string,v:string)=>{raw=v;}};
  writeArchive(storage,wrap(c));const restored=readArchive(storage)!.campaigns[0];assert.deepEqual(restored,c);assert.throws(()=>advance(restored));
  resolveEncounter(restored,'done');advance(restored,()=>.99);assert.equal(restored.journey!.arrived,true);assert.equal(restored.log.filter(x=>x.includes('step 1:')).length,1);
});
test('campaigns and exported backup copies are independent',()=>{
  const a=demoCampaign('CSC'),b=blankCampaign('DD');const archive=wrap(a);archive.campaigns.push(b);
  const copy=validateArchive(archive);startJourney(copy.campaigns[0],['haven','cinder']);advance(copy.campaigns[0],()=>.99);
  assert.equal(copy.campaigns[1].journey,null);assert.equal(a.journey,null);
  const exported=parseArchive(exportCampaign(copy.campaigns[0]));assert.equal(exported.campaigns.length,1);assert.deepEqual(exported.campaigns[0],copy.campaigns[0]);
});
test('malformed imports rejected: versions, references, geometry, weights and progress',()=>{
  const mutations=[
    (a:any)=>a.version=2,(a:any)=>a.selected='absent',(a:any)=>a.campaigns[0].routes[0].from='absent',
    (a:any)=>a.campaigns[0].destinations[0].x=Infinity,(a:any)=>a.campaigns[0].destinations.push(a.campaigns[0].destinations[0]),
    (a:any)=>a.campaigns[0].tables[0].entries[0].weight=-1,(a:any)=>a.campaigns[0].tables[0].entries[0].encounter='absent',
    (a:any)=>a.campaigns[0].routes[0].steps=0,(a:any)=>a.campaigns[0].routes.push({...a.campaigns[0].routes[0],id:'duplicate'}),
    (a:any)=>a.campaigns[0].log=[{}],(a:any)=>a.campaigns[0].journey={stops:['haven','cinder'],leg:0,step:2,active:null,arrived:false},
  ];
  for(const mutate of mutations){const a=wrap();mutate(a);assert.throws(()=>validateArchive(a));}
  assert.throws(()=>parseArchive('{bad'));assert.throws(()=>parseArchive(' '.repeat(10000001)));
});
test('storage errors propagate and invalid archives never replace existing data',()=>{
  const denied={getItem:()=>{throw Error('denied');},setItem:()=>{throw Error('quota');}};
  assert.throws(()=>readArchive(denied),/denied/);assert.throws(()=>writeArchive(denied,wrap()),/quota/);
  let raw=exportCampaign(demoCampaign());const before=raw;const storage={getItem:()=>raw,setItem:(_k:string,v:string)=>raw=v};
  const invalid=wrap();invalid.campaigns[0].name='';assert.throws(()=>writeArchive(storage,invalid));assert.equal(raw,before);
});
test('share links contain only approved situation; no hash or campaign/private query',()=>{
  const url=new URL(challengeLink('https://example.com/galaxy-grown-games/?secret=hidden#/map','asteroid-field'));
  assert.equal(url.pathname,'/galaxy-grown-games/');assert.equal(url.search,'?situation=asteroid-field');assert.equal(url.hash,'');
  assert.equal(new URL(challengeLink(url.href,'space-battle')).search,'?situation=space-battle');
});
