/* PitchPulse local backup/restore. No server upload and no Strava credentials. */
(()=>{
'use strict';
const KEYS=['pitchpulse_v1','pitchpulse_v84','pitchpulse_home_plan','pitchpulse_last_sync'];
const DATA=['pitchpulse_v1','pitchpulse_v84','pitchpulse_home_plan'];
const version=1;
const byId=id=>document.getElementById(id);
const message=(s,bad=false)=>{const el=byId('ppBackupStatus');if(el){el.textContent=s;el.style.color=bad?'#f5a35b':''}};
const date=()=>new Date().toISOString().slice(0,10);
const validate=(key,value)=>{
 if(key==='pitchpulse_v1'){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid original PitchPulse data.');
  for(const k of ['runs','matches','injuries','workouts'])if(value[k]!==undefined&&!Array.isArray(value[k]))throw Error('Invalid '+k+' records.');
  if(value.done!==undefined&&(!value.done||typeof value.done!=='object'||Array.isArray(value.done)))throw Error('Invalid completed sessions.');
 }else if(key==='pitchpulse_v84'){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid v8.4 data.');
  for(const k of ['fixtures','checkins','achievements','schedule'])if(value[k]!==undefined&&!Array.isArray(value[k]))throw Error('Invalid '+k+' records.');
 }else if(key==='pitchpulse_home_plan'&&value!==null&&typeof value!=='object'&&typeof value!=='string')throw Error('Invalid home plan.');
};
const download=(payload,name)=>{
 const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
};
const backup=()=>{
 const data={};for(const k of KEYS){const raw=localStorage.getItem(k);if(raw!==null){try{data[k]=JSON.parse(raw)}catch{data[k]=raw}}}
 if(!('pitchpulse_v1' in data))throw Error('No saved PitchPulse records were found.');
 const payload={format:'pitchpulse-local-backup',version,createdAt:new Date().toISOString(),data};
 download(payload,'pitchpulse-backup-'+date()+'.json');
 message('Backup file generated. Keep it somewhere safe before updating.');
};
async function restore(file){
 if(!file)return;
 if(file.size>15*1024*1024)throw Error('Backup is too large (15 MB maximum).');
 let payload;try{payload=JSON.parse(await file.text())}catch{throw Error('This is not a valid JSON backup.')}
 // Accept earlier v8.4 exports created before the dedicated backup feature.
 if(payload&&payload.v84&&payload.legacy&&!payload.format)payload={format:'pitchpulse-local-backup',version:1,data:{pitchpulse_v1:payload.legacy,pitchpulse_v84:payload.v84}};
 if(!payload||payload.format!=='pitchpulse-local-backup'||payload.version!==1||!payload.data||typeof payload.data!=='object'||Array.isArray(payload.data))throw Error('This is not a recognised PitchPulse backup.');
 const keys=Object.keys(payload.data);
 if(!keys.includes('pitchpulse_v1')||keys.some(k=>!KEYS.includes(k)))throw Error('The backup has missing or unexpected data keys.');
 for(const k of keys){const v=payload.data[k];if(DATA.includes(k))validate(k,v);if(k==='pitchpulse_last_sync'&&typeof v!=='string'&&typeof v!=='number')throw Error('Invalid sync timestamp.')}
 const count=payload.data.pitchpulse_v1;
 const summary=['runs','matches','injuries','workouts'].map(k=>(Array.isArray(count[k])?count[k].length:0)+' '+k).join(', ');
 if(!confirm('Restore backup from '+(payload.createdAt||'unknown date')+'?\n\n'+summary+'\n\nThis replaces locally saved PitchPulse data on THIS device. Your current records will be overwritten. Cancel if you have not backed them up first.')){message('Restore cancelled.');return}
 // Snapshot existing keys so failed writes can be reverted.
 const previous={};for(const k of KEYS)previous[k]=localStorage.getItem(k);
 try{
  for(const k of KEYS){if(Object.prototype.hasOwnProperty.call(payload.data,k))localStorage.setItem(k,JSON.stringify(payload.data[k]));else localStorage.removeItem(k)}
 }catch(e){for(const k of KEYS){try{if(previous[k]===null)localStorage.removeItem(k);else localStorage.setItem(k,previous[k])}catch{}}throw Error('Restore failed; attempted to recover previous data: '+e.message)}
 alert('Backup restored. PitchPulse will now reload to display your restored records.');
 location.reload();
}
function init(){
 if(byId('ppBackupPanel'))return;
 const home=byId('overview');if(!home)return;
 const panel=document.createElement('details');panel.id='ppBackupPanel';panel.className='card';panel.innerHTML='<summary><strong>Data backup & restore</strong></summary><p class="muted">Download your saved training, match and injury records before updating. Backup files stay on your device; Strava login credentials are not included.</p><div style="display:flex;flex-wrap:wrap;gap:10px;margin:12px 0"><button type="button" id="ppBackupDownload">Download backup</button><label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer">Restore from file <input id="ppBackupFile" type="file" accept=".json,application/json" style="max-width:190px"></label></div><p id="ppBackupStatus" class="muted" role="status" aria-live="polite">Restoring replaces saved data on this device after confirmation.</p>';
 home.insertBefore(panel,home.firstChild);
 byId('ppBackupDownload').onclick=()=>{try{backup()}catch(e){message(e.message,true)}};
 byId('ppBackupFile').onchange=async e=>{const file=e.target.files[0];try{await restore(file)}catch(err){message(err.message,true)}finally{e.target.value=''}};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();