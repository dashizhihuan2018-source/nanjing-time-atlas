import {chapters,conclusion,imperialTours} from './exhibition.mjs';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const kindNames={evidence:'史料记载',reconstruction:'论文复原',interpretation:'作者解释'};
const $=id=>document.getElementById(id);
export function initReader({onPlace,onRoute,onTour,onOpen=()=>{},placeLabels=[]}){
  const room=$('reading-room'),content=$('chapter-content');
  let chapterId=chapters[0].id,lastFocus=null;
  const publicMode=document.querySelector('meta[name="atlas-mode"]')?.content==='public';
  function pageLink(pages){return publicMode?'./sources.html#paper-pages':`./paper.pdf#page=${Math.min(...pages)+7}`;}
  function pageCitation(pages){return `<a class="reading-citation" href="${pageLink(pages)}" target="_blank" rel="noreferrer">论文印刷页 ${pages.join('、')} <span>↗</span></a>`;}
  function setHash(section){const h=new URLSearchParams({chapter:chapterId});if(section)h.set('section',section);history.replaceState(null,'',location.pathname+location.search+'#'+h);}
  function close(){if(room.hidden)return;room.hidden=true;document.body.classList.remove('is-reading');history.replaceState(null,'',location.pathname+location.search);lastFocus?.focus();}
  function open(id=chapterId,section){lastFocus=room.hidden?document.activeElement:lastFocus;onOpen();room.hidden=false;document.body.classList.add('is-reading');render(id,section);$('reading-close').focus({preventScroll:true});}
  function table(comparison){return `<div class="comparison-scroll" tabindex="0" role="region" aria-label="${escape(comparison.columns[0])}比较表"><table><thead><tr>${comparison.columns.map(c=>`<th scope="col">${escape(c)}</th>`).join('')}</tr></thead><tbody>${comparison.rows.map(row=>`<tr>${row.map((cell,i)=>`<${i?'td':'th scope="row"'}>${escape(cell)}</${i?'td':'th'}>`).join('')}</tr>`).join('')}</tbody></table></div>`;}
  function defenseDiagram(){return `<div class="defense-diagram" aria-label="三层防御关系示意，非地理范围或测绘"><svg viewBox="0 0 660 280" role="img" aria-label="由城防核心，经三门户，联系区域缓冲的三层关系"><g fill="none" stroke="#64d5c8"><ellipse cx="330" cy="140" rx="290" ry="115" opacity=".25"/><ellipse cx="330" cy="140" rx="210" ry="82" opacity=".45"/><ellipse cx="330" cy="140" rx="114" ry="46" stroke="#c69f69"/><path d="M40 140H216M444 140H620M330 25V94M330 186V255" opacity=".2"/></g><g text-anchor="middle" fill="#93b5be" font-size="11"><text x="330" y="19">区域缓冲 · 北 / 东 / 长江上游</text><text x="330" y="74">三门户 · 清流关 / 瓜州 / 采石</text><text x="330" y="137" fill="#e6c79b" font-size="23">南京城防核心</text><text x="330" y="162" font-size="10">因山为城 · 郊营伏场 · 江防要塞</text></g></svg><p>作者提出的跨尺度关系模型 · 椭圆不表示实际边界或防御距离</p></div>`;}
  function tourChooser(){return `<section class="tour-selector" aria-label="选择十二次南巡"><div class="section-label">十二巡 / 分别观看</div><div class="tour-grid">${imperialTours.map(t=>`<button data-imperial-tour="${escape(t.id)}"><span>${t.year}</span><strong>${escape(t.title)}</strong><i>↗</i></button>`).join('')}</div><p>选择巡次，在地图中对照论文记载的驻跸顺序；不等于每日行走轨迹。</p></section>`;}
  function render(id,section){
    const chapter=chapters.find(c=>c.id===id)||chapters[0];chapterId=chapter.id;
    for(const button of $('chapter-nav').children)button.setAttribute('aria-selected',String(button.dataset.chapter===chapter.id));
    $('section-nav').innerHTML=`<span class="section-label">本章索引</span>${chapter.sections.map((s,i)=>`<button data-section="${escape(s.id)}"><span>${String(i+1).padStart(2,'0')}</span>${escape(s.title)}</button>`).join('')}<button data-section="research-limitations"><span>↳</span>研究边界</button>`;
    content.innerHTML=`<header class="chapter-intro"><span class="eyebrow">${escape(chapter.kicker)}</span><h2>${escape(chapter.title)}</h2><p>${escape(chapter.summary)}</p>${pageCitation(chapter.pages)}</header>${chapter.id==='defense'?defenseDiagram():''}${chapter.id==='tours'?tourChooser():''}${chapter.sections.map((s,i)=>`<section class="research-section" id="reading-${escape(s.id)}"><div class="section-meta"><span>${String(i+1).padStart(2,'0')} / ${kindNames[s.kind]}</span>${pageCitation(s.pages)}</div><h3>${escape(s.title)}</h3>${s.body.map(p=>`<p>${escape(p)}</p>`).join('')}${s.comparison?table(s.comparison):''}${s.items?.length?`<dl class="research-items">${s.items.map(item=>`<div><dt>${escape(item.title)}${item.kind==='palace'?'<small>行宫</small>':item.kind==='day-seat'?'<small>行座地点</small>':''}</dt><dd>${escape(item.text)}${item.placeId?`<button class="inline-map-link" data-reading-place="${escape(item.placeId)}">在地图参照 ↗</button>`:''}</dd></div>`).join('')}</dl>`:''}${s.placeIds?.length||s.routeId?`<div class="section-map-links">${s.routeId?`<button data-reading-route="${escape(s.routeId)}">循路线读这一节 ⟶</button>`:''}${s.placeIds.map(p=>`<button data-reading-place="${escape(p)}" data-place-label="${escape(p)}">地点参照 ↗</button>`).join('')}</div>`:''}</section>`).join('')}<section class="research-section research-limitations" id="reading-research-limitations"><span class="eyebrow">研究不止于此 / 论文结语 114—115</span><h3>已经看见的，尚待证实的。</h3><h4>研究贡献</h4><ul>${conclusion.contributions.map(p=>`<li>${escape(p)}</li>`).join('')}</ul><h4>论文的边界</h4><ul>${conclusion.limitations.map(p=>`<li>${escape(p)}</li>`).join('')}</ul><h4>后续研究</h4><ul>${conclusion.nextSteps.map(p=>`<li>${escape(p)}</li>`).join('')}</ul>${pageCitation([114,115])}</section><div class="chapter-end"><span>继续阅读</span><button id="next-chapter">${escape(chapters[(chapters.indexOf(chapter)+1)%chapters.length].title)} ⟶</button></div>`;
    const names=Object.fromEntries(placeLabels.map(p=>[p.id,p.name]));
    for(const button of content.querySelectorAll('[data-place-label]'))button.textContent=(names[button.dataset.placeLabel]||'地点')+' ↗';
    $('next-chapter').addEventListener('click',()=>render(chapters[(chapters.indexOf(chapter)+1)%chapters.length].id));
    content.scrollTop=0;setHash(section);
    if(section)requestAnimationFrame(()=>$('reading-'+section)?.scrollIntoView({block:'start'}));
  }
  $('chapter-nav').setAttribute('role','tablist');
  for(const chapter of chapters){const b=document.createElement('button');b.dataset.chapter=chapter.id;b.setAttribute('role','tab');b.setAttribute('aria-selected','false');b.textContent=chapter.title;b.addEventListener('click',()=>render(chapter.id));$('chapter-nav').append(b);}
  $('section-nav').addEventListener('click',e=>{const b=e.target.closest('[data-section]');if(b){$('reading-'+b.dataset.section)?.scrollIntoView({block:'start',behavior:'auto'});setHash(b.dataset.section);}});
  content.addEventListener('click',e=>{
    const p=e.target.closest('[data-reading-place]'),r=e.target.closest('[data-reading-route]'),t=e.target.closest('[data-imperial-tour]');
    if(p){close();onPlace(p.dataset.readingPlace);}if(r){close();onRoute(r.dataset.readingRoute);}if(t){close();onTour?.(t.dataset.imperialTour);}
  });
  $('reading-open').addEventListener('click',()=>open());$('reading-close').addEventListener('click',close);
  room.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();close();}});
  const initial=new URLSearchParams(location.hash.slice(1));if(initial.has('chapter'))open(initial.get('chapter'),initial.get('section'));
  window.addEventListener('hashchange',()=>{const p=new URLSearchParams(location.hash.slice(1));if(p.has('chapter'))open(p.get('chapter'),p.get('section'));else if(!room.hidden)close();});
  return {open,close,isOpen:()=>!room.hidden};
}
