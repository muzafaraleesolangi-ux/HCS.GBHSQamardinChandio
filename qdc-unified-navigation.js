(() => {
  'use strict';
  if (window.parent !== window && new URLSearchParams(location.search).has('embedded')) return;

  const css = `
    body > header:not(.qdc-emerald-header){display:none!important}
    .qdc-emerald-header,.qdc-emerald-header *{box-sizing:border-box}
    .qdc-emerald-header{position:relative;z-index:25;width:100%;margin:0!important;color:#f8f4df!important;background:radial-gradient(circle at 79% 35%,#176b51 0%,#083f35 43%,#062e29 100%);font-family:Arial,Helvetica,sans-serif!important;box-shadow:0 13px 26px #072b2550;isolation:isolate}
    .qdc-emerald-header .qeh-top{display:flex;justify-content:space-between;gap:12px;padding:9px clamp(16px,3vw,38px);background:#06241f66;border-bottom:1px solid #e6c87355;color:#e6d6a2;font-size:10px;font-weight:800;letter-spacing:.12em}
    .qdc-emerald-header .qeh-main{display:flex;align-items:center;gap:clamp(14px,3vw,30px);max-width:1600px;margin:auto;padding:17px clamp(16px,3vw,38px)}
    .qdc-emerald-header .qeh-school-logo{display:block;flex:none;width:clamp(79px,9vw,135px);height:clamp(83px,9.5vw,143px);object-fit:contain;filter:drop-shadow(0 8px 14px #0005);transition:transform .5s,filter .5s;animation:qeh-rise .7s both}
    .qdc-emerald-header .qeh-school-logo:hover{transform:translateY(-7px) scale(1.06) rotate(-2deg);filter:drop-shadow(0 16px 22px #0008)}
    .qdc-emerald-header .qeh-identity{min-width:0;flex:1;animation:qeh-rise .8s .12s both}
    .qdc-emerald-header .qeh-kicker{display:block;color:#edd488;font-size:clamp(9px,1vw,12px);letter-spacing:.19em;font-weight:800}
    .qdc-emerald-header .qeh-title{margin:6px 0!important;color:#f8f4df!important;font:bold clamp(24px,3.5vw,47px)/1.02 Georgia,serif!important;letter-spacing:.025em;transition:color .35s,letter-spacing .35s}
    .qdc-emerald-header .qeh-identity:hover .qeh-title{color:#f8df90!important;letter-spacing:.04em}
    .qdc-emerald-header .qeh-place{margin:0!important;color:#cbe0d0!important;font-size:clamp(10px,1.05vw,13px)!important}
    .qdc-emerald-header .qeh-trace{display:block;width:min(240px,70%);height:2px;margin-top:12px;background:linear-gradient(90deg,#f0d887,#fff,#f0d887);transform-origin:left;animation:qeh-draw 1.4s .2s both}
    .qdc-emerald-header .qeh-gov{display:flex;flex:none;flex-direction:column;align-items:center;gap:7px;width:94px;color:#e9d9a3;animation:qeh-rise .85s .2s both}
    .qdc-emerald-header .qeh-gov img{display:block;width:65px;height:74px;object-fit:contain;transition:transform .55s,filter .55s;filter:brightness(0) saturate(100%) invert(90%) sepia(23%) saturate(572%) hue-rotate(354deg)}
    .qdc-emerald-header .qeh-gov:hover img{transform:rotate(9deg) scale(1.13);filter:brightness(0) saturate(100%) invert(90%) sepia(23%) saturate(572%) hue-rotate(354deg) drop-shadow(0 0 9px #e9d9a3)}
    .qdc-emerald-header .qeh-gov small{text-align:center;font-size:9px;letter-spacing:.1em;line-height:1.25}
    .qdc-emerald-header .qeh-nav{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:5px;padding:9px clamp(12px,2vw,25px);background:#052c2670;border-top:1px solid #e8ce7f40}
    .qdc-emerald-header .qeh-nav a,.qdc-emerald-header .qeh-nav button{display:inline-flex;align-items:center;justify-content:center;min-height:40px;margin:0!important;padding:8px 13px;border:1px solid transparent;border-radius:7px;background:transparent;color:#edf3e9!important;text-decoration:none!important;font:700 11px Arial,Helvetica,sans-serif!important;cursor:pointer;transition:background .25s,color .25s,transform .25s,border-color .25s}
    .qdc-emerald-header .qeh-nav a:hover,.qdc-emerald-header .qeh-nav button:hover{transform:translateY(-3px);border-color:#b9a767;background:#f3df9d1f}
    .qdc-emerald-header .qeh-nav .qeh-current{background:#e9d493!important;color:#103e32!important}
    .qdc-emerald-header .qeh-nav .qeh-sign{border-color:#bfaa67;margin-left:auto!important}
    .qdc-emerald-header .qeh-nav a:focus-visible,.qdc-emerald-header .qeh-nav button:focus-visible{outline:3px solid #f2d073;outline-offset:2px}
    .qdc-emerald-header .qeh-foot{display:flex;justify-content:space-between;gap:12px;padding:9px clamp(16px,3vw,38px);color:#b5d6c3;font-size:9px;letter-spacing:.08em}
    .qdc-emerald-header .qeh-foot strong{color:#e4cb7c}
    @keyframes qeh-rise{from{opacity:0;transform:translateY(15px)}to{opacity:1;transform:translateY(0)}}
    @keyframes qeh-draw{from{transform:scaleX(0)}to{transform:scaleX(1)}}
    @media(max-width:620px){.qdc-emerald-header .qeh-top span:last-child,.qdc-emerald-header .qeh-gov small{display:none}.qdc-emerald-header .qeh-main{gap:10px;padding:14px 13px}.qdc-emerald-header .qeh-school-logo{width:67px;height:72px}.qdc-emerald-header .qeh-gov{width:42px}.qdc-emerald-header .qeh-gov img{width:38px;height:43px}.qdc-emerald-header .qeh-title{font-size:clamp(18px,5vw,28px)!important}.qdc-emerald-header .qeh-place{font-size:9px!important}.qdc-emerald-header .qeh-nav{justify-content:flex-start;flex-wrap:nowrap;overflow-x:auto;padding:7px 10px}.qdc-emerald-header .qeh-nav a,.qdc-emerald-header .qeh-nav button{flex:none;white-space:nowrap;font-size:10px!important;padding:6px 9px}.qdc-emerald-header .qeh-foot{font-size:8px}.qdc-emerald-header .qeh-foot span{display:none}}
    @media(prefers-reduced-motion:reduce){.qdc-emerald-header *, .qdc-emerald-header *:before,.qdc-emerald-header *:after{animation:none!important;transition:none!important}}
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);

  function mount() {
    if (document.querySelector('.qdc-emerald-header')) return;
    const page = location.pathname.split('/').pop() || 'index.html';
    const active = page === 'monthly-management.html' || page === 'monthly-progress.html' ? 'monthly' : page === 'building-survey.html' ? 'building' : page === 'seniority-data.html' ? 'teacher' : 'home';
    const header = document.createElement('header');
    header.className = 'qdc-emerald-header';
    header.innerHTML = `<div class="qeh-top"><span>GOVERNMENT OF SINDH · SCHOOL EDUCATION &amp; LITERACY DEPARTMENT</span><span>OFFICIAL EMPLOYEE PORTAL</span></div>
      <div class="qeh-main"><img class="qeh-school-logo" src="./assets/qamardin-selected-logo-3.svg" alt="Official GBHS Qamar Din Chandio school logo"><div class="qeh-identity"><span class="qeh-kicker">CLUSTER HUB SCHOOL</span><h1 class="qeh-title">GBHS QAMAR DIN<br>CHANDIO</h1><p class="qeh-place">UC Khairwah · Taluka Moro · District Naushahro Feroze</p><span class="qeh-trace" aria-hidden="true"></span></div><div class="qeh-gov"><img src="./assets/government-sindh-crest.png" alt="Government of Sindh emblem"><small>GOVERNMENT<br>OF SINDH</small></div></div>
      <nav class="qeh-nav" aria-label="Portal navigation"><a href="./index.html" data-page="home">Home</a><a href="./index.html#screen-login" data-page="employee">Employee</a><a href="./monthly-progress.html" data-page="monthly">Monthly Report</a><a href="./building-survey.html" data-page="building">Building Survey</a><a href="./seniority-data.html" data-page="teacher">Teacher Data</a><a class="qeh-sign" href="./index.html#screen-login">Sign In →</a></nav>
      <div class="qeh-foot"><strong>CONNECTED SCHOOLS. BETTER LEARNING.</strong><span>Employee profile &amp; admin workspace</span></div>`;
    header.querySelector(`[data-page="${active}"]`)?.classList.add('qeh-current');
    document.body.prepend(header);
    const oldHeader = [...document.body.children].find(el => el.tagName === 'HEADER' && el !== header);
    const deoBanner = oldHeader?.querySelector('.deo-request-banner');
    if (deoBanner) oldHeader.after(deoBanner);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once:true});
  else mount();
})();

