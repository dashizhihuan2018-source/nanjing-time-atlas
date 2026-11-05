import { test } from 'node:test';
import assert from 'node:assert/strict';
let data;
try { data=await import('../src/history.mjs'); } catch {}
test('historical dataset is implemented',()=>assert.ok(data?.routes?.length >= 5));
test('every historical record has real page-level provenance',()=>{
  for(const item of [...data.routes,...data.places,...data.events]){
    assert.ok(item.source, item.id); assert.ok(data.sources[item.source],item.id);
    assert.ok(data.sources[item.source].pages.length>0,item.id);
  }
});
test('routes refer to known places and include no invented coordinates',()=>{
  for(const route of data.routes){
    assert.ok(route.stops.length>=3);
    for(const stop of route.stops) assert.ok(data.places.some(p=>p.id===stop.place),`${route.id}:${stop.place}`);
    assert.equal(route.geometry,undefined);
  }
  for(const place of data.places){assert.equal(place.lon,undefined);assert.ok(place.locationNote);}
});
test('1751 and 1757 imperial entries remain distinct',()=>{
  const first=data.routes.find(r=>r.id==='qianlong-1751').stops.map(s=>s.place);
  const second=data.routes.find(r=>r.id==='qianlong-1757').stops.map(s=>s.place);
  assert.ok(first.includes('chaoyang')); assert.ok(!first.includes('qixia'));
  assert.ok(second.includes('taiping')); assert.ok(second.includes('qixia'));
});
test('war stages preserve lunar date and interpretative uncertainty',()=>{
  const route=data.routes.find(r=>r.id==='zheng-1659');
  assert.ok(route.stops.some(s=>s.date?.includes('农历')));
  assert.ok(route.note.includes('示意'));
});
