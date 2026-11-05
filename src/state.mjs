import { routes, places, events } from './history.mjs';
export function normalizeState(input={}) {
  const n=Number(input.year);
  const year=Number.isFinite(n)?Math.min(1784,Math.max(1644,Math.round(n))):1757;
  const route=routes.find(r=>r.id===input.route&&r.year===year);
  let topic=['war','tour','all'].includes(input.topic)?input.topic:'all';
  if(route&&topic!=='all'&&topic!==route.topic)topic=route.topic;
  const rawStep=Number(input.step);
  return {year,route:route?.id||null,step:route?Math.min(route.stops.length-1,Math.max(0,Number.isFinite(rawStep)?Math.floor(rawStep):0)):0,
    place:places.some(p=>p.id===input.place)?input.place:null,
    topic};
}
export function selectRoute(state,id) {
  const route=routes.find(r=>r.id===id);
  return route?normalizeState({...state,year:route.year,route:id,topic:route.topic,step:0,place:null}):normalizeState({...state,route:null,step:0});
}
export function stepRoute(state,delta) {return normalizeState({...state,step:state.step+delta});}
export function stateFromURL(search) {return normalizeState(Object.fromEntries(new URLSearchParams(search)));}
export function stateToURL(state) {
  const s=normalizeState(state), q=new URLSearchParams({year:String(s.year),topic:s.topic});
  if(s.route){q.set('route',s.route);q.set('step',String(s.step));}
  if(s.place)q.set('place',s.place);
  return `?${q}`;
}
export function eventForYear(year) {return [...events].reverse().find(e=>e.year<=year)||events[0];}
