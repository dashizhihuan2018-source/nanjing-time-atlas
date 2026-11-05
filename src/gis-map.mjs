import {Map as MapLibreMap,Marker,LngLatBounds,setWorkerUrl} from 'maplibre-gl';
import {MapLibreOverlay} from '@deck.gl/maplibre';
import {PathLayer,ScatterplotLayer} from '@deck.gl/layers';
import {TripsLayer} from '@deck.gl/geo-layers';
import {buildRouteModel,locatedPlaces} from './gis-model.mjs';

setWorkerUrl(new URL('./maplibre-worker.mjs',import.meta.url).href);

const COLORS={war:[240,113,81],tour:[198,159,105],geo:[100,213,200]};
const KIND=['park','road','water','river','wall'];
const LOCAL_SOURCE='atlas-modern-reference';
const DECK_GROUP='deck-maplibre-layer-group-last';
const CITY_CENTER=[118.766,32.054];

function screenPadding(container){
  const width=container.clientWidth,height=container.clientHeight;
  // Fit into the unobscured portion of the map, not the full GPU canvas.
  const mobile=width<=760;
  const sidebar=document.querySelector('.sidebar');
  const evidence=document.querySelector('.evidence-panel');
  const player=document.querySelector('.route-player');
  const local=element=>element?.getBoundingClientRect();
  const mapRect=container.getBoundingClientRect();
  const sidebarRect=sidebar&&!sidebar.hidden&&(!mobile||sidebar.classList.contains('open'))?local(sidebar):null;
  const evidenceRect=evidence&&!evidence.hidden?local(evidence):null;
  const playerRect=player&&!player.hidden?local(player):null;
  const left=sidebarRect?sidebarRect.right-mapRect.left+26:mobile?24:Math.max(60,width*.21);
  const right=evidenceRect?mapRect.right-evidenceRect.left+22:mobile?84:Math.max(130,Math.min(230,width*.14));
  const top=mobile?Math.min(210,height*.27):Math.min(150,height*.19);
  const bottom=playerRect?mapRect.bottom-playerRect.top+20:mobile?Math.min(170,height*.22):Math.min(160,height*.18);
  // MapLibre needs a positive viewport even when panels almost fill a phone.
  const horizontal=Math.max(80,width-80),vertical=Math.max(90,height-90);
  const hScale=Math.min(1,horizontal/(left+right));
  const vScale=Math.min(1,vertical/(top+bottom));
  return {left:Math.round(left*hScale),right:Math.round(right*hScale),
    top:Math.round(top*vScale),bottom:Math.round(bottom*vScale)};
}

