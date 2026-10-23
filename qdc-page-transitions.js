(() => {
  'use strict';
  if (window.top !== window.self) return;

  const portals = new Set(['index.html', 'monthly-progress.html', 'monthly-management.html', 'building-survey.html']);
  const labels = {
    'index.html': 'Opening cluster homepage',
    'monthly-progress.html': 'Opening monthly progress report',
    'monthly-management.html': 'Opening monthly report management',
    'building-survey.html': 'Opening building safety survey'
  };
  const css = `
    .qdc-page-loader{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:24px;background:radial-gradient(ellipse at 48% 37%,#126647f5,#07392dec 65%,#031910f5);backdrop-filter:blur(8px);color:#fff;text-align:center;font:700 14px/1.5 Manrope,system-ui,sans-serif;opacity:0;visibility:hidden;pointer-events:none;transition:opacity .25s ease,visibility .25s ease}
    .qdc-page-loader.is-active{opacity:1;visibility:visible;pointer-events:auto}
    .qdc-page-loader__mark{display:grid;place-items:center;width:70px;height:70px;margin:0 auto 16px;border:2px solid #f0d084;border-radius:50%;color:#f4d48e;background:#073c2ac7;box-shadow:0 0 0 9px #dfbf6e14;font-size:31px;animation:qdc-loader-breathe .8s ease-in-out infinite alternate}
    .qdc-page-loader__title{display:block;font-size:clamp(17px,3vw,23px);letter-spacing:-.03em}
    .qdc-page-loader__hint{display:block;margin:5px 0 18px;color:#cbd9ed;font-size:11px;font-weight:500}
    .qdc-page-loader__bar{display:block;width:190px;height:4px;margin:auto;overflow:hidden;border-radius:9px;background:#ffffff36}
    .qdc-page-loader__bar:before{content:"";display:block;height:100%;width:30%;border-radius:inherit;background:linear-gradient(90deg,#d79e41,#ffe4a6);animation:qdc-loader-progress .65s ease-in-out infinite alternate}
    html.qdc-entering body{animation:qdc-page-in .45s cubic-bezier(.2,.8,.25,1) both}
    html.qdc-leaving body{animation:qdc-page-out .28s ease both}
    @keyframes qdc-page-in{from{opacity:.35;transform:translateX(14px)}to{opacity:1;transform:none}}
    @keyframes qdc-page-out{to{opacity:.35;transform:translateX(-12px)}}
    @keyframes qdc-loader-breathe{to{transform:scale(1.06);box-shadow:0 0 0 14px #dfbf6e08}}
    @keyframes qdc-loader-progress{to{width:100%}}
    @media(prefers-reduced-motion:reduce){html.qdc-entering body,html.qdc-leaving body,.qdc-page-loader__mark,.qdc-page-loader__bar:before{animation:none!important}.qdc-page-loader{transition:none!important}}
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.append(style);
  const overlay = document.createElement('div');
  overlay.className = 'qdc-page-loader';
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-live', 'polite');
  overlay.innerHTML = '<div><span class="qdc-page-loader__mark" aria-hidden="true"><img src="./assets/qamardin-selected-logo-3.svg" alt="" style="width:55px;height:55px;object-fit:contain"></span><strong class="qdc-page-loader__title"></strong><small class="qdc-page-loader__hint">Preparing your workspace...</small><span class="qdc-page-loader__bar" aria-hidden="true"></span></div>';
  document.body.append(overlay);
  const title = overlay.querySelector('.qdc-page-loader__title');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let pending = false;
  const targetName = (href) => {
    try {
      const url = new URL(href, location.href);
      if (url.origin !== location.origin) return null;
      const filename = url.pathname.split('/').pop() || 'index.html';
      return portals.has(filename) ? filename : null;
    } catch (_) { return null; }
  };
  const reset = () => {
    pending = false;
    overlay.classList.remove('is-active');
    document.documentElement.classList.remove('qdc-leaving');
  };
  /* Direct navigation: never display the page-transition logo overlay when moving
     from homepage to a monthly report, survey, DEO form or another portal page. */
  const go = (url, label) => {
    if(pending)return;
    pending=true;
    window.qdcUniversalLoader?.markInternalNavigation?.(url);
    location.assign(url);
  };
  window.qdcNavigateBack = () => {
    if(pending)return;
    let sameOrigin=false;
    try{sameOrigin=new URL(document.referrer).origin===location.origin}catch(_){}
    if(!sameOrigin||history.length<=1)return go('./index.html',labels['index.html']);
    pending=true;
    window.qdcUniversalLoader?.markInternalNavigation?.(document.referrer);
    history.back();
  };
  document.addEventListener('click', event => {
    const anchor = event.target.closest('a[href]');
    if (!anchor || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || anchor.hasAttribute('download')) return;
    if (anchor.target && anchor.target !== '_self') return;
    const name = targetName(anchor.href);
    if (!name) return;
    const url = new URL(anchor.href, location.href);
    if (url.href === location.href || (url.pathname === location.pathname && url.search === location.search)) return;
    event.preventDefault();
    go(url.href, labels[name]);
  }, true);
  addEventListener('pageshow', () => {
    reset();
    document.documentElement.classList.add('qdc-entering');
    setTimeout(() => document.documentElement.classList.remove('qdc-entering'), 550);
  });
  addEventListener('pagehide', () => document.documentElement.classList.remove('qdc-entering'));
})();
