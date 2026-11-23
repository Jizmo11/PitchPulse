/* StrideEleven Football Match Centre — presentation-only progressive enhancement.
   Existing data IDs, handlers and local storage remain untouched. */
(function(){
'use strict';
function el(tag,cls,txt){const n=document.createElement(tag);if(cls)n.className=cls;if(txt)n.textContent=txt;return n;}
function panel(title,description,open){
 const d=el('details','sxi-fmc-panel');d.open=!!open;
 const summary=el('summary','sxi-fmc-summary');
 const heading=el('span','sxi-fmc-heading',title);
 const desc=el('small','sxi-fmc-description',description);
 summary.append(heading,desc);d.append(summary);return d;
}
function mount(){
 const root=document.getElementById('soccer');
 const gps=document.getElementById('sxiFootballGpsPanel');
 const history=document.querySelector('#soccer .sxi-football-history');
 if(!root||!gps||!history||document.getElementById('sxiFmc'))return;
 const centre=el('section','sxi-fmc');centre.id='sxiFmc';
 const head=el('div','sxi-fmc-head');
 head.append(el('h2','', 'Match Centre'),el('p','muted','Selected session · key performance at a glance'));
 centre.append(head);
 const kpis=el('div','sxi-fmc-kpis');kpis.id='sxiFmcKpis';
 const items=[['Distance','—'],['Max speed','—'],['Duration','—'],['Goals','—'],['Assists','—'],['Contributions','—']];
 items.forEach(([label,value],i)=>{const card=el('div','sxi-fmc-kpi');const num=el('strong','',value);num.id='sxiFmcValue'+i;card.append(num,el('small','',label));kpis.append(card);});
 centre.append(kpis);
 const gpsSection=panel('GPS & pitch map','Route, heatmap and pitch alignment',false);
 const workSection=panel('Work rate & sprints','Speed and sprint metrics from your GPS',false);
 const halvesSection=panel('First half vs second half','Match boundaries and half comparisons',false);
 const statsSection=panel('Goals, assists & match statistics','Manual contributions and saved Dribl match details',false);
 const advancedSection=panel('Advanced controls','Match timeline, boundaries and saved adjustments',false);
 const gpsBody=el('div','sxi-fmc-body');gpsBody.append(gps);gpsSection.append(gpsBody);
 const workBody=el('div','sxi-fmc-body');workBody.append(el('p','muted','Speed and sprint breakdowns appear after GPS data is loaded.'));workSection.append(workBody);
 const halvesBody=el('div','sxi-fmc-body');halvesBody.append(el('p','muted','Use the existing Match timeline controls to calculate and compare halves.'));halvesSection.append(halvesBody);
 const statsBody=el('div','sxi-fmc-body');statsSection.append(statsBody);
 const advancedBody=el('div','sxi-fmc-body');advancedSection.append(advancedBody);
 centre.append(gpsSection,workSection,halvesSection,statsSection,advancedSection);
 history.insertAdjacentElement('afterend',centre);
 const breakdown=document.getElementById('breakdownCard');if(breakdown)advancedBody.append(breakdown);
 const contributions=document.getElementById('v82MatchEntry');
 const goalCard=document.getElementById('v82Goals')?.closest('.card');
 if(goalCard)statsBody.append(goalCard);
 const overview=root.querySelector('.sxi-football-overview');
 if(overview){const summary=el('summary','','Season performance overview');const wrap=el('details','sxi-fmc-season');overview.parentNode.insertBefore(wrap,overview);wrap.append(summary,overview);}
 const topGoals=root.querySelector('.sxi-football-goals');if(topGoals&&topGoals!==goalCard)statsBody.append(topGoals);
 const dribl=document.getElementById('v84SoccerMatch');if(dribl)statsBody.append(dribl);
 // Preserve the original session selection controls and all existing GPS handlers.
 const originalGpsLabel=gps.querySelector('h3');if(originalGpsLabel)originalGpsLabel.classList.add('sxi-fmc-internal-title');
 function update(){
   const focused=window.v7Focus?.kind==='soccer'?(typeof db!=='undefined'?db.matches?.[window.v7Focus.index]:null):null;
   const selected=focused||null;
   const text=(value,unit)=>value===null||value===undefined||value===''?'—':String(value)+(unit||'');
   const number=(...values)=>values.find(v=>typeof v==='number'&&Number.isFinite(v));
   const dist=selected?number(selected.km):undefined;
   const speed=selected?number(selected.top):undefined;
   const duration=selected?number(selected.elapsedMin,selected.min):undefined;
   const vals=[dist===undefined?'—':dist.toFixed(2)+' km',speed===undefined?'—':speed.toFixed(2)+' km/h',duration===undefined?'—':Math.round(duration)+' min','—','—','—'];
   // Only show selected-session values when verified in the source model.
   const goals=selected?number(selected.goals):undefined,assists=selected?number(selected.assists):undefined;
   if(goals!==undefined)vals[3]=String(goals);
   if(assists!==undefined)vals[4]=String(assists);
   if(goals!==undefined&&assists!==undefined)vals[5]=String(goals+assists);
   vals.forEach((v,i)=>{const n=document.getElementById('sxiFmcValue'+i);if(n)n.textContent=v;});
   const match=selected?(typeof soccerKind==='function'?soccerKind(selected)==='match':/round/i.test(selected.name||'')):document.getElementById('soccerType')?.value!=='training';
   advancedSection.hidden=!match;halvesSection.hidden=!match;
   if(!match){advancedSection.open=false;halvesSection.open=false;}
   const late=document.getElementById('v84SoccerMatch');if(late&&late.parentElement!==statsBody)statsBody.append(late);
 }
 const type=document.getElementById('soccerType');if(type)type.addEventListener('change',()=>setTimeout(update,0));
 document.addEventListener('pitchpulse:soccer-selected',()=>setTimeout(update,0));
 root.addEventListener('click',e=>{if(e.target.closest('#matchHistory, #v84SoccerMatch'))setTimeout(update,80);});
 update();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
window.addEventListener('load',mount);
let attempts=0;const retry=setInterval(()=>{mount();if(document.getElementById('sxiFmc')||++attempts>25)clearInterval(retry);},400);
})();
