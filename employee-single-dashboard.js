/* One employee dashboard, direct submission and full-page authorized office editing.
   All persistence, approval and role checks remain in the established application. */
(function(){
 'use strict';
 const q=(s,r=document)=>r.querySelector(s),all=(s,r=document)=>Array.from(r.querySelectorAll(s));
 const shapes={people:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8m8 .13a4 4 0 0 1 0 7.75',save:'M6 3h9l4 4v14H5V3h1Zm2 0v6h7V3M9 13h6m-6 4h6',edit:'m4 16 12-12 4 4-12 12H4v-4Zm10-10 4 4',send:'m3 3 18 9-18 9 4-9-4-9Zm4 9h14',shield:'M12 3 3 7v5c0 5 9 10 9 10s9-5 9-10V7l-9-4Zm-4 9 3 3 5-6',chip:'M7 7h10v10H7zM3 9h4m-4 6h4m10-6h4m-4 6h4M9 3v4m6-4v4m-6 10v4m6-4v4',back:'M19 12H5m6-6-6 6 6 6'};
 const icon=n=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+shapes[n]+'"/></svg>';
 const text=(el,value)=>{if(el&&el.textContent!==String(value))el.textContent=String(value);};
 const button=(id,label,shape)=>{const b=document.createElement('button');b.type='button';b.id=id;b.className='qsp-button';b.innerHTML=icon(shape)+'<span>'+label+'</span>';return b;};
 let screen,main,officePanel,officeFooter,officeTop,officeStart,activity,queued=false;
 const office=()=>typeof ADMIN_EDIT_MODE!=='undefined'&&!!ADMIN_EDIT_MODE;
 const authorized=()=>typeof TOKEN!=='undefined'&&!!TOKEN&&typeof CAN_ADMIN!=='undefined'&&!!CAN_ADMIN&&typeof OFFICER!=='undefined'&&['MASTER','HUBHM'].includes(OFFICER?.role);
 const editing=()=>!q('#inline-edit-bar').classList.contains('hidden');
 function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;refresh();});}
 function refresh(){
  if(!screen||screen.classList.contains('hidden')||screen.classList.contains('hm-tab-dashboard'))return;
  const officeEdit=office()&&authorized(),officeView=typeof CUR_FROMDASH!=='undefined'&&!!CUR_FROMDASH;
  if(screen.classList.contains('qdc-office-edit')!==officeEdit)screen.classList.toggle('qdc-office-edit',officeEdit);
  if(screen.classList.contains('qdc-office-view')!==officeView)screen.classList.toggle('qdc-office-view',officeView);
  officePanel.hidden=!officeEdit;officeFooter.hidden=!officeEdit;officeTop.hidden=!officeEdit;
  officeStart.hidden=!authorized()||!officeView||officeEdit;
  officeTop.disabled=!!q('#btn-admin-save').disabled;
  text(q('#qdc-office-save-top span'),officeTop.disabled?'Saving…':'Save Employee');
  const pending=typeof CUR_STATUS!=='undefined'&&CUR_STATUS==='CORRECTION',verified=typeof CUR_STATUS!=='undefined'&&CUR_STATUS==='VERIFIED';
  text(q('.qdc7-overview-copy small'),officeEdit?'AUTHORIZED OFFICE EDITOR':officeView?'EMPLOYEE RECORD':'EMPLOYEE HOME DASHBOARD');
  text(q('.qdc7-overview-copy h2'),officeEdit?'Edit Employee — Complete Record':'Complete Employee Profile');
  text(q('.qdc7-overview-copy p'),officeEdit?'Update employee details and photo. Save Employee returns to your admin dashboard.':pending?'Your submission is with Admin. Verification is completed only after approval.':verified?'Your record has been verified by Admin. All personal, service and qualification details are shown below.':'All personal, service and qualification details are on this page. Submit them directly for Admin approval.');
  const top=q('#qsp-submit-top');if(top){text(q('span',top),'Submit for Admin Approval');top.hidden=officeView||!editing();}
  const resume=q('#qsp-resume');if(resume)resume.hidden=officeView||pending;
  all('#r-fields .qef-step-hidden').forEach(f=>f.classList.remove('qef-step-hidden'));
  if(!officeEdit&&!activity.dataset.state)text(q('#qdc-profile-activity-text'),pending?'Awaiting Admin approval':verified?'Verified by Admin':'Your complete profile is ready to view or update.');
 }
 function start(){
  screen=q('#screen-record');main=q('#screen-record .recmain');const header=q('#screen-record .recordhead'),card=q('#screen-record > .card');
  if(!screen||!main||!header||!card||!q('.qsp-workspace-grid'))return;
  screen.classList.add('qdc-emerald-flow','qdc-jade-pearl','qdc-onepage-profile');
  // No preview gateway: the established native submit button sends for Admin approval.
  delete window.qdcProfileReview;
  const shell=document.createElement('div');shell.className='qef-shell';header.before(shell);shell.append(header,q('#screen-record .recbody'));
  const tabs=q('#ptopbar');if(tabs)card.insertBefore(tabs,shell);
  const identity=document.createElement('div');identity.className='qef-identity-label';identity.textContent='MY EMPLOYEE PROFILE';header.prepend(identity);
  const first=q('.qdc7-overview-kpi');if(first){const wrap=document.createElement('div');wrap.className='qef-identity-meter';wrap.append(first);header.append(wrap);}
  const crest=q('.qsp-toolbar-brand>svg');if(crest)crest.outerHTML=icon('people');
  text(q('.qsp-toolbar-brand small'),'Complete record. Direct submission.');
  const ring=q('#qsp-progress-ring');if(ring)ring.innerHTML=icon('shield');
  text(q('#qdc7-missing')?.nextElementSibling,'Complete required details before submitting');
  activity=document.createElement('div');activity.className='qef-activity noprint';activity.setAttribute('role','status');activity.innerHTML='<span class="qef-activity-icon">'+icon('chip')+'</span><div><small>WORKSPACE ACTIVITY</small><b id="qdc-profile-activity-text">Your complete profile is ready to view or update.</b></div><span class="qef-signal" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
  q('.qsp-workspace-grid').before(activity);
  officePanel=document.createElement('section');officePanel.className='qdc-office-panel noprint';officePanel.hidden=true;officePanel.setAttribute('aria-label','Office employee photo editor');main.insertBefore(officePanel,activity);officePanel.append(q('#admin-edit-box'));
  officeFooter=document.createElement('div');officeFooter.className='qdc-office-actions noprint';officeFooter.hidden=true;
  const cancel=button('qdc-office-back','Back to Dashboard','back');cancel.addEventListener('click',()=>q('#btn-back').click());
  const save=q('#btn-admin-save');save.innerHTML=icon('save')+'<span>Save Employee</span>';officeFooter.append(cancel,save);q('.qsp-workspace-grid').after(officeFooter);
  officeTop=button('qdc-office-save-top','Save Employee','save');officeTop.hidden=true;officeTop.addEventListener('click',()=>{if(!save.disabled)save.click();});
  officeStart=button('qdc-office-start','Edit Employee','edit');officeStart.hidden=true;officeStart.addEventListener('click',()=>{if(authorized()&&typeof CUR!=='undefined'&&CUR)openAdminEmployeeEditor(CUR.id);});
  q('.qsp-top-actions').prepend(officeStart,officeTop);
  const topSubmit=q('#qsp-submit-top');if(topSubmit)topSubmit.innerHTML=icon('send')+'<span>Submit for Admin Approval</span>';
  // Prevent losing unsaved office edits through either dashboard-return control.
  q('#btn-back').addEventListener('click',e=>{
   if(!office()||!authorized())return;
   if(typeof OFFICE_EDIT_BUSY!=='undefined'&&OFFICE_EDIT_BUSY){e.preventDefault();e.stopImmediatePropagation();return;}
   let changed=false;try{changed=collectInlineChanges().length>0||!!ADMIN_PHOTO_DRAFT;}catch(err){}
   if(changed&&!confirm('Leave the employee editor and discard unsaved changes?')){e.preventDefault();e.stopImmediatePropagation();}
  },true);
  document.addEventListener('qdc-profile-activity',e=>{
   const d=e.detail||{},busy=['loading','saving','submitting'].includes(d.stage);activity.dataset.state=d.stage||'ready';text(q('#qdc-profile-activity-text'),d.message||'Workspace ready');
   if(screen.classList.contains('qef-processing')!==busy)screen.classList.toggle('qef-processing',busy);
  });
  document.addEventListener('qdc-office-busy',e=>{const busy=!!e.detail?.busy;officeTop.disabled=busy;text(q('#qdc-office-save-top span'),busy?'Saving…':'Save Employee');});
  const observer=new MutationObserver(schedule);
  observer.observe(screen,{attributes:true,attributeFilter:['class']});observer.observe(q('#r-fields'),{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});
  observer.observe(q('#inline-edit-bar'),{attributes:true,attributeFilter:['class']});observer.observe(save,{attributes:true,attributeFilter:['disabled','class']});
  screen.addEventListener('input',schedule);screen.addEventListener('change',schedule);refresh();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
