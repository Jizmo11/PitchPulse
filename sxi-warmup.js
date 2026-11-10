/* StrideEleven Cloudflare backend warm-up indicator. No fake progress or forced navigation. */
(() => {
  'use strict';
  const statusUrl = '/api/status';
  let timer = null, stopped = false, attempt = 0, pending = false;
  const style = document.createElement('style');
  style.textContent = `
    #sxi-warmup{position:fixed;left:12px;right:12px;bottom:calc(78px + env(safe-area-inset-bottom,0px));z-index:9000;background:#172631;color:#edf4fa;border:1px solid #3c5261;border-left:4px solid #b7f36b;border-radius:13px;padding:13px 15px;box-shadow:0 8px 25px #0007;font:14px system-ui,Arial,sans-serif;max-width:680px;margin:auto}
    #sxi-warmup[hidden]{display:none!important}
    #sxi-warmup strong{display:block;font-size:14px;margin-bottom:4px}
    #sxi-warmup p{margin:0;color:#bac9d2;font-size:12px;line-height:1.45}
    #sxi-warmup button{margin-top:10px;background:#b7f36b;color:#102030;border:0;border-radius:8px;padding:7px 12px;font-weight:700;font-size:12px}
    #sxi-warmup .sxi-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#b7f36b;margin-right:7px;animation:sxi-pulse 1.3s ease-in-out infinite}
    @keyframes sxi-pulse{50%{opacity:.3;transform:scale(.8)}}
    @media(prefers-reduced-motion:reduce){#sxi-warmup .sxi-dot{animation:none}}
  `;
  document.head.appendChild(style);
  function init(){
    if(document.getElementById('sxi-warmup'))return;
    const panel=document.createElement('aside');
    panel.id='sxi-warmup';panel.setAttribute('role','status');panel.setAttribute('aria-live','polite');
    panel.innerHTML='<strong><span class="sxi-dot" aria-hidden="true"></span>Warming up your performance data…</strong><p id="sxi-warmup-detail">Your dashboard is ready while the performance service starts.</p><button id="sxi-warmup-retry" type="button" hidden>Try again</button>';
    document.body.appendChild(panel);
    panel.querySelector('button').addEventListener('click',()=>{attempt=0;panel.querySelector('button').hidden=true;check();});
    check();
  }
  function schedule(ms){if(stopped)return;clearTimeout(timer);timer=setTimeout(check,ms);}
  async function check(){
    if(stopped||pending)return;
    if(!navigator.onLine){
      document.getElementById('sxi-warmup-detail').textContent='You appear to be offline. Saved training information is still available.';
      document.getElementById('sxi-warmup-retry').hidden=false;
      return;
    }
    pending=true;
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),12000);
    try{
      const response=await fetch(statusUrl,{cache:'no-store',credentials:'same-origin',signal:controller.signal});
      if(!response.ok)throw Error('HTTP '+response.status);
      const data=await response.json();
      if(!data||typeof data!=='object'||typeof data.connected!=='boolean')throw Error('Unexpected status');
      stopped=true;clearTimeout(timer);
      const panel=document.getElementById('sxi-warmup');
      if(panel)panel.hidden=true;
      document.dispatchEvent(new CustomEvent('sxi:backend-ready',{detail:{connected:data.connected,configured:data.configured}}));
    }catch(error){
      attempt++;
      const detail=document.getElementById('sxi-warmup-detail');
      const retry=document.getElementById('sxi-warmup-retry');
      if(attempt>=5){
        detail.textContent='Extra time! The performance service is taking longer than usual. Your saved dashboard remains available.';
        retry.hidden=false;
      }else{
        detail.textContent='Connecting to your performance service… Your saved dashboard remains available.';
      }
      if(attempt<12)schedule(Math.min(3000+attempt*2500,15000));
      else retry.hidden=false;
    }finally{clearTimeout(timeout);pending=false;}
  }
  window.addEventListener('online',()=>{if(!stopped){attempt=0;check();}});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
