/* PitchPulse v8.4 foundation. Additive data only: never modifies pitchpulse_v1 or Strava. */
(()=>{
'use strict';
const KEY='pitchpulse_v84',LEGACY='pitchpulse_v1';
const defaults=()=>({version:1,team:{club:'Mt Barker United',season:'2026 Winter',division:'Division 2A'},fixtures:[],checkins:[],goals:{},assists:{},links:{},achievements:[],notes:{},schedule:[]});
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))||fallback}catch{return fallback}};
let state=Object.assign(defaults(),read(KEY,{}));
const base=()=>read(LEGACY,{runs:[],matches:[],injuries:[],workouts:[],done:{}});
const save=()=>{localStorage.setItem(KEY,JSON.stringify(state));draw();drawSoccerMatch()};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const recent=(arr,n)=>arr.filter(x=>x.date&&Date.now()-new Date(x.date+'T12:00:00').getTime()<=n*86400000&&new Date(x.date+'T12:00:00').getTime()<=Date.now()+86400000);
const activityName=x=>x.name||x.opponent||'Soccer activity';
const idFor=x=>x.stravaId?'strava:'+x.stravaId:'manual:'+x.date+':'+activityName(x);
const fmt=n=>Number(n||0).toFixed(1);
function fixtureCandidates(f,matches){return matches.filter(m=>m.date===f.date&&(!state.links[f.id]||state.links[f.id]===idFor(m))).map(m=>({m,score:(String(activityName(m)).toLowerCase().includes(f.opponent.toLowerCase())?2:0)+(/round\s*\d+/i.test(activityName(m))&&String(activityName(m)).toLowerCase().includes('round '+f.round)?2:0)})).sort((a,b)=>b.score-a.score)}
function readiness(){const c=state.checkins.find(x=>x.date===today());if(!c)return 'Not checked in';if(+c.pain>=5||+c.fatigue>=4)return 'Consider recovery';if(+c.pain>=3||+c.fatigue>=3||+c.sleep<=2)return 'Take it easier';return 'Feeling ready (self-report)'}
function weekly(){const b=base(),runs=recent(b.runs||[],7),matches=recent(b.matches||[],7);return {runs,matches,km:runs.reduce((n,x)=>n+(+x.km||0),0)+matches.reduce((n,x)=>n+(+x.km||0),0)}}
function card(title,body){return '<article class="card"><h3>'+title+'</h3>'+body+'</article>'}
function draw(){
const root=document.getElementById('v84Root');if(!root)return;
const b=base(),w=weekly(),inj=recent(b.injuries||[],14),up=state.fixtures.filter(x=>x.date>=today()).sort((a,b)=>a.date.localeCompare(b.date)),past=state.fixtures.filter(x=>x.date<today()).sort((a,b)=>b.date.localeCompare(a.date));
const latest=state.checkins.find(x=>x.date===today());
const form='<form id="v84Checkin"><div class="grid"><label>Sleep (1–5)<select name="sleep">'+[1,2,3,4,5].map(n=>'<option '+(latest?.sleep==n?'selected':'')+'>'+n+'</option>').join('')+'</select></label><label>Fatigue (1–5)<select name="fatigue">'+[1,2,3,4,5].map(n=>'<option '+(latest?.fatigue==n?'selected':'')+'>'+n+'</option>').join('')+'</select></label><label>Soreness (0–10)<input type="number" name="pain" min="0" max="10" value="'+(latest?.pain??0)+'" required></label></div><button type="submit">Save check-in</button></form>';
const report='Last 7 days: '+w.runs.length+' runs, '+w.matches.length+' soccer activities, '+fmt(w.km)+' km recorded. '+inj.length+' symptom entries in the last 14 days.';
const selected=(b.matches||[]).find(m=>idFor(m)===state.selectedMatchId);const selectedId=selected?idFor(selected):null;const matchParts=selected?activityName(selected).match(/\bround\s*(\d+)\s+(?:vs\.?|v\.?|versus)\s+(.+?)(?:\s+\d+\s*[-:]\s*\d+\s*[WDL])?\s*$/i):null;const inferredRound=matchParts?matchParts[1]:'';const inferredOpponent=matchParts?matchParts[2].trim():'';const relevantFixtures=selected?state.fixtures.filter(f=>state.links[f.id]===selectedId||(!state.links[f.id]&&f.date===selected.date&&((inferredOpponent&&f.opponent.toLowerCase()===inferredOpponent.toLowerCase())||(inferredRound&&String(f.round)===inferredRound)))):state.fixtures;const fixtureRows=relevantFixtures.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(f=>{const c=fixtureCandidates(f,b.matches||[]);const linked=(b.matches||[]).find(m=>idFor(m)===state.links[f.id]);const manual=state.goals[f.id];const official=f.officialGoals;const conflict=manual!==undefined&&official!==''&&official!==undefined&&Number(manual)!==Number(official);return '<div class="item"><strong>'+esc(f.date)+' · Round '+esc(f.round)+' vs '+esc(f.opponent)+'</strong><div class="muted">'+esc(f.result||'Fixture')+' · '+(linked?'Linked: '+esc(activityName(linked)):'Not linked')+'</div>'+(conflict?'<p class="warn">Goal discrepancy: manual '+esc(manual)+' vs official '+esc(official)+'. Neither has been overwritten.</p>':'')+'<div class="muted">Goals (manual): '+esc(manual??'—')+' · Official: '+esc(official??'—')+' · Assists: '+esc(state.assists[f.id]??'—')+' · Cards: '+esc(f.cards||'—')+'</div><div class="row" style="flex-wrap:wrap"><button class="secondary smallbtn" data-edit="'+esc(f.id)+'">Match stats</button>'+(c.length?'<button class="secondary smallbtn" data-link="'+esc(f.id)+'">Match activity ('+c.length+')</button>':'')+'</div></div>'}).join('');
const selectedFixture=selected&&state.fixtures.find(f=>state.links[f.id]===idFor(selected));
const timeline=[...(b.runs||[]).map(x=>({date:x.date,text:'Run: '+activityName(x)})),...(b.matches||[]).map(x=>({date:x.date,text:'Soccer: '+activityName(x)})),...(b.injuries||[]).map(x=>({date:x.date,text:'Symptom: '+(x.area||'')})),...state.fixtures.map(x=>({date:x.date,text:'Fixture: '+x.opponent}))].filter(x=>x.date).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,20);
root.innerHTML=card('Selected soccer match', '<label>Match selected in Soccer or choose here<select id="v84SelectedMatch"><option value="">All matches / no selection</option>'+(b.matches||[]).map(m=>'<option value="'+esc(idFor(m))+'" '+(state.selectedMatchId===idFor(m)?'selected':'')+'>'+esc(m.date+' · '+activityName(m))+'</option>').join('')+'</select></label>'+(selected?'<p><strong>'+esc(activityName(selected))+'</strong> · '+esc(selected.date)+' · '+fmt(selected.km)+' km · Avg '+fmt(selected.avg)+' km/h · Top '+fmt(selected.top)+' km/h</p><p class="muted">'+(selectedFixture?'Linked fixture: Round '+esc(selectedFixture.round)+' vs '+esc(selectedFixture.opponent):'No linked fixture yet')+'. Dribl automatic sync is not connected yet.</p>':'<p class="muted">Choose a match in Soccer to view its performance here.</p>'))+card('Readiness · '+esc(readiness()),'<p class="muted">Self-reported wellbeing, not medical clearance or an injury prediction.</p>'+form)
+card('Weekly workload & report','<div class="grid"><div class="stat"><strong>'+w.runs.length+'</strong><small>Runs</small></div><div class="stat"><strong>'+w.matches.length+'</strong><small>Soccer sessions</small></div><div class="stat"><strong>'+fmt(w.km)+'</strong><small>Km logged</small></div></div><p>'+esc(report)+'</p><button class="secondary" id="v84Export">Export v8.4 data</button>')
+card('Team & season','<form id="v84Team"><label>Club<input name="club" required value="'+esc(state.team.club)+'"></label><label>Season<input name="season" required value="'+esc(state.team.season)+'"></label><label>Division<input name="division" required value="'+esc(state.team.division)+'"></label><button>Save team selection</button></form><p class="muted">Dribl-ready configuration. Live Dribl access is not connected yet.</p>')
+card('Matchday mode',up.length?'<strong>Next match: '+esc(up[0].date)+' vs '+esc(up[0].opponent)+'</strong><p class="muted">Warm up, check symptoms, hydrate, and record your match reflection afterwards.</p>':'<p class="muted">Your next fixture will appear here.</p>')
+card('Milestones & achievements','<p class="muted">Personal records and season milestones are recorded locally.</p><form id="v84Achievement"><label>Achievement<input name="name" required placeholder="e.g. 5 km personal best"></label><button>Add milestone</button></form>'+state.achievements.slice(-5).reverse().map(x=>'<div class="item">'+esc(x.date)+' · '+esc(x.name)+'</div>').join(''))
+card('Season timeline',timeline.map(x=>'<div class="item"><small>'+esc(x.date)+'</small> · '+esc(x.text)+'</div>').join('')||'<p class="muted">Your existing training and matches will appear here.</p>')
+card('Advanced injury tracking','<p>'+inj.length+' symptom entries in the last 14 days. Continue using the existing Recovery body diagram to record locations and severity. Head injury requires medical assessment.</p>')
+card('Advanced match analytics','<p>'+past.length+' past fixtures recorded in v8.4. Official goals and cards can be stored separately from manual stats; assists remain manual.</p>');
root.querySelectorAll('article.card').forEach(article=>{const heading=article.querySelector(':scope > h3');if(!heading)return;const name=heading.textContent;const details=document.createElement('details');details.className='v84Collapse';details.open=/^(Selected soccer match|Matchday mode)/.test(name);const summary=document.createElement('summary');summary.textContent=name;summary.style.cssText='font-weight:700;font-size:1.1em;cursor:pointer;padding:5px 0';details.appendChild(summary);heading.remove();while(article.firstChild)details.appendChild(article.firstChild);article.appendChild(details)});
root.querySelector('#v84Checkin').onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));state.checkins=state.checkins.filter(x=>x.date!==today());state.checkins.push({date:today(),sleep:+d.sleep,fatigue:+d.fatigue,pain:+d.pain});save()};
root.querySelector('#v84Team').onsubmit=e=>{e.preventDefault();state.team=Object.fromEntries(new FormData(e.target));save()};

