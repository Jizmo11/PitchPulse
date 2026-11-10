/* StrideEleven Running Performance Centre Phase 2.
   Stores derived effort times only, never raw GPS streams. */
(function(){
'use strict';
const DIST=[400,1000,1609.344,3000,5000,10000];
const LABEL=['400 m','1 km','1 mile','3 km','5 km','10 km'];
const CACHE_KEY='sxi_running_efforts_v2';
const $id=id=>document.getElementById(id);
function cacheRead(){try{return JSON.parse(localStorage.getItem(CACHE_KEY)||'{}')||{}}catch{return {}}}
function cacheWrite(value){try{localStorage.setItem(CACHE_KEY,JSON.stringify(value));return true}catch{return false}}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function fmt(sec){if(!Number.isFinite(sec))return '—';const s=Math.round(sec);return (s>=3600?Math.floor(s/3600)+':':'')+String(Math.floor(s%3600/60)).padStart(s>=3600?2:1,'0')+':'+String(s%60).padStart(2,'0');}
function effortAt(distance,time,goal){
 let best=Infinity, j=0;
 for(let i=0;i<distance.length;i++){
  if(!Number.isFinite(distance[i])||!Number.isFinite(time[i]))continue;
  if(j<i)j=i;
  while(j<distance.length&&distance[j]-distance[i]<goal)j++;
  if(j>=distance.length)break;
  if(j===0||distance[j]<=distance[j-1])continue;
  const frac=(distance[i]+goal-distance[j-1])/(distance[j]-distance[j-1]);
  const end=time[j-1]+frac*(time[j]-time[j-1]);
  const duration=end-time[i];
  if(duration>0&&duration<best)best=duration;
 }
 return Number.isFinite(best)?Math.round(best*10)/10:null;
}
function analyze(st){
 const d=st.distance,t=st.time;
 if(!Array.isArray(d)||!Array.isArray(t)||d.length!==t.length||d.length<2)return null;
 for(let i=1;i<d.length;i++){
  if(!Number.isFinite(Number(d[i]))||!Number.isFinite(Number(t[i]))||Number(d[i])<Number(d[i-1])||Number(t[i])<Number(t[i-1]))return null;
 }
 return DIST.map(goal=>effortAt(d.map(Number),t.map(Number),goal));
}
function getRuns(){return typeof filteredRuns==='function'?filteredRuns().map(x=>x.r):[];}
function renderEfforts(){
 const host=$id('sxiRunRecords');if(!host)return;
 const runs=getRuns(),cache=cacheRead();
 const rows=DIST.map((d,i)=>{
  const found=runs.filter(r=>r.stravaId&&cache[String(r.stravaId)]?.values?.[i]>0).map(r=>({r,time:cache[String(r.stravaId)].values[i]})).sort((a,b)=>a.time-b.time);
  const best=found[0];
  return '<button type="button" class="sxi-best-tile" data-effort="'+i+'" aria-pressed="false"><strong>'+(best?fmt(best.time):'—')+'</strong><small>'+LABEL[i]+'</small></button>';
 });
 const count=runs.filter(r=>r.stravaId&&cache[String(r.stravaId)]).length;
 host.innerHTML='<h4>Fastest continuous efforts</h4><div class="sxi-best-grid">'+rows.join('')+'</div><div class="sxi-best-detail" id="sxiBestDetail" aria-live="polite">Tap a tile to see the run details.</div>'+
 '<p class="muted">Calculated from timestamped distance streams within each run. Pauses count toward elapsed effort time. Only analyzed Strava runs are included; records follow your season/month filters.</p>'+
 '<button type="button" id="sxiAnalyzeEfforts" class="secondary" style="display:none">Analyze Strava runs</button><div id="sxiEffortStatus" class="muted">'+count+' of '+runs.filter(r=>r.stravaId).length+' Strava runs analyzed</div>';
 $id('sxiAnalyzeEfforts').addEventListener('click',analyzeAll);
 host.querySelectorAll('[data-effort]').forEach(tile=>tile.addEventListener('click',()=>{const i=Number(tile.dataset.effort);const best=runs.filter(r=>r.stravaId&&cache[String(r.stravaId)]?.values?.[i]>0).map(r=>({r,time:cache[String(r.stravaId)].values[i]})).sort((a,b)=>a.time-b.time)[0];host.querySelectorAll('[data-effort]').forEach(t=>t.setAttribute('aria-pressed',String(t===tile)));$id('sxiBestDetail').textContent=best?LABEL[i]+' · '+fmt(best.time)+' · '+(best.r.date||'')+' · '+(best.r.name||'Run')+' · '+fmt(best.time/DIST[i]*1000)+' /km':'No recorded effort at this distance yet.';}));
}
let analysisBusy=false;
async function analyzeAll(){if(analysisBusy)return;analysisBusy=true;
 const button=$id('sxiAnalyzeEfforts'),status=$id('sxiEffortStatus');
 if(!button||button.disabled){analysisBusy=false;return;}
 const runs=getRuns().filter(r=>r.stravaId),cache=cacheRead();
 const missing=runs.filter(r=>!cache[String(r.stravaId)]);
 if(!missing.length){status.textContent='All available runs have been analyzed.';analysisBusy=false;return;}
 button.disabled=true;let completed=0,failed=0;
 for(const r of missing){
  status.textContent='Analyzing '+(completed+failed+1)+' of '+missing.length+' runs…';
  try{
   const response=await stravaRequest('/api/activities/'+encodeURIComponent(r.stravaId)+'/streams');
   const values=analyze(response.streams||{});
   if(!values)throw Error('Invalid distance/time stream');
   cache[String(r.stravaId)]={values};
   if(!cacheWrite(cache))throw Error('Device storage is full');
   completed++;
  }catch(e){
   failed++;
   if(/429|rate limit/i.test(e.message||'')){status.textContent='Strava rate limit reached. Try again later; completed results are saved.';break;}
  }
 }
 renderEfforts();
 const newStatus=$id('sxiEffortStatus');
 if(newStatus)newStatus.textContent=completed+' run(s) analyzed, '+failed+' unavailable. Results are saved on this device.';analysisBusy=false;
}
window.sxiAutoAnalyzeEfforts=()=>{if(!analysisBusy&&getRuns().some(r=>r.stravaId&&!cacheRead()[String(r.stravaId)]))analyzeAll();};
function renderTrends(){
 const host=$id('sxiRunTrends');if(!host)return;
 const mode=$id('sxiRunTrendMode')?.value||'pace';
 const rows=getRuns().filter(r=>Number(r.km)>0&&Number(r.min)>0).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
 const points=rows.map(r=>({name:r.name||'Run',date:r.date||'',value:mode==='pace'?Number(r.min)/Number(r.km):mode==='speed'?Number(r.km)*60/Number(r.min):Number(r.top||r.maxSpeed||NaN)})).filter(x=>Number.isFinite(x.value)&&x.value>0);
 if(!points.length){host.innerHTML='<p class="muted">No recorded values for this period.</p>';return;}
 const low=Math.min(...points.map(p=>p.value)),high=Math.max(...points.map(p=>p.value)),span=Math.max(.1,high-low);
 const coords=points.map((p,i)=>({x:points.length===1?300:40+i*520/(points.length-1),y:165-(p.value-low)/span*125,...p}));
 const unit=mode==='pace'?'min/km':'km/h';
 host.innerHTML='<div id="sxiRunPointDetail" class="muted" style="min-height:28px">Tap a point to view the run and its result.</div><svg viewBox="0 0 600 205" role="img" aria-label="Running '+mode+' progression" style="width:100%"><line x1="40" y1="165" x2="565" y2="165" stroke="#607589"/><polyline points="'+coords.map(p=>p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ')+'" fill="none" stroke="#b7f36b" stroke-width="3"/>'+coords.map(p=>'<circle tabindex="0" role="button" data-point="'+coords.indexOf(p)+'" cx="'+p.x+'" cy="'+p.y+'" r="6" fill="#b7f36b"><title>'+escapeHtml(p.date+' · '+p.name+' · '+(mode==='pace'?fmt(p.value*60):p.value.toFixed(2))+' '+unit)+'</title></circle>').join('')+'<text x="5" y="18" fill="#c6d2de" font-size="14">'+(mode==='pace'?fmt(high*60):high.toFixed(2))+'</text><text x="5" y="160" fill="#c6d2de" font-size="14">'+(mode==='pace'?fmt(low*60):low.toFixed(2))+'</text><text x="300" y="198" text-anchor="middle" fill="#c6d2de" font-size="14">Runs by date · '+unit+'</text></svg><p class="muted">'+points.length+' activities · '+escapeHtml(points[0].date)+' to '+escapeHtml(points[points.length-1].date)+'</p>';
 const detail=$id('sxiRunPointDetail');
 host.querySelectorAll('[data-point]').forEach(node=>{
  const show=()=>{const p=points[Number(node.getAttribute('data-point'))];if(p&&detail)detail.textContent=p.date+' · '+p.name+' · '+(mode==='pace'?fmt(p.value*60)+' min/km':p.value.toFixed(2)+' km/h');};
  node.addEventListener('click',show);
  node.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();show();}});
 });
}
function refresh(){renderEfforts();renderTrends();}
window.sxiPhase2Refresh=refresh;
document.addEventListener('DOMContentLoaded',()=>{
 const selector=$id('sxiRunTrendMode');if(selector)selector.addEventListener('change',renderTrends);
 refresh();
});
})();
