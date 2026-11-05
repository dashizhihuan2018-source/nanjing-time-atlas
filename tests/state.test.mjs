import { test } from 'node:test';
import assert from 'node:assert/strict';

let state;
try { state = await import('../src/state.mjs'); } catch {}

test('a hostile deep link cannot combine a tour route with the war-only directory',()=>{
  const value=state.stateFromURL('?year=1757&topic=war&route=qianlong-1757');
  assert.equal(value.route,'qianlong-1757');
  assert.equal(value.topic,'tour');
});

test('state functions are implemented', () => assert.equal(typeof state?.normalizeState, 'function'));
test('normalization rejects unknown routes and clamps years', () => {
  assert.deepEqual(state.normalizeState({year:9000, route:'unknown', step:90}), {year:1784, route:null, step:0, place:null, topic:'all'});
});
test('route selection sets its historic year and resets step', () => {
  const selected = state.selectRoute({year:1645, step:6}, 'qianlong-1757');
  assert.equal(selected.year,1757); assert.equal(selected.step,0); assert.equal(selected.topic,'tour');
});
test('steps stop at both ends, including missing route', () => {
  assert.equal(state.stepRoute(state.selectRoute({},'qianlong-1751'),-1).step,0);
  const end = state.stepRoute(state.selectRoute({},'qianlong-1751'),100);
  assert.equal(state.stepRoute(end,1).step,end.step);
  assert.equal(state.stepRoute(state.normalizeState({}),1).step,0);
});
test('URL state round-trips and hostile values normalize', () => {
  const selected = {...state.selectRoute({},'zheng-1659'),step:2,place:'yifeng'};
  assert.deepEqual(state.stateFromURL(state.stateToURL(selected)), selected);
  assert.equal(state.stateFromURL('?year=NaN&route=not-real&step=-5').route,null);
  assert.equal(state.stateFromURL('?place=%3Cscript%3E').place,null);
});
test('year selection does not assign a future event', () => {
  assert.equal(state.eventForYear(1650).year,1645);
  assert.equal(state.eventForYear(1756).year,1751);
});
test('changing year removes incompatible route', () => {
  const selected = state.selectRoute({},'zheng-1659');
  assert.equal(state.normalizeState({...selected,year:1757}).route,null);
});
