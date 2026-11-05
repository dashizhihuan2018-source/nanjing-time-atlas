const NS='http://www.w3.org/2000/svg';
const rad=Math.PI/180;
export function project([lon,lat]) {
  return [(lon-118.8)*10000, -(Math.log(Math.tan(Math.PI/4+lat*rad/2))-Math.log(Math.tan(Math.PI/4+32.06*rad/2)))/rad*10000];
}
function el(tag,attrs={},text) {
  const node=document.createElementNS(NS,tag);
  for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));
  if(text!==undefined)node.textContent=text;
  return node;
}
function coordsPath(coords,closed=false) {
  if(!coords?.length)return '';
  return coords.map((coord,i)=>`${i?'L':'M'}${project(coord).map(v=>v.toFixed(1)).join(',')}`).join('')+(closed?'Z':'');
}
function geometryPath(geometry) {
  if(!geometry)return '';
  switch(geometry.type){
    case 'LineString':return coordsPath(geometry.coordinates);
    case 'MultiLineString':return geometry.coordinates.map(c=>coordsPath(c)).join('');
    case 'Polygon':return geometry.coordinates.map(c=>coordsPath(c,true)).join('');
    case 'MultiPolygon':return geometry.coordinates.flatMap(p=>p.map(c=>coordsPath(c,true))).join('');
    default:return '';
  }
}
function finiteCoord(place){return Number.isFinite(place?.lon)&&Number.isFinite(place?.lat);}
export function resolvePlaces(historical,geography) {
  const raw=Array.isArray(geography.places)?geography.places:Object.values(geography.places||{});
  return historical.map(place=>{
    let match;
    for(const name of place.geoNames){
      match=raw.find(candidate=>candidate.name===name||candidate.aliases?.includes(name));
      if(finiteCoord(match))break;
    }
    return {...place,geo:finiteCoord(match)?{lon:match.lon,lat:match.lat,source:match.source,note:match.note}:null};
  });
}

