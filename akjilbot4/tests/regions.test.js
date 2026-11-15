const test=require('node:test'),assert=require('node:assert/strict'),A=require('../../악질봇4.0.0.js');
function harness(){
 const c=A.copy(A.catalog),files={},io={list:()=>Object.keys(files),read:n=>files[n],writeNewDurable(n,v){files[n]=v;}};let store,app,n=0;
 function open(){store=A.Store.create(io);store.load(A.newState(42));app=A.App.create(store,c);}open();
 const send=text=>app.handle({text,identity:'region-user',name:'지역 테스터',room:'개발123',now:1000+n,eventId:'region-'+(++n)});
 const user=()=>Object.values(store.getState().users)[0];
 const mutate=fn=>store.transact('arrange-region-test',s=>fn(Object.values(s.users)[0],s));
 function start(){send('+탐험');send('1');}
 function win(){mutate((u,s)=>{const b=u.run.battle;b.player.hand=[{uid:A.id(s,'region-hit-'),cardId:'class:starter_strike',cost:0}];b.player.hp=45;b.enemy.hp=1;b.enemy.shield=0;b.enemy.bossId=null;b.enemy.heroPower=null;b.enemyPlan=[];b.enemyPowerPlan=false;b.enemyPlanDeferred=false;b.enemy.status.cards.effects=[];});send('1');}
 function rewards(){let guard=0;while(user().run&&user().run.phase==='REWARD'){assert.ok(++guard<20);const p=user().run.pending;send(String(p.kind==='tavern'?p.options.length:p.kind==='camp'?2:p.kind==='swap'?3:1));}}
 return {c,get store(){return store;},send,user,mutate,start,win,rewards,reopen(){store.close();open();}};
}
test('four regions have valid distinct normal pools and bosses reserved for battle eight',()=>{
 assert.equal(A.catalog.config.regionsEnabled,true);assert.deepEqual(A.Regions.validate(A.catalog),[]);
 assert.deepEqual(A.content.regionDesign.regions.map(r=>r.name),['엘윈 숲','날개, 공업도시','시간의 서고','빛이 잠든 곳']);
 const state=A.newState(73);
 for(let index=0;index<4;index++){
  const r={regionVersion:1,wins:index*8,deck:[{uid:'region-base',cardId:'class:starter_strike'}],treasures:{},hero:A.copy(A.catalog.heroes[0]),encounterResults:[]},seen=[];
  for(let local=1;local<=8;local++){
   const spec=A.Opponents.prepare(state,r,A.catalog),region=A.content.regionDesign.regions[index];assert.equal(spec.stage,r.wins+1);assert.equal(spec.region.regionNumber,index+1);assert.equal(spec.region.battle,local);assert.equal(spec.region.isBoss,local===8);
   assert.ok((local===8?region.bosses:region.enemies).includes(spec.enemyId));assert.ok(!seen.includes(spec.enemyId));seen.push(spec.enemyId);
   r.encounterResults.push({stage:r.wins+1,enemyId:spec.enemyId,name:spec.name,won:true});r.wins++;r.enemyId=spec.enemyId;r.enemySpec=null;
  }
 }
 assert.throws(()=>A.Opponents.prepare(state,{regionVersion:1,wins:32},A.catalog),/모든 지역/);
});
test('a full 32-win exploration crosses regions without resetting resources and settles exactly once',()=>{
 const h=harness();h.start();assert.equal(h.user().run.regionVersion,1);const initialKeys=h.user().items.keys;let last;
 for(let count=0;count<32;count++){
  const r=h.user().run,region=A.content.regionDesign.regions[Math.floor(count/8)];assert.equal(r.wins,count);assert.equal(r.enemySpec.region.regionName,region.name);assert.equal(r.enemySpec.region.isBoss,count%8===7);
  if(count%8===0)assert.match(h.send('+탐험'),new RegExp(region.name));
  const selected=A.copy(r.enemySpec),rng=h.store.getState().rngState;h.reopen();assert.deepEqual(h.user().run.enemySpec,selected);h.send('+탐험');assert.equal(h.store.getState().rngState,rng);
  const preview=h.send('y');assert.match(preview,new RegExp(region.name));assert.equal(h.user().run.battle.player.maxHp,60);
  h.win();assert.equal(h.user().run.wins,count+1);assert.equal(h.user().run.phase,'REWARD');h.rewards();
  if(count<31){
   const ready=h.user().run;assert.equal(ready.phase,'READY');last={deck:A.copy(ready.deck),treasures:A.copy(ready.treasures),hp:ready.hp,gold:ready.gold};h.send('+탐험');const next=h.user().run;
   assert.deepEqual(next.deck,last.deck);assert.deepEqual(next.treasures,last.treasures);assert.equal(next.hp,last.hp);assert.equal(next.gold,last.gold);assert.equal(h.user().items.keys,initialKeys);assert.equal(A.validateState(h.store.getState()),true);
  }
 }
 const u=h.user();assert.equal(u.run,null);assert.equal(u.lastRun.wins,32);assert.equal(u.lastRun.reason,'clear');assert.equal(u.lastRun.progress.completedRegions,4);assert.equal(u.lastRun.encounterResults.length,32);assert.ok(u.lastRun.reward.gold>=4000&&u.lastRun.reward.gold<=6000);
 const paid=A.copy(u);h.reopen();h.send('+인벤');assert.equal(h.user().gold,paid.gold);assert.deepEqual(h.user().lastRun,paid.lastRun);assert.equal(A.validateState(h.store.getState()),true);
});
test('coin settlement depends only on kills and randomness, never remaining exploration gold',()=>{
 const a=harness(),b=harness();for(const h of [a,b]){h.start();h.mutate(u=>{u.run.wins=17;u.run.phase='READY';u.run.enemySpec=null;u.run.enemyId=null;u.run.pending=null;});}
 a.mutate(u=>{u.run.gold=0;});b.mutate(u=>{u.run.gold=9999;});a.send('gg');b.send('gg');
 assert.deepEqual(a.user().lastRun.reward,b.user().lastRun.reward);assert.equal(a.user().lastRun.wins,17);assert.equal(a.user().lastRun.progress.completedRegions,2);assert.equal(a.user().gold,b.user().gold);
 for(const wins of [0,1,7,8,9,16,24,32]){const lo=A.Economy.reward(wins,()=>0),hi=A.Economy.reward(wins,()=>.999);assert.ok(hi.gold>=lo.gold);assert.equal(lo.gold%50,0);assert.ok(lo.gold>=50);}
});
test('region-local duplicate prevention resets after a boss, without rerolling a saved preview',()=>{
 const s=A.newState(11),run={regionVersion:1,wins:8,hero:A.copy(A.catalog.heroes[0]),deck:[],treasures:{},enemyId:'aviana',encounterResults:[{stage:1,enemyId:'cannon_minion',name:'대포 미니언',won:true}]};
 const spec=A.Opponents.prepare(s,run,A.catalog,'cannon_minion'),rng=s.rngState;assert.equal(spec.region.regionNumber,2);assert.equal(spec.region.battle,1);assert.deepEqual(A.Opponents.prepare(s,run,A.catalog),spec);assert.equal(s.rngState,rng);
});
test('admin restart beyond eight wins preserves region identity, current HP and encounter deck',()=>{
 const h=harness();h.start();h.mutate(u=>{u.run.wins=15;u.run.phase='READY';u.run.enemySpec=null;u.run.enemyId=null;});h.send('+탐험');const before=A.copy(h.user().run.enemySpec);h.send('y');h.send('++관리자획득');h.send('++재시작');
 assert.equal(h.user().run.phase,'ENCOUNTER');assert.deepEqual(h.user().run.enemySpec.deck,before.deck);assert.equal(h.user().run.enemySpec.maxHp,70);assert.equal(h.user().run.enemySpec.region.regionNumber,2);assert.equal(h.user().run.enemySpec.region.isBoss,true);
});
