import {routes,places,events,sources,paperURL,thesis} from './history.mjs';
import {normalizeState,stateFromURL,stateToURL,selectRoute,stepRoute,eventForYear} from './state.mjs';
import {AtlasMap,resolvePlaces} from './map.mjs';
import {initReader} from './reader.mjs';

const $=id=>document.getElementById(id);
const publicMode=document.querySelector('meta[name="atlas-mode"]')?.content==='public';
const escape=text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state=stateFromURL(location.search),map,resolved=places.map(p=>({...p,geo:null})),playing=null,noticeTimer,evidenceContext=null;
let motion=!matchMedia('(prefers-reduced-motion: reduce)').matches,perspective=true;
let reader;
function notify(message){$('notice').textContent=message;$('notice').hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').hidden=true,4200);}
function era(year){if(year>=1736)return `乾隆${year-1735}年`;if(year>=1723)return `雍正${year-1722}年`;if(year>=1662)return `康熙${year-1661}年`;return `顺治${year-1643}年`;}
function currentRoute(){return routes.find(r=>r.id===state.route);}
function stopPlaying(){clearInterval(playing);playing=null;$('play-route').textContent='▶';$('play-route').setAttribute('aria-label','播放路线');}
function closeMenu(){$('sidebar').classList.remove('open');$('menu-toggle').setAttribute('aria-expanded','false');}

function renderRoutes(){
  $('route-list').replaceChildren();
  for(const route of routes.filter(r=>r.featured!==false&&(state.topic==='all'||r.topic===state.topic))){
    const button=document.createElement('button');button.className='route-option';button.setAttribute('aria-pressed',String(state.route===route.id));button.setAttribute('aria-label',route.title);
    button.innerHTML=`<span class="route-year">${route.year}</span><span><span class="route-name">${escape(route.title)}</span><span class="route-subtitle">${escape(route.subtitle)}</span></span><span class="route-arrow" aria-hidden="true">↗</span>`;
    button.addEventListener('click',()=>chooseRoute(route.id));$('route-list').append(button);
  }
  document.querySelectorAll('[data-topic]').forEach(b=>{if(b.closest('.topic-tabs'))b.setAttribute('aria-pressed',String(b.dataset.topic===state.topic));});
}
function renderTimeline(){
  const current=eventForYear(state.year);$('year-value').textContent=state.year;
  $('era-label').textContent=events.find(e=>e.year===state.year)?.era||era(state.year);
  $('year-range').value=state.year;
  $('event-caption').textContent=(current.year===state.year?'':'最近节点 · ')+current.title;
  for(const button of $('timeline-nodes').children)button.classList.toggle('active',Number(button.dataset.year)===current.year);
}
function renderPlayer(){
  const route=currentRoute();$('route-player').hidden=!route;
  if(!route)return;
  const stage=route.stops[state.step],place=resolved.find(p=>p.id===stage.place);
  $('route-era').textContent=`${route.year} / ${route.era} · ${route.title}`;
  $('route-stage').textContent=stage.title+(place?.geo?'':' · 未精确定位');
  $('stage-description').textContent=(stage.date?stage.date+' · ':'')+stage.text;
  $('step-count').textContent=`${state.step+1} / ${route.stops.length}`;
  $('prev-stop').disabled=state.step===0;$('next-stop').disabled=state.step===route.stops.length-1;
  $('route-stop-list').replaceChildren();
  route.stops.forEach((stop,i)=>{
    const place=resolved.find(p=>p.id===stop.place),button=document.createElement('button');
    const label=stop.label||place.name;
    button.className=i===state.step?'active':'';button.setAttribute('aria-label',`第${i+1}站 ${label}`);
    button.innerHTML=`<span class="stop-index">${String(i+1).padStart(2,'0')}</span>${escape(label)}${place.geo?'':'<span class="unlocated-tag">待定位</span>'}`;
    button.addEventListener('click',()=>{stopPlaying();commit({...state,step:i,place:null});focusStage();});$('route-stop-list').append(button);
  });
  $('route-stop-list').querySelector('.active')?.scrollIntoView({block:'nearest',inline:'nearest'});
}
function renderHeading(){
  const route=currentRoute();$('map-kicker').textContent=route?(route.topic==='war'?'战事 / 城防与门户':'南巡 / 行宫与胜境'):'江宁府 · 城市空间';
  $('map-title').textContent=route?route.title:'一座城的山水骨架';
  $('map-subtitle').textContent=route?'虚线连接历史节点 · 并非精确古道路':'城墙、山水与历史地点 · 现代底图参照';
}
function commit(next,{url=true}={}){
  if(url)reader?.close();
  state=normalizeState(next);
  // Clearing a selected place must also retire its source context, including
  // step buttons, playback, timeline changes and URL restoration.
  if(evidenceContext?.type==='place'&&state.place!==evidenceContext.id)
    evidenceContext={type:state.route?'route':'event'};
  if(url)history.replaceState(null,'',stateToURL(state));
  renderRoutes();renderTimeline();renderPlayer();renderHeading();map?.setState(state,currentRoute());
  if(!$('evidence-panel').hidden)renderEvidence();
}
function chooseRoute(id){reader?.close();stopPlaying();evidenceContext={type:'route'};state=selectRoute(state,id);closeMenu();commit(state);map?.fitRoute(currentRoute());$('search-results').hidden=true;$('place-search').value='';}
function focusStage(){
  const stop=currentRoute()?.stops[state.step];if(!stop)return;
  if(!map?.focus(stop.place))notify('这一站尚未精确定位：保留论文叙述，不在地图猜坐标。');
}
function showPlace(id){
  stopPlaying();evidenceContext={type:'place',id};commit({...state,place:id});map?.focus(id);openEvidence();
  $('search-results').hidden=true;$('place-search').value='';closeMenu();
}
function sourceHTML(id){
  const source=sources[id];return `<section class="evidence-section"><h3>论文出处 / 可追溯阅读</h3><p class="source-title">${escape(source.title)}</p><span class="source-pages">印刷页 ${source.pages.join('、')} 页</span><p>${source.figures.length?source.figures.map(escape).join(' · '):'正文论述'}</p><p>${escape(source.summary)}</p><p>${thesis.author}，${thesis.school}，${thesis.year}<br>《${thesis.title}》</p></section>`;
}
function renderEvidence(){
  let source='method',content='';
  if(evidenceContext?.type==='place'){
    const place=resolved.find(p=>p.id===evidenceContext.id);if(!place)return;
    source=place.source;content=`<span class="eyebrow">点地查证 / ${place.geo?'现代位置参照':'尚未定位'}</span><h2>${escape(place.name)}</h2><div class="evidence-modern">${escape(place.modern)}</div><p class="evidence-description">${escape(place.description)}</p><section class="evidence-section"><h3>空间定位 / 不确定性</h3><p>${escape(place.locationNote)}</p>${place.geo?`<p class="small">现代OSM参照：${escape(place.geo.note||'非历史精确测绘落点')}</p><a class="geographic-link" href="${escape(place.geo.source)}" target="_blank" rel="noreferrer">查看现代地理对象 ↗</a>`:'<p class="evidence-quote">此处保留史料记录，但不绘制未经证实的坐标。</p>'}</section>`;
  }else if(evidenceContext?.type==='route'&&currentRoute()){
    const route=currentRoute(),stop=route.stops[state.step];source=route.source;
    content=`<span class="eyebrow">循迹查证 / ${route.year}</span><h2>${escape(route.title)}</h2><div class="evidence-modern">${escape(route.subtitle)}</div><p class="evidence-description">${escape(stop.title)}${stop.date?' · '+escape(stop.date):''}<br>${escape(stop.text)}</p><p class="evidence-quote">${escape(route.note)}</p>`;
  }else{
    const event=eventForYear(state.year);source=event.source;
    content=`<span class="eyebrow">时间节点 / ${event.year}</span><h2>${escape(event.title)}</h2><div class="evidence-modern">${escape(event.era)}</div><p class="evidence-description">${escape(event.text)}</p>${event.year!==state.year?`<p class="evidence-quote">当前年份${state.year}没有独立复原快照，显示此前最近的史料节点${event.year}；不表示城貌逐年变化。</p>`:''}`;
  }
  $('evidence-content').innerHTML=content+sourceHTML(source);
  $('paper-link').href=publicMode?`./sources.html#${source}`:paperURL(source);
  if(publicMode){$('paper-link').firstChild.textContent='查看论文出处 ';document.querySelector('.paper-note').textContent='公开版仅展示书目信息与页码，不提供论文全文。';}
}
function openEvidence(){reader?.close();$('search-results').hidden=true;$('layers-panel').hidden=true;$('layers-toggle').setAttribute('aria-expanded','false');$('evidence-panel').hidden=false;renderEvidence();$('evidence-close').focus();}

for(const event of events.filter(e=>!e.minor)){
  const button=document.createElement('button');button.className='timeline-node';button.dataset.year=event.year;button.dataset.topic=event.topic;button.textContent=event.year;button.title=event.title;button.setAttribute('aria-label',`${event.year} ${event.title}`);
  button.addEventListener('click',()=>{stopPlaying();evidenceContext={type:'event'};if(event.route)chooseRoute(event.route);else{commit({...state,year:event.year,route:null,step:0,place:null});map?.city();}});$('timeline-nodes').append(button);
}
document.querySelectorAll('.topic-tabs button').forEach(button=>button.addEventListener('click',()=>{
  stopPlaying();const topic=button.dataset.topic;
  const route=currentRoute()?.topic===topic||topic==='all'?state.route:null;
  evidenceContext={type:route?'route':'event'};commit({...state,topic,route,place:null});
}));
$('year-range').addEventListener('input',event=>{stopPlaying();evidenceContext={type:'event'};commit({...state,year:Number(event.target.value),place:null});});
$('prev-stop').addEventListener('click',()=>{stopPlaying();commit({...stepRoute(state,-1),place:null});focusStage();});
$('next-stop').addEventListener('click',()=>{stopPlaying();commit({...stepRoute(state,1),place:null});focusStage();});
$('play-route').addEventListener('click',()=>{
  if(playing)return stopPlaying();const route=currentRoute();if(!route)return;
  if(state.step===route.stops.length-1)commit({...state,step:0,place:null});
  $('play-route').textContent='Ⅱ';$('play-route').setAttribute('aria-label','暂停路线');
  playing=setInterval(()=>{if(state.step>=route.stops.length-1)return stopPlaying();commit({...stepRoute(state,1),place:null});focusStage();if(state.step===route.stops.length-1)stopPlaying();},2600);
});
$('evidence-open').addEventListener('click',()=>{evidenceContext={type:'route'};openEvidence();});
$('timeline-info').addEventListener('click',()=>{evidenceContext={type:'event'};openEvidence();});
$('evidence-close').addEventListener('click',()=>{$('evidence-panel').hidden=true;$('evidence-open').offsetParent?$('evidence-open').focus():$('timeline-info').focus();});
$('city-view').addEventListener('click',()=>map?.city());
$('exhibition-enter').addEventListener('click',()=>{chooseRoute('qianlong-1757');focusStage();});
$('motion-toggle').setAttribute('aria-pressed',String(motion));
$('motion-toggle').addEventListener('click',()=>{motion=!motion;map?.setMotion?.(motion);$('motion-toggle').setAttribute('aria-pressed',String(map?.inspect?.().motionEnabled??motion));});
$('perspective-toggle').addEventListener('click',()=>{perspective=!perspective;map?.setPerspective?.(perspective);$('perspective-toggle').setAttribute('aria-pressed',String(perspective));});
$('map').addEventListener('atlas:view',event=>{const [lon,lat]=event.detail.center;$('map-coordinates').textContent=`${lat.toFixed(3)}° N / ${lon.toFixed(3)}° E`;});
$('zoom-in').addEventListener('click',()=>map?.zoom(.75));$('zoom-out').addEventListener('click',()=>map?.zoom(1.33));
$('layers-toggle').addEventListener('click',()=>{reader?.close();$('evidence-panel').hidden=true;$('search-results').hidden=true;const hidden=!$('layers-panel').hidden;$('layers-panel').hidden=hidden;$('layers-toggle').setAttribute('aria-expanded',String(!hidden));});
document.querySelectorAll('input[data-layer]').forEach(input=>input.addEventListener('change',()=>map?.showLayer(input.dataset.layer,input.checked)));
$('menu-toggle').addEventListener('click',()=>{const open=$('sidebar').classList.toggle('open');$('menu-toggle').setAttribute('aria-expanded',String(open));});
$('place-search').addEventListener('input',event=>{
  reader?.close();$('layers-panel').hidden=true;$('layers-toggle').setAttribute('aria-expanded','false');
  const query=event.target.value.trim();$('search-results').replaceChildren();$('search-results').hidden=!query;if(!query)return;
  $('evidence-panel').hidden=true;
  const matches=resolved.filter(p=>[p.name,p.modern,...p.geoNames].some(n=>n.includes(query))).slice(0,9);
  if(!matches.length){const p=document.createElement('p');p.textContent='未找到此地。试试“仪凤门”“栖霞”或“江宁”。';$('search-results').append(p);}
  for(const place of matches){const button=document.createElement('button');button.innerHTML=`${escape(place.name)}<small>${escape(place.modern)}${place.geo?'':' · 未定位'}</small>`;button.addEventListener('click',()=>showPlace(place.id));$('search-results').append(button);}
});
$('place-search').addEventListener('keydown',event=>{if(event.key==='Enter'){$('search-results').querySelector('button')?.click();}if(event.key==='ArrowDown'){$('search-results').querySelector('button')?.focus();event.preventDefault();}});
for(const id of ['about-open','method-open','data-status'])$(id).addEventListener('click',()=>$('about-dialog').showModal());
$('about-close').addEventListener('click',()=>$('about-dialog').close());
$('about-dialog').addEventListener('click',e=>{if(e.target===$('about-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
document.addEventListener('keydown',event=>{
  if(event.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){event.preventDefault();$('place-search').focus();}
  if(event.key==='Escape'){$('search-results').hidden=true;$('layers-panel').hidden=true;$('layers-toggle').setAttribute('aria-expanded','false');$('evidence-panel').hidden=true;closeMenu();}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopPlaying();});
window.addEventListener('popstate',()=>{stopPlaying();commit(stateFromURL(location.search),{url:false});if(currentRoute())map?.fitRoute(currentRoute());});
let resizeTimer;
window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{map?.resize?.();if(currentRoute())map?.fitRoute(currentRoute());},180);});
reader=initReader({onPlace:showPlace,onRoute:chooseRoute,onTour:id=>chooseRoute('overnight-'+id),placeLabels:places,onOpen:()=>{
  stopPlaying();
  $('evidence-panel').hidden=true;$('search-results').hidden=true;$('place-search').value='';
  $('layers-panel').hidden=true;$('layers-toggle').setAttribute('aria-expanded','false');
}});

async function init(){
  commit(state,{url:false});
  try{
    const response=await fetch(new URL('../public/data/geography.json',import.meta.url));if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const geography=await response.json();if(geography.type!=='FeatureCollection'||!geography.features?.length)throw new Error('地理数据为空');
    resolved=resolvePlaces(places,geography);
    $('map').replaceChildren();
    let candidate;
    try{
      const {GisMap}=await import('../public/gis/gis-map.mjs');
      candidate=new GisMap($('map'),geography,resolved,showPlace);
      let timer;try{await Promise.race([candidate.ready,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('GPU地图初始化超时')),12000);})]);}finally{clearTimeout(timer);}
      map=candidate;map.setMotion(motion);map.setPerspective(perspective);document.body.dataset.engine='maplibre';
    }catch(error){
      try{candidate?.destroy();}catch{}$('map').replaceChildren();
      map=new AtlasMap($('map'),geography,resolved,showPlace);document.body.dataset.engine='svg';
      for(const id of ['motion-toggle','perspective-toggle']){$(id).disabled=true;$(id).setAttribute('aria-pressed','false');}
      notify('当前设备未能启用GPU地图，已切换二维矢量模式；论文内容与路线仍可阅读。');
      console.warn('GIS fallback:',error.message);
    }
    $('map').atlasMap=map;commit(state,{url:false});
    if(currentRoute())map.fitRoute(currentRoute());if(state.place){evidenceContext={type:'place',id:state.place};map.focus(state.place);if(!reader.isOpen())openEvidence();}
    const count=resolved.filter(p=>p.geo).length;
    if(count<8)notify('部分历史地点缺少现代地理参照，可在资料面板查看未定位说明。');
    document.body.dataset.ready='true';
  }catch(error){
    $('map').innerHTML='<div class="map-loading">地理资料未能载入，请刷新本地网站。历史目录与论文出处仍可阅读。</div>';
    notify(`底图加载失败：${error.message}`);document.body.dataset.ready='error';
  }
}
init();