export class AtlasMap {
  constructor(container,geography,places,onSelect) {
    this.container=container;this.places=places;this.onSelect=onSelect;this.markerNodes=[];this.layers={};
    this.svg=el('svg',{role:'img','aria-label':'南京山水、城墙与历史路线地图',preserveAspectRatio:'xMidYMid slice'});
    this.svg.append(el('title',{},'南京城及宁镇走廊历史空间图志'));
    this.svg.append(el('desc',{},'现代地理底图与历史节点分层绘制。虚线为路线示意，不是精确古道路。'));
    const defs=el('defs');
    const pattern=el('pattern',{id:'map-grid',width:500,height:500,patternUnits:'userSpaceOnUse'});
    pattern.append(el('path',{d:'M 500 0 L 0 0 0 500',fill:'none',stroke:'#98a78c','stroke-width':1,opacity:'.13'}));defs.append(pattern);this.svg.append(defs);
    this.svg.append(el('rect',{x:-30000,y:-30000,width:60000,height:60000,fill:'#071722'}));
    this.svg.append(el('rect',{x:-30000,y:-30000,width:60000,height:60000,fill:'url(#map-grid)'}));
    for(const kind of ['park','road','water','river','wall']){
      const group=el('g',{'data-layer':kind});this.layers[kind]=group;
      for(const feature of geography.features||[]){
        if(feature.properties?.kind!==kind)continue;
        const d=geometryPath(feature.geometry);if(!d)continue;
        const path=el('path',{d,class:`geography-path geography-${kind}`,'vector-effect':'non-scaling-stroke','fill-rule':'evenodd'});
        if(feature.properties.name)path.append(el('title',{},feature.properties.name+' · 现代地理参照'));
        group.append(path);
      }
      this.svg.append(group);
    }
    this.labelLayer=el('g',{'aria-hidden':'true'});this.svg.append(this.labelLayer);
    this.routeLayer=el('g',{'data-layer':'route'});this.layers.route=this.routeLayer;this.svg.append(this.routeLayer);
    this.placeLayer=el('g',{'data-layer':'places'});this.layers.places=this.placeLayer;this.svg.append(this.placeLayer);
    this.routeNodes=el('g');this.routeLayer.append(this.routeNodes);
    this.drawPlaces();container.replaceChildren(this.svg);
    this.view={x:-1000,y:-900,w:2400,h:1900};this.city();this.bindInput();
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);
  }
  drawPlaces(){
    // Selected/route labels are given priority; colliding optional labels hide at city scale.
    for(const place of this.places){
      if(!place.geo)continue;
      const g=el('g',{class:'map-place','data-id':place.id,'data-kind':place.kind,tabindex:0,role:'button','aria-label':`${place.name}，${place.modern}`});
      const xy=project([place.geo.lon,place.geo.lat]);
      g.append(el('circle',{r:12,class:'halo'}));
      if(place.kind==='gate')g.append(el('rect',{x:-3.5,y:-3.5,width:7,height:7,rx:.5,class:'marker'}));
      else g.append(el('circle',{r:place.kind==='palace'||place.kind==='office'?4.5:3,class:'marker'}));
      const label=el('text',{x:9,y:4,class:'label'},place.name);g.append(label);
      g.append(el('title',{},`${place.name} · ${place.locationNote}`));
      g.addEventListener('click',event=>{event.stopPropagation();this.onSelect(place.id);});
      g.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();this.onSelect(place.id);}});
      this.markerNodes.push({place,g,label,xy});this.placeLayer.append(g);
    }
    for(const id of ['xuanwu','zhongshan','mochou','mufu']){
      const place=this.places.find(p=>p.id===id&&p.geo);if(!place)continue;
      const [x,y]=project([place.geo.lon,place.geo.lat]);
      const text=el('text',{x,y:y-70,class:`geography-name ${place.kind==='mountain'?'terrain':''}`,'text-anchor':'middle'},place.id==='zhongshan'?'钟 山':place.id==='xuanwu'?'后 湖':place.name);
      this.labelLayer.append(text);
    }
  }
  setState(state,route){
    this.state=state;this.route=route;
    this.routeLayer.replaceChildren();this.routeNodes=el('g');
    if(route){
      // Break a segment at every unknown stop: we never bridge a missing geographic claim.
      let previous=null;
      const routeStops=route.stops.map(stop=>this.places.find(p=>p.id===stop.place));
      for(const place of routeStops){
        if(!place?.geo){previous=null;continue;}
        const xy=project([place.geo.lon,place.geo.lat]);
        if(previous){
          const d=`M${previous.join(',')}L${xy.join(',')}`;
          this.routeLayer.append(el('path',{d,class:'route-halo','vector-effect':'non-scaling-stroke'}));
          this.routeLayer.append(el('path',{d,class:'route-line',stroke:route.color,'vector-effect':'non-scaling-stroke'}));
        }
        previous=xy;
      }
      routeStops.forEach((place,i)=>{
        if(!place?.geo)return;
        const g=el('g',{class:`route-node ${i===state.step?'route-current':''}`});
        g.dataset.x=project([place.geo.lon,place.geo.lat])[0];g.dataset.y=project([place.geo.lon,place.geo.lat])[1];
        // Offset numbers slightly so the landmark remains separately clickable.
        g.append(el('circle',{cx:-12,cy:-12,r:8,class:'route-stop-dot'}));g.append(el('text',{x:-12,y:-12,class:'route-stop-number'},i+1));
        this.routeNodes.append(g);
      });
      this.routeLayer.append(this.routeNodes);
    }
    const activePlace=state.place||route?.stops[state.step]?.place;
    const activeStop=route?.stops[state.step];
    for(const marker of this.markerNodes){
      marker.g.classList.toggle('selected',marker.place.id===activePlace);
      marker.g.classList.toggle('route-stop',Boolean(route?.stops.some(s=>s.place===marker.place.id)));
      const label=marker.place.id===activePlace&&activeStop?.place===marker.place.id?activeStop.label||marker.place.name:marker.place.name;
      marker.label.textContent=label;
      marker.g.setAttribute('aria-label',`${label}，${marker.place.modern}`);
      marker.g.querySelector('title').textContent=`${label} · ${marker.place.locationNote}`;
    }
    this.applyView();
  }
  fitCoords(coords,padding=1.35){
    if(!coords.length)return;
    const points=coords.map(project),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
    const w=Math.max(650,Math.max(...xs)-Math.min(...xs))*padding;
    const h=Math.max(700,Math.max(...ys)-Math.min(...ys))*padding;
    const rect=this.container.getBoundingClientRect(),aspect=rect.width/rect.height;
    let width=Math.max(w,h*aspect),height=width/aspect;
    const cx=(Math.max(...xs)+Math.min(...xs))/2,cy=(Math.max(...ys)+Math.min(...ys))/2;
    this.view={x:cx-width/2,y:cy-height/2,w:width,h:height};this.applyView();
  }
  city(){
    // This fixed viewport is not geometry: it is only the initial Nanjing camera extent.
    this.fitCoords([[118.73,31.998],[118.865,32.105]],1.3);
  }
  fitRoute(route){
    const coords=route.stops.map(s=>this.places.find(p=>p.id===s.place)?.geo).filter(Boolean).map(g=>[g.lon,g.lat]);
    this.fitCoords(coords,1.5);
  }
  focus(id){
    const place=this.places.find(p=>p.id===id);if(!place?.geo)return false;
    const [x,y]=project([place.geo.lon,place.geo.lat]);
    this.view.x=x-this.view.w*.45;this.view.y=y-this.view.h*.47;this.applyView();return true;
  }
  applyView(){
    const r=this.container.getBoundingClientRect();if(!r.width||!r.height||!this.view)return;
    this.view.h=this.view.w*r.height/r.width;
    this.svg.setAttribute('viewBox',`${this.view.x} ${this.view.y} ${this.view.w} ${this.view.h}`);
    const scale=this.view.w/r.width;
    const boxes=[];
    // Sort for label collision decisions without changing DOM/focus order.
    const order=[...this.markerNodes].sort((a,b)=>Number(b.g.classList.contains('selected'))-Number(a.g.classList.contains('selected'))||Number(b.g.classList.contains('route-stop'))-Number(a.g.classList.contains('route-stop')));
    for(const marker of order){
      marker.g.setAttribute('transform',`translate(${marker.xy.join(' ')}) scale(${scale})`);
      const px=(marker.xy[0]-this.view.x)/scale,py=(marker.xy[1]-this.view.y)/scale;
      const box={x:px+8,y:py-10,w:marker.label.textContent.length*12,h:20};
      const priority=marker.g.classList.contains('selected')||marker.g.classList.contains('route-stop');
      const collides=boxes.some(b=>box.x<b.x+b.w&&box.x+box.w>b.x&&box.y<b.y+b.h&&box.y+box.h>b.y);
      marker.label.setAttribute('display',!priority&&collides?'none':'inline');
      if(priority||!collides)boxes.push(box);
    }
    for(const g of this.routeNodes?.children||[])g.setAttribute('transform',`translate(${g.dataset.x} ${g.dataset.y}) scale(${scale})`);
    const km=this.view.w/10000*111.32*Math.cos(32.06*rad)*75/r.width;
    const scaleElement=document.getElementById('map-scale');if(scaleElement)scaleElement.textContent=km<1?`${Math.round(km*1000)} m`:`${km.toFixed(1)} km`;
  }
  resize(){this.applyView();}
  zoom(factor,anchor){
    const r=this.container.getBoundingClientRect();
    const ax=anchor?(anchor[0]-r.left)/r.width:.5,ay=anchor?(anchor[1]-r.top)/r.height:.5;
    const w=Math.min(24000,Math.max(400,this.view.w*factor));const ratio=w/this.view.w;
    this.view.x+=this.view.w*ax*(1-ratio);this.view.y+=this.view.h*ay*(1-ratio);this.view.w=w;this.applyView();
  }
  showLayer(kind,visible){
    this.layers[kind]?.setAttribute('display',visible?'inline':'none');
    if(kind==='water')this.layers.river?.setAttribute('display',visible?'inline':'none');
    if(kind==='park')this.labelLayer.setAttribute('display',visible?'inline':'none');
  }
  bindInput(){
    const points=new Map();let last;
    const gesture=()=>{
      const values=[...points.values()];if(values.length===1)return {x:values[0][0],y:values[0][1],distance:0};
      if(values.length>=2)return {x:(values[0][0]+values[1][0])/2,y:(values[0][1]+values[1][1])/2,distance:Math.hypot(values[0][0]-values[1][0],values[0][1]-values[1][1])};
      return null;
    };
    this.svg.addEventListener('pointerdown',e=>{
      if(e.target.closest('.map-place'))return;
      points.set(e.pointerId,[e.clientX,e.clientY]);this.svg.setPointerCapture(e.pointerId);last=gesture();
    });
    this.svg.addEventListener('pointermove',e=>{
      if(!points.has(e.pointerId))return;
      points.set(e.pointerId,[e.clientX,e.clientY]);const next=gesture();
      if(last&&next){
        const r=this.container.getBoundingClientRect();
        this.view.x-=(next.x-last.x)/r.width*this.view.w;this.view.y-=(next.y-last.y)/r.height*this.view.h;
        if(next.distance&&last.distance)this.zoom(last.distance/next.distance,[next.x,next.y]);else this.applyView();
      }
      last=next;
    });
    const end=e=>{points.delete(e.pointerId);last=gesture();};
    this.svg.addEventListener('pointerup',end);this.svg.addEventListener('pointercancel',end);this.svg.addEventListener('lostpointercapture',end);
    this.svg.addEventListener('wheel',e=>{e.preventDefault();this.zoom(Math.exp(Math.max(-150,Math.min(150,e.deltaY))*.002),[e.clientX,e.clientY]);},{passive:false});
    this.container.addEventListener('keydown',e=>{
      if(e.target!==this.container)return;
      if(e.key==='+'||e.key==='='){this.zoom(.8);e.preventDefault();}
      if(e.key==='-'){this.zoom(1.25);e.preventDefault();}
      const directions={ArrowLeft:[-.08,0],ArrowRight:[.08,0],ArrowUp:[0,-.08],ArrowDown:[0,.08]};
      if(directions[e.key]){e.preventDefault();this.view.x+=directions[e.key][0]*this.view.w;this.view.y+=directions[e.key][1]*this.view.h;this.applyView();}
    });
  }
}
