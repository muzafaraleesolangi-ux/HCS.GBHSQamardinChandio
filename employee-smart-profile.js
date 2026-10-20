/* Smart Nature employee workspace. Presentation only: existing save, verification,
   photo, print and logout handlers remain the authority. */
(function(){
 'use strict';
 const q=(s,r=document)=>r.querySelector(s), qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
 const paths={back:'M19 12H5m6-6-6 6 6 6',print:'M7 8V3h10v5M7 17H4V8h16v9h-3M7 14h10v7H7z',logout:'M10 4H4v16h6m4-12 4 4-4 4m-6-4h12',history:'M3 11a9 9 0 1 1 2 7M3 4v7h7m2-5v6l4 2',send:'m3 3 18 9-18 9 4-9-4-9Zm4 9h14',save:'M5 3h12l4 4v14H3V3Zm2 0v6h10V3M7 21v-8h10v8',leaf:'M20 3C9 1 2 7 5 15c8 6 17-1 15-12ZM4 21l11-12',edit:'m4 16 12-12 4 4-12 12H4v-4Zm10-10 4 4',check:'m5 12 4 4L19 6',close:'m6 6 12 12M6 18 18 6',info:'M12 11v6m0-10v1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0'};
 const icon=name=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+'<path d="'+(paths[name]||paths.info)+'"/></svg>';
 function button(id,label,name){const b=document.createElement('button');b.id=id;b.type='button';b.className='qsp-button';b.innerHTML=icon(name)+'<span>'+label+'</span>';return b;}
 function putText(node,text){if(node&&node.textContent!==String(text))node.textContent=text;}
 const empty=v=>!String(v??'').trim()||/^(?:[—–-]+|not on record|not recorded|not assigned|select(?: an option)?)$/i.test(String(v).trim());
 function visibleFields(){return qa('#r-fields .field').filter(f=>!f.hidden&&!f.closest('[hidden]'));}
 function filled(field){const c=q('input:not([type=checkbox]),select,textarea',field);const v=q('.v',field);return !empty(c?c.value:v?.classList.contains('blank')?'':v?.textContent);}
 let queued=false,screen,overview,aside,popup,historyButton,topSubmit,frame,fadeTimer;
 function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;refresh();});}
 function isEditing(){return !!q('#inline-edit-bar')&&!q('#inline-edit-bar').classList.contains('hidden');}
 function sectionData(){let section=null;const list=[];for(const n of q('#r-fields').children){if(n.classList.contains('qdc-field-section')){section={label:q('b',n)?.textContent||'Profile details',fields:[]};list.push(section);}else if(n.classList.contains('field')&&!n.hidden){if(!section){section={label:'Profile details',fields:[]};list.push(section);}section.fields.push(n);}}return list.filter(s=>s.fields.length);}
 function refresh(){
  if(!screen||screen.classList.contains('hidden')||screen.classList.contains('hm-tab-dashboard')){closeHistory();return;}
  const fields=visibleFields(),complete=fields.filter(filled).length,total=fields.length,pct=total?Math.round(complete/total*100):0;
  const meter=q('#qsp-progress-ring');if(meter){meter.style.setProperty('--qsp-progress',pct+'%');meter.setAttribute('aria-valuenow',String(pct));meter.setAttribute('aria-valuetext',complete+' of '+total+' visible fields filled');}
  putText(q('#qdc7-pct'),pct+'%');putText(q('#qdc7-reviewed'),complete);putText(q('#qdc7-missing'),total-complete);
  putText(q('#qdc7-completed'),complete+' of '+total+' visible fields');
  const bar=q('#inline-edit-bar'),native=q('#btn-inline-submit'),edit=isEditing();
  if(screen.classList.contains('qsp-editing')!==edit)screen.classList.toggle('qsp-editing',edit);
  topSubmit.hidden=!edit;topSubmit.disabled=!!native?.disabled;
  topSubmit.classList.toggle('qsp-busy',!!native?.disabled);
  const banner=q('#qdc-editor-banner');if(banner)banner.classList.toggle('qsp-compact-banner',!edit);
  // Summary describes saved changes separately from completeness and unsaved typing.
  let draft={},pending={},photo=false,unsaved=false;
  try{draft=inlineDraftMap();pending=pendingCorrectionMap();photo=!!DRAFT_PHOTO;unsaved=!!PROFILE_UNSAVED;}catch(e){}
  const waiting=Object.keys(pending).length>0;const count=Object.keys(draft).length;
  putText(q('#qsp-draft-title'),waiting?'Submitted for Review':'Saved Draft');
  putText(q('#qsp-draft-state'),waiting?'Awaiting admin verification':unsaved?'Unsaved edits — save your draft':count||photo?'Your saved work is ready to continue':'No saved changes yet');
  putText(q('#qsp-draft-count'),waiting?Object.keys(pending).length+' submitted changes':count+' saved change'+(count===1?'':'s')+(photo?' · Photo saved':''));
  aside.classList.toggle('qsp-unsaved',unsaved);aside.classList.toggle('qsp-pending',waiting);
  const groups=sectionData(),signature=groups.map(s=>s.label+':'+s.fields.filter(filled).length+'/'+s.fields.length).join('|');
  const list=q('#qsp-section-status');
  if(list.dataset.signature!==signature){list.dataset.signature=signature;list.replaceChildren();groups.forEach(group=>{
   const done=group.fields.filter(filled).length,b=document.createElement('button');b.type='button';b.className='qsp-section-link'+(done===group.fields.length?' complete':'');
   b.innerHTML=icon(done===group.fields.length?'check':'info');const copy=document.createElement('span'),name=document.createElement('b'),detail=document.createElement('small');name.textContent=group.label;detail.textContent=done+' / '+group.fields.length+' filled';copy.append(name,detail);b.append(copy);
   b.addEventListener('click',()=>{const target=group.fields.find(f=>!filled(f))||group.fields[0];target?.scrollIntoView({behavior:'smooth',block:'center'});});list.append(b);
  });}
  const resume=q('#qsp-resume'),nativeEdit=q('#btn-inline-edit');resume.hidden=waiting||(!edit&&nativeEdit?.classList.contains('hidden'));
  putText(q('#qsp-resume span'),edit?'Continue editing':'Resume editing');
  const summary=q('#inline-change-summary');if(summary&&summary.parentElement!==aside)aside.insertBefore(summary,q('#qsp-resume'));
  const print=q('#btn-print');if(print&&!print.dataset.qspStyled){print.dataset.qspStyled='1';print.innerHTML=icon('print')+'<span>Print / PDF</span>';}
  fields.forEach(f=>f.classList.toggle('qsp-filled',filled(f)));
 }
 function closeHistory(restore=false){if(!popup)return;popup.classList.remove('open');popup.setAttribute('aria-hidden','true');popup.inert=true;historyButton.setAttribute('aria-expanded','false');if(restore)historyButton.focus();}
 function placeHistory(){const rect=historyButton.getBoundingClientRect(),width=Math.min(380,innerWidth-24);popup.style.width=width+'px';popup.style.left=Math.max(12,Math.min(rect.right-width,innerWidth-width-12))+'px';popup.style.top=Math.min(rect.bottom+9,Math.max(12,innerHeight-170))+'px';popup.style.maxHeight=Math.max(100,innerHeight-parseFloat(popup.style.top)-16)+'px';}
 function openHistory(){clearTimeout(fadeTimer);placeHistory();popup.inert=false;popup.classList.add('open');popup.setAttribute('aria-hidden','false');historyButton.setAttribute('aria-expanded','true');}
 function leaveHistory(){clearTimeout(fadeTimer);fadeTimer=setTimeout(()=>{if(!popup.matches(':hover')&&!historyButton.matches(':hover'))closeHistory();},120);}
 function start(){
  screen=q('#screen-record');overview=q('#qdc7-overview');if(!screen||!overview)return;
  screen.classList.add('qdc-smart-profile');
  const card=q(':scope > .card',screen),header=q('.recordhead',screen);
  const toolbar=document.createElement('nav');toolbar.className='qsp-toolbar noprint';toolbar.setAttribute('aria-label','Employee profile actions');
  const badge=document.createElement('div');badge.className='qsp-toolbar-brand';badge.innerHTML=icon('leaf')+'<span>EMPLOYEE WORKSPACE<small>Your record. Your progress.</small></span>';toolbar.append(badge);
  const actions=document.createElement('div');actions.className='qsp-top-actions';toolbar.append(actions);card.insertBefore(toolbar,header);
  [['btn-back','Back','back'],['btn-print','Print / PDF','print']].forEach(([id,label,name])=>{const b=q('#'+id);if(b){b.classList.add('qsp-button');b.innerHTML=icon(name)+'<span>'+label+'</span>';actions.append(b);}});
  historyButton=button('qsp-history-button','Update History','history');historyButton.setAttribute('aria-controls','qsp-history-popup');historyButton.setAttribute('aria-expanded','false');actions.append(historyButton);
  const logout=q('#btn-emp-logout');if(logout){logout.classList.add('qsp-button');logout.innerHTML=icon('logout')+'<span>Logout</span>';actions.append(logout);}
  popup=document.createElement('section');popup.id='qsp-history-popup';popup.className='qsp-history-popup noprint';popup.setAttribute('role','dialog');popup.setAttribute('aria-label','Update History');popup.setAttribute('aria-hidden','true');popup.inert=true;
  const close=button('qsp-history-close','Close','close');close.setAttribute('aria-label','Close update history');const heading=document.createElement('div');heading.className='qsp-popup-heading';heading.innerHTML='<b>Update History</b>';heading.append(close);popup.append(heading);
  const hist=q('#rs-hist .hist');if(hist)popup.append(hist);document.body.append(popup);
  historyButton.addEventListener('click',()=>popup.classList.contains('open')?closeHistory():openHistory());
  historyButton.addEventListener('pointerleave',leaveHistory);popup.addEventListener('pointerleave',leaveHistory);popup.addEventListener('pointerenter',()=>clearTimeout(fadeTimer));close.addEventListener('click',()=>closeHistory(true));
  document.addEventListener('click',e=>{if(!popup.contains(e.target)&&!historyButton.contains(e.target))closeHistory();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&popup.classList.contains('open'))closeHistory(true);});
  document.addEventListener('focusin',e=>{if(popup.classList.contains('open')&&!popup.contains(e.target)&&!historyButton.contains(e.target))closeHistory();});
  window.addEventListener('resize',()=>{if(popup.classList.contains('open'))placeHistory();});window.addEventListener('scroll',()=>closeHistory(),{passive:true});
  // Keep the established edit event; remove duplicate presentation controls.
  q('.qdc7-overview-icon',overview).innerHTML=icon('leaf');
  putText(q('.qdc7-overview-copy small',overview),'SMART EMPLOYEE WORKSPACE');
  putText(q('.qdc7-overview-copy h2',overview),'My Employee Profile');
  putText(q('.qdc7-overview-copy p',overview),'Review your record, save your progress and submit for admin verification.');
  q('#qdc7-edit span').innerHTML=icon('edit');
  q('#qdc7-print').hidden=true;
  const first=q('.qdc7-kpi-icon',overview);first.id='qsp-progress-ring';first.setAttribute('role','progressbar');first.setAttribute('aria-label','Profile completion');first.setAttribute('aria-valuemin','0');first.setAttribute('aria-valuemax','100');first.innerHTML=icon('leaf');
  qa('.qdc7-kpi-icon',overview).slice(1).forEach((n,i)=>n.innerHTML=icon(i?'info':'check'));
  topSubmit=button('qsp-submit-top','Submit for Verification','send');topSubmit.classList.add('qsp-primary');topSubmit.hidden=true;q('.qdc7-overview-actions',overview).append(topSubmit);
  topSubmit.addEventListener('click',()=>{const native=q('#btn-inline-submit');if(isEditing()&&native&&!native.disabled)native.click();});
  frame=document.createElement('div');frame.className='qsp-workspace-grid';const fields=q('#r-fields');fields.before(frame);frame.append(fields);
  aside=document.createElement('aside');aside.className='qsp-draft-panel';aside.setAttribute('aria-label','Saved draft overview');
  aside.innerHTML='<div class="qsp-draft-heading">'+icon('save')+'<h3 id="qsp-draft-title">Saved Draft</h3></div><p id="qsp-draft-state"></p><small id="qsp-draft-count"></small><div id="qsp-section-status"></div>';
  const resume=button('qsp-resume','Resume editing','edit');aside.append(resume);const caption=document.createElement('p');caption.className='qsp-draft-caption';caption.textContent='Complete details. Clear records. Better service.';aside.append(caption);const art=document.createElement('div');art.className='qsp-nature-art';art.setAttribute('aria-hidden','true');art.innerHTML='<svg viewBox="0 0 260 100" fill="none"><path d="M0 68 45 24l42 32 46-43 67 52 25-28 35 30v33H0Z" fill="#dce5d2"/><path d="m0 79 65-31 39 29 63-36 93 40v19H0Z" fill="#a8bca0"/><path d="m0 91 60-13 62 13 84-17 54 17v9H0Z" fill="#718f6e"/><path d="M17 83V43m0 0-10 18h20L17 43Zm0 13L3 75h28L17 56Zm220 30V32m0 0-12 23h24l-12-23Zm0 18-17 26h34l-17-26Z" fill="#395f46" stroke="#395f46"/><path d="M82 95h61m-42-6h69" stroke="#faf8ee" stroke-linecap="round" opacity=".7"/></svg>';aside.append(art);frame.append(aside);
  resume.addEventListener('click',()=>{if(isEditing())fields.scrollIntoView({behavior:'smooth',block:'start'});else q('#qdc7-edit')?.click();});
  // Real values, never simulated activity or random counters.
  const observer=new MutationObserver(schedule);observer.observe(fields,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  observer.observe(q('#inline-edit-bar'),{attributes:true,attributeFilter:['class']});observer.observe(q('#btn-inline-submit'),{attributes:true,attributeFilter:['disabled']});observer.observe(q('#inline-change-summary'),{childList:true,subtree:true,attributes:true,attributeFilter:['class']});observer.observe(screen,{attributes:true,attributeFilter:['class']});
  screen.addEventListener('input',schedule);screen.addEventListener('change',schedule);refresh();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
