(()=>{'use strict';
if(window.parent!==window&&new URLSearchParams(location.search).has('embedded'))return;
const style=document.createElement('style');style.textContent=`
.portal-navigation{box-sizing:border-box!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;width:100%!important;padding:10px clamp(10px,3vw,28px)!important;background:linear-gradient(110deg,#fffef9,#eaf4ec)!important;border-bottom:1px solid #b8cbbb!important;font-family:Manrope,system-ui,sans-serif!important;color:#174d39!important}
.portal-nav-brand{display:flex!important;align-items:center!important;color:#174d39!important;font-size:11px!important;font-weight:850!important;line-height:1.3!important}
.portal-nav-actions{display:flex!important;gap:7px!important;flex-shrink:0!important}
.portal-navigation .portal-nav-button{display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:6px!important;min-height:44px!important;margin:0!important;padding:7px 13px!important;background:linear-gradient(130deg,#fff,#eef5ef)!important;color:#17513b!important;border:1px solid #a8bdab!important;border-radius:11px!important;box-shadow:0 3px 8px #174d3910!important;text-decoration:none!important;font:800 11px Manrope,system-ui,sans-serif!important;cursor:pointer!important;transition:transform .25s,box-shadow .25s!important}
.portal-navigation .portal-nav-button:hover{transform:translateY(-3px)!important;box-shadow:0 8px 18px #174d3925!important}
.portal-navigation .portal-nav-button:focus-visible{outline:3px solid #c8a45b!important;outline-offset:2px!important}
.portal-navigation .portal-nav-button svg{width:16px!important;height:16px!important;fill:none!important;stroke:currentColor!important;stroke-width:2!important}
.portal-navigation .portal-nav-home img{width:28px!important;height:28px!important;object-fit:contain!important}
header>a[href='./index.html'],a.portal-home{display:none!important}
@media(max-width:480px){.portal-navigation{gap:6px!important;padding:7px 9px!important}.portal-nav-brand{font-size:9px!important;max-width:48%!important}.portal-navigation .portal-nav-button{padding:5px 9px!important;font-size:10px!important}.portal-navigation .portal-nav-home img{width:27px!important;height:27px!important}}
@media(prefers-reduced-motion:reduce){.portal-navigation .portal-nav-button{transition:none!important}}
`;document.head.append(style);
const nav=document.createElement('nav');nav.className='portal-navigation';nav.setAttribute('aria-label','Portal navigation');
nav.innerHTML='<div class="portal-nav-brand">CLUSTER HUB SCHOOL<br>GBHS QAMARDIN CHANDIO</div><div class="portal-nav-actions"><button type="button" class="portal-nav-button" data-portal-back><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg>BACK</button><a class="portal-nav-button portal-nav-home" href="./index.html"><img src="./assets/gbhs-qamardin-chandio-logo.svg" alt="" aria-hidden="true">HOME</a></div>';
document.body.prepend(nav);
nav.querySelector('[data-portal-back]').onclick=()=>{if(typeof window.qdcNavigateBack==='function')window.qdcNavigateBack();else if(history.length>1)history.back();else location.assign('./index.html');};
})();
