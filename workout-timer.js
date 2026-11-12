/* SXI Training timer: isolated UI; never modifies workout data. */
(function(){
'use strict';
if(document.getElementById('sxiTimerDock'))return;
const KEY='sxi_workout_timer_settings';
const defaults={mode:'countdown',duration:120,prep:15,alerts:'both',compact:false};
let saved={};try{saved=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(_){}
const cfg=Object.assign({},defaults,saved);
const clamp=(n,min,max,fallback)=>Number.isFinite(Number(n))?Math.min(max,Math.max(min,Math.round(Number(n)))):fallback;
cfg.duration=clamp(cfg.duration,5,3600,120);cfg.prep=clamp(cfg.prep,0,120,15);
if(!['countdown','stopwatch'].includes(cfg.mode))cfg.mode='countdown';
if(!['both','vibrate','silent'].includes(cfg.alerts))cfg.alerts='both';
let phase='idle',remaining=0,deadline=0,startedAt=0,lastSecond=null,interval=null,audio=null;
const persist=()=>{try{localStorage.setItem(KEY,JSON.stringify(cfg))}catch(_){}};
const mmss=n=>{const s=Math.max(0,Math.ceil(n));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')};
const style=document.createElement('style');
style.textContent='.sxi-timer{position:fixed;bottom:calc(77px + env(safe-area-inset-bottom,0px));left:12px;right:12px;z-index:20;max-width:520px;margin:auto;background:#222a2b;border:1px solid #b7f36b;border-radius:14px;color:#edf4fa;box-shadow:0 8px 28px #0009;padding:11px 12px;font:inherit}.sxi-timer[hidden]{display:none!important}.sxi-timer button{cursor:pointer}.sxi-timer-head{display:flex;align-items:center;gap:8px;justify-content:space-between}.sxi-timer-label{font-size:11px;color:#b7f36b;font-weight:700;letter-spacing:.5px}.sxi-timer-clock{font-size:25px;font-weight:800;font-variant-numeric:tabular-nums}.sxi-timer-actions{display:flex;gap:6px;align-items:center}.sxi-timer-actions button,.sxi-timer-controls button{border:1px solid #52605b;background:#35403e;color:#fff;border-radius:9px;padding:8px 10px;font-size:14px}.sxi-timer-actions button.primary,.sxi-timer-controls button.primary{background:#b7f36b;color:#14200b;font-weight:800}.sxi-timer-body{margin-top:12px;border-top:1px solid #46504d;padding-top:12px}.sxi-timer-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.sxi-timer label{font-size:12px;color:#dce7e1;display:block}.sxi-timer select,.sxi-timer input{width:100%;padding:8px;margin-top:4px;border:1px solid #56625d;border-radius:8px;background:#151d1e;color:#fff;font:inherit}.sxi-timer-controls{display:flex;gap:8px;margin-top:10px}.sxi-timer-controls button{flex:1}.sxi-timer-note{font-size:11px;color:#aab6b0;margin:9px 0 0}.sxi-timer-progress{height:4px;background:#48524e;border-radius:6px;margin-top:8px;overflow:hidden}.sxi-timer-progress>div{height:100%;width:0;background:#b7f36b}.sxi-timer.preparing{border-color:#68b9ff}.sxi-timer.preparing .sxi-timer-label{color:#68b9ff}.sxi-timer.preparing .sxi-timer-progress>div{background:#68b9ff}@media(min-width:700px){.sxi-timer{left:auto;right:20px;width:380px}}';
document.head.appendChild(style);
const dock=document.createElement('aside');dock.id='sxiTimerDock';dock.className='sxi-timer';dock.hidden=true;
dock.setAttribute('aria-label','Workout timer');
dock.innerHTML='<div class="sxi-timer-head"><div><div class="sxi-timer-label" id="sxiTimerPhase">WORKOUT TIMER</div><div class="sxi-timer-clock" id="sxiTimerClock">02:00</div></div><div class="sxi-timer-actions"><button type="button" id="sxiTimerPlay" class="primary" aria-label="Start timer">▶</button><button type="button" id="sxiTimerReset" aria-label="Reset timer">↺</button><button type="button" id="sxiTimerCollapse" aria-label="Collapse timer">⌄</button></div></div><div class="sxi-timer-progress"><div id="sxiTimerBar"></div></div><div class="sxi-timer-body" id="sxiTimerBody"><div class="sxi-timer-grid"><label>Mode<select id="sxiTimerMode"><option value="countdown">Countdown</option><option value="stopwatch">Stopwatch</option></select></label><label>Timer (seconds)<input type="number" id="sxiTimerDuration" min="5" max="3600" step="5" value="120"></label><label>Get ready (seconds)<select id="sxiTimerPrep"><option value="0">None</option><option value="5">5 seconds</option><option value="10">10 seconds</option><option value="15">15 seconds</option><option value="30">30 seconds</option></select></label><label>Alerts<select id="sxiTimerAlerts"><option value="both">Sound + vibration</option><option value="vibrate">Vibration only</option><option value="silent">Silent</option></select></label></div><p class="sxi-timer-note">Alerts require the app to be active; sound and vibration may not play while the phone is locked.</p></div>';
document.body.appendChild(dock);
const el=id=>document.getElementById(id);
el('sxiTimerMode').value=cfg.mode;el('sxiTimerDuration').value=cfg.duration;el('sxiTimerPrep').value=String([0,5,10,15,30].includes(cfg.prep)?cfg.prep:15);el('sxiTimerAlerts').value=cfg.alerts;
function sound(long){
 if(cfg.alerts!=='both')return;
 try{const C=window.AudioContext||window.webkitAudioContext;if(!C)return;if(!audio)audio=new C();if(audio.state==='suspended')audio.resume().catch(()=>{});
 const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime;o.type='sine';o.frequency.value=long?780:990;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.15,t+.015);g.gain.exponentialRampToValueAtTime(.0001,t+(long?.55:.1));o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+(long?.56:.12));}catch(_){}
}
function alertUser(long){sound(long);if(cfg.alerts!=='silent'&&navigator.vibrate){try{navigator.vibrate(long?[180,90,250]:70)}catch(_){}}}
function label(){return phase==='prep'?'GET READY':phase==='work'?'WORK COUNTDOWN':phase==='stopwatch'?'STOPWATCH':phase==='done'?'FINISHED':phase==='paused'?'PAUSED':'WORKOUT TIMER'}
function render(){
 dock.classList.toggle('preparing',phase==='prep');
 el('sxiTimerPhase').textContent=label();
 const now=Date.now();
 const secs=(phase==='prep'||phase==='work'||phase==='stopwatch')?Math.max(0,(deadline-now)/1000):remaining;
 el('sxiTimerClock').textContent=phase==='stopwatch'?mmss((now-startedAt)/1000):mmss(phase==='idle'?(cfg.mode==='countdown'?cfg.duration:0):secs);
 const running=['prep','work','stopwatch'].includes(phase);
 el('sxiTimerPlay').textContent=running?'Ⅱ':phase==='paused'?'▶':'▶';
 el('sxiTimerPlay').setAttribute('aria-label',running?'Pause timer':phase==='paused'?'Resume timer':'Start timer');
 el('sxiTimerCollapse').textContent=cfg.compact?'⌃':'⌄';
 el('sxiTimerCollapse').setAttribute('aria-label',cfg.compact?'Expand timer':'Collapse timer');
 el('sxiTimerBody').hidden=cfg.compact;
 requestAnimationFrame(updateClearance);
 const total=phase==='prep'?cfg.prep:phase==='work'?cfg.duration:cfg.duration;
 el('sxiTimerBar').style.width=phase==='done'?'100%':phase==='idle'?'0%':phase==='stopwatch'?'0%':Math.max(0,Math.min(100,(1-secs/Math.max(1,total))*100))+'%';
 el('sxiTimerDuration').disabled=running||phase==='paused';
 el('sxiTimerMode').disabled=running||phase==='paused';
 el('sxiTimerPrep').disabled=running||phase==='paused';
}
function stopTicker(){if(interval){clearInterval(interval);interval=null}}
function tick(){
 const now=Date.now();
 if(phase==='stopwatch'){remaining=(now-startedAt)/1000;render();return}
 if(phase!=='prep'&&phase!=='work')return;
 let secs=Math.max(0,(deadline-now)/1000),whole=Math.ceil(secs);
 if(whole!==lastSecond){if(whole>0&&whole<=3)alertUser(false);lastSecond=whole}
 if(secs<=0){
   if(phase==='prep'){alertUser(true);phase='work';deadline+=cfg.duration*1000;lastSecond=null;if(deadline<=now){phase='done';remaining=0;stopTicker();alertUser(true)}}
   else{phase='done';remaining=0;stopTicker();alertUser(true)}
 }
 render();
}
function start(){
 if(phase==='paused'){if(cfg.mode==='stopwatch'&&pausedKind==='stopwatch'){phase='stopwatch';startedAt=Date.now()-remaining*1000}
 else{phase=pausedKind;deadline=Date.now()+remaining*1000}lastSecond=null}
 else if(cfg.mode==='stopwatch'){phase='stopwatch';startedAt=Date.now();remaining=0}
 else{phase=cfg.prep?'prep':'work';remaining=cfg.prep||cfg.duration;deadline=Date.now()+remaining*1000;lastSecond=null}
 stopTicker();interval=setInterval(tick,100);tick();
}
let pausedKind='work';
function pause(){if(!['prep','work','stopwatch'].includes(phase))return;pausedKind=phase;remaining=phase==='stopwatch'?(Date.now()-startedAt)/1000:Math.max(0,(deadline-Date.now())/1000);phase='paused';stopTicker();render()}
function reset(){stopTicker();phase='idle';remaining=0;lastSecond=null;render()}
el('sxiTimerPlay').onclick=()=>{if(['prep','work','stopwatch'].includes(phase))pause();else start()};
el('sxiTimerReset').onclick=reset;
el('sxiTimerCollapse').onclick=()=>{cfg.compact=!cfg.compact;persist();render()};
el('sxiTimerMode').onchange=e=>{cfg.mode=e.target.value;persist();reset()};
el('sxiTimerDuration').onchange=e=>{cfg.duration=clamp(e.target.value,5,3600,120);e.target.value=cfg.duration;persist();reset()};
el('sxiTimerPrep').onchange=e=>{cfg.prep=Number(e.target.value);persist();reset()};
el('sxiTimerAlerts').onchange=e=>{cfg.alerts=e.target.value;persist();render()};
const trainingSection=document.getElementById('training');
const clearance=document.createElement('div');
clearance.id='sxiTimerScrollClearance';
clearance.setAttribute('aria-hidden','true');
clearance.style.cssText='height:0;pointer-events:none;flex:none';
trainingSection.appendChild(clearance);
function updateClearance(){
 const visible=trainingSection.classList.contains('active')&&!dock.hidden;
 clearance.style.height=visible?(Math.ceil(dock.getBoundingClientRect().height)+18)+'px':'0px';
}
function visibility(){dock.hidden=!trainingSection.classList.contains('active');updateClearance()}
if(typeof ResizeObserver!=='undefined'){new ResizeObserver(updateClearance).observe(dock)}
window.addEventListener('resize',updateClearance);
document.getElementById('nav')?.addEventListener('click',()=>setTimeout(visibility,0));
const observer=new MutationObserver(visibility);observer.observe(document.getElementById('training'),{attributes:true,attributeFilter:['class','style']});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick()});
visibility();render();
})();