/* GBHS Qamardin Chandio · Homepage & Master Leadership Manager v6
   Source-preserving enhancement: custom token RPCs; no modifications to employee records or original auth.
   Leadership portraits remain neutral placeholders until an authorized Master Admin uploads real photos. */
(function(){
 "use strict";
 const $=(selector,scope=document)=>scope.querySelector(selector);
 const $$=(selector,scope=document)=>Array.from(scope.querySelectorAll(selector));
 const tags=[
  {key:"hub_head",label:"HUB CLUSTER HEAD",name:"Imtiaz Ali Khand",designation:"Head Master · Hub Cluster Head",office:"GBHS Qamardin Chandio",bio:"Leads the Cluster Hub School and supports academic coordination, school collaboration and professional development across the cluster."},
  {key:"district_officer",label:"DISTRICT EDUCATION OFFICER (ES&HS)",name:"Muhammad Aslam Rajper",designation:"District Education Officer (ES&HS)",office:"Naushahro Feroze",bio:"District education leadership supporting secondary and higher-secondary institutions, effective coordination and the improvement of educational services."}
 ];
 let published=tags.map(x=>Object.assign({},x)),management=[],prepared=false,loading=false;
 const pendingPhotos=Object.create(null);
 const el=(tag,cls,txt)=>{const v=document.createElement(tag);if(cls)v.className=cls;if(txt!=null)v.textContent=txt;return v;};
 function schoolBrand(){
  const header=$("#h-title"),brow=$(".eyebrowh .l1"),dept=$("#h-place");
  if(header)header.textContent="GBHS QAMARDIN CHANDIO";
  if(brow)brow.textContent="CLUSTER HUB SCHOOL · UC KHAIRWAH · TALUKA MORO · NAUSHAHRO FEROZE";
  if(dept)dept.textContent="Employee Profile & Verification Portal · Government of Sindh · School Education & Literacy Department";
  const page=$("#screen-login .pagehead h1");
  if(page)page.textContent="GBHS QAMARDIN CHANDIO";
  const pageLabel=$("#screen-login .pagehead small");
  if(pageLabel)pageLabel.textContent="CLUSTER HUB SCHOOL · EMPLOYEE PROFILE & VERIFICATION PORTAL";
  const hero=$("#screen-login #hero-title");
  if(hero)hero.textContent="GBHS QAMARDIN CHANDIO";
  const msg=$("#screen-login #hero-msg");
  if(msg)msg.textContent="A professional home for our cluster's employees, school records, service particulars and secure profile verification.";
  const crumb=$("#screen-login .topbar .crumb b");
  if(crumb)crumb.textContent="EMPLOYEE PROFILE & VERIFICATION PORTAL";
  const footer=$("#screen-login .footer b");
  if(footer)footer.textContent="GBHS QAMARDIN CHANDIO · CLUSTER HUB SCHOOL";
  const cellsHead=$("#cells .cellshead h2");if(cellsHead)cellsHead.textContent="Our Five Cluster Cells";
  const cellsHelp=$("#cells .cellshead p");if(cellsHelp)cellsHelp.textContent="Explore schools and employee information cell by cell";
  const rail=$("#screen-login .rail");
  if(rail&&!$("#qdc-v6-about-link",rail)){
   const nav=$(".nav",rail);
   if(nav){
    const b=el("button","","About & Leadership");
    b.type="button";b.id="qdc-v6-about-link";b.setAttribute("aria-label","View school introduction and leadership");
    b.addEventListener("click",()=>$("#qdc-v6-about")?.scrollIntoView({behavior:"smooth",block:"start"}));
    nav.append(b);
   }
  }
 }
 function photoSlot(profile){
  const slot=el("div","qdc-v6-photo");
  const valid=typeof profile.photo==="string"&&/^data:image\/(jpeg|png|webp);base64,/.test(profile.photo);
  if(valid){const img=el("img");img.src=profile.photo;img.alt="Portrait of "+(profile.name||"School officer");img.loading="lazy";slot.append(img);}
  else{slot.classList.add("qdc-v6-photo-placeholder");const monogram=String(profile.name||"Officer").trim().split(/\s+/).slice(0,2).map(part=>part[0]||"").join("").toUpperCase();slot.append(el("span","qdc-v6-silhouette",monogram));}
  return slot;
 }
 function personCard(profile){
  const c=el("article","qdc-v6-leader");
  c.dataset.profileKey=profile.key;
  c.append(photoSlot(profile));
  const content=el("div","qdc-v6-leader-info");
  content.append(el("small","qdc-v6-position",tags.find(t=>t.key===profile.key)?.label||"LEADERSHIP"));
  content.append(el("h3","",profile.name||"—"));
  content.append(el("strong","qdc-v6-designation",profile.designation||""));
  content.append(el("span","qdc-v6-office",profile.office||""));
  content.append(el("p","",profile.bio||""));
  if(!profile.photo)content.append(el("small","qdc-v6-photo-note","Official portrait can be added by the Master Admin."));
  c.append(content);return c;
 }
 function aboutCard(){
  const a=el("article","qdc-v6-about-card");
  const k=el("small","qdc-v6-position","ABOUT OUR SCHOOL");
  a.append(k,el("h3","","GBHS QAMARDIN CHANDIO"));
  a.append(el("div","qdc-v6-about-sub","Cluster Hub School · UC Khairwah · Taluka Moro"));
  a.append(el("p","","GBHS Qamardin Chandio serves as a Cluster Hub School, supporting coordination, school leadership and educational administration across its linked school cells. This portal brings employee information, school directories and verification services into one organized platform."));
  const footer=el("div","qdc-v6-about-tags");
  ["Cluster Coordination","School Support","Employee Services"].forEach(t=>footer.append(el("span","",t)));
  a.append(footer);return a;
 }
 function renderLeadership(){
  const holder=$("#qdc-v6-leadership-grid");if(!holder)return;
  holder.replaceChildren();
  const first=published.find(p=>p.key==="hub_head");
  const second=published.find(p=>p.key==="district_officer");
  if(first)holder.append(personCard(first));
  holder.append(aboutCard());
  if(second)holder.append(personCard(second));
 }
 function setupHome(){
  const root=$("#screen-login"),cells=$("#cells");if(!root||!cells)return;
  if($("#qdc-v6-about"))return;
  const section=el("section","qdc-v6-home-section");section.id="qdc-v6-about";
  const head=el("div","qdc-v6-section-head");
  const headgroup=el("div");
  headgroup.append(el("small","","OUR SCHOOL · OUR LEADERSHIP"));
  headgroup.append(el("h2","","A Connected Cluster. A Shared Commitment to Education."));
  head.append(headgroup);
  const badge=el("span","","GBHS QAMARDIN CHANDIO");
  badge.className="qdc-v6-section-badge";head.append(badge);section.append(head);
  const grid=el("div","qdc-v6-leadership-grid");grid.id="qdc-v6-leadership-grid";grid.setAttribute("aria-live","polite");
  section.append(grid);
  cells.parentNode.insertBefore(section,cells);
  renderLeadership();
  // Notices appear first on the homepage; retired lower quick-access cards are removed.
  if(!$("#qdc-v6-links")){
   const quick=el("section","qdc-v6-links");quick.id="qdc-v6-links";
   quick.setAttribute("aria-label","Latest Notices");
   const link=el("a","qdc-v6-link");
   link.href="./monthly-progress.html";
   link.append(el("span","qdc-v6-link-icon","📣"));
   const content=el("span","qdc-v6-link-content");
   content.append(el("strong","","Latest Notices"),el("small","","Monthly Academic Progress Report · Classes 1 to X · Open page"));
   link.append(content,el("span","qdc-v6-link-arrow","↗"));quick.append(link);
   $("#home-overview").prepend(quick);
  }
  const nav=$("#screen-login .nav");if(nav && !$("#qdc-v6-cells-link")){
   // Keep the portal's original navigation handlers; existing Cells button remains functional.
   const cellsButton=$('[data-jump="cells"]',nav);
   if(cellsButton)cellsButton.id="qdc-v6-cells-link";
  }
  const sub=$("#screen-login .pagehead");
  if(sub)sub.classList.add("qdc-v6-pageheading");
 }
 async function getPublic(){
  try{
   const result=await callFn("sv_leadership_public",{});
   if(Array.isArray(result)){published=result.filter(p=>p&&tags.some(t=>t.key===p.key));renderLeadership();}
  }catch(err){console.warn("Leadership data unavailable; displaying default introduction cards.",err);}
 }
 function isMaster(){
  try{return typeof OFFICER!=="undefined"&&OFFICER?.role==="MASTER"&&!!TOKEN;}
  catch(e){return false;}
 }
 function sessionToken(){
  try{return isMaster()?TOKEN:null;}
  catch(e){return null;}
 }
 function notify(form,text,good){
  const box=$(".qdc-v6-feedback",form);
  if(!box)return;
  box.textContent=text;box.classList.toggle("good",!!good);box.setAttribute("role","status");
 }
 function photoPreview(form,photo,name){
  const spot=$(".qdc-v6-preview-photo",form);if(!spot)return;
  spot.replaceChildren();
  const p={photo:photo,name:name};
  spot.append(photoSlot(p));
 }
 function createManagerForm(key){
  const t=tags.find(x=>x.key===key);
  const form=el("form","qdc-v6-manager-form");form.dataset.profileKey=key;
  form.innerHTML=
    '<div class="qdc-v6-manager-head"><span class="qdc-v6-manager-marker">★</span><div><small>MASTER ADMIN · HOMEPAGE MANAGEMENT</small><h3></h3></div><span class="qdc-v6-master-chip">MASTER ONLY</span></div>'+
    '<div class="qdc-v6-last-update"></div><div class="qdc-v6-edit-layout">'+
     '<div class="qdc-v6-photo-editor"><div class="qdc-v6-preview-photo"></div><label class="qdc-v6-upload-btn"><span>↑</span> Upload / Replace Photo<input type="file" accept="image/jpeg,image/png,image/webp" class="qdc-v6-photo-file" hidden></label><button type="button" class="qdc-v6-remove-photo">Remove Photo</button><small>JPG / PNG / WebP • Automatically cropped for profile cards. Use the real officer portrait only.</small></div>'+
     '<div class="qdc-v6-inputs"><label>Full Name<input name="full_name" type="text" maxlength="100" required autocomplete="off"></label>'+
     '<label>Designation<input name="designation" type="text" maxlength="160" required></label>'+
     '<label>School / Office<input name="office" type="text" maxlength="150"></label>'+
     '<label>Short Introduction <span class="qdc-v6-count">0 / 850</span><textarea name="bio" maxlength="850" rows="4"></textarea></label>'+
     '<label class="qdc-v6-publish"><input name="published" type="checkbox" checked><span>Publish on Home Page</span></label></div></div>'+
    '<div class="qdc-v6-form-actions"><button class="qdc-v6-save" type="submit">✓ Save & Update Homepage</button>'+
    '<button class="qdc-v6-preview-btn" type="button">Preview Card</button>'+
    '<button class="qdc-v6-reset-btn" type="button">Cancel Changes</button></div>'+
    '<div class="qdc-v6-feedback" aria-live="polite"></div><div class="qdc-v6-live-preview" hidden></div>';
  $(".qdc-v6-manager-head h3",form).textContent=t.label;
  form.addEventListener("submit",saveForm);
  $(".qdc-v6-photo-file",form).addEventListener("change",async e=>{
   const file=e.target.files?.[0];if(!file)return;
   notify(form,"Preparing your official portrait…",false);
   try{
    pendingPhotos[key]={keep:false,photo:await compressPhoto(file)};
    photoPreview(form,pendingPhotos[key].photo,form.elements.full_name.value);
    notify(form,"Photo ready. Select Save & Update Homepage to publish it.",true);
   }catch(err){notify(form,err.message||"Photo could not be processed",false);}
   finally{e.target.value="";}
  });
  $(".qdc-v6-remove-photo",form).addEventListener("click",()=>{
   pendingPhotos[key]={keep:false,photo:null};
   photoPreview(form,null,form.elements.full_name.value);
   notify(form,"Photo will be removed after you save the profile.",false);
  });
  $(".qdc-v6-preview-btn",form).addEventListener("click",()=>{
   const prev=$(".qdc-v6-live-preview",form);
   const data=values(form),photo=pendingPhotos[key]?.keep===false?pendingPhotos[key].photo:management.find(x=>x.key===key)?.photo;
   prev.hidden=false;prev.replaceChildren(personCard(Object.assign({key,photo},data)));
   prev.scrollIntoView({behavior:"smooth",block:"nearest"});
  });
  $(".qdc-v6-reset-btn",form).addEventListener("click",()=>fillForm(form,management.find(x=>x.key===key)||t));
  form.elements.bio.addEventListener("input",()=>$(".qdc-v6-count",form).textContent=form.elements.bio.value.length+" / 850");
  return form;
 }
 function values(form){
  return {name:form.elements.full_name.value.trim(),designation:form.elements.designation.value.trim(),
   office:form.elements.office.value.trim(),bio:form.elements.bio.value.trim(),published:form.elements.published.checked};
 }
 function fillForm(form,p){
  if(!p)return;
  const key=form.dataset.profileKey;
  form.elements.full_name.value=p.name||"";
  form.elements.designation.value=p.designation||"";
  form.elements.office.value=p.office||"";
  form.elements.bio.value=p.bio||"";
  form.elements.published.checked=p.published!==false;
  $(".qdc-v6-count",form).textContent=form.elements.bio.value.length+" / 850";
  const meta=$(".qdc-v6-last-update",form);
  if(meta){ const d=p.updated_at?new Date(p.updated_at):null; meta.textContent=d&&!isNaN(d.getTime())?"Last updated: "+d.toLocaleString()+" · by "+(p.updated_by||"system"):"Not yet updated by Master Admin"; }
  delete pendingPhotos[key];
  photoPreview(form,p.photo||null,p.name||"");
  $(".qdc-v6-live-preview",form).hidden=true;
  notify(form,"",false);
 }
 async function compressPhoto(file){
  if(!/^image\/(jpeg|png|webp)$/.test(file.type))throw Error("Upload JPG, PNG or WebP only.");
  if(file.size>7*1024*1024)throw Error("Original image must be smaller than 7 MB.");
  const url=URL.createObjectURL(file);
  try{
   const img=await new Promise((resolve,reject)=>{
    const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error("Invalid image file"));i.src=url;
   });
   if(img.naturalWidth<90||img.naturalHeight<90)throw Error("Please choose a clearer portrait (minimum 90×90).");
   const canvas=document.createElement("canvas");canvas.width=480;canvas.height=480;
   const ctx=canvas.getContext("2d");if(!ctx)throw Error("Image editor unavailable");
   const side=Math.min(img.naturalWidth,img.naturalHeight),x=(img.naturalWidth-side)/2,y=(img.naturalHeight-side)/2;
   ctx.fillStyle="#f5f8f6";ctx.fillRect(0,0,480,480);
   ctx.drawImage(img,x,y,side,side,0,0,480,480);
   let output="";
   for(const quality of [.85,.72,.6,.5,.4]){
    output=canvas.toDataURL("image/jpeg",quality);
    if(output.length<=280000)break;
   }
   if(output.length>320000)throw Error("Photo is still too large; try a smaller original.");
   return output;
  }finally{URL.revokeObjectURL(url);}
 }
 async function saveForm(event){
  event.preventDefault();
  const form=event.currentTarget, key=form.dataset.profileKey;
  if(!isMaster()){notify(form,"Master Admin sign-in is required.",false);return;}
  const v=values(form);
  if(v.name.length<2||v.designation.length<3){notify(form,"Enter the officer's full name and designation.",false);return;}
  const button=$(".qdc-v6-save",form);button.disabled=true;button.textContent="Saving securely…";
  const photo=pendingPhotos[key];
  try{
   const result=await callFn("sv_leadership_save",{
    p_token:sessionToken(),p_key:key,p_name:v.name,p_designation:v.designation,
    p_office:v.office,p_bio:v.bio,p_photo_data:photo?.keep===false?photo.photo:null,
    p_keep_photo:!(photo?.keep===false),p_is_published:v.published
   });
   if(!result?.ok)throw Error(result?.status||"Save rejected by the server");
   await Promise.all([getPublic(),refreshManager()]);
   notify(form,v.published?"Profile saved. The public homepage has been updated.":"Profile saved as unpublished. It is hidden from the public homepage.",true);
  }catch(err){notify(form,"Update failed: "+(err?.message||"Please try again"),false);}
  finally{button.disabled=false;button.textContent="✓ Save & Update Homepage";}
 }
 function setupManager(){
  const dash=$("#screen-dash"),main=$("#screen-dash .qdc-admin-main"),sidebar=$("#screen-dash .qdc-admin-side .tabs");
  if(!dash||!main||!sidebar||$("#tab-leadership"))return;
  const menu=el("button","tab hidden","✦ Homepage Leadership");
  menu.type="button";menu.dataset.tab="leadership";menu.id="qdc-v6-leadership-nav";menu.setAttribute("aria-hidden","true");
  sidebar.append(menu);
  const panel=el("div","tabpane hidden qdc-v6-admin-panel");panel.id="tab-leadership";
  panel.innerHTML='<div class="qdc-v6-admin-title"><div><small>HOMEPAGE CONTENT MANAGEMENT</small><h2>Leadership Profiles</h2><p>Update the official portraits, names, designations and introductions shown on the homepage. Only Master Admin can save these records.</p></div><span>✓ Secure Master Approval</span></div><div class="qdc-v6-forms"></div>';
  const forms=$(".qdc-v6-forms",panel);tags.forEach(p=>forms.append(createManagerForm(p.key)));
  main.append(panel);
  menu.addEventListener("click",async()=>{
   if(!isMaster())return;
   if(typeof openTab==="function")openTab("leadership");
   else {$$("#screen-dash .tabpane").forEach(x=>x.classList.toggle("hidden",x!==panel));menu.classList.add("on");}
   await refreshManager();
  });
  const observer=new MutationObserver(()=>syncAdminUI());
  observer.observe(dash,{attributes:true,attributeFilter:["class"]});
  const refresh=$("#btn-refresh");
  refresh?.addEventListener("click",()=>setTimeout(syncAdminUI,150),true);
  $("#btn-logout")?.addEventListener("click",()=>{management=[];menu.classList.add("hidden");panel.classList.add("hidden");},true);
  syncAdminUI();
 }
 function syncAdminUI(){
  const menu=$("#qdc-v6-leadership-nav"),panel=$("#tab-leadership");
  if(!menu)return;
  const master=isMaster(),shown=master&&!$("#screen-dash").classList.contains("hidden");
  menu.classList.toggle("hidden",!master);
  menu.setAttribute("aria-hidden",String(!master));
  if(!master){
   if(panel&&!panel.classList.contains("hidden")){
    panel.classList.add("hidden");
    if(typeof openTab==="function")openTab("cells");
   }
   management=[];
  }
  if(shown&&!management.length&&!loading)refreshManager();
 }
 async function refreshManager(){
  if(!isMaster()||loading)return;
  loading=true;
  try{
   const result=await callFn("sv_leadership_manage",{p_token:sessionToken()});
   if(!result?.ok)throw Error(result?.status||"Not authorized");
   management=Array.isArray(result.profiles)?result.profiles:[];
   $$("form.qdc-v6-manager-form").forEach(form=>fillForm(form,management.find(x=>x.key===form.dataset.profileKey)||tags.find(x=>x.key===form.dataset.profileKey)));
  }catch(err){
   $$("form.qdc-v6-manager-form").forEach(form=>notify(form,"Could not load official profiles: "+(err.message||"Unknown error"),false));
  }finally{loading=false;}
 }
 function init(){
  if(prepared)return;prepared=true;
  schoolBrand();
  setupHome();
  setupManager();
  getPublic();
  // The original application still owns all authentication, roster, cell, registration and edit workflows.
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
 else init();
})();