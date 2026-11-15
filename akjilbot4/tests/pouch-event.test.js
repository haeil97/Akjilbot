const test=require('node:test'),assert=require('node:assert/strict'),A=require('../../악질봇4.0.0.js');
const title='⚔️ 이벤트 – 둑 아래의 주머니 ⚔️',outro='양말은 젖었지만, 주머니까지 빈 것은 아닙니다.';
function harness(hp=20,gold=5,wins=1){
 const c=A.copy(A.catalog),files={},io={list:()=>Object.keys(files),read:n=>files[n],writeNewDurable(n,v){files[n]=v;}};let store,app,n=0;
 function open(){store=A.Store.create(io);store.load(A.newState(42));app=A.App.create(store,c);}open();
 const send=(text,id)=>app.handle({text,identity:'pouch-user',name:'주머니 테스터',room:'개발123',now:1000+(++n),eventId:id||'pouch-'+n});
 const user=()=>Object.values(store.getState().users)[0],mutate=fn=>store.transact('pouch-fixture',s=>fn(Object.values(s.users)[0],s));
 send('+탐험');send('1');mutate((u,s)=>{const r=u.run;r.wins=wins;r.hp=hp;r.gold=gold;r.phase='REWARD';r.pending=null;r.queue=['event','tavern'];let calls=0;A.Journey.next(s,u,c,()=>calls++===1?.7:0);});
 function roll(high){let seed=1;while((A.random({rngState:seed})()>=.5)!==high)seed++;mutate((u,s)=>{s.rngState=seed;});}
 return {c,get store(){return store;},send,user,mutate,roll,reopen(){store.close();open();}};
}
test('region one offers pouch with standard spacing; shallow choice grants only two run gold',()=>{
 for(const wins of [1,8]){
  const h=harness(20,5,wins);assert.equal(h.user().run.pending.extra.event.id,'pouch_below_bank');
  assert.equal(h.send('+탐험'),title+'\n\n개울 아래에서 돈주머니가 흔들립니다. 얕은 물에는 동전이, 깊은 물에는 묵직한 상자가 잠겨 있습니다.\n\n1. 얕은 곳을 뒤진다: 2골드를 얻습니다.\n\n2. 깊은 곳을 뒤진다: 체력을 4 잃고 상자를 꺼냅니다.');
  const coins=h.user().gold,deck=A.copy(h.user().run.deck),result=A.UI.messages(h.send('1'))[0];
  assert.equal(result,title+'\n\n'+outro+'\n\n골드를 2 얻었습니다.');assert.equal(h.user().run.gold,7);assert.equal(h.user().gold,coins);assert.equal(h.user().run.hp,20);assert.deepEqual(h.user().run.deck,deck);assert.equal(h.user().run.pending.kind,'tavern');
 }
 const h=harness(20,5,9);assert.equal(h.user().run.pending.extra,null);
});
test('deep choice costs four HP once and persists the second menu and stale-token protection',()=>{
 const h=harness(),token=h.user().run.pending.id,output=h.send('2','deep-once'),after=A.copy(h.store.getState());
 assert.equal(output,title+'\n\n상자가 손에 들어왔습니다.\n\n1. 상자를 연다: 50%로 무작위 하급 보물을 얻습니다. 50%로 덱에 [💔] 돌을 추가합니다.\n\n2. 상자째 판다: 4골드를 얻습니다.');
 assert.equal(h.user().run.hp,16);assert.equal(h.user().run.gold,5);h.reopen();assert.equal(h.send('2','deep-once'),output);assert.deepEqual(h.store.getState(),after);
 assert.equal(h.send('+탐험'),output);assert.throws(()=>h.send('+선택 '+token+' 2'),/이전 화면/);
 const result=A.UI.messages(h.send('2'))[0];assert.equal(result,title+'\n\n'+outro+'\n\n골드를 4 얻었습니다.');assert.equal(h.user().run.gold,9);assert.equal(h.user().run.hp,16);
});
test('opening can add a low passive treasure without replacing existing treasures',()=>{
 const h=harness();h.send('2');
 const old=A.copy(h.user().run.treasures),oldDeck=h.user().run.deck.length;
 h.mutate(u=>{for(const id of Object.keys(h.c.treasures))if(id!=='lucky_shovel')h.c.treasures[id].retired=true;});
 assert.ok(h.c.treasures.lucky_shovel);h.roll(false);
 const output=h.send('1','open-once'),r=h.user().run;
 assert.equal(A.UI.messages(output)[0],title+'\n\n'+outro+'\n\n[✨] 행운의 삽을 획득했습니다.');
 for(const key of Object.keys(old))assert.equal(r.treasures[key],old[key]);assert.ok(Object.values(r.treasures).includes('lucky_shovel'));assert.equal(r.deck.length,oldDeck);
 const after=A.copy(h.store.getState());h.reopen();assert.equal(h.send('1','open-once'),output);assert.deepEqual(h.store.getState(),after);
});
test('opening can grant a card treasure with its passive slot retained for combat',()=>{
 const h=harness();h.send('2');const id=Object.keys(h.c.treasures).find(id=>{const t=h.c.treasures[id];return t.kind==='card'&&t.tier==='low'&&!t.classId&&!t.retired;});
 for(const key of Object.keys(h.c.treasures))if(key!==id)h.c.treasures[key].retired=true;
 h.roll(false);h.send('1');const r=h.user().run,slot=Object.keys(r.treasures).find(k=>r.treasures[k]===id);
 assert.ok(slot);assert.ok(r.deck.some(x=>x.cardId===h.c.treasures[id].cardId&&x.treasureSlot===slot));
});
test('stone result adds one event-only, non-upgradeable curse card and cannot be rerolled by replay',()=>{
 const h=harness();h.send('2');h.roll(true);
 const output=h.send('1','stone-once'),r=h.user().run;
 assert.equal(A.UI.messages(output)[0],title+'\n\n상자 안에는 쓸모없는 돌만 가득 차 있습니다.\n\n[💔] 돌을 덱에 추가했습니다.');
 assert.equal(r.deck.filter(x=>x.cardId==='event:stone').length,1);const after=A.copy(h.store.getState());h.reopen();assert.equal(h.send('1','stone-once'),output);assert.deepEqual(h.store.getState(),after);
 const d=h.c.cards['event:stone'];assert.equal(d.cost,0);assert.equal(d.element,'CURSE');assert.equal(d.text,'흠, 쓸모없군...');assert.ok(!d.upgrade);assert.ok(!h.c.cardPool.includes('event:stone'));
});
test('stone is playable at zero cost, has no effect and goes to rest',()=>{
 const c=A.copy(A.catalog),b=A.Battle.create({name:'나',maxHp:100,deck:[]},{name:'적',maxHp:100,deck:[]},c,()=>.2);
 b.enemyPlan=[];b.enemyPowerPlan=false;b.player.hand=[{uid:'stone',cardId:'event:stone',upgraded:false}];const desc=A.Battle.describeCard(b.player.hand[0],c);
 assert.ok(!desc.unplayable);assert.ok(!desc.temporary);A.Battle.submit(b,['stone'],c,()=>.2);
 assert.equal(b.player.hp,100);assert.equal(b.enemy.hp,100);assert.equal(b.player.shield,0);assert.ok(b.player.rest.some(x=>x.uid==='stone'));
});
test('four or less HP dies outside battle and settles kills without inventing another encounter',()=>{
 for(const hp of [1,4]){
  const h=harness(hp),before=A.copy(h.user().run.encounterResults||[]);h.send('2','fatal-once');
  assert.equal(h.user().run,null);assert.equal(h.user().lastRun.reason,'defeat');assert.equal(h.user().lastRun.wins,1);
  assert.ok(h.user().lastRun.encounterResults.every(x=>x.stage<=1));const after=A.copy(h.store.getState());h.reopen();h.send('2','fatal-once');assert.deepEqual(h.store.getState(),after);
 }
 const h=harness(5);h.send('2');assert.equal(h.user().run.hp,1);assert.equal(h.user().run.pending.kind,'event');
});
