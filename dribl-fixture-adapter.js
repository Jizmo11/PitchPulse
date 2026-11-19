/* StrideEleven PR91: read-only Dribl fixture adapter.
 * Manual verification fixture only; NOT a live Dribl API response.
 * Never writes Strava data, links, goals, assists, or localStorage.
 */
(function(root){
'use strict';
const sample=Object.freeze({
 source:'dribl-manual-verified',id:'zdBvQPbqPd',date:'2024-04-05',
 home:'Adelaide Hills 2A',away:'Concordia 2A',homeScore:1,awayScore:2,
 venue:'Hawks Nest Pitch 1',season:'2024',division:'CSL Division 2A',
 url:'https://csl.dribl.com/matchcentre?m=zdBvQPbqPd',
 playerEvents:[{player:'Jayden Miller',shirt:11,type:'yellow',minute:5}],
 eventCoverage:'unverified-completeness'
});
function normalise(raw){
 if(!raw||typeof raw!=='object')throw Error('Fixture must be an object');
 const id=String(raw.id||'').trim(),date=String(raw.date||'');
 if(!/^[a-zA-Z0-9_-]{4,80}$/.test(id)||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z')))throw Error('Invalid fixture identifier or date');
 const home=String(raw.home||'').trim(),away=String(raw.away||'').trim();
 if(!home||!away)throw Error('Both teams required');
 const score=n=>n===null||n===undefined?null:(Number.isInteger(n)&&n>=0?n:(()=>{throw Error('Invalid score')})());
 const events=Array.isArray(raw.playerEvents)?raw.playerEvents.map(e=>({player:String(e.player||''),shirt:Number.isInteger(e.shirt)?e.shirt:null,type:String(e.type||''),minute:Number.isInteger(e.minute)?e.minute:null})):[];
 return {source:String(raw.source||'manual'),id,date,home,away,homeScore:score(raw.homeScore),awayScore:score(raw.awayScore),venue:String(raw.venue||''),season:String(raw.season||''),division:String(raw.division||''),url:String(raw.url||''),playerEvents:events,eventCoverage:String(raw.eventCoverage||'unknown')};
}
function activityId(m){return m&&m.stravaId?'strava:'+m.stravaId:null}
function suggestions(fixture,activities){
 const f=normalise(fixture);
 return (Array.isArray(activities)?activities:[]).filter(m=>m&&m.date===f.date&&activityId(m)).map(m=>({
 fixtureId:f.id,activityId:activityId(m),date:f.date,
 activityName:String(m.name||m.opponent||'Football activity'),
 status:'requires-user-confirmation'
 }));
}
const api=Object.freeze({sample,normalise,suggestions});
if(typeof module!=='undefined'&&module.exports)module.exports=api;
else root.SXIDriblFixtureAdapter=api;
})(typeof window!=='undefined'?window:globalThis);
