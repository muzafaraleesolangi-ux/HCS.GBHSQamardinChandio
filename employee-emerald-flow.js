/* Emerald Flow: live presentation + an explicit review screen before the existing
   employee submission handler. No alternate persistence or verification path. */
(function(){
 'use strict';
 const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
 const paths={shield:'M12 3 3 7v5c0 5 9 10 9 10s9-5 9-10V7l-9-4Zm-4 9 3 3 5-6',chip:'M7 7h10v10H7zM3 9h4m-4 6h4m10-6h4m-4 6h4M9 3v4m6-4v4m-6 10v4m6-4v4',review:'M4 3h16v18H4zM8 7h8m-8 5h8m-8 5h4',arrow:'M4 12h16m-6-6 6 6-6 6',edit:'m4 16 12-12 4 4-12 12H4v-4Zm10-10 4 4',check:'m5 12 4 4L19 6',close:'m6 6 12 12M6 18 18 6',send:'m3 3 18 9-18 9 4-9-4-9Zm4 9h14',clock:'M12 7v5l4 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0'};
 Object.assign(paths,{people:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8m8 .13a4 4 0 0 1 0 7.75',back:'m14 5-7 7 7 7M7 12h14',print:'M7 8V3h10v5M7 17H4V8h16v9h-3M7 14h10v7H7z',history:'M3 11a9 9 0 1 1 2 7M3 4v7h7m2-5v6l4 2',logout:'M10 4H4v16h6m4-12 4 4-4 4m-6-4h12',save:'M6 3h9l4 4v14H5V3h1Zm2 0v6h7V3M9 13h6m-6 4h6'});
 const icon=n=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+(paths[n]||paths.review)+'"/></svg>';
 const text=(node,value)=>{if(node&&node.textContent!==String(value))node.textContent=String(value);};
 const editing=()=>!!q('#inline-edit-bar')&&!q('#inline-edit-bar').classList.contains('hidden');
 const active=()=>screen&&!screen.classList.contains('hidden')&&!screen.classList.contains('hm-tab-dashboard');
 const reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const scrollTo=node=>node?.scrollIntoView({behavior:reduced()?'auto':'smooth',block:'center'});
 let screen,dialog,previousFocus,queued=false,changeSignature='',profileKey='',statusNode,stage='ready',step=0,reviewSignature='';
 const titles=['Personal Information','Service Information','Qualifications','Review Your Profile'];
 const subtitles=['Your identity, contact and personal details.','Your posting, employment dates and payroll details.','Your academic and professional records.','Check your complete profile before submitting.'];
 function source(){
  let changes=[],kind='saved',photo=false,unsaved=false,record=null,note='';
  try{record=CUR;photo=!!DRAFT_PHOTO;note=DRAFT_NOTE||'';unsaved=!!PROFILE_UNSAVED;
   const pending=pendingCorrectionMap();
   if(Object.keys(pending).length){changes=Object.entries(pending).map(([field,c])=>({...c,field}));kind='pending';}
   else if(editing()){changes=collectInlineChanges();kind=unsaved?'editing':'saved';}
   else changes=Object.entries(inlineDraftMap()).map(([field,c])=>({...c,field}));
  }catch(e){}
  return {changes,kind,photo,unsaved,record,note};
 }
 function cells(){return qa('#r-fields .field').filter(f=>!f.hidden&&!f.closest('[hidden]'));}
 function valueOf(field){const control=q('input:not([type=checkbox]),select,textarea',field);if(control)return control.value||'';const val=q('.v',field);return val?.classList.contains('blank')?'':val?.textContent?.trim()||'';}
 function labelOf(field){return q('.k',field)?.textContent?.replace(/\*/g,'').trim()||field.dataset.fieldKey||'Profile field';}
 function bucket(field){const key=field.dataset.fieldKey||q('[data-field]',field)?.dataset.field||'';if(/qualification|result_declaration/.test(key))return 2;if(/^(employee_name|father_name|father_husband_name|gender|cnic|personal_no|mobile|mobile_no|mobile_number|dob|date_of_birth)$/.test(key))return 0;return 1;}
 function setStep(next,scroll=true){
  step=Math.max(0,Math.min(3,next));refresh();
  if(scroll)scrollTo(q('#qdc7-overview'));
 }
 function renderProfileRows(host){
  host.replaceChildren();cells().forEach(field=>{const row=document.createElement('tr'),label=document.createElement('th'),value=document.createElement('td');label.scope='row';label.textContent=labelOf(field);value.textContent=valueOf(field).trim()||'Not on record';row.append(label,value);host.append(row);});
 }
 function refreshFlow(data,current){
  const officeEdit=typeof ADMIN_EDIT_MODE!=='undefined'&&!!ADMIN_EDIT_MODE;
  screen.classList.toggle('qdc-office-edit',officeEdit);
  const officeStepper=q('.qef-stepper'),officeFooter=q('.qef-flow-footer'),officePreview=q('#qef-inline-review');
  if(officeStepper)officeStepper.hidden=officeEdit;
  if(officeFooter)officeFooter.hidden=officeEdit;
  if(officeEdit){
   current.forEach(f=>f.classList.remove('qef-step-hidden'));
   if(officePreview)officePreview.hidden=true;
   text(q('.qdc7-overview-copy h2'),'Edit Employee — Complete Record');
   text(q('.qdc7-overview-copy p'),'Edit all personal, service and qualification fields in this full-window office editor. Save updates with the official Save button.');
   text(q('.qdc7-overview-copy small'),'AUTHORIZED OFFICE EDITOR');
   return;
  }
  if(screen.dataset.flowStep!==String(step))screen.dataset.flowStep=String(step);
  current.forEach(f=>{const hide=step===3||bucket(f)!==step;if(f.classList.contains('qef-step-hidden')!==hide)f.classList.toggle('qef-step-hidden',hide);});
  text(q('.qdc7-overview-copy h2'),titles[step]);text(q('.qdc7-overview-copy p'),subtitles[step]);text(q('.qdc7-overview-copy small'),'EMERALD FLOW • STEP '+(step+1)+' OF 4');
  qa('.qef-step').forEach((b,i)=>{b.classList.toggle('current',i===step);if(i===step)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
  q('#qef-step-prev').disabled=step===0;q('#qef-step-next').hidden=step===3;
  text(q('#qef-step-next span'),step===2?'Review Profile':'Next Step');
  const count=current.filter(f=>bucket(f)===step).length;
  text(q('#qef-step-label'),step===3?'Final review':(step+1)+' / 4 · '+count+' fields');
  q('#qef-draft-slot').hidden=!editing();
  const preview=q('#qef-inline-review');preview.hidden=step!==3;
  if(step===3){
   const signature=JSON.stringify([current.map(f=>[labelOf(f),valueOf(f)]),data.changes,data.photo,data.note]);
   if(signature!==reviewSignature){reviewSignature=signature;renderProfileRows(q('#qef-inline-rows'));renderChanges(q('#qef-inline-changes'),data);}
   text(q('#qef-inline-message'),validateForSubmit().message);
  }
 }

 function renderChanges(host,data){
  host.replaceChildren();
  if(!data.changes.length){const p=document.createElement('p');p.className='qef-no-changes';p.textContent=data.photo?'A new profile photo is included.':'No field changes to compare.';host.append(p);}
  data.changes.forEach(change=>{
   const card=document.createElement('article');card.className='qef-change';const name=document.createElement('b');name.textContent=change.label||change.field;const from=document.createElement('del');from.textContent=String(change.from??'').trim()||'Not on record';const to=document.createElement('ins');to.textContent=String(change.to??'').trim()||'Cleared';const rail=document.createElement('div');rail.innerHTML=icon('arrow');rail.prepend(from);rail.append(to);card.append(name,rail);host.append(card);
  });
  if(data.photo){const p=document.createElement('p');p.className='qef-photo-note';p.textContent='New profile photo included with these changes.';host.append(p);}
 }
 function activity(detail){
  stage=detail.stage||'ready';text(statusNode,detail.message||'Workspace ready');const busy=['loading','saving','submitting'].includes(stage);
  if(screen.classList.contains('qef-processing')!==busy)screen.classList.toggle('qef-processing',busy);
  const strip=q('#qef-activity');strip.dataset.state=stage;
  text(q('#qef-server-state'),busy?'Processing':stage==='error'?'Review needed':stage==='saved'?'Draft saved':stage==='submitted'?'With admin':'Record status');
  schedule();
 }
 function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;refresh();});}
 function refresh(){
  if(!active()){if(dialog?.open)closeReview();return;}
  const data=source(),key=data.record?.id||data.record?.personal_no||data.record?.cnic||'';
  if(key!==profileKey){profileKey=key;stage='ready';step=0;reviewSignature='';text(statusNode,'Review your information, then save or submit.');}
  const current=cells();refreshFlow(data,current);const counts=[0,0,0],totals=[0,0,0];current.forEach(f=>{const b=bucket(f);totals[b]++;if(valueOf(f).trim())counts[b]++;});
  qa('.qef-step').forEach((b,i)=>{const complete=i<3&&totals[i]>0&&counts[i]===totals[i];b.classList.toggle('complete',complete);if(i<3)text(q('small',b),counts[i]+' / '+totals[i]+' filled');else text(q('small',b),data.kind==='pending'?'With admin':data.changes.length+' changes');});
  const signature=JSON.stringify([data.changes,data.photo,data.kind]);
  if(signature!==changeSignature){changeSignature=signature;renderChanges(q('#qef-changes'),data);text(q('#qef-change-count'),data.changes.length);}
  text(q('#qef-review-kind'),data.kind==='pending'?'Submitted changes':data.kind==='editing'?'Unsaved changes':'Saved changes');
  const open=q('#qef-review-open');open.disabled=!!q('#btn-inline-submit')?.disabled;open.hidden=!!(typeof ADMIN_EDIT_MODE!=='undefined'&&ADMIN_EDIT_MODE);
  if(stage==='ready')text(q('#qef-server-state'),data.kind==='pending'?'With admin':data.unsaved?'Unsaved edits':data.changes.length||data.photo?'Saved draft':'Current profile');
  // Display current values only. Percentages and counters remain derived from the real form.
 }
 function validateForSubmit(){
  try{
   if(!editing())return {canSubmit:false,message:'This is a preview of your current record.'};
   const merged=inlineEffectiveRecord(),changes=collectInlineChanges(),error=validateInlineChanges(changes,merged);
   if(error)return {canSubmit:false,message:error};
   const missing=missingMandatoryFields({...merged,photo_url:DRAFT_PHOTO||CUR.photo_url});
   if(missing.length)return {canSubmit:false,message:'Complete the required fields before submission: '+missing.map(f=>f[1]).join(', ')};
   if(!changes.length&&!DRAFT_PHOTO)return {canSubmit:false,message:'There are no changes to submit. Update a field or your profile photo first.'};
   return {canSubmit:true,message:'Your changes will be saved and sent together for admin verification.'};
  }catch(e){return {canSubmit:false,message:'The profile is still loading. Close this preview and reopen it.'};}
 }
 function openReview(){
  if(!active()||q('#btn-inline-submit')?.disabled)return;
  const data=source(),validation=validateForSubmit();
  text(q('#qef-review-person'),data.record?.employee_name||q('#r-name')?.textContent||'Employee profile');
  renderProfileRows(q('#qef-review-rows'));
  renderChanges(q('#qef-review-changes'),data);text(q('#qef-review-message'),validation.message);
  q('#qef-review-message').classList.toggle('needs-attention',editing()&&!validation.canSubmit);
  const confirm=q('#qef-confirm-submit');confirm.hidden=!editing();confirm.disabled=!validation.canSubmit;
  text(q('#qef-dialog-kind'),data.kind==='pending'?'Submitted changes':'Changes to review');
  const note=q('#qef-review-office-note');note.hidden=!data.note;note.textContent=data.note?'Note for office: '+data.note:'';
  previousFocus=document.activeElement;
  if(!dialog.open){if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');}
  q('#qef-dialog-close').focus();
 }
 function closeReview(){if(!dialog)return;if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});}
 function start(){
  screen=q('#screen-record');const card=q('#screen-record > .card'),main=q('#screen-record .recmain'),header=q('#screen-record .recordhead'),frame=q('.qsp-workspace-grid');
  if(!screen||!card||!main||!header||!frame)return;
  screen.classList.add('qdc-emerald-flow','qdc-jade-pearl');
  const shell=document.createElement('div');shell.className='qef-shell';header.before(shell);shell.append(header,q('#screen-record .recbody'));const tabs=q('#ptopbar');if(tabs)card.insertBefore(tabs,shell);
  const label=document.createElement('div');label.className='qef-identity-label';label.textContent='MY EMPLOYEE PROFILE';header.prepend(label);
  const meter=q('.qdc7-overview-kpi');if(meter){const wrap=document.createElement('div');wrap.className='qef-identity-meter';wrap.append(meter);header.append(wrap);}
  const crest=q('.qsp-toolbar-brand svg');if(crest)crest.outerHTML=icon('people');text(q('.qsp-toolbar-brand small'),'Your profile. One clear step at a time.');
  [['btn-back','Back','back'],['btn-print','Print / PDF','print'],['qsp-history-button','Update History','history'],['btn-emp-logout','Logout','logout'],['btn-inline-save','Save Draft','save']].forEach(([id,label,name])=>{const b=q('#'+id);if(b)b.innerHTML=icon(name)+'<span>'+label+'</span>';});
  const ring=q('#qsp-progress-ring');if(ring)ring.innerHTML=icon('shield');const overviewIcon=q('.qdc7-overview-icon');if(overviewIcon)overviewIcon.innerHTML=icon('review');
  text(q('.qdc7-overview-copy small'),'EMPLOYEE RECORD • EMERALD FLOW');text(q('.qdc7-overview-copy h2'),'Employee Information');text(q('.qdc7-overview-copy p'),'Review every change before sending your profile for verification.');
  text(q('#qdc7-missing')?.nextElementSibling,'Complete required details before submitting');
  const stateCard=document.createElement('article');stateCard.className='qdc7-overview-kpi qef-state-card';stateCard.innerHTML='<span class="qdc7-kpi-icon">'+icon('shield')+'</span><div><small>WORKSPACE STATUS</small><strong id="qef-server-state">Current profile</strong><span>Admin verifies submitted changes</span></div>';q('.qdc7-overview-kpis').append(stateCard);
  const stepper=document.createElement('nav');stepper.className='qef-stepper';stepper.setAttribute('aria-label','Profile review steps');
  ['Personal','Service','Qualifications','Review'].forEach((name,i)=>{const b=document.createElement('button');b.type='button';b.className='qef-step';b.innerHTML='<i>'+(i+1)+'</i><span><b>'+name+'</b><small>Review fields</small></span>';b.addEventListener('click',()=>{setStep(i);});stepper.append(b);});card.insertBefore(stepper,shell);
  const strip=document.createElement('div');strip.id='qef-activity';strip.className='qef-activity noprint';strip.setAttribute('role','status');strip.innerHTML='<span class="qef-activity-icon">'+icon('chip')+'</span><div><small>WORKSPACE ACTIVITY</small><b id="qef-activity-text">Review your information, then save or submit.</b></div><span class="qef-signal" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';frame.before(strip);statusNode=q('#qef-activity-text');
  const aside=q('.qsp-draft-panel');const title=document.createElement('div');title.className='qef-changes-heading';title.innerHTML=icon('review')+'<div><small id="qef-review-kind">Saved changes</small><h3>Changes to Review</h3></div><b id="qef-change-count">0</b>';aside.prepend(title);
  const changes=document.createElement('div');changes.id='qef-changes';title.after(changes);
  const review=document.createElement('button');review.id='qef-review-open';review.type='button';review.className='qsp-button qef-review-launch';review.innerHTML=icon('review')+'<span>Review Profile</span>';review.addEventListener('click',()=>{setStep(3);openReview();});aside.append(review);
  dialog=document.createElement('dialog');dialog.id='qef-review-dialog';dialog.setAttribute('aria-labelledby','qef-review-title');
  dialog.innerHTML='<div class="qef-dialog-top"><div><small>REVIEW BEFORE SUBMISSION</small><h2 id="qef-review-title">Review your profile</h2><p id="qef-review-person"></p></div><button type="button" id="qef-dialog-close" aria-label="Close review">'+icon('close')+'</button></div><div class="qef-dialog-body"><section><h3>Current profile</h3><table><tbody id="qef-review-rows"></tbody></table></section><aside><h3 id="qef-dialog-kind">Changes to review</h3><div id="qef-review-changes"></div><p id="qef-review-office-note" hidden></p></aside></div><div class="qef-dialog-foot"><p id="qef-review-message"></p><div><button type="button" id="qef-return-edit">'+icon('edit')+' Back to Profile</button><button type="button" id="qef-confirm-submit">'+icon('send')+' Submit for Verification</button></div></div>';
  document.body.append(dialog);q('#qef-dialog-close').addEventListener('click',closeReview);q('#qef-return-edit').addEventListener('click',closeReview);dialog.addEventListener('click',e=>{if(e.target===dialog)closeReview();});dialog.addEventListener('cancel',()=>{requestAnimationFrame(()=>previousFocus?.focus({preventScroll:true}));});
  const native=q('#btn-inline-submit');
  window.qdcProfileReview={requestSubmission:()=>{setStep(3,false);openReview();}};
  q('#qef-confirm-submit').addEventListener('click',()=>{if(!validateForSubmit().canSubmit||native.disabled)return;closeReview();saveInlineChanges(true);});
  const inlineReview=document.createElement('section');inlineReview.id='qef-inline-review';inlineReview.className='qef-inline-review';inlineReview.hidden=true;
  inlineReview.innerHTML='<div class="qef-review-table"><h3>Complete profile</h3><table><tbody id="qef-inline-rows"></tbody></table></div><aside><h3>Your changes</h3><div id="qef-inline-changes"></div><p id="qef-inline-message"></p><button type="button" class="qsp-button" id="qef-final-preview">'+icon('review')+'<span>Open Final Review</span></button></aside>';frame.append(inlineReview);
  q('#qef-final-preview').addEventListener('click',openReview);
  const flowFooter=document.createElement('nav');flowFooter.className='qef-flow-footer noprint';flowFooter.setAttribute('aria-label','Profile step controls');
  flowFooter.innerHTML='<button type="button" id="qef-step-prev">'+icon('arrow')+'<span>Previous</span></button><small id="qef-step-label"></small><div id="qef-draft-slot"></div><button type="button" id="qef-step-next"><span>Next Step</span>'+icon('arrow')+'</button>';frame.after(flowFooter);
  q('#qef-draft-slot').append(q('#btn-inline-save'));q('#qef-step-prev').addEventListener('click',()=>setStep(step-1));q('#qef-step-next').addEventListener('click',()=>setStep(step+1));
  screen.addEventListener('focusin',e=>{const f=e.target.closest?.('#r-fields .field');if(f&&active()&&bucket(f)!==step)setStep(bucket(f),false);});
  const top=q('#qsp-submit-top');if(top)top.innerHTML=icon('review')+'<span>Review & Submit</span>';
  document.addEventListener('qdc-profile-activity',e=>activity(e.detail||{}));
  const observer=new MutationObserver(schedule);observer.observe(q('#r-fields'),{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});observer.observe(screen,{attributes:true,attributeFilter:['class']});observer.observe(native,{attributes:true,attributeFilter:['disabled']});screen.addEventListener('input',schedule);screen.addEventListener('change',schedule);refresh();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