function localStyle(features){
  return {
    version:8,
    name:'南京现代地理参照 · 本地矢量',
    sources:{[LOCAL_SOURCE]:{type:'geojson',data:{type:'FeatureCollection',features:features||[]},
      attribution:'现代地理参照：© OpenStreetMap contributors；历史节点与现代坐标不等同清代测绘'}},
    layers:[
      {id:'atlas-background',type:'background',paint:{'background-color':'#071722'}},
      ...localLayers(),
    ],
  };
}
function localLayers(){
  const filter=kind=>['==',['get','kind'],kind];
  const body=['all',filter('wall'),['!=',['get','wallClass'],'historic-reference']];
  const trace=['all',filter('wall'),['==',['get','wallClass'],'historic-reference']];
  return [
    {id:'atlas-park',type:'fill',source:LOCAL_SOURCE,filter:filter('park'),paint:{'fill-color':'#153c42','fill-opacity':.66}},
    {id:'atlas-water',type:'fill',source:LOCAL_SOURCE,filter:filter('water'),paint:{'fill-color':'#1c6777','fill-opacity':.8}},
    {id:'atlas-river',type:'line',source:LOCAL_SOURCE,filter:filter('river'),paint:{'line-color':'#54bac0','line-opacity':.58,'line-width':['interpolate',['linear'],['zoom'],8,.6,13,2.4]}},
    {id:'atlas-road',type:'line',source:LOCAL_SOURCE,filter:filter('road'),paint:{'line-color':'#9bc9cf','line-opacity':.3,'line-width':['interpolate',['linear'],['zoom'],8,.35,14,1.5]}},
    {id:'atlas-wall-glow',type:'line',source:LOCAL_SOURCE,filter:body,paint:{'line-color':'#c69f69','line-opacity':.25,'line-width':10,'line-blur':5}},
    {id:'atlas-wall-historic',type:'line',source:LOCAL_SOURCE,filter:trace,paint:{'line-color':'#c1a783','line-opacity':.65,'line-width':1.6,'line-dasharray':[3,3]}},
    {id:'atlas-wall',type:'line',source:LOCAL_SOURCE,filter:body,layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#e4bd83','line-opacity':.96,'line-width':['interpolate',['linear'],['zoom'],8,1.8,14,4]}},
  ];
}
function modeEvent(container,mode,message){
  container.dispatchEvent(new CustomEvent('atlas:mode',{bubbles:true,detail:{mode,message}}));
}
function viewEvent(container,map){
  const center=map.getCenter();
  container.dispatchEvent(new CustomEvent('atlas:view',{bubbles:true,
    detail:{center:[center.lng,center.lat],zoom:map.getZoom(),pitch:map.getPitch()}}));
}

// MapLibre invokes 'load' handlers outside the Promise executor. Convert
// initialization errors there into a rejection that the SVG fallback can see.
export function awaitMapLoad(map,initialize,cleanup){
  return new Promise((resolve,reject)=>{
    let settled=false;
    const finish=()=>{settled=true;map.off('load',onLoad);map.off('error',onError);};
    const fail=error=>{if(settled)return;finish();try{cleanup();}catch{}reject(error);};
    const onLoad=()=>{if(settled)return;try{const result=initialize();finish();resolve(result);}catch(error){fail(error);}};
    const onError=event=>{
      if(settled)return;
      if(!map.loaded()&&!map.isStyleLoaded())fail(event.error||new Error('MapLibre style load failed'));
    };
    map.once('load',onLoad);map.on('error',onError);
  });
}

export class GisMap {
  constructor(container,geography,resolvedPlaces,onSelect){
    this.container=container;this.geography=geography;this.places=resolvedPlaces;
    this.onSelect=onSelect;this.markers=[];this.routeNumberMarkers=[];this.overlay=null;
    this.routeModel={segments:[],nodes:[]};this.state=null;this.route=null;
    this.visibility={park:true,road:true,water:true,wall:true,places:true,route:true};
    this.mode='local-vector';this.destroyed=false;this.time=0;this.raf=0;
    this.deckLoaded=false;this.deckRenderCount=0;
    this.reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)');
    this.userMotion=true;this.motion=this.userMotion&&!this.reduced?.matches;
    this.onHidden=()=>{this.refreshMotion();this.renderRoute();};
    this.onReduced=()=>this.updateMotion();
    document.addEventListener('visibilitychange',this.onHidden);
    this.reduced?.addEventListener?.('change',this.onReduced);
    this.map=new MapLibreMap({container,style:localStyle(geography?.features),
      center:CITY_CENTER,zoom:10.75,pitch:48,bearing:-16,
      attributionControl:true,antialias:true,cooperativeGestures:false,
      maxPitch:70,minZoom:7,maxZoom:18,renderWorldCopies:false});
    this.map.on('moveend',()=>viewEvent(container,this.map));
    this.map.on('style.load',()=>{if(this.destroyed)return;this.ensureLocalLayers();this.applyVisibility();});
    this.drawMarkers();
    this.ready=awaitMapLoad(this.map,()=>{
      if(this.destroyed)throw new Error('Map destroyed before load');
      this.overlay=new MapLibreOverlay({interleaved:true,layers:[],
        onLoad:()=>{this.deckLoaded=true;},
        onAfterRender:()=>{this.deckRenderCount++;}});
      this.map.addControl(this.overlay);
      this.renderRoute();
      modeEvent(container,'local-vector','本地现代地理参照已就绪；历史路线为地点顺序示意');
      viewEvent(container,this.map);
      return this;
    },()=>this.destroy());
  }

  ensureLocalLayers(){
    if(!this.map.getSource(LOCAL_SOURCE))this.map.addSource(LOCAL_SOURCE,{type:'geojson',
      data:{type:'FeatureCollection',features:this.geography?.features||[]},
      attribution:'现代地理参照：© OpenStreetMap contributors'});
    for(const layer of localLayers())if(!this.map.getLayer(layer.id))this.map.addLayer(layer);
  }

  drawMarkers(){
    for(const place of locatedPlaces(this.places)){
      const button=document.createElement('button');button.type='button';
      button.className='map-place';button.dataset.id=place.id;button.dataset.kind=place.kind;
      button.setAttribute('aria-label',`${place.name}，${place.modern||''}`);
      const dot=document.createElement('span');dot.className='map-place-dot';dot.setAttribute('aria-hidden','true');
      const label=document.createElement('span');label.className='map-place-label';label.textContent=place.name;
      button.append(dot,label);
      button.addEventListener('click',event=>{event.stopPropagation();this.onSelect?.(place.id);});
      const marker=new Marker({element:button,anchor:'center'}).setLngLat([place.geo.lon,place.geo.lat]).addTo(this.map);
      this.markers.push({place,button,marker});
    }
  }

  setState(state,route){
    this.state=state;this.route=route;
    this.routeModel=buildRouteModel(route,this.places);
    this.drawRouteNumbers();
    const current=state?.place||route?.stops?.[state?.step]?.place;
    for(const {place,button} of this.markers){
      const label=route?.stops?.find(stop=>stop.place===place.id)?.label||place.name;
      button.querySelector('.map-place-label').textContent=label;
      button.setAttribute('aria-label',`${label}，${place.modern||''}；现代位置参照`);
      button.classList.toggle('selected',place.id===current);
      button.classList.toggle('route-stop',Boolean(route?.stops?.some(stop=>stop.place===place.id)));
    }
    this.renderRoute();this.refreshMotion();
  }

  drawRouteNumbers(){
    for(const marker of this.routeNumberMarkers)marker.remove();
    this.routeNumberMarkers=[];
    if(!this.visibility.route)return;
    for(const node of this.routeModel.nodes){
      const place=this.places.find(candidate=>candidate.id===node.id);
      const button=document.createElement('button');button.type='button';
      button.className='map-route-number';button.textContent=String(node.number);
      button.setAttribute('aria-label',`${this.route?.title||'路线'}第${node.number}站，${place?.name||node.id}`);
      button.addEventListener('click',event=>{event.stopPropagation();this.onSelect?.(node.id);});
      const marker=new Marker({element:button,anchor:'center',offset:[15,-15]})
        .setLngLat(node.coordinates).addTo(this.map);
      this.routeNumberMarkers.push(marker);
    }
  }

  renderRoute(){
    if(!this.overlay)return;
    if(!this.visibility.route){this.overlay.setProps({layers:[]});return;}
    const {segments,nodes}=this.routeModel;
    const color=COLORS[this.route?.topic]||COLORS.geo;
    const segmentData=segments.map((segment,i)=>({...segment,index:i}));
    const active=nodes.find(node=>node.stopIndex===this.state?.step);
    const layers=[
      new PathLayer({id:'atlas-route-aura',data:segmentData,getPath:d=>d.path,getColor:[...color,34],
        getWidth:16,widthUnits:'pixels',jointRounded:true,capRounded:true,pickable:false}),
      new PathLayer({id:'atlas-route-spine',data:segmentData,getPath:d=>d.path,getColor:[...color,180],
        getWidth:3,widthUnits:'pixels',jointRounded:true,capRounded:true,pickable:false}),
      new ScatterplotLayer({id:'atlas-route-rings',data:nodes,getPosition:d=>d.coordinates,
        stroked:true,filled:false,getLineColor:[...color,190],getLineWidth:2,lineWidthUnits:'pixels',
        getRadius:14,radiusUnits:'pixels',pickable:false}),
      new ScatterplotLayer({id:'atlas-route-points',data:nodes,getPosition:d=>d.coordinates,
        getFillColor:d=>d===active?[255,236,197,255]:[...color,210],getRadius:d=>d===active?6:4,
        radiusUnits:'pixels',pickable:false}),
    ];
    if(this.motion&&!document.hidden&&segments.length){
      layers.push(new TripsLayer({id:'atlas-route-trips',data:segmentData,getPath:d=>d.path,
        getTimestamps:d=>d.timestamps,getColor:color,opacity:.9,
        widthMinPixels:4,trailLength:9,currentTime:this.time,fadeTrail:true,jointRounded:true,capRounded:true,pickable:false}));
    }
    this.overlay.setProps({layers});
  }

  resize(){this.map.resize();}
  city(){
    const padding=screenPadding(this.container);
    const coordinates=(this.geography.features||[]).filter(f=>f.properties?.kind==='wall')
      .flatMap(f=>f.geometry.type==='LineString'?f.geometry.coordinates:f.geometry.type==='MultiLineString'?f.geometry.coordinates.flat():[])
      .filter(c=>Number.isFinite(c[0])&&Number.isFinite(c[1]));
    if(coordinates.length>1){
      const bounds=new LngLatBounds();coordinates.forEach(c=>bounds.extend(c));
      this.map.fitBounds(bounds,{padding,maxZoom:13,pitch:this.perspective===false?0:48,
        bearing:this.perspective===false?0:-16,duration:this.motion?1100:0});
    }else this.map.easeTo({center:CITY_CENTER,
      offset:[(padding.left-padding.right)/2,(padding.top-padding.bottom)/2],
      zoom:10.75,pitch:this.perspective===false?0:48,bearing:-16,duration:this.motion?1100:0});
  }
  fitRoute(route){
    const coords=(route?.stops||[]).map(stop=>this.places.find(place=>place.id===stop.place)?.geo)
      .filter(geo=>Number.isFinite(geo?.lon)&&Number.isFinite(geo?.lat));
    if(!coords.length)return false;
    const padding=screenPadding(this.container);
    if(coords.length===1){this.map.flyTo({center:[coords[0].lon,coords[0].lat],
      offset:[(padding.left-padding.right)/2,(padding.top-padding.bottom)/2],zoom:12,duration:this.motion?900:0});return true;}
    const bounds=new LngLatBounds();coords.forEach(geo=>bounds.extend([geo.lon,geo.lat]));
    this.map.fitBounds(bounds,{padding,
      maxZoom:13,duration:this.motion?1100:0});return true;
  }
  focus(id){
    const geo=this.places.find(place=>place.id===id)?.geo;
    if(!Number.isFinite(geo?.lon)||!Number.isFinite(geo?.lat))return false;
    const padding=screenPadding(this.container);
    this.map.flyTo({center:[geo.lon,geo.lat],offset:[(padding.left-padding.right)/2,(padding.top-padding.bottom)/2],
      zoom:Math.max(12,this.map.getZoom()),duration:this.motion?900:0});return true;
  }
  zoom(factor){if(Number.isFinite(factor)&&factor>0)this.map.zoomTo(Math.min(18,Math.max(7,this.map.getZoom()-Math.log2(factor))),{duration:this.motion?360:0});}
  showLayer(kind,visible){
    if(!(kind in this.visibility))return;
    this.visibility[kind]=Boolean(visible);this.applyVisibility();
    if(kind==='route'){this.drawRouteNumbers();this.renderRoute();this.refreshMotion();}
  }
  applyVisibility(){
    if(this.destroyed)return;
    for(const kind of KIND){
      const visible=this.visibility[kind==='river'?'water':kind];
      for(const id of kind==='wall'?['atlas-wall','atlas-wall-glow','atlas-wall-historic']:[`atlas-${kind}`]){
        if(this.map.getLayer(id))this.map.setLayoutProperty(id,'visibility',visible?'visible':'none');
      }
    }
    for(const {button} of this.markers){
      button.hidden=!this.visibility.places;
      button.style.display=this.visibility.places?'':'none';
    }
  }
  setMotion(enabled){this.userMotion=Boolean(enabled);this.updateMotion();}
  updateMotion(){this.motion=this.userMotion&&!this.reduced?.matches;this.refreshMotion();this.renderRoute();}
  refreshMotion(){
    if(this.raf){cancelAnimationFrame(this.raf);this.raf=0;}
    if(this.destroyed||!this.motion||document.hidden||!this.visibility.route||!this.routeModel.segments.length)return;
    let last=0;
    const tick=timestamp=>{
      if(!this.motion||document.hidden||this.destroyed||!this.visibility.route)return;
      if(last)this.time=(this.time+Math.min(50,timestamp-last)*.014)%34;
      last=timestamp;this.renderRoute();this.raf=requestAnimationFrame(tick);
    };
    this.raf=requestAnimationFrame(tick);
  }
  setPerspective(enabled){this.perspective=Boolean(enabled);this.map.easeTo({pitch:enabled?48:0,bearing:enabled?-16:0,duration:this.motion?650:0});}
  inspect(){
    const center=this.map.getCenter();
    const style=this.map.getStyle();
    const installedGroup=this.map.getLayer(DECK_GROUP);
    // MapLibre 6 omits custom layers from serialized getStyle(); query the live layer.
    const customGroups=installedGroup?[{id:DECK_GROUP,type:installedGroup.type,present:true}]:[];
    // Diagnostic view of the actual deck instance's final layers, not requested props.
    // This internal API may change with deck.gl; absent instance is reported as unknown.
    const deck=this.overlay?._deck;
    const finalLayers=deck?.layerManager?.getLayers?.();
    return {engine:'maplibre-gl',mode:this.mode,loaded:this.map.loaded(),
      sources:Object.keys(style?.sources||{}),
      layers:(style?.layers||[]).map(layer=>({id:layer.id,type:layer.type,
        visibility:this.map.getLayoutProperty(layer.id,'visibility')||'visible'})),
      center:[center.lng,center.lat],zoom:this.map.getZoom(),pitch:this.map.getPitch(),bearing:this.map.getBearing(),
      plannedSegments:this.visibility.route?this.routeModel.segments.map(segment=>({placeIds:segment.placeIds,stopIndices:segment.stopIndices,pathLength:segment.path.length})):[],
      deckCustomGroups:customGroups,deckLoaded:this.deckLoaded,deckRenderCount:this.deckRenderCount,
      overlayLayerIds:finalLayers?finalLayers.map(layer=>layer.id):null,
      overlayCanvasIsMapCanvas:Boolean(this.overlay?.getCanvas()&&this.overlay.getCanvas()===this.map.getCanvas()),
      motionRequested:this.userMotion,motionSystemLimited:Boolean(this.reduced?.matches),motionEnabled:this.motion,
      motionRunning:Boolean(this.raf),routeGroupPresent:Boolean(this.map.getLayer(DECK_GROUP))};
  }
  destroy(){
    if(this.destroyed)return;
    this.destroyed=true;
    if(this.raf)cancelAnimationFrame(this.raf);this.raf=0;
    document.removeEventListener('visibilitychange',this.onHidden);
    this.reduced?.removeEventListener?.('change',this.onReduced);
    for(const {marker} of this.markers)marker.remove();this.markers=[];
    for(const marker of this.routeNumberMarkers)marker.remove();this.routeNumberMarkers=[];
    try{this.overlay?.finalize();}finally{this.overlay=null;this.map.remove();}
  }
}
