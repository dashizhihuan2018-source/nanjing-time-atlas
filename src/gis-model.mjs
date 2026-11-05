// Modern reference coordinates are intentionally distinct from historical route evidence.
export function locatedPlaces(places=[]){
  return places.filter(place=>Number.isFinite(place?.geo?.lon)&&Number.isFinite(place?.geo?.lat));
}

function illustrativeArc(start,end){
  const dx=end[0]-start[0],dy=end[1]-start[1];
  const length=Math.hypot(dx*Math.cos(start[1]*Math.PI/180),dy);
  const bend=Math.min(length*.09,.018);
  const path=[];
  for(let i=0;i<=24;i++){
    const t=i/24,offset=Math.sin(Math.PI*t)*bend;
    path.push([start[0]+dx*t-dy/(length||1)*offset,
      start[1]+dy*t+dx/(length||1)*offset]);
  }
  path[0]=[...start];path[path.length-1]=[...end];
  return path;
}

export function buildRouteModel(route,places=[]){
  const byId=new Map(locatedPlaces(places).map(place=>[place.id,place]));
  const segments=[],nodes=[];
  let previous=null;
  for(const [index,stop] of (route?.stops||[]).entries()){
    const place=byId.get(stop.place);
    if(!place){previous=null;continue;}
    const node={id:place.id,number:index+1,stopIndex:index,
      coordinates:[place.geo.lon,place.geo.lat],source:place.geo.source||null};
    nodes.push(node);
    if(previous){
      const path=illustrativeArc(previous.coordinates,node.coordinates);
      segments.push({placeIds:[previous.id,node.id],stopIndices:[previous.stopIndex,index],path,
        timestamps:path.map((_,i)=>i),sourceIds:[previous.source,node.source]});
    }
    previous=node;
  }
  return {segments,nodes};
}
