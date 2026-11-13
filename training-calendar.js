/* StrideEleven weekly training calendar. Keeps Strava source records untouched. */
(function(){
'use strict';
const days=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const localDate=d=>{const x=new Date(d);return Number.isNaN(x.getTime())?'':x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')};
const add=(date,n)=>{const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+n);return localDate(d)};
const monday=()=>{const d=new Date();return add(localDate(d),-((d.getDay()+6)%7))};
const diff=(a,b)=>Math.round((new Date(a+'T12:00:00')-new Date(b+'T12:00:00'))/86400000);
const settings=()=>{if(!db.sxiCalendar||typeof db.sxiCalendar!=='object')db.sxiCalendar={};return db.sxiCalendar};
const config=p=>{const s=settings();if(!s[p.id])s[p.id]={weeks:12,week:1,start:monday(),swaps:{},assignments:{}};return s[p.id]};
const persist=()=>{localStorage.setItem('pitchpulse_v1',JSON.stringify(db));};
const effectiveDay=(t,c)=>{const swaps=c.swaps[c.week]||{};return swaps[t.id]||t.day};
const weekStart=c=>add(c.start,7*(c.week-1));
const runId=(r,i)=>String(r.stravaId||r.strava_id||r.id||'local-'+i+'-'+r.date+'-'+r.km);
const isStrava=r=>r.source!=='Manual'&&(!!(r.stravaId||r.strava_id)||/strava/i.test(String(r.source||'')));
const runs=()=>Array.isArray(db.runs)?db.runs.map((r,i)=>({r,id:runId(r,i),date:localDate(r.date),km:Number(r.km)||0})).filter(x=>isStrava(x.r)&&x.date):[];
const entries=(p,c)=>db.trainingTemplates.filter(t=>t.planId===p.id).map(t=>({...t,scheduledDay:effectiveDay(t,c)}));
const completed=(p,c,t)=>{const key=add(weekStart(c),days.indexOf(t.scheduledDay));return (db.trainingCompleted||[]).some(h=>h.templateId===t.id&&h.planId===p.id&&h.week===c.week)|| (db.trainingCompleted||[]).some(h=>!h.templateId&&h.name===t.name&&h.day===t.scheduledDay&&h.week===c.week&&h.date===key)};
function matching(p,c){
 const items=entries(p,c),start=weekStart(c),assigned=c.assignments[c.week]||{},used=new Set(Object.values(assigned).map(x=>x.runId).filter(Boolean)),out={};
 const available=runs().filter(x=>!Object.values(settings()).some(z=>Object.values(z.assignments||{}).some(w=>Object.values(w).some(v=>v.runId===x.id))));
 for(const t of items.filter(t=>t.type==='Run'&&!completed(p,c,t))){
  if(assigned[t.id]){out[t.id]=assigned[t.id];continue;}
  const day=add(start,days.indexOf(t.scheduledDay)),minimum=Number(t.km)||0;
  const options=available.filter(x=>!used.has(x.id)&&x.km+1e-8>=minimum&&Math.abs(diff(x.date,day))<=1).sort((a,b)=>Math.abs(diff(a.date,day))-Math.abs(diff(b.date,day))||a.date.localeCompare(b.date));
  if(options.length){const x=options[0];out[t.id]={runId:x.id,date:x.date,km:x.km,auto:true};used.add(x.id);}
 }
 return out;
}
function progress(p,c){const items=entries(p,c),matched=matching(p,c);return {items,matched,done:items.filter(t=>completed(p,c,t)||matched[t.id]).length};}
function advance(p,c){let changed=false;while(c.week<c.weeks){const q=progress(p,c);if(!q.items.length||q.done<q.items.length||localDate(new Date())<=add(weekStart(c),6))break;c.week++;changed=true;}if(changed)persist();}
const style=document.createElement('style');style.textContent='.sxi-week{display:block;border:1px solid #435247;border-radius:14px;padding:14px;margin:12px 0;background:#202825}.sxi-week h3{margin:0;color:#b7f36b}.sxi-week-head{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}.sxi-week button{cursor:pointer}.sxi-days{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:12px}.sxi-day{background:#29322e;border:1px solid #49574d;border-radius:12px;padding:12px;min-width:0}.sxi-day.done{border-color:#b7f36b;background:#263c2d}.sxi-day small{display:block;color:#a8b8ae;margin-bottom:6px}.sxi-day button{margin-top:8px;width:100%;text-align:left}.sxi-week .sxi-muted{color:#acb9ae;font-size:.85em}.sxi-week select{max-width:110px}.sxi-week .sxi-extra{margin-top:6px;color:#b7f36b;font-size:.85em}.sxi-week .sxi-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.sxi-week .sxi-actions button{width:auto}.sxi-week progress{width:100%;accent-color:#b7f36b}.sxi-dragging{opacity:.6;outline:2px solid #b7f36b;touch-action:none}.sxi-drop-target{outline:2px dashed #b7f36b;background:#344b38}.sxi-day [data-drag-template]{touch-action:pan-y}@media(min-width:760px){.sxi-days{grid-template-columns:repeat(4,minmax(0,1fr))}}';document.head.appendChild(style);
let drag=null,holdTimer=null,suppressTapUntil=0;
const km2=n=>(Number(n)||0).toFixed(2);
function render(){
 const root=$('v8TrainingSchedule');if(!root)return;
 if(!Array.isArray(db.trainingPlans)||!db.trainingPlans.length){root.innerHTML='<p class="muted">No training plans found. Your saved data has not been changed.</p>';return;}
 const weekSelect=$('week');if(weekSelect){weekSelect.closest('.card')?.querySelector('label[for="week"]')?.classList.add('hidden');weekSelect.classList.add('hidden');}
 root.innerHTML=db.trainingPlans.map(p=>{
 const c=config(p);advance(p,c);const q=progress(p,c),start=weekStart(c),extras=c.assignments[c.week]||{};
 return '<section class="sxi-week"><div class="sxi-week-head"><div><h3>'+esc(p.name)+'</h3><span class="sxi-muted">Week '+c.week+' of '+c.weeks+' · '+esc(start)+' – '+esc(add(start,6))+'</span></div><div class="sxi-actions"><button class="secondary smallbtn" data-action="duration" data-plan="'+esc(p.id)+'">Plan length</button><button class="secondary smallbtn" data-action="previous" data-plan="'+esc(p.id)+'">Previous week</button><button class="secondary smallbtn" data-action="next" data-plan="'+esc(p.id)+'">Next week</button></div></div><progress value="'+q.done+'" max="'+Math.max(q.items.length,1)+'"></progress><div class="sxi-muted">'+q.done+' / '+q.items.length+' scheduled sessions completed</div><div class="sxi-muted sxi-drag-help">Hold a workout, then drag it onto another day to move or swap.</div><div class="sxi-days">'+days.map((day,di)=>{
 const ts=q.items.filter(t=>t.scheduledDay===day),extra=Object.values(extras).filter(a=>a.extraDay===day),dayDone=ts.length>0&&ts.every(t=>completed(p,c,t)||q.matched[t.id]);
 return '<div class="sxi-day '+(dayDone?'done':'')+'" data-drop-day="'+day+'" data-plan="'+esc(p.id)+'"><small>'+day.toUpperCase()+' · '+esc(add(start,di))+'</small>'+(ts.length?ts.map(t=>{const done=completed(p,c,t)||q.matched[t.id];const idx=db.trainingTemplates.findIndex(x=>x.id===t.id);return '<button class="secondary smallbtn" data-action="open" data-index="'+idx+'" data-drag-template="'+esc(t.id)+'" data-plan="'+esc(p.id)+'">'+(done?'✓ ':'')+esc(t.name)+'</button><div class="sxi-muted">'+esc(t.type)+(t.type==='Run'?' · ≥ '+esc(t.km||'0')+' km':'')+'</div>'+(q.matched[t.id]?'<div class="sxi-extra">Strava '+km2(q.matched[t.id].km)+' km'+(q.matched[t.id].auto?' · Auto':' · Assigned')+'</div>':'')}).join(''):'<div class="sxi-muted">Rest / no workout</div>')+extra.map(a=>'<div class="sxi-extra">+ Recovery run · '+km2(a.km)+' km</div>').join('')+'</div>'
 }).join('')+'</div><div class="sxi-actions"><button class="secondary smallbtn" data-action="add" data-plan="'+esc(p.id)+'">+ Add workout</button><button class="secondary smallbtn" data-action="unmatched" data-plan="'+esc(p.id)+'">Unscheduled Strava runs</button><button class="secondary smallbtn" data-action="rename" data-plan="'+esc(p.id)+'">Rename</button><button class="secondary smallbtn" data-action="delete" data-plan="'+esc(p.id)+'">Delete plan</button></div></section>';
 }).join('')||'<p class="muted">Create a workout to begin a training plan.</p>';
}
function sxiStravaHistory(){
 const history=$('v8CompletedHistory');if(!history)return;
 const records=[];
 for(const p of db.trainingPlans||[]){const c=config(p),original=c.week;
  for(let week=1;week<=c.weeks;week++){c.week=week;const matched=matching(p,c);
   for(const t of entries(p,c).filter(t=>t.type==='Run')){
    const m=matched[t.id];if(!m||completed(p,c,t))continue;
    const r=runs().find(x=>x.id===m.runId);
    if(r)records.push({id:r.id,name:t.name,date:r.date,km:r.km,min:Number(r.r.min)||0,plan:p.name,week});
   }
  }c.week=original;
 }
 const unique=[...new Map(records.map(r=>[r.id,r])).values()];
 const snapshots=(db.trainingCompleted||[]).map((c,i)=>({date:String(c.date||'').slice(0,10),name:c.name,week:c.week,type:c.type,exercises:c.exercises?.length||0,sort:i}));
 const merged=[...snapshots.map(x=>({...x,source:'snapshot'})),...unique.map(x=>({...x,source:'strava'}))].sort((a,b)=>b.date.localeCompare(a.date)||(a.source==='strava'?1:-1));
 history.innerHTML=merged.map(x=>'<div class="item"><b>'+esc(x.name||'Session')+'</b><br><span class="muted">'+esc(x.date)+' · Week '+esc(x.week)+' · '+(x.source==='strava'?'Run · '+km2(x.km)+' km · '+(Number(x.min)||0).toFixed(1)+' min · Strava':esc(x.type||'Workout')+(x.exercises?' · '+x.exercises+' exercises':''))+'</span></div>').join('')||'<p class="muted">No completed sessions yet.</p>';
}
function unassigned(p,c){
 const matched=matching(p,c),used=new Set(Object.values(matched).map(x=>x.runId));
 const s=settings();for(const z of Object.values(s))for(const w of Object.values(z.assignments||{}))for(const a of Object.values(w))if(a.runId)used.add(a.runId);
 return runs().filter(x=>!used.has(x.id)&&Math.abs(diff(x.date,weekStart(c)))<=8&&diff(x.date,weekStart(c))>=-1);
}
function assign(p,c){
 const rr=unassigned(p,c);if(!rr.length){alert('No unmatched Strava runs near this training week.');return;}
 const text=rr.map((x,i)=>(i+1)+'. '+x.date+' · '+x.km+' km').join('\n');
 const n=Number(prompt('Choose an unmatched run:\n'+text));if(!Number.isInteger(n)||n<1||n>rr.length)return;
 const x=rr[n-1],items=entries(p,c),targets=items.filter(t=>t.type==='Run'&&!completed(p,c,t)&&!matching(p,c)[t.id]&&x.km+1e-8>=Number(t.km||0));
 const options=['Leave unassigned',...targets.map(t=>'Complete '+t.scheduledDay+' · '+t.name),...days.filter(d=>!items.some(t=>t.scheduledDay===d)).map(d=>'Extra recovery run on '+d)];
 const pick=Number(prompt('Assign '+x.km+' km run:\n'+options.map((s,i)=>i+'. '+s).join('\n')));
 if(!Number.isInteger(pick)||pick<1||pick>=options.length)return;
 c.assignments[c.week] ||= {};
 if(pick<=targets.length){const t=targets[pick-1];c.assignments[c.week][t.id]={runId:x.id,date:x.date,km:x.km};}
 else{const day=days.filter(d=>!items.some(t=>t.scheduledDay===d))[pick-targets.length-1];c.assignments[c.week]['extra-'+x.id]={runId:x.id,date:x.date,km:x.km,extraDay:day};}
 persist();render();
}

// Touch and pointer drag: long hold to pick up; ordinary taps still open workouts.
function clearDrag(){clearTimeout(holdTimer);holdTimer=null;document.querySelectorAll('.sxi-drop-target,.sxi-dragging').forEach(el=>el.classList.remove('sxi-drop-target','sxi-dragging'));drag=null;}
document.addEventListener('pointerdown',e=>{
 const btn=e.target.closest('#v8TrainingSchedule [data-drag-template]');if(!btn||e.button!==0)return;
 const p=db.trainingPlans.find(x=>x.id===btn.dataset.plan);if(!p)return;
 const c=config(p),t=entries(p,c).find(x=>String(x.id)===btn.dataset.dragTemplate);
 if(!t||completed(p,c,t)||matching(p,c)[t.id])return;
 const x=e.clientX,y=e.clientY;
 holdTimer=setTimeout(()=>{drag={pointer:e.pointerId,plan:p.id,template:t.id,from:t.scheduledDay};btn.classList.add('sxi-dragging');suppressTapUntil=Date.now()+1200;navigator.vibrate?.(25);},450);
 const cancel=ev=>{if(!drag&&Math.hypot(ev.clientX-x,ev.clientY-y)>12){clearTimeout(holdTimer);holdTimer=null;}};
 const move=ev=>{if(ev.pointerId!==e.pointerId)return;cancel(ev);if(!drag)return;document.querySelectorAll('.sxi-drop-target').forEach(el=>el.classList.remove('sxi-drop-target'));const target=document.elementFromPoint(ev.clientX,ev.clientY)?.closest('.sxi-day[data-drop-day]');if(target?.dataset.plan===drag.plan)target.classList.add('sxi-drop-target');};
 const finish=ev=>{if(ev.pointerId!==e.pointerId)return;document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',finish);document.removeEventListener('pointercancel',finish);const active=drag;if(active&&ev.type==='pointerup'){const target=document.elementFromPoint(ev.clientX,ev.clientY)?.closest('.sxi-day[data-drop-day]');if(target?.dataset.plan===active.plan&&target.dataset.dropDay!==active.from){const plan=db.trainingPlans.find(p=>p.id===active.plan),cfg=config(plan),items=entries(plan,cfg),dest=target.dataset.dropDay;const moving=items.find(t=>String(t.id)===active.template);const other=items.filter(t=>t.scheduledDay===dest&&t.id!==moving.id&&!completed(plan,cfg,t)&&!matching(plan,cfg)[t.id]);if(moving){const swaps=cfg.swaps[cfg.week]||{};swaps[moving.id]=dest;for(const t of other)swaps[t.id]=active.from;cfg.swaps[cfg.week]=swaps;persist();}}}clearDrag();if(active)render();};
 document.addEventListener('pointermove',move);document.addEventListener('pointerup',finish);document.addEventListener('pointercancel',finish);
},{passive:true});
document.addEventListener('click',e=>{
 const btn=e.target.closest('#v8TrainingSchedule button[data-action]');if(!btn)return;
 const action=btn.dataset.action,p=db.trainingPlans.find(x=>x.id===btn.dataset.plan);if(action==='open'){if(Date.now()<suppressTapUntil)return;window.sxiPreviewWorkout?.(Number(btn.dataset.index));return;}if(!p)return;
 const c=config(p);
 if(action==='duration'){const n=Number(prompt('Number of training weeks (1–52):',c.weeks));if(Number.isInteger(n)&&n>=1&&n<=52){c.weeks=n;c.week=Math.min(c.week,n);persist();}}
 if(action==='previous')c.week=Math.max(1,c.week-1);
 if(action==='next')c.week=Math.min(c.weeks,c.week+1);
 if(action==='unmatched')assign(p,c);
 if(action==='add')window.v8StartNew?.(p.id);
 if(action==='rename')window.v81RenamePlan?.(p.id);
 if(action==='delete')window.v81DeletePlan?.(p.id);
 render();
});
const originalRender=window.render;
if(typeof originalRender==='function')window.render=function(){originalRender();safeRender();};
function safeRender(){try{render();sxiStravaHistory();window.sxiCalendarStatus={ok:true,plans:db.trainingPlans?.length||0,templates:db.trainingTemplates?.length||0,cards:document.querySelectorAll('#v8TrainingSchedule .sxi-week').length};}catch(error){window.sxiCalendarStatus={ok:false,error:String(error.message||error)};console.error('SXI training calendar render failed',error);const root=$('v8TrainingSchedule');if(root)root.innerHTML='<div class="sxi-week"><h3>Training calendar could not load</h3><p class="sxi-muted">Your saved workouts have not been deleted. Error: '+esc(error.message||String(error))+'</p><button class="secondary smallbtn" onclick="window.sxiCalendarRender()">Retry calendar</button></div>';}}
window.sxiCalendarRender=safeRender;
window.sxiCalendarWeek=(id)=>{const p=db.trainingPlans.find(x=>x.id===id);return p?config(p).week:1};
window.sxiCalendarCompletion=(t)=>{const p=db.trainingPlans.find(x=>x.id===t.planId);return p?{planId:p.id,templateId:t.id,week:config(p).week}:{}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',safeRender);else safeRender();
})();