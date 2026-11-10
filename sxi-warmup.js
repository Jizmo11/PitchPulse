/* StrideEleven Pages: resilient Render wake-up monitor. */
(() => {
  'use strict';
  const STATUS_URL = '/api/status';
  const REQUEST_TIMEOUT_MS = 15000;
  const RETRY_INTERVAL_MS = 12000;
  let timer = null;
  let pending = false;
  let ready = false;
  let failures = 0;
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
  const panel = () => document.getElementById('sxi-warmup');
  const detail = () => document.getElementById('sxi-warmup-detail');
  const retry = () => document.getElementById('sxi-warmup-retry');
  function schedule(delay = RETRY_INTERVAL_MS) {
    clearTimeout(timer);
    if (!ready && navigator.onLine) timer = setTimeout(check, delay);
  }
  async function check() {
    if (ready || pending) return;
    clearTimeout(timer);
    if (!navigator.onLine) {
      detail().textContent = 'You appear to be offline. Saved training information is still available.';
      retry().hidden = false;
      return;
    }
    pending = true;
    retry().disabled = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(STATUS_URL, {cache:'no-store',credentials:'same-origin',signal:controller.signal});
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      if (!data || typeof data !== 'object' || typeof data.connected !== 'boolean') throw new Error('Invalid backend status');
      ready = true;
      clearTimeout(timer);
      panel().hidden = true;
      document.dispatchEvent(new CustomEvent('sxi:backend-ready', {detail:{connected:data.connected,configured:data.configured}}));
    } catch (_) {
      failures++;
      detail().textContent = failures >= 5
        ? 'Extra time! The performance service is taking longer than usual. Retrying automatically; your saved dashboard remains available.'
        : 'Connecting to your performance service… Your saved dashboard remains available.';
      retry().hidden = failures < 5;
    } finally {
      clearTimeout(timeout);
      pending = false;
      retry().disabled = false;
      if (!ready && navigator.onLine) schedule();
    }
  }
  function init() {
    if (panel()) return;
    const element = document.createElement('aside');
    element.id = 'sxi-warmup';
    element.setAttribute('role','status');
    element.setAttribute('aria-live','polite');
    element.innerHTML = '<strong><span class="sxi-dot" aria-hidden="true"></span>Warming up your performance data…</strong><p id="sxi-warmup-detail">Your dashboard is ready while the performance service starts.</p><button id="sxi-warmup-retry" type="button" hidden>Try again</button>';
    document.body.appendChild(element);
    retry().addEventListener('click', () => { if (!pending) { failures = 0; retry().hidden = true; check(); } });
    check();
  }
  window.addEventListener('online', () => { if (!ready && panel()) { failures = 0; check(); } });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !ready && panel()) check(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true}); else init();
})();
