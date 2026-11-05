import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {places,routes} from '../src/history.mjs';
import {resolvePlaces} from '../src/map.mjs';

const geography=JSON.parse(await readFile(new URL('../public/data/geography.json',import.meta.url),'utf8'));
test('the shipped geographic snapshot has finite coordinates and object provenance',()=>{
  assert.ok(geography.features.length>100);
  function verify(coords){
    if(typeof coords[0]==='number')assert.ok(coords.length>=2&&coords.every(Number.isFinite));
    else coords.forEach(verify);
  }
  for(const feature of geography.features){
    verify(feature.geometry.coordinates);
    assert.match(feature.properties.source,/^https:\/\/www\.openstreetmap\.org\/(way|relation)\/\d+$/);
  }
});
test('lake geometry is never faked, and the present missing-data limitation is visible',async()=>{
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  for(const id of [2138994,18231223]){
    const lake=geography.features.find(f=>f.properties.osmType==='relation'&&f.properties.osmId===id);
    if(!lake){assert.match(html,/两湖水面与宁镇区域待补/);continue;}
    assert.equal(lake.properties.kind,'water');
    assert.ok(['Polygon','MultiPolygon'].includes(lake.geometry.type));
  }
});
test('each historical route retains multiple sourced modern geographic references',()=>{
  const resolved=resolvePlaces(places,geography);
  for(const route of routes){
    const count=route.stops.filter(stop=>resolved.find(p=>p.id===stop.place)?.geo).length;
    if(route.featured!==false)assert.ok(count>=3,route.id);
    else assert.ok(count>=1,`${route.id} must retain at least its documented palace reference, never invented extra points`);
  }
  for(const id of ['general','jiashan','ciying','wukesong'])assert.equal(resolved.find(p=>p.id===id).geo,null);
});
