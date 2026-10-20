/* Navy Review: live presentation + an explicit review screen before the existing
   employee submission handler. No alternate persistence or verification path. */
(function(){
 'use strict';
 const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
 const paths={shield:'M12 3 3 7v5c0 5 9 10 9 10s9-5 9-10V7l-9-4Zm-4 9 3 3 5-6',chip:'M7 7h10v10H7zM3 9h4m-4 6h4m10-6h4m-4 6h4M9 3v4m6-4v4m-6 10v4m6-4v4',review:'M4 3h16v18H4zM8 7h8m-8 5h8m-8 5h4',arrow:'M4 12h16m-6-6 6 6-6 6',edit:'m4 16 12-12 4 4-12 12H4v-4Zm10-10 4 4',check:'m5 12 4 4L19 6',close:'m6 6 12 12M6 18 18 6',send:'m3 3 18 9-18 9 4-9-4-9Zm4 9h14',clock:'M12 7v5l4 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0'};
 const icon=n=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+(paths[n]||paths.review)+'"/></svg>';
 const text=(node,value)=>{if(node&&node.textContent!==String(value))node.textContent=String(value);};
 const editing=()=>!!q('#inline-edit-bar')&&!q('#inline-edit-bar').classList.contains('hidden');
 const active=()=>screen&&!screen.classList.contains('hidden')&&!screen.classList.contains('hm-tab-dashboard');
 const reduced=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const scrollTo=node=>node?.scrollIntoView({behavior:reduced()?'auto':'smooth',block:'center'});
 let screen,dialog,previousFocus,queued=false,changeSignature='',profileKey='',statusNode,stage='ready';
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
 function bucket(field){const key=field.dataset.fieldKey||q('[data-field]',field)?.dataset.field||'';if(/qualification|result_declaration/.test(key))return 2;if(/mobile|salary|name|gender|cnic|personal_no/.test(key))return 0;return 1;}
 function renderChanges(host,data){
  host.replaceChildren();
  if(!data.changes.length){const p=document.createElement('p');p.className='qnr-no-changes';p.textContent=data.photo?'A new profile photo is included.':'No field changes to compare.';host.append(p);}
  data.changes.forEach(change=>{
   const card=document.createElement('article');card.className='qnr-change';const name=document.createElement('b');name.textContent=change.label||change.field;const from=document.createElement('del');from.textContent=String(change.from??'').trim()||'Not on record';const to=document.createElement('ins');to.textContent=String(change.to??'').trim()||'Cleared';const rail=document.createElement('div');rail.innerHTML=icon('arrow');rail.prepend(from);rail.append(to);card.append(name,rail);host.append(card);
  });
  if(data.photo){const p=document.createElement('p');p.className='qnr-photo-note';p.textContent='New profile photo included with these changes.';host.append(p);}
 }
 function activity(detail){
  stage=detail.stage||'ready';text(statusNode,detail.message||'Workspace ready');const busy=['loading','saving','submitting'].includes(stage);
  if(screen.classList.contains('qnr-processing')!==busy)screen.classList.toggle('qnr-processing',busy);
  const strip=q('#qnr-activity');strip.dataset.state=stage;
  text(q('#qnr-server-state'),busy?'Processing':stage==='error'?'Review needed':stage==='saved'?'Draft saved':stage==='submitted'?'With admin':'Record status');
  schedule();
 }
 function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;refresh();});}
 function refresh(){
  if(!active()){if(dialog?.open)closeReview();return;}
  const data=source(),key=data.record?.id||data.record?.personal_no||data.record?.cnic||'';
  if(key!==profileKey){profileKey=key;stage='ready';text(statusNode,'Review your information, then save or submit.');}
  const current=cells(),counts=[0,0,0],totals=[0,0,0];current.forEach(f=>{const b=bucket(f);totals[b]++;if(valueOf(f).trim())counts[b]++;});
  qa('.qnr-step').forEach((b,i)=>{const complete=i<3&&totals[i]>0&&counts[i]===totals[i];b.classList.toggle('complete',complete);if(i<3)text(q('small',b),counts[i]+' / '+totals[i]+' filled');else text(q('small',b),data.kind==='pending'?'With admin':data.changes.length+' changes');});
  const signature=JSON.stringify([data.changes,data.photo,data.kind]);
  if(signature!==changeSignature){changeSignature=signature;renderChanges(q('#qnr-changes'),data);text(q('#qnr-change-count'),data.changes.length);}
  text(q('#qnr-review-kind'),data.kind==='pending'?'Submitted changes':data.kind==='editing'?'Unsaved changes':'Saved changes');
  const open=q('#qnr-review-open');open.disabled=!!q('#btn-inline-submit')?.disabled;open.hidden=!!(typeof ADMIN_EDIT_MODE!=='undefined'&&ADMIN_EDIT_MODE);
  if(stage==='ready')text(q('#qnr-server-state'),data.kind==='pending'?'With admin':data.unsaved?'Unsaved edits':data.changes.length||data.photo?'Saved draft':'Current profile');
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
  text(q('#qnr-review-person'),data.record?.employee_name||q('#r-name')?.textContent||'Employee profile');
  const body=q('#qnr-review-rows');body.replaceChildren();
  cells().forEach(field=>{const row=document.createElement('tr'),label=document.createElement('th'),value=document.createElement('td');label.scope='row';label.textContent=labelOf(field);value.textContent=valueOf(field).trim()||'Not on record';row.append(label,value);body.append(row);});
  renderChanges(q('#qnr-review-changes'),data);text(q('#qnr-review-message'),validation.message);
  q('#qnr-review-message').classList.toggle('needs-attention',editing()&&!validation.canSubmit);
  const confirm=q('#qnr-confirm-submit');confirm.hidden=!editing();confirm.disabled=!validation.canSubmit;
  text(q('#qnr-dialog-kind'),data.kind==='pending'?'Submitted changes':'Changes to review');
  const note=q('#qnr-review-office-note');note.hidden=!data.note;note.textContent=data.note?'Note for office: '+data.note:'';
  previousFocus=document.activeElement;
  if(!dialog.open){if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');}
  q('#qnr-dialog-close').focus();
 }
 function closeReview(){if(!dialog)return;if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});}
 function start(){
  screen=q('#screen-record');const card=q('#screen-record > .card'),main=q('#screen-record .recmain'),header=q('#screen-record .recordhead'),frame=q('.qsp-workspace-grid');
  if(!screen||!card||!main||!header||!frame)return;
  screen.classList.add('qdc-navy-review');
  const shell=document.createElement('div');shell.className='qnr-shell';header.before(shell);shell.append(header,q('#screen-record .recbody'));const tabs=q('#ptopbar');if(tabs)card.insertBefore(tabs,shell);
  const label=document.createElement('div');label.className='qnr-identity-label';label.textContent='EMPLOYEE SERVICE PROFILE';header.prepend(label);
  const meter=q('.qdc7-overview-kpi');if(meter){const wrap=document.createElement('div');wrap.className='qnr-identity-meter';wrap.append(meter);header.append(wrap);}
  const crest=q('.qsp-toolbar-brand svg');if(crest)crest.outerHTML=icon('chip');text(q('.qsp-toolbar-brand small'),'Review. Save. Verify.');
  const ring=q('#qsp-progress-ring');if(ring)ring.innerHTML=icon('shield');const overviewIcon=q('.qdc7-overview-icon');if(overviewIcon)overviewIcon.innerHTML=icon('review');
  text(q('.qdc7-overview-copy small'),'EMPLOYEE RECORD • NAVY REVIEW');text(q('.qdc7-overview-copy h2'),'Employee Information');text(q('.qdc7-overview-copy p'),'Review every change before sending your profile for verification.');
  text(q('#qdc7-missing')?.nextElementSibling,'Complete required details before submitting');
  const stateCard=document.createElement('article');stateCard.className='qdc7-overview-kpi qnr-state-card';stateCard.innerHTML='<span class="qdc7-kpi-icon">'+icon('shield')+'</span><div><small>WORKSPACE STATUS</small><strong id="qnr-server-state">Current profile</strong><span>Admin verifies submitted changes</span></div>';q('.qdc7-overview-kpis').append(stateCard);
  const stepper=document.createElement('nav');stepper.className='qnr-stepper';stepper.setAttribute('aria-label','Profile review steps');
  ['Personal','Service','Qualifications','Review'].forEach((name,i)=>{const b=document.createElement('button');b.type='button';b.className='qnr-step';b.innerHTML='<i>'+(i+1)+'</i><span><b>'+name+'</b><small>Review fields</small></span>';b.addEventListener('click',()=>{if(i===3){openReview();return;}const f=cells().find(f=>bucket(f)===i);scrollTo(f);f?.querySelector('input,select,textarea')?.focus({preventScroll:true});});stepper.append(b);});main.insertBefore(stepper,q('#qdc7-overview'));
  const strip=document.createElement('div');strip.id='qnr-activity';strip.className='qnr-activity noprint';strip.setAttribute('role','status');strip.innerHTML='<span class="qnr-activity-icon">'+icon('chip')+'</span><div><small>WORKSPACE ACTIVITY</small><b id="qnr-activity-text">Review your information, then save or submit.</b></div><span class="qnr-signal" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';frame.before(strip);statusNode=q('#qnr-activity-text');
  const aside=q('.qsp-draft-panel');const title=document.createElement('div');title.className='qnr-changes-heading';title.innerHTML=icon('review')+'<div><small id="qnr-review-kind">Saved changes</small><h3>Changes to Review</h3></div><b id="qnr-change-count">0</b>';aside.prepend(title);
  const changes=document.createElement('div');changes.id='qnr-changes';title.after(changes);
  const review=document.createElement('button');review.id='qnr-review-open';review.type='button';review.className='qsp-button qnr-review-launch';review.innerHTML=icon('review')+'<span>Review Profile</span>';review.addEventListener('click',openReview);aside.append(review);
  dialog=document.createElement('dialog');dialog.id='qnr-review-dialog';dialog.setAttribute('aria-labelledby','qnr-review-title');
  dialog.innerHTML='<div class="qnr-dialog-top"><div><small>REVIEW BEFORE SUBMISSION</small><h2 id="qnr-review-title">Review your profile</h2><p id="qnr-review-person"></p></div><button type="button" id="qnr-dialog-close" aria-label="Close review">'+icon('close')+'</button></div><div class="qnr-dialog-body"><section><h3>Current profile</h3><table><tbody id="qnr-review-rows"></tbody></table></section><aside><h3 id="qnr-dialog-kind">Changes to review</h3><div id="qnr-review-changes"></div><p id="qnr-review-office-note" hidden></p></aside></div><div class="qnr-dialog-foot"><p id="qnr-review-message"></p><div><button type="button" id="qnr-return-edit">'+icon('edit')+' Back to Profile</button><button type="button" id="qnr-confirm-submit">'+icon('send')+' Submit for Verification</button></div></div>';
  document.body.append(dialog);q('#qnr-dialog-close').addEventListener('click',closeReview);q('#qnr-return-edit').addEventListener('click',closeReview);dialog.addEventListener('click',e=>{if(e.target===dialog)closeReview();});dialog.addEventListener('cancel',()=>{requestAnimationFrame(()=>previousFocus?.focus({preventScroll:true}));});
  const native=q('#btn-inline-submit');
  window.qdcNavyReview={requestSubmission:openReview};
  q('#qnr-confirm-submit').addEventListener('click',()=>{if(!validateForSubmit().canSubmit||native.disabled)return;closeReview();saveInlineChanges(true);});
  const top=q('#qsp-submit-top');if(top)top.innerHTML=icon('review')+'<span>Review & Submit</span>';
  document.addEventListener('qdc-profile-activity',e=>activity(e.detail||{}));
  const observer=new MutationObserver(schedule);observer.observe(q('#r-fields'),{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']});observer.observe(screen,{attributes:true,attributeFilter:['class']});observer.observe(native,{attributes:true,attributeFilter:['disabled']});screen.addEventListener('input',schedule);screen.addEventListener('change',schedule);refresh();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
