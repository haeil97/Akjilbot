const test=require('node:test'),assert=require('node:assert/strict'),A=require('../../악질봇4.0.0.js');
const title='⚔️ 이벤트 – 나눠 먹는 도시락 ⚔️',outro='빈자리 쪽의 풀이 조용히 눕습니다.';
function harness({hp=20,gold=5,wins=1}={}){
 const c=A.copy(A.catalog),files={},io={list:()=>Object.keys(files),read:n=>files[n],writeNewDurable(n,v){files[n]=v;}};let store,app,n=0;
 function open(){store=A.Store.create(io);store.load(A.newState(42));app=A.App.create(store,c);}open();
 const send=(text,id)=>app.handle({text,identity:'lunch-user',name:'도시락 테스터',room:'개발123',now:1000+(++n),eventId:id||'lunch-'+n});
 const user=()=>Object.values(store.getState().users)[0],mutate=fn=>store.transact('lunch-fixture',s=>fn(Object.values(s.users)[0],s));
 function offer(roll=0){mutate((u,s)=>{u.run.phase='REWARD';u.run.pending=null;u.run.queue=['event','tavern'];let calls=0;A.Journey.next(s,u,c,()=>calls++===0?roll:.7);});}
 send('+탐험');send('1');mutate(u=>{u.run.wins=wins;u.run.hp=hp;u.run.maxHp=60;u.run.gold=gold;u.run.battle=null;u.run.enemySpec=null;u.run.enemyId=null;u.run.turnToken=null;});offer();
 return {c,get store(){return store;},send,user,mutate,offer,reopen(){store.close();open();}};
}
test('lunchbox belongs to region one and uses the specified distinct menu and result titles',()=>{
 for(const wins of [1,8]){const h=harness({wins});assert.equal(h.user().run.pending.extra.event.id,'leaf_lunchbox');
 assert.equal(h.send('+탐험'),'⚔️ 이벤트 – 나뭇잎 도시락 ⚔️\n\n당신은 숲속에서 누군가가 싸 둔 나뭇잎 도시락을 발견합니다. 반대편에는 아직 아무도 앉지 않았습니다.\n\n1. 혼자 먹는다: 체력을 14 회복합니다.\n\n2. 반을 남긴다: 체력을 7 회복합니다. 다음 전투 후 5골드를 추가로 얻습니다.\n\n3. 도시락을 두고 간다: 이번 탐험에서 이벤트 발생 확률이 5% 증가합니다.');}
 assert.equal(harness({wins:9}).user().run.pending.extra,null);
});
test('eating alone heals fourteen capped at max HP without changing other resources',()=>{
 for(const hp of [20,59]){const h=harness({hp}),before=A.copy(h.user().run);
 assert.equal(A.UI.messages(h.send('1'))[0],title+'\n\n'+outro+'\n\n체력을 14 회복했습니다.');
 assert.equal(h.user().run.hp,Math.min(60,hp+14));assert.equal(h.user().run.gold,before.gold);assert.deepEqual(h.user().run.deck,before.deck);assert.ok(!h.user().run.nextBattleGoldBonus);assert.ok(!h.user().run.eventChanceBonusPercent);}
});
test('sharing heals seven and saves a deferred five gold reward without paying it immediately',()=>{
 const h=harness(),output=h.send('2','share-once');assert.equal(A.UI.messages(output)[0],title+'\n\n'+outro+'\n\n체력을 7 회복했습니다.\n다음 전투 완료 후 5골드를 획득합니다.');
 assert.equal(h.user().run.hp,27);assert.equal(h.user().run.gold,5);assert.equal(h.user().run.nextBattleGoldBonus,5);
 const after=A.copy(h.store.getState());h.reopen();assert.equal(h.send('2','share-once'),output);assert.deepEqual(h.store.getState(),after);
});
test('deferred gold is added exactly once to the next actual victory and its displayed breakdown',()=>{
 const h=harness();h.send('2');const coins=h.user().gold;h.send(String(h.user().run.pending.options.length));h.reopen();assert.equal(h.user().run.nextBattleGoldBonus,5);h.send('+탐험');h.send('y');
 h.mutate((u,s)=>{const b=u.run.battle;b.player.hand=[{uid:A.id(s,'lunch-hit-'),cardId:'class:starter_strike',cost:0}];b.player.hp=45;b.enemy.hp=1;b.enemy.shield=0;b.enemy.bossId=null;b.enemy.heroPower=null;b.enemyPlan=[];b.enemyPowerPlan=false;b.enemyPlanDeferred=false;b.enemy.status.cards.effects=[];});
 const beforeGold=h.user().run.gold,output=h.send('1','win-once'),r=h.user().run;
 assert.equal(r.wins,2);assert.equal(r.lastBattleGold.eventBonus,5);assert.equal(r.lastBattleGold.total,r.lastBattleGold.base+r.lastBattleGold.bonus+5);assert.equal(r.gold,beforeGold+r.lastBattleGold.total);assert.ok(!r.nextBattleGoldBonus);assert.equal(h.user().gold,coins);assert.match(output,/도시락 보너스 5/);
 const after=A.copy(h.store.getState());h.reopen();assert.equal(h.send('1','win-once'),output);assert.deepEqual(h.store.getState(),after);
 h.mutate(u=>{A.Journey.reward(u.run,h.c,()=>0);});assert.equal(h.user().run.lastBattleGold.eventBonus,0);
});
test('deferred reward survives a region boundary and never pays when the run is abandoned',()=>{
 const h=harness({wins:8});h.send('2');h.reopen();assert.equal(h.user().run.nextBattleGoldBonus,5);
 const coins=h.user().gold,expected=A.Economy.reward(8,A.random(A.copy(h.store.getState())));h.send('gg');assert.equal(h.user().run,null);assert.equal(h.user().gold,coins+expected.gold);
 h.send('+탐험');h.send('1');assert.ok(!h.user().run.nextBattleGoldBonus);assert.ok(!h.user().run.eventChanceBonusPercent);
});
test('leaving lunch increases event chance by five percentage points and survives reopen and duplicate input',()=>{
 const h=harness(),before=A.copy(h.user().run),output=h.send('3','leave-once');
 assert.equal(A.UI.messages(output)[0],title+'\n\n'+outro+'\n\n이번 탐험에서 이벤트 발생 확률이 5% 증가합니다.');
 assert.equal(h.user().run.eventChanceBonusPercent,5);assert.equal(h.user().run.hp,before.hp);assert.equal(h.user().run.gold,before.gold);assert.deepEqual(h.user().run.deck,before.deck);
 const after=A.copy(h.store.getState());h.reopen();assert.equal(h.send('3','leave-once'),output);assert.deepEqual(h.store.getState(),after);
 for(const [roll,kind] of [[.2,'event'],[.249999,'event'],[.25,'tavern']]){h.offer(roll);assert.equal(h.user().run.pending.kind,kind);}
});
test('repeated lunch increases stack to 30 percent and the chance is capped at 100 percent',()=>{
 const h=harness();h.send('3');h.offer();h.send('3');assert.equal(h.user().run.eventChanceBonusPercent,10);
 h.offer(.299999);assert.equal(h.user().run.pending.kind,'event');h.offer(.3);assert.equal(h.user().run.pending.kind,'tavern');
 h.mutate(u=>{u.run.eventChanceBonusPercent=80;});h.offer(.999999);assert.equal(h.user().run.pending.kind,'event');h.send('3');assert.equal(h.user().run.eventChanceBonusPercent,80);
});
