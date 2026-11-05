import {test} from 'node:test';
import assert from 'node:assert/strict';
import {project,resolvePlaces} from '../src/map.mjs';

test('map projection preserves east/right and north/up directions',()=>{
  const origin=project([118.8,32.06]);
  assert.ok(Math.abs(origin[0])<1e-6&&Math.abs(origin[1])<1e-6);
  assert.ok(project([118.9,32.06])[0]>origin[0]);
  assert.ok(project([118.8,32.16])[1]<origin[1]);
});
test('historical places only resolve from documented modern object names',()=>{
  const historical=[{id:'known',geoNames:['古门']},{id:'unknown',geoNames:[]}];
  const resolved=resolvePlaces(historical,{places:[{name:'今门',aliases:['古门'],lon:118.8,lat:32.06,source:'https://www.openstreetmap.org/way/1',note:'现代重建参照'}]});
  assert.equal(resolved[0].geo.source,'https://www.openstreetmap.org/way/1');
  assert.equal(resolved[1].geo,null);
  assert.equal(resolvePlaces(historical,{places:[{name:'古门',lon:NaN,lat:32}]})[0].geo,null);
});
