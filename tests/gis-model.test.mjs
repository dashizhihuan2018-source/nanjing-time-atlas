import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRouteModel, locatedPlaces} from '../src/gis-model.mjs';
import {GisMap,awaitMapLoad} from '../src/gis-map.mjs';

const places=[
  {id:'a',geo:{lon:0,lat:0}},
  {id:'b',geo:null},
  {id:'c',geo:{lon:118,lat:32}},
  {id:'d',geo:{lon:119,lat:33}},
];
const route=(...ids)=>({id:'sample',topic:'war',stops:ids.map(place=>({place}))});

test('known / unknown / known / known breaks at unknown and only draws final pair',()=>{
  const result=buildRouteModel(route('a','b','c','d'),places);
  assert.equal(result.segments.length,1);
  assert.deepEqual(result.segments[0].placeIds,['c','d']);
  assert.deepEqual(result.nodes.map(node=>node.number),[1,3,4]);
});

test('order and repeated stops retain provenance and do not invent intermediate places',()=>{
  const result=buildRouteModel(route('a','c','a','a','d'),places);
  assert.deepEqual(result.segments.map(s=>s.placeIds),[
    ['a','c'],['c','a'],['a','a'],['a','d'],
  ]);
  assert.deepEqual(result.segments.map(s=>s.stopIndices),[[0,1],[1,2],[2,3],[3,4]]);
  for(const segment of result.segments){
    assert.deepEqual(segment.path[0],result.nodes[segment.stopIndices[0]].coordinates);
    assert.deepEqual(segment.path.at(-1),result.nodes[segment.stopIndices[1]].coordinates);
  }
});

test('zero coordinates count as located; null and nonfinite do not',()=>{
  assert.deepEqual(locatedPlaces([...places,{id:'bad',geo:{lon:NaN,lat:32}}]).map(p=>p.id),['a','c','d']);
  assert.deepEqual(buildRouteModel(route('a','c'),places).segments[0].path[0],[0,0]);
});

test('no geographic stops cannot generate paths or visual nodes',()=>{
  assert.deepEqual(buildRouteModel(route('b','missing'),places),{segments:[],nodes:[]});
});

test('asynchronous map load callback rejects ready and cleans up if overlay installation throws',async()=>{
  const listeners=new Map();let cleanups=0;
  const map={once:(type,fn)=>listeners.set(type,fn),on:(type,fn)=>listeners.set(type,fn),
    off:(type,fn)=>{if(listeners.get(type)===fn)listeners.delete(type);},
    loaded:()=>true,isStyleLoaded:()=>true};
  const thrown=new Error('interleaved WebGL2 unavailable');
  const ready=awaitMapLoad(map,()=>{throw thrown;},()=>{cleanups++;});
  listeners.get('load')();
  await assert.rejects(ready,error=>error===thrown);
  assert.equal(cleanups,1);
  assert.equal(listeners.has('error'),false);
});

test('system preference changes cannot override a user-disabled motion setting',()=>{
  const candidate={userMotion:true,reduced:{matches:false},refreshMotion(){},renderRoute(){},
    updateMotion:GisMap.prototype.updateMotion};
  GisMap.prototype.setMotion.call(candidate,false);
  candidate.reduced.matches=true;
  GisMap.prototype.updateMotion.call(candidate);
  candidate.reduced.matches=false;
  GisMap.prototype.updateMotion.call(candidate);
  assert.equal(candidate.userMotion,false);
  assert.equal(candidate.motion,false);
  GisMap.prototype.setMotion.call(candidate,true);
  assert.equal(candidate.motion,true);
  candidate.reduced.matches=true;
  GisMap.prototype.updateMotion.call(candidate);
  assert.equal(candidate.motion,false);
});
