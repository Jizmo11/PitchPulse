'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const adapter=require('../dribl-fixture-adapter.js');
test('verified historical match sample normalises',()=>{
 const f=adapter.normalise(adapter.sample);
 assert.equal(f.id,'zdBvQPbqPd');assert.equal(f.date,'2024-04-05');
 assert.equal(f.homeScore,1);assert.equal(f.awayScore,2);
 assert.deepEqual(f.playerEvents.map(e=>[e.type,e.minute]),[['yellow',5]]);
});
test('same-date Strava activity is suggested, never auto-linked',()=>{
 const acts=[{stravaId:123,date:'2024-04-05',name:'Evening Football (Soccer)'},{stravaId:456,date:'2024-04-06',name:'Football'}];
 const before=JSON.stringify(acts);
 const found=adapter.suggestions(adapter.sample,acts);
 assert.equal(found.length,1);assert.equal(found[0].activityId,'strava:123');
 assert.equal(found[0].status,'requires-user-confirmation');
 assert.equal(JSON.stringify(acts),before);
});
test('rejects missing identity, invalid scores and invalid dates',()=>{
 for(const f of [{...adapter.sample,id:''},{...adapter.sample,home:''},{...adapter.sample,homeScore:-1},{...adapter.sample,date:'not-a-date'}]){
  assert.throws(()=>adapter.normalise(f));
 }
});
test('missing activity ID cannot create a link suggestion',()=>{
 assert.deepEqual(adapter.suggestions(adapter.sample,[{date:'2024-04-05',name:'manual'}]),[]);
});
test('normalisation creates independent records and does not modify sample',()=>{
 const before=JSON.stringify(adapter.sample);
 const result=adapter.normalise(adapter.sample);
 result.playerEvents[0].type='changed';
 assert.equal(JSON.stringify(adapter.sample),before);
});
