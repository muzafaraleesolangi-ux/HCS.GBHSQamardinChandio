/* Qamardin Pearl Glass global banner: purely presentational branding + functional
   links to existing homepage sections. Does not intercept authentication or loaders. */
(()=>{'use strict';
 const SVG={
  book:'<path d="M12 6.5c-2.3-1.5-5.7-1.8-9-1v13c3.3-.8 6.7-.5 9 1 2.3-1.5 5.7-1.8 9-1v-13c-3.3-.8-6.7-.5-9 1Zm0 0v13"/>',
  target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="m12 12 7-7"/>',
  people:'<circle cx="12" cy="8" r="3"/><path d="M5 20v-2a7 7 0 0 1 14 0v2M4 10a3 3 0 0 1 3-3m13 3a3 3 0 0 0-3-3"/>',
  home:'<path d="m3 10 9-7 9 7v10H4V10m6 10v-7h4v7"/>',
  school:'<path d="M3 21h18M5 21V8l7-4 7 4v13M9 11h.01M15 11h.01M9 15h.01M15 15h.01M10 21v-3h4v3"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.6 2.6 0 1 1 4.8 1.4c-.9 1-2.3 1.4-2.3 3m0 3h.01"/>',
  leadership:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m4-10a3 3 0 0 0-2-5m1 10a5 5 0 0 1 3 5"/>'
 };
 const ico=k=>'<svg viewBox="0 0 24 24" aria-hidden="true">'+SVG[k]+'</svg>';
 const links=[['home-overview','Overview','home'],['cells','Cells & Schools','school'],['home-auth','Employee Help','help'],['qdc-v6-about','About & Leadership','leadership']];
 const homePage=/(?:^|\/)index\.html$/.test(location.pathname)||/\/$/.test(location.pathname);
 const makeTitle=(element,value)=>{
  const line=document.createElement('span');line.className='qgh-name-line';
  line.setAttribute('aria-hidden','true');
  Array.from(value).forEach((char,i)=>{
   const span=document.createElement('span');span.className=char===' '?'qgh-word-gap':'qgh-letter';
   if(char===' '){span.textContent=' ';}else{span.textContent=char;span.style.setProperty('--l',i);}
   line.appendChild(span);
  });element.appendChild(line);
 };
 function navigateWithinHome(event){
  const anchor=event.currentTarget;
  if(!homePage)return;
  event.preventDefault();
  const id=anchor.dataset.qghTarget;
  const screen=document.getElementById('screen-login');
  if(screen&&screen.classList.contains('hidden')){
   let unsaved=false;
   try{unsaved=typeof PROFILE_UNSAVED!=='undefined'&&!!PROFILE_UNSAVED}catch(_e){}
   if(unsaved&&!confirm('Unsaved changes may be lost. Open the homepage?'))return;
   if(typeof window.show==='function')window.show('#screen-login');
   else if(typeof show==='function')show('#screen-login');
   else{location.assign('./index.html#'+id);return;}
  }
  const target=document.getElementById(id)||(id==='qdc-v6-about'?document.getElementById('home-overview'):null);
  if(target&&!target.closest('.hidden')){
   target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
   try{history.replaceState(history.state,'','#'+id)}catch(_e){}
  }
 }
 function init(){
  if(document.querySelector('.qgh-portal')||document.documentElement.classList.contains('mpr-embedded')||document.body?.classList.contains('mpr-embedded'))return;
  if(window.self!==window.top&&new URLSearchParams(location.search).has('embedded'))return;
  const body=document.body;if(!body)return;
  const native=Array.from(body.children).find(el=>el.tagName==='HEADER');
  if(!native)return;
  const premium=document.createElement('section');premium.className='qgh-portal';
  premium.setAttribute('aria-label','Cluster Hub School premium portal header');
  premium.innerHTML='<div class="qgh-main">'+
   '<div class="qgh-mark"><div class="qgh-logo school"><img src="./assets/qamardin-selected-logo-3.svg" alt="Official GBHS Qamardin Chandio school logo" width="114" height="114" loading="eager"></div><small>OFFICIAL CLUSTER LOGO</small></div>'+
   '<div class="qgh-heading-box"><div class="qgh-kicker">CLUSTER HUB SCHOOL</div><h1 class="qgh-name" aria-label="GBHS QAMAR DIN CHANDIO"></h1>'+
   '<div class="qgh-divider"></div><div class="qgh-department">School Education &amp; Literacy Department · Government of Sindh</div>'+
   '<div class="qgh-loc">UC KHAIRWAH · TALUKA MORO · DISTRICT NAUSHAHRO FEROZE</div></div>'+
   '<div class="qgh-mark"><div class="qgh-logo"><img src="./assets/government-sindh-crest.png" alt="Official Government of Sindh crest" width="114" height="114" loading="eager"></div><small>SINDH EDUCATION</small></div></div>'+
   '<div class="qgh-cards"><div class="qgh-card feature"><span class="qgh-card-icon">'+ico('book')+'</span><div><b>Connected schools.</b><b>Better learning.</b></div></div>'+
   '<div class="qgh-card"><span class="qgh-card-icon">'+ico('target')+'</span><div><h2>VISION</h2><p>Clear records.<br>Stronger schools.</p></div></div>'+
   '<div class="qgh-card"><span class="qgh-card-icon">'+ico('people')+'</span><div><h2>PURPOSE</h2><p>Staff, progress and reporting in one reliable place.</p></div></div></div>'+
   '<nav class="qgh-nav" aria-label="Cluster Hub School quick links"></nav>';
  const title=premium.querySelector('.qgh-name');makeTitle(title,'GBHS QAMAR DIN');makeTitle(title,'CHANDIO');
  const bar=premium.querySelector('.qgh-nav');
  links.forEach(([id,label,icon])=>{
   const a=document.createElement('a');a.href='./index.html#'+id;a.dataset.qghTarget=id;
   a.innerHTML=ico(icon)+'<span></span>';a.querySelector('span').textContent=label;
   a.addEventListener('click',navigateWithinHome);bar.appendChild(a);
  });
  body.insertBefore(premium,native);
  body.classList.add('qgh-installed',homePage?'qgh-home':'qgh-module');
  /* Keep the old header in the DOM for legacy application selectors, but
     remove its visual layout so it cannot duplicate the approved new header. */
  const legacyDeoNotice=native.querySelector('.deo-request-banner');
  if(legacyDeoNotice){
    const retained=document.createElement('section');
    retained.className='qgh-retained-notice';
    retained.setAttribute('aria-label','District Education Office official instructions');
    retained.append(legacyDeoNotice);
    premium.after(retained);
  }
  native.classList.add('qgh-retired-header');
  native.setAttribute('aria-hidden','true');
  native.setAttribute('hidden','');
  native.style.setProperty('display','none','important');
  const unified=body.querySelector(':scope > .portal-navigation');
  if(unified&&unified!==premium)premium.after(unified);
  if(homePage&&location.hash){
   const hash=decodeURIComponent(location.hash.slice(1));
   if(links.some(row=>row[0]===hash)){
    requestAnimationFrame(()=>{const target=document.getElementById(hash);const screen=document.getElementById('screen-login');if(target&&screen&&!screen.classList.contains('hidden'))target.scrollIntoView({block:'start'});});
   }
  }
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
