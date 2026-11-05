import test from 'node:test';
import assert from 'node:assert/strict';
import {routes,places,sources,events} from '../src/history.mjs';
import {imperialTours} from '../src/exhibition.mjs';
import {selectRoute,stateFromURL,stateToURL,eventForYear} from '../src/state.mjs';
test('all twelve overnight records are independently selectable and deep-linkable',()=>{
  for(const tour of imperialTours){
    const id=`overnight-${tour.id}`,route=routes.find(r=>r.id===id);assert.ok(route,id);
    assert.equal(route.year,tour.year);assert.equal(route.stops.length,tour.stops.length);
    const state=selectRoute({},id);assert.equal(state.route,id);assert.equal(stateFromURL(stateToURL(state)).route,id);
    assert.ok(sources[route.source].pages.includes(55));
    tour.stops.forEach((stop,i)=>{const place=places.find(p=>p.id===route.stops[i].place);assert.ok(place);if(!stop.placeId)assert.deepEqual(place.geoNames,[]);});
    assert.equal(eventForYear(tour.year).year,tour.year);
  }
  assert.deepEqual(events.map(e=>e.year),events.map(e=>e.year).toSorted((a,b)=>a-b));
});