root.querySelector('#v84Achievement').onsubmit=e=>{e.preventDefault();state.achievements.push({date:today(),name:new FormData(e.target).get('name')});save()};
root.querySelectorAll('[data-done]').forEach(el=>el.onclick=()=>{const x=state.schedule.find(x=>x.id===el.dataset.done);if(x){x.done=!x.done;save()}});
root.querySelector('#v84SelectedMatch').onchange=e=>{state.selectedMatchId=e.target.value;save()};
root.querySelector('#v84Export').onclick=()=>{const blob=new Blob([JSON.stringify({v84:state,legacy:base()},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='pitchpulse-backup-'+today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
}

// Match management lives in Soccer; legacy v8.4 fixture IDs and stats are preserved.
function parseMatch(m){
 const match=activityName(m).match(/\bround\s*(\d+)\s+(?:vs\.?|v\.?|versus)\s+(.+?)(?:\s+\d+\s*[-:]\s*\d+\s*[WDL])?\s*$/i);
 return {date:m.date,round:match?match[1]:'',opponent:match?match[2].trim():''};
}
function findFixture(m){
 if(!m)return null;
 const id=idFor(m),p=parseMatch(m);
 return state.fixtures.find(f=>state.links[f.id]===id)
 ||state.fixtures.find(f=>!state.links[f.id]&&f.date===p.date&&((p.round&&String(f.round)===p.round&&p.opponent&&f.opponent.toLowerCase()===p.opponent.toLowerCase())));
}
function drawSoccerMatch(){
 const root=document.getElementById('v84SoccerMatch');if(!root)return;
 const matches=base().matches||[];
 const selected=matches.find(m=>idFor(m)===state.selectedMatchId);
 const fixture=findFixture(selected);
 const opts=matches.map(m=>'<option value="'+esc(idFor(m))+'" '+(selected&&idFor(selected)===idFor(m)?'selected':'')+'>'+esc(m.date+' · '+activityName(m))+'</option>').join('');
 const manual=fixture?state.goals[fixture.id]:undefined,assists=fixture?state.assists[fixture.id]:undefined;
 const official=fixture?fixture.officialGoals:undefined;
 const discrepancy=manual!==undefined&&official!==undefined&&official!==''&&Number(manual)!==Number(official);
 const p=selected?parseMatch(selected):null;
 const score=fixture?.result||'';
 const recordedScore=(activityName(selected||{}).match(/\b(\d+)\s*[-:]\s*(\d+)\s*[WDL]\b/i)||[]).slice(1).join(' – ');
 const scoreText=score||recordedScore||'Awaiting result';
 const tile=(label,value,unit='')=>'<div class="stat" style="min-width:0"><strong style="font-size:1.35em">'+esc(value)+'</strong><small>'+esc(label)+(unit?' · '+esc(unit):'')+'</small></div>';
 const displayGoals=manual??(official!==undefined&&official!==''?official:'—');
 const stats=selected?'<div style="text-align:center;padding:12px 4px"><div class="muted">'+esc(p?.round?'Round '+p.round+' · ':'')+esc(p?.opponent||activityName(selected))+' · '+esc(selected.date)+'</div><div style="font-size:1.9em;font-weight:800;margin:8px 0">'+esc(scoreText)+'</div><small class="muted">'+(fixture?.result?'Saved match result':'Result not yet verified by Dribl')+'</small></div><h4>My match statistics</h4><div class="grid">'+tile('Goals',displayGoals)+tile('Assists',assists??'—')+tile('Yellow / red cards',fixture?.cards||'—')+'</div><h4>Strava GPS performance</h4><div class="grid">'+tile('Distance',Number(selected.km||0).toFixed(2),'km')+tile('Average speed',Number(selected.avg||0).toFixed(2),'km/h')+tile('Top speed',Number(selected.top||0).toFixed(2),'km/h')+'</div>':'<p class="muted">Select a match to see its combined dashboard.</p>';
 const edit=selected?'<details style="margin-top:12px"><summary style="cursor:pointer;font-weight:700;padding:12px 0">Edit goals & assists</summary><form id="v84SoccerStats"><div class="grid"><label>My goals<input type="number" min="0" step="1" name="goals" value="'+esc(manual??'')+'" placeholder="Not entered"></label><label>My assists<input type="number" min="0" step="1" name="assists" value="'+esc(assists??'')+'" placeholder="Not entered"></label></div><p class="muted">Official goals: '+esc(official??'Not synced')+' · Cards: '+esc(fixture?.cards||'Not synced')+'. Dribl sync is not connected yet.</p>'+(discrepancy?'<p class="warn">Goal discrepancy: manual '+esc(manual)+' vs official '+esc(official)+'. Neither was overwritten.</p>':'')+'<button type="submit">Save match stats</button></form></details>':'';
 const archive=state.fixtures.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(f=>{
  const linked=matches.find(m=>state.links[f.id]===idFor(m));
  return '<div class="item"><strong>'+esc(f.date)+' · Round '+esc(f.round)+' vs '+esc(f.opponent)+'</strong><div class="muted">'+(linked?'Linked: '+esc(activityName(linked)):'Not linked')+' · Goals '+esc(state.goals[f.id]??'—')+' · Assists '+esc(state.assists[f.id]??'—')+'</div><button type="button" class="secondary smallbtn" data-v84remove="'+esc(f.id)+'">Remove fixture</button></div>';
 }).join('');
 root.innerHTML='<h3>Match Dashboard</h3><label>Soccer match<select id="v84SoccerSelect"><option value="">Select a match</option>'+opts+'</select></label>'+stats+edit+'<details><summary style="cursor:pointer;font-weight:700;padding:12px 0">Manage saved fixtures ('+state.fixtures.length+')</summary><p class="muted">Existing fixtures and statistics are preserved. Remove only unwanted manual fixtures; original Strava activities are never deleted.</p>'+archive+'</details>';
 root.querySelector('#v84SoccerSelect').onchange=e=>{state.selectedMatchId=e.target.value;save()};
 const form=root.querySelector('#v84SoccerStats');
 if(form)form.onsubmit=e=>{
  e.preventDefault();
  const d=Object.fromEntries(new FormData(form)),p=parseMatch(selected);
  if(!fixture&&(!p.round||!p.opponent))return alert('This activity title does not include a round and opponent. No match statistics were changed.');
  let f=fixture;
  if(!f){f={id:'fixture-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),date:p.date,round:p.round,opponent:p.opponent,officialGoals:'',cards:''};state.fixtures.push(f);}
  state.links[f.id]=idFor(selected);
  if(d.goals==='')delete state.goals[f.id];else state.goals[f.id]=Number(d.goals);
  if(d.assists==='')delete state.assists[f.id];else state.assists[f.id]=Number(d.assists);
  save();
 };
 root.querySelectorAll('[data-v84remove]').forEach(el=>el.onclick=()=>{
  const id=el.dataset.v84remove,f=state.fixtures.find(x=>x.id===id);
  if(!f||!confirm('Remove saved fixture '+f.date+' vs '+f.opponent+' and its v8.4 statistics? Original Strava activity remains unchanged.'))return;
  state.fixtures=state.fixtures.filter(x=>x.id!==id);
  delete state.goals[id];delete state.assists[id];delete state.links[id];save();
 });
}
function init(){const nav=document.getElementById('nav');if(!nav||document.getElementById('v84Tab'))return;const btn=document.createElement('button');btn.id='v84Tab';btn.type='button';btn.textContent='◈ Insights';nav.appendChild(btn);const soccer=document.getElementById('soccer');if(soccer&&!document.getElementById('v84SoccerMatch')){const matchCard=document.createElement('article');matchCard.className='card';matchCard.id='v84SoccerMatch';soccer.insertBefore(matchCard,soccer.children[1]||null)}drawSoccerMatch();const section=document.createElement('section');section.id='v84Insights';section.innerHTML='<h2>PitchPulse v8.4 · Insights</h2><div id="v84Root"><p class="muted">Loading Insights…</p></div>';document.querySelector('main').appendChild(section);btn.onclick=()=>{document.querySelectorAll('section').forEach(s=>s.classList.toggle('active',s===section));document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('active',b===btn));const title=document.getElementById('pageTitle');if(title)title.textContent='Insights';section.style.display='block';try{draw()}catch(error){const target=document.getElementById('v84Root');if(target)target.textContent='Insights could not load: '+error.message;console.error('PitchPulse v8.4 Insights',error)}};nav.addEventListener('click',e=>{const selected=e.target.closest('button');if(selected&&selected!==btn){section.classList.remove('active');section.style.removeProperty('display')}});window.addEventListener('pitchpulse:soccer-selected',e=>{const m=e.detail;if(m){state.selectedMatchId=idFor(m);save()}});window.addEventListener('storage',e=>{if(e.key===LEGACY||e.key===KEY){if(e.key===KEY)state=Object.assign(defaults(),read(KEY,{}));draw()}})}
document.addEventListener('pitchpulse:match-updated',drawSoccerMatch);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();