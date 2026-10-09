import test from 'node:test';
import assert from 'node:assert/strict';
import {beforeSources,currentSources,monthlyHarness,monthlyFixture,visualCommitHarness} from '../scripts/r92-performance-check.mjs';

// Direct execution of old/current production functions with fictional inputs
// and plain callback spies. No application boot, browser or DOM emulator.
const before=beforeSources(),after=currentSources();

test('R92 monthly analysis preserves exact R91 HTML while visiting 10,000 events once',()=>{
  const old=monthlyHarness(before),next=monthlyHarness(after),a=monthlyFixture(),b=monthlyFixture();
  assert.equal(next.run(b.model),old.run(a.model));assert.equal(a.visits,120000);assert.equal(b.visits,10000);
  assert.deepEqual(b.rows,a.rows);
});

test('R92 monthly aggregation retains empty months, year boundaries, event types and decimal loss order',()=>{
  const old=monthlyHarness(before),next=monthlyHarness(after);
  const fixture=monthlyFixture(241),base={yearRealized:0,yearDividends:0,yearFees:0};
  for(const events of [[],fixture.model.events,fixture.model.events.filter(event=>!event.inYear),[
    {inYear:true,date:'2026-01-01',type:'sell',realized:1e15,dividend:0},
    {inYear:true,date:'2026-01-02',type:'sell',realized:.125,dividend:0},
    {inYear:true,date:'2026-01-03',type:'sell',realized:-1e15,dividend:0},
    {inYear:true,date:'2026-12-31',type:'dividend',realized:0,dividend:.375},
    {inYear:false,date:'2025-12-31',type:'buy',realized:10,dividend:20}
  ]])assert.equal(next.run({...base,events}),old.run({...base,events}));
});

test('R92 appearance-only commits retain every calculation result and still safely save the full state',()=>{
  const h=visualCommitHarness(after),original=structuredClone(h.state),cacheResults=Object.values(h.calculationCache).map(cache=>cache.get('fixture'));
  h.api.setAutumnBackground('fuji');
  assert.equal(h.counts.cacheClears,0);Object.values(h.calculationCache).forEach((cache,index)=>assert.equal(cache.get('fixture'),cacheResults[index]));
  assert.equal(h.counts.writes.length,1);assert.equal(h.counts.writes[0].key,'salarymate_v5_full_state');assert.equal(h.counts.writes[0].reset,false);
  const saved=JSON.parse(h.counts.writes[0].value);assert.equal(saved.schemaVersion,15);assert.equal(saved.uiPreferences.autumnBackground,'fuji');
  for(const key of ['companies','records','leaveRecords','stockPortfolio'])assert.deepEqual(saved[key],original[key]);
  assert.equal(h.counts.cloudChanges,1);assert.deepEqual(h.counts.statuses.map(row=>row[0]),['submitting','idle']);
});

test('R92 ordinary mutations and direct saves continue to invalidate all business calculation caches',()=>{
  const ordinary=visualCommitHarness(after);
  assert.equal(ordinary.api.commitStateMutation(()=>{ordinary.state.records[0].baseSalary=32000;}),true);
  assert.equal(ordinary.counts.cacheClears,Object.keys(ordinary.calculationCache).length);
  for(const cache of Object.values(ordinary.calculationCache))assert.equal(cache.size,0);
  assert.equal(JSON.parse(ordinary.counts.writes[0].value).records[0].baseSalary,32000);
  const direct=visualCommitHarness(after);assert.equal(direct.api.saveState(),true);
  assert.equal(direct.counts.cacheClears,Object.keys(direct.calculationCache).length);
});

test('R92 failed appearance persistence rolls back preference/data, invalidates caches and renders the failure',()=>{
  const h=visualCommitHarness(after,{failWrite:true}),initial=structuredClone(h.state),initialUi=structuredClone(h.ui);
  h.api.setAutumnBackground('fuji');
  assert.deepEqual(h.state,initial);assert.deepEqual(h.ui,initialUi);assert.equal(h.counts.cloudChanges,0);
  for(const cache of Object.values(h.calculationCache))assert.equal(cache.size,0);
  assert.equal(h.counts.renders,1);assert.equal(h.counts.applies,0);assert.equal(h.counts.removedNotices,0);
  assert.equal(h.counts.statuses.at(-1)[0],'failure');assert.equal(h.counts.released.length,1);assert.equal(h.counts.released[0][1],false);
});

test('R92 a throwing appearance mutation rolls back data and never leaves retained caches',()=>{
  const h=visualCommitHarness(after),initial=structuredClone(h.state);
  assert.equal(h.api.commitVisualPreference(()=>{h.state.records[0].baseSalary=1;throw Error('Fixture mutation failure');}),false);
  assert.deepEqual(h.state,initial);assert.equal(h.counts.writes.length,0);
  for(const cache of Object.values(h.calculationCache))assert.equal(cache.size,0);
});

test('R92 successful visual refresh applies CSS, clears stale notices and does not replace the main view',()=>{
  const h=visualCommitHarness(after);
  h.api.refreshVisualPreferences(true);assert.equal(h.counts.applies,1);assert.equal(h.counts.renders,0);
  assert.deepEqual(h.counts.attributes,[['aria-busy','false']]);assert.equal(h.counts.removedNotices,2);
  h.api.refreshVisualPreferences(false);assert.equal(h.counts.renders,1);assert.equal(h.counts.applies,1);
});

test('R92 background, opacity, density and accent selections avoid full renders; style changes retain mascot refresh',()=>{
  for(const [action,value,style]of [['setAutumnBackground','fuji','autumn'],['setHd2dBackground','harbor','pixel-luxe'],['setSurfaceOpacity','solid','autumn'],['setInterfaceMode','large','autumn'],['setColorTheme','rose','autumn']]){
    const h=visualCommitHarness(after);h.ui.interfaceStyle=style;h.api[action](value);
    assert.equal(h.counts.renders,0,action);assert.equal(h.counts.applies,1,action);assert.equal(h.counts.cacheClears,0,action);assert.equal(h.counts.writes.length,1,action);
  }
  const style=visualCommitHarness(after);style.api.setInterfaceStyle('pixel-luxe');
  assert.equal(style.counts.renders,1);assert.equal(style.counts.applies,0);assert.equal(style.counts.cacheClears,0);assert.equal(style.ui.interfaceStyle,'pixel-luxe');
});

test('R92 unchanged or blocked appearance choices never write or mutate business data',()=>{
  const same=visualCommitHarness(after),initial=structuredClone(same.state);
  same.api.setAutumnBackground('cafe');assert.equal(same.counts.writes.length,0);assert.equal(same.counts.applies,0);assert.deepEqual(same.state,initial);
  const blocked=visualCommitHarness(after,{denyLock:true}),blockedState=structuredClone(blocked.state),blockedUi=structuredClone(blocked.ui);
  blocked.api.setAutumnBackground('fuji');assert.equal(blocked.counts.writes.length,0);assert.deepEqual(blocked.state,blockedState);assert.deepEqual(blocked.ui,blockedUi);
  assert.equal(blocked.counts.renders,1);assert.equal(blocked.counts.applies,0);
});
