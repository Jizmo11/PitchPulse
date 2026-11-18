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
 if(!$id('sxiBestTilesStyle')){
  const style=document.createElement('style');style.id='sxiBestTilesStyle';
  style.textContent='#sxiRunRecords .sxi-best-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:12px 0}#sxiRunRecords .sxi-best-tile{min-width:0;padding:12px 4px;border-radius:12px;background:#292929;color:inherit;border:1px solid #494949;text-align:center;cursor:pointer}#sxiRunRecords .sxi-best-tile strong{display:block;color:#b7f36b;font-size:clamp(16px,4vw,23px);font-weight:700;white-space:nowrap}#sxiRunRecords .sxi-best-tile small{display:block;color:#c5c5c5;margin-top:5px}#sxiRunRecords .sxi-best-tile[aria-pressed="true"]{border-color:#b7f36b}#sxiRunRecords .sxi-best-detail{min-height:32px;color:#c5c5c5;font-size:13px;margin:9px 0}#sxiRunRecords .sxi-effort-controls{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:10px 0}#sxiRunRecords .sxi-effort-controls .muted{font-size:12px}#sxiRunRecords .sxi-effort-retry{width:auto;padding:5px 10px;font-size:12px;min-height:0}';
  document.head.appendChild(style);
 }
 const runs=allStravaRuns(),cache=cacheRead();
 const bests=DIST.map((d,i)=>runs.filter(r=>r.stravaId&&cache[String(r.stravaId)]?.values?.[i]>0).map(r=>({r,time:cache[String(r.stravaId)].values[i]})).sort((a,b)=>a.time-b.time)[0]||null);
 const tiles=bests.map((best,i)=>'<button type="button" class="sxi-best-tile" data-effort="'+i+'" aria-pressed="false" aria-label="'+LABEL[i]+' personal best '+(best?fmt(best.time):'not recorded')+'"><strong>'+(best?fmt(best.time):'—')+'</strong><small>'+LABEL[i]+'</small></button>');
 const count=runs.filter(r=>r.stravaId&&cache[String(r.stravaId)]).length;
 host.innerHTML='<h4>All-time personal bests · elapsed time</h4><div class="sxi-best-grid">'+tiles.join('')+'</div><div id="sxiBestDetail" class="sxi-best-detail" aria-live="polite">Tap a tile to see its run details.</div>'+
 '<p class="muted">Calculated from timestamped distance streams within each run. Pauses count toward elapsed effort time. Only analyzed Strava runs are included. All-time personal bests remain visible regardless of season/month filters.</p>'+
 '<div class="sxi-effort-controls"><span class="muted" role="status">'+(count===runs.length?'✓ ':'')+count+' of '+runs.length+' Strava runs analysed</span><button type="button" id="sxiAnalyzeEfforts" class="secondary sxi-effort-retry">Retry missing</button></div><div id="sxiEffortStatus" class="muted" aria-live="polite"></div>';
 $id('sxiAnalyzeEfforts').addEventListener('click',()=>analyzeAll(false));
 host.querySelectorAll('[data-effort]').forEach(tile=>tile.addEventListener('click',()=>{
  const i=Number(tile.getAttribute('data-effort')),best=bests[i];
  host.querySelectorAll('[data-effort]').forEach(t=>t.setAttribute('aria-pressed',String(t===tile)));
  $id('sxiBestDetail').textContent=best?LABEL[i]+' · '+fmt(best.time)+' · '+(best.r.date||'')+' · '+(best.r.name||'Run')+' · '+fmt(best.time/DIST[i]*1000)+' min/km':'No recorded effort for '+LABEL[i]+' yet.';
 }));
}
let analysisBusy=false;
let autoAttempted=false;
function allStravaRuns(){return (typeof db!=='undefined'&&Array.isArray(db.runs)?db.runs:[]).filter(r=>r.stravaId);}
async function analyzeAll(automatic=false){if(analysisBusy)return;analysisBusy=true;
 const button=$id('sxiAnalyzeEfforts'),status=$id('sxiEffortStatus');
 if(!button||button.disabled){analysisBusy=false;return;}
 const runs=allStravaRuns(),cache=cacheRead();
 const missing=runs.filter(r=>!cache[String(r.stravaId)]);
 if(!missing.length){status.textContent='All Strava runs have been analysed.';analysisBusy=false;return;}
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
window.sxiAutoAnalyzeEfforts=()=>{if(!analysisBusy&&allStravaRuns().some(r=>!cacheRead()[String(r.stravaId)]))analyzeAll(true);};
function renderTrends(){
 const host=$id('sxiRunTrends');if(!host)return;
 const mode=$id('sxiRunTrendMode')?.value==='speed'?'speed':'pace';
 const rows=getRuns().filter(r=>Number(r.km)>0&&Number(r.min)>0).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
 const points=rows.map(r=>({name:r.name||'Run',date:r.date||'',value:mode==='pace'?Number(r.min)/Number(r.km):Number(r.km)*60/Number(r.min)})).filter(p=>Number.isFinite(p.value)&&p.value>0);
 if(!points.length){host.innerHTML='<p class="muted">No recorded values for this period.</p>';return;}
 const max=Math.max(...points.map(p=>p.value));
 // Four equal intervals, five Y-axis labels including zero.
 const targetStep=max/4;
 const magnitude=Math.pow(10,Math.floor(Math.log10(targetStep)));
 const step=[1,2,2.5,5,10].map(n=>n*magnitude).find(n=>n>=targetStep)||10*magnitude;
 const ceiling=4*step;
 const left=52,right=576,top=31,bottom=169,height=bottom-top,slot=(right-left)/points.length,barWidth=Math.min(34,slot*.7);
const auDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)?d.slice(8,10)+'/'+d.slice(5,7)+'/'+d.slice(0,4):d;
 const unit=mode==='pace'?'min/km':'km/h',label=v=>mode==='pace'?fmt(v*60):String(v);
 const grid=Array.from({length:Math.round(ceiling/step)+1},(_,i)=>i*step).map(v=>{const y=bottom-v/ceiling*height;return '<line x1="'+left+'" x2="'+right+'" y1="'+y.toFixed(1)+'" y2="'+y.toFixed(1)+'" stroke="#83909a" stroke-opacity=".23"/><text x="'+(left-9)+'" y="'+(y+4).toFixed(1)+'" text-anchor="end" fill="#b9c6d2" font-size="12">'+label(v)+'</text>';}).join('');
 const bars=points.map((p,i)=>{const h=p.value/ceiling*height,x=left+i*slot+(slot-barWidth)/2,y=bottom-h;return '<rect role="button" tabindex="0" data-point="'+i+'" x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+barWidth.toFixed(1)+'" height="'+h.toFixed(1)+'" rx="3" fill="#b7f36b"><title>'+escapeHtml(p.date+' · '+p.name+' · '+label(p.value)+' '+unit)+'</title></rect>';}).join('');
 host.innerHTML='<div id="sxiRunPointDetail" class="muted" style="min-height:28px">Tap a bar to view the run and its result.</div><svg viewBox="0 0 600 215" role="img" aria-label="Running '+mode+' comparison bar chart with labelled '+unit+' axis" style="width:100%;max-height:250px"><text x="4" y="12" fill="#b9c6d2" font-size="11">'+unit+'</text>'+grid+bars+'<text x="310" y="204" text-anchor="middle" fill="#c6d2de" font-size="13">Individual runs</text></svg><p class="muted">'+(mode==='pace'?'Lower pace means a faster run. · ':'')+points.length+' activities · '+escapeHtml(auDate(points[0].date))+' – '+escapeHtml(auDate(points[points.length-1].date))+'</p>';
 const detail=$id('sxiRunPointDetail');
 
 host.querySelectorAll('[data-point]').forEach(node=>{
  const show=()=>{const p=points[Number(node.getAttribute('data-point'))];if(p&&detail)detail.textContent=auDate(p.date)+' · '+p.name+' · '+label(p.value)+' '+unit;};
  node.addEventListener('click',show);
  node.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();show();}});
 });
}
function refresh(){renderEfforts();renderTrends();}
window.sxiPhase2Refresh=refresh;
document.addEventListener('DOMContentLoaded',()=>{
 const selector=$id('sxiRunTrendMode');if(selector)selector.addEventListener('change',renderTrends);
 refresh();
 // Analyse missing Strava efforts on app open, without requiring a button tap.
 // Attempt once per page load to avoid retry loops for unavailable streams.
 if(!autoAttempted){autoAttempted=true;window.sxiAutoAnalyzeEfforts();}
});
})();
