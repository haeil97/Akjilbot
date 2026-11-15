const offerEvent=require('./event-fixture.js');
const test=require('node:test'),assert=require('node:assert/strict'),A=require('../../악질봇4.0.0.js');
const title='⚔️ 이벤트 – 싹이 트는 동전 ⚔️',outro='잎은 동전보다 훨씬 가볍게 흔들립니다.';
function harness({gold=10,wins=1}={}){
 const c=A.copy(A.catalog),files={},io={list:()=>Object.keys(files),read:n=>files[n],writeNewDurable(n,v){files[n]=v;}};let store,app,n=0;
 function open(){store=A.Store.create(io);store.load(A.newState(42));app=A.App.create(store,c);}open();
 const send=(text,id)=>app.handle({text,identity:'seed-user',name:'동전 테스터',room:'개발123',now:1000+(++n),eventId:id||'seed-'+n});
 const user=()=>Object.values(store.getState().users)[0],mutate=fn=>store.transact('seed-fixture',s=>fn(Object.values(s.users)[0],s));
 function offer(){mutate((u,s)=>{const r=u.run;r.phase='REWARD';r.battle=null;r.enemySpec=null;r.enemyId=null;r.turnToken=null;r.pending=null;r.queue=['event','tavern'];offerEvent(A,s,u,c,'sprouting_coin');});}
 send('+탐험');send('1');mutate(u=>{u.run.wins=wins;u.run.hp=40;u.run.maxHp=60;u.run.gold=gold;});offer();
 function win(id){mutate(u=>{u.run.phase='READY';u.run.pending=null;u.run.queue=[];});send('+탐험');send('y');mutate((u,s)=>{const b=u.run.battle;b.player.hand=[{uid:A.id(s,'seed-hit-'),cardId:'class:starter_strike',cost:0}];b.player.hp=45;b.enemy.hp=1;b.enemy.shield=0;b.enemy.bossId=null;b.enemy.heroPower=null;b.enemyPlan=[];b.enemyPowerPlan=false;b.enemyPlanDeferred=false;b.enemy.status.cards.effects=[];});return send('1',id);}
 return {c,get store(){return store;},send,user,mutate,offer,win,reopen(){store.close();open();}};
}
test('sprouting coin belongs to region one and uses the exact story and spacing',()=>{
 for(const wins of [1,8]){const h=harness({wins});assert.equal(h.user().run.pending.extra.event.id,'sprouting_coin');
 assert.equal(h.send('+탐험'),title+'\n\n흙에 반쯤 박힌 동전에서 잎이 돋아납니다. 물을 주려 하자 잎이 동전 주머니를 향해 기웁니다.\n\n1. 2골드를 심는다: 2골드를 잃습니다. 전투 2회 후 6골드를 얻습니다.\n\n2. 4골드를 심는다: 4골드를 잃습니다. 전투 2회 후 무작위 하급 보물을 얻습니다.\n\n3. 지금 수확한다: 1골드를 얻습니다.');}
 assert.equal(harness({wins:9}).user().run.pending.extra,null);
});
test('all choices use the fixed outro, spend only run gold and persist deferred promises',()=>{
 for(const index of [1,2,3]){const h=harness(),coins=h.user().gold,output=h.send(String(index),'seed-once'),r=h.user().run;
 const logs=index===1?'골드를 2 잃었습니다.\n전투 2회 후 6골드를 획득합니다.':index===2?'골드를 4 잃었습니다.\n전투 2회 후 무작위 하급 보물을 획득합니다.':'골드를 1 얻었습니다.';
 assert.equal(A.UI.messages(output)[0],title+'\n\n'+outro+'\n\n'+logs);assert.equal(r.gold,index===1?8:index===2?6:11);assert.equal(h.user().gold,coins);assert.equal(r.hp,40);
 if(index<3){assert.equal(r.delayedEventRewards.length,1);assert.equal(r.delayedEventRewards[0].dueWins,3);}else assert.ok(!r.delayedEventRewards);
 const after=A.copy(h.store.getState());h.reopen();assert.equal(h.send(String(index),'seed-once'),output);assert.deepEqual(h.store.getState(),after);}
});
test('insufficient gold rolls back the complete state without scheduling a reward',()=>{
 for(const [index,gold] of [[1,1],[2,3]]){const h=harness({gold}),before=A.copy(h.store.getState());assert.throws(()=>h.send(String(index)),/골드가 부족/);assert.deepEqual(h.store.getState(),before);}
});
test('gold matures only on the second actual victory and duplicate victory input cannot pay twice',()=>{
 const h=harness();h.send('1');h.win();assert.equal(h.user().run.lastBattleGold.investmentBonus,0);assert.equal(h.user().run.delayedEventRewards.length,1);
 h.reopen();const before=h.user().run.gold,coins=h.user().gold,output=h.win('maturity-once'),r=h.user().run;
 assert.equal(r.wins,3);assert.equal(r.lastBattleGold.investmentBonus,6);assert.equal(r.gold,before+r.lastBattleGold.base+r.lastBattleGold.bonus+6);assert.equal(h.user().gold,coins);assert.ok(!r.delayedEventRewards);
assert.ok(output.includes('골드를 6 얻었습니다.'));assert.ok(output.includes('동전 수확 6'));
 const after=A.copy(h.store.getState());h.reopen();assert.equal(h.send('1','maturity-once'),output);assert.deepEqual(h.store.getState(),after);
 h.win();assert.equal(h.user().run.lastBattleGold.investmentBonus,0);assert.deepEqual(h.user().run.lastBattleEventRewards,[]);
});
test('treasure matures after two wins across a region boundary and adds the proper slot and card',()=>{
 const low=Object.keys(A.catalog.treasures).find(id=>{const t=A.catalog.treasures[id];return t.tier==='low'&&t.kind==='card'&&!t.classId&&!t.retired;});
 const h=harness({wins:7});h.send('2');for(const id of Object.keys(h.c.treasures))if(h.c.treasures[id].tier==='low')h.c.treasures[id].retired=id!==low;
 h.win();assert.equal(h.user().run.wins,8);assert.equal(h.user().run.lastBattleEventRewards.length,0);h.reopen();const output=h.win('treasure-maturity'),r=h.user().run;
 assert.equal(r.wins,9);assert.ok(Object.values(r.treasures).includes(low));const slot=Object.keys(r.treasures).find(k=>r.treasures[k]===low);assert.ok(r.deck.some(x=>x.cardId===h.c.treasures[low].cardId&&x.treasureSlot===slot));assert.ok(output.includes(h.c.treasures[low].name));assert.ok(!r.delayedEventRewards);
 const after=A.copy(h.store.getState());h.reopen();assert.equal(h.send('1','treasure-maturity'),output);assert.deepEqual(h.store.getState(),after);
});
test('multiple investments are retained separately and combine with the lunch bonus without overwriting it',()=>{
 const h=harness();h.send('1');h.offer();h.send('1');assert.equal(h.user().run.delayedEventRewards.length,2);assert.notEqual(h.user().run.delayedEventRewards[0].id,h.user().run.delayedEventRewards[1].id);
 h.mutate((u,s)=>{u.run.wins=3;u.run.nextBattleGoldBonus=5;A.Journey.reward(u.run,h.c,()=>0,s);});const r=h.user().run;assert.equal(r.lastBattleGold.investmentBonus,12);assert.equal(r.lastBattleGold.eventBonus,5);assert.equal(r.lastBattleGold.total,r.lastBattleGold.base+r.lastBattleGold.bonus+17);assert.ok(!r.delayedEventRewards);
});
test('an exhausted low treasure pool keeps its mature promise until a later victory can fulfill it',()=>{
 const h=harness();h.send('2');for(const id of Object.keys(h.c.treasures))if(h.c.treasures[id].tier==='low')h.c.treasures[id].retired=true;
 h.mutate((u,s)=>{u.run.wins=3;A.Journey.reward(u.run,h.c,()=>0,s);});assert.equal(h.user().run.delayedEventRewards.length,1);assert.equal(h.user().run.lastBattleEventRewards.length,0);
 const low=Object.keys(h.c.treasures).find(id=>h.c.treasures[id].name==='행운의 삽');h.c.treasures[low].retired=false;
 h.mutate((u,s)=>{u.run.wins=4;A.Journey.reward(u.run,h.c,()=>0,s);});assert.ok(!h.user().run.delayedEventRewards);assert.ok(Object.values(h.user().run.treasures).includes(low));
});
test('abandoning before maturity discards the promise and does not alter kill-based coins',()=>{
 const h=harness();h.send('1');const coins=h.user().gold,expected=A.Economy.reward(1,A.random(A.copy(h.store.getState())));h.send('gg');assert.equal(h.user().run,null);assert.equal(h.user().gold,coins+expected.gold);h.send('+탐험');h.send('1');assert.ok(!h.user().run.delayedEventRewards);
});
