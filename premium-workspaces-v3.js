/* Premium Workspaces v3 | UI-only enhancements
 * No changes to IDs, Supabase, authentication, existing save/approval handlers or record values.
 * All actions delegate to established functional controls.
 */
(function(){
 "use strict";
 const logo="./assets/qamardin-selected-logo-3.svg";
 const $=(sel,scope=document)=>scope.querySelector(sel);
 const visible=el=>!!el && !el.classList.contains("hidden") && !el.closest(".hidden") && getComputedStyle(el).display!=="none";
 const make=(tag,cls,txt)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(txt)x.textContent=txt;return x;};
 const clickTab=key=>{const target=$('#screen-dash .qdc-admin-side .tab[data-tab="'+key+'"]');if(target && !target.classList.contains("hidden"))target.click();};
 function image(alt,cls){const x=make("img",cls);x.src=logo;x.alt=alt;x.width=54;x.height=54;x.loading="eager";return x;}
 function addSchoolLockup(target,smallFirst){
   if(!target || $(".qdc-v3-lockup",target))return;
   const lock=make("div","qdc-v3-lockup");
   lock.append(image("GBHS Qamardin Chandio crest","qdc-v3-lockup-logo"));
   const names=make("div","qdc-v3-lockup-copy");
   const kicker=make("small",null,"CLUSTER HUB SCHOOL");
   const name=make("strong",null,"GBHS QAMARDIN CHANDIO");
   if(smallFirst)names.append(kicker,name);else names.append(name,kicker);
   lock.append(names);target.append(lock);
 }
 function setupBrand(){
   // Existing homepage is preserved, except for school-name hierarchy and school crest.
   const homeBrand=$("#screen-login .rail .brand");
   if(homeBrand){
     const b=$("b",homeBrand),sm=$("small",homeBrand),seal=$(".seal",homeBrand);
     if(b)b.textContent="GBHS QAMARDIN CHANDIO";
     if(sm)sm.textContent="CLUSTER HUB SCHOOL";
     if(seal && !$(".qdc-v3-crest",seal)){seal.textContent="";seal.append(image("GBHS Qamardin Chandio logo","qdc-v3-crest"));}
   }
   const cluster=$("#screen-login .pagehead .cluster");
   if(cluster && !$(".qdc-v3-cluster-name",cluster)){
     cluster.textContent="";
     cluster.append(make("small",null,"CLUSTER HUB SCHOOL"),make("strong","qdc-v3-cluster-name","GBHS QAMARDIN CHANDIO"));
   }
   const loginAuth=$("#screen-login #home-auth");
   if(loginAuth && !$(".qdc-v3-login-brand",loginAuth)){
     const b=make("div","qdc-v3-login-brand");
     b.append(image("GBHS Qamardin Chandio crest","qdc-v3-login-logo"));
     const words=make("div");
     words.append(make("small",null,"CLUSTER HUB SCHOOL"),make("strong",null,"GBHS QAMARDIN CHANDIO"));
     b.append(words);loginAuth.insertBefore(b,loginAuth.firstChild);
   }
   const admin=$('#screen-dash .qdc-admin-brand');
   if(admin){
     const b=$("b",admin),sm=$("small",admin),icon=$("span",admin);
     if(b)b.textContent="GBHS QAMARDIN CHANDIO";
     if(sm)sm.textContent="CLUSTER HUB SCHOOL";
     if(icon && !$("img",icon)){icon.textContent="";icon.append(image("GBHS Qamardin Chandio crest","qdc-v3-admin-crest"));}
   }
   const dashhero=$("#screen-dash .dashhero-text");
   addSchoolLockup(dashhero,false);
   const band=$("#screen-record .letterhead");
   if(band){
     const img=$("#band-img");
     if(img){img.src=logo;img.alt="GBHS Qamardin Chandio official school crest";img.width=70;img.height=70;}
     if(!$(".qdc-v3-lettertext",band)){
       const label=make("div","qdc-v3-lettertext");
       label.append(make("small",null,"CLUSTER HUB SCHOOL"),make("strong",null,"GBHS QAMARDIN CHANDIO"),make("span",null,"Employee Service & Verification Portal"));
       band.append(label);
     }
   }
   // The old app asynchronously redraws its earlier header illustration.
   // Keep the original school crest assigned, without modifying image/data load functions.
   const target=$("#band-img");
   if(target){
     new MutationObserver(()=>{
       if(target.getAttribute("src")!==logo)target.setAttribute("src",logo);
     }).observe(target,{attributes:true,attributeFilter:["src"]});
   }
 }
 const actions=[
  {label:"Employee Records",symbol:"♙",key:"staff"},
  {label:"Schools Management",symbol:"⌂",key:"schools"},
  {label:"Unified Review Queue",symbol:"✓",key:"requests"},
  {label:"Export to Excel",symbol:"⇩",key:"excel"},
  {label:"Refresh Dashboard",symbol:"↻",key:"refresh"}
 ];
 function setupActions(){
   const analytics=$("#qdc-service-analytics");
   if(!analytics || $("#qdc-v3-actions"))return;
   const panel=make("section","qdc-v3-actions");
   panel.id="qdc-v3-actions";panel.setAttribute("aria-label","Admin quick actions");
   panel.append(make("h3",null,"⚡ Quick Actions"));
   actions.forEach(a=>{
     const b=make("button","qdc-v3-action");
     b.type="button";b.dataset.action=a.key;
     b.append(make("b",null,a.symbol),make("span",null,a.label),make("span",null,"›"));
     panel.append(b);
   });
   analytics.insertAdjacentElement("afterend",panel);
   panel.addEventListener("click",e=>{
     const b=e.target.closest("button[data-action]");if(!b)return;
     const a=b.dataset.action;
     if(["staff","schools","requests"].includes(a)){clickTab(a);return;}
     const control=$(a==="excel"?"#btn-excel":"#btn-refresh");
     if(visible(control))control.click();
   });
   document.addEventListener("keydown",e=>{
     if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"&&visible($("#screen-dash"))){
       const q=$("#ds-query");if(!q)return;
       e.preventDefault();q.focus();q.select();
     }
   });
   const bar=$("#screen-dash .bar");
   if(bar && !$(".qdc-v3-shortcut",bar)){
     const hint=make("span","qdc-v3-shortcut");
     hint.innerHTML='Search <kbd>Ctrl</kbd> + <kbd>K</kbd>';
     const search=$("#dashsearch");
     if(search)search.append(hint);
   }
 }
 function fieldHint(label){
   const name=String(label||"").toLowerCase().replace(/\s+/g," ");
   if(name.includes("cnic"))return "Enter your CNIC exactly as printed on the official identity card, including its correct digits.";
   if(name.includes("personal no")||name.includes("pid"))return "Use the Personal ID (PID) given in your official service or payroll record.";
   if(name.includes("date of birth")||name==="dob")return "Match your date of birth with your official employment and identity records.";
   if(name.includes("mobile")||name.includes("phone")||name.includes("contact"))return "Provide a working mobile number that your office can use to contact you.";
   if(name.includes("place of posting")||name.includes("school")||name.includes("semis"))return "Select the school and SEMIS information matching your current posting order.";
   if(name.includes("designation")||name.includes("bps")||name.includes("appointment")||name.includes("joining"))return "Use the designation, pay scale and service dates from your official orders.";
   if(name.includes("qualification"))return "Enter your highest completed qualification as shown on your certificate.";
   if(name.includes("name"))return "Enter the spelling used in your official service record.";
   return "Check this field against your official record before saving the update.";
 }
 function setupFieldHints(){
   const record=$("#screen-record");if(!record)return;
   record.addEventListener("focusin",e=>{
     if(!e.target.matches("input,select,textarea"))return;
     const field=e.target.closest(".field");
     if(!field || !field.closest(".fields"))return;
     record.querySelectorAll(".qdc-v3-field-help").forEach(x=>x.remove());
     const label=$(".k",field);
     const tip=make("div","qdc-v3-field-help",fieldHint(label?.textContent||e.target.getAttribute("name")||""));
     tip.setAttribute("role","status");
     field.append(tip);
   });
   record.addEventListener("focusout",e=>{
     const field=e.target.closest(".field");if(!field)return;
     setTimeout(()=>{if(!field.contains(document.activeElement))$(".qdc-v3-field-help",field)?.remove();},0);
   });
 }
 function boot(){setupBrand();setupActions();setupFieldHints();}
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();