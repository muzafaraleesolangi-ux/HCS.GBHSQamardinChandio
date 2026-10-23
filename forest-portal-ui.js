(()=>{'use strict';
if(window.top!==window.self&&new URLSearchParams(location.search).has('embedded'))return;
const file=location.pathname.split('/').pop()||'index.html';
const contexts={'index.html':'EMPLOYEE PROFILE & ADMIN WORKSPACE','building-survey.html':'BUILDING SAFETY SURVEY','seniority-data.html':'DEO TEACHER DATA GENERATOR'};
const cssClass={'index.html':'qf-index','building-survey.html':'qf-survey','seniority-data.html':'qf-seniority'}[file];
if(cssClass)document.body.classList.add(cssClass);
if(file==='monthly-progress.html'||file==='monthly-management.html'){
 const powered=document.createElement('div');powered.className='qf-powered';powered.setAttribute('role','note');
 powered.innerHTML='<strong>Powered by Cluster Hub School GBHS Qamardin Chandio</strong><span>Schools across District Naushahro Feroze can create and export Monthly Academic Progress Reports here. This service is open beyond the Qamardin cluster.</span>';
 (document.querySelector('.portal-navigation')||document.body.firstElementChild).after(powered);
}
const wa='<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12.04 2C6.52 2 2.03 6.48 2.02 12a9.9 9.9 0 0 0 1.33 4.98L2 22l5.16-1.35a10 10 0 0 0 4.88 1.25h.01C17.57 21.9 22 17.43 22 11.95 22 6.45 17.54 2 12.04 2Zm0 18.2a8.23 8.23 0 0 1-4.2-1.15l-.3-.18-3.13.82.83-3.04-.2-.31a8.25 8.25 0 0 1-1.26-4.34 8.25 8.25 0 0 1 8.27-8.25 8.2 8.2 0 0 1 5.84 2.42 8.18 8.18 0 0 1 2.42 5.84 8.25 8.25 0 0 1-8.27 8.19Zm4.53-6.17c-.25-.13-1.48-.73-1.71-.81-.23-.08-.4-.12-.57.13-.17.25-.65.81-.8.98-.14.16-.29.19-.54.06-.25-.13-1.05-.39-2-1.24-.74-.66-1.24-1.47-1.38-1.72-.15-.25-.02-.39.11-.51l.37-.44c.12-.14.16-.24.25-.4.08-.17.04-.31-.02-.44-.06-.13-.57-1.37-.78-1.87-.2-.49-.41-.42-.57-.42h-.49c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.09 0 1.23.9 2.42 1.02 2.58.13.17 1.77 2.71 4.29 3.8.6.26 1.07.42 1.43.53.6.19 1.15.16 1.58.1.48-.07 1.48-.61 1.69-1.2.21-.59.21-1.09.15-1.2-.06-.1-.23-.17-.48-.29Z"/></svg>';
const help=document.createElement('div');help.className='qf-support';
help.innerHTML='<div class="qf-help-menu" id="qf-help-menu" hidden><strong>Choose a WhatsApp contact</strong><a class="qf-contact" href="https://wa.me/923000357397" target="_blank" rel="noopener noreferrer">'+wa+'<span>Muzafar Ali Solangi<small>03000357397</small></span></a><a class="qf-contact" href="https://wa.me/923023213152" target="_blank" rel="noopener noreferrer">'+wa+'<span>Aquib Ali Chandio<small>03023213152</small></span></a></div><button type="button" class="qf-help-toggle" aria-controls="qf-help-menu" aria-expanded="false">'+wa+'<span>Need Help?</span></button>';
document.body.append(help);
const toggle=help.querySelector('.qf-help-toggle'),menu=help.querySelector('.qf-help-menu');
const setOpen=open=>{menu.hidden=!open;toggle.setAttribute('aria-expanded',String(open));};
toggle.addEventListener('click',()=>setOpen(menu.hidden));
document.addEventListener('click',e=>{if(!help.contains(e.target))setOpen(false)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!menu.hidden){setOpen(false);toggle.focus()}});
})();
