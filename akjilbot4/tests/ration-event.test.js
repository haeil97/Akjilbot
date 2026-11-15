const test=require('node:test'),assert=require('node:assert/strict'),A=require('../../악질봇4.0.0.js');
const food='event:emergency_ration',title='⚔️ 이벤트 - 비상식량 검사 ⚔️',outro='도장은 도토리 모양입니다. 합격인 것 같습니다.';
function harness(deck,gold=5){
 const c=A.copy(A.catalog),files={},io={list:()=>Object.keys(files),read:n=>files[n],writeNewDurable(n,v){files[n]=v;}};let store,app,n=0;
 function open(){store=A.Store.create(io);store.load(A.newState(42));app=A.App.create(store,c);}open();
 const send=(text,id)=>app.handle({text,identity:'ration-user',name:'가방 테스터',room:'개발123',now:1000+n,eventId:id||'ration-'+(++n)});
 const user=()=>Object.values(store.getState().users)[0],mutate=fn=>store.transact('ration-fixture',s=>fn(Object.values(s.users)[0],s));
 send('+탐험');send('1');mutate((u,s)=>{const r=u.run;r.wins=1;r.hp=20;r.gold=gold;r.phase='REWARD';r.battle=null;r.enemySpec=null;r.enemyId=null;r.turnToken=null;r.pending=null;r.queue=['event','tavern'];r.deck=A.copy(deck||[{uid:'willow',cardId:'class:guff_willow'},{uid:'growth',cardId:'class:guff_growth'},{uid:'wall',cardId:'class:guff_root_wall'}]).map(x=>Object.assign({upgraded:false},x));let calls=0;A.Journey.next(s,u,c,()=>calls++===1?.999:0);});
 return {c,get store(){return store;},send,user,mutate,reopen(){store.close();open();}};
}
test('ration menu shows the stored non-treasure candidate with blank lines and the exact story',()=>{
 const h=harness();assert.equal(h.user().run.pending.extra.event.id,'ration_inspection');assert.equal(h.user().run.pending.extra.removalCandidate.uid,'willow');
 assert.equal(h.send('+탐험'),'⚔️ 이벤트 – 비상식량 검사 ⚔️\n\n다람쥐가 당신의 가방에 작은 도장을 찍습니다.\n “먹을 수 없는 게 너무 많네요. 비상시엔 큰일이에요.”\n\n1. 식량을 받는다: 비상식량을 덱에 추가합니다.\n\n2. 짐을 줄인다: [🍃] 버드나무를 내 덱에서 제거하고 비상식량을 덱에 추가합니다.\n\n3. 짐 검사: 골드를 1 잃습니다. 2번 선택지의 카드가 무작위로 변경됩니다. 이 선택지를 반복할 수 있습니다.');
});
test('taking food adds exactly one ration without removing a card, healing, or spending money',()=>{
 const h=harness(),before=h.user(),output=h.send('1'),messages=A.UI.messages(output),r=h.user().run;
 assert.equal(messages[0],title+'\n\n'+outro+'\n\n[🍃] 비상식량을 덱에 추가했습니다.');assert.match(messages[1],/선술집/);assert.equal(r.deck.length,before.run.deck.length+1);assert.equal(r.deck.at(-1).cardId,food);assert.equal(r.deck.at(-1).upgraded,false);assert.equal(r.hp,20);assert.equal(r.gold,5);assert.equal(h.user().gold,before.gold);
});
test('reducing luggage removes the exact displayed physical card and logs food before removal',()=>{
 const deck=[{uid:'willow',cardId:'class:guff_willow'},{uid:'second-copy',cardId:'class:guff_willow'},{uid:'treasure',cardId:'treasure_wonder_wand',treasureSlot:'low'}],h=harness(deck),messages=A.UI.messages(h.send('2')),r=h.user().run;
 assert.equal(messages[0],title+'\n\n'+outro+'\n\n[🍃] 비상식량을 덱에 추가했습니다.\n[🍃] 버드나무를 덱에서 제거했습니다.');assert.equal(r.deck.length,3);assert.ok(!r.deck.some(x=>x.uid==='willow'));assert.ok(r.deck.some(x=>x.uid==='second-copy'));assert.ok(r.deck.some(x=>x.uid==='treasure'));assert.equal(r.deck.filter(x=>x.cardId===food).length,1);
});
test('inspection repeatedly pays one run gold, changes the candidate and token, and prints the full menu',()=>{
 const h=harness(),coins=h.user().gold;let previous=h.user().run.pending;
 for(let count=1;count<=5;count++){
  const output=h.send('3'),r=h.user().run,current=r.pending;assert.equal(r.gold,5-count);assert.equal(r.hp,20);assert.equal(r.deck.length,3);assert.equal(current.kind,'event');assert.equal(current.extra.event.id,'ration_inspection');assert.notEqual(current.extra.removalCandidate.cardId,previous.extra.removalCandidate.cardId);assert.notEqual(current.id,previous.id);assert.match(output,/다람쥐가 당신의 가방/);assert.match(output,/1\. 식량을 받는다/);assert.doesNotMatch(output,/합격인 것 같습니다|선술집/);assert.equal(h.user().gold,coins);previous=current;
 }
 const before=A.copy(h.store.getState());assert.throws(()=>h.send('3'),/골드가 부족/);assert.deepEqual(h.store.getState(),before);
});
test('inspection excludes all copies of the prior variant and never selects treasures',()=>{
 const h=harness([{uid:'a',cardId:'class:guff_willow'},{uid:'a2',cardId:'class:guff_willow'},{uid:'b',cardId:'class:guff_growth'},{uid:'treasure',cardId:'treasure_wonder_wand'},{uid:'slot',cardId:'class:starter_strike',treasureSlot:'extra'}]);
 h.send('3');assert.equal(h.user().run.pending.extra.removalCandidate.uid,'b');h.send('3');assert.equal(h.user().run.pending.extra.removalCandidate.cardId,'class:guff_willow');
});
test('a deck with no alternative candidate rejects inspection without losing gold or RNG',()=>{
 const h=harness([{uid:'a',cardId:'class:guff_willow'},{uid:'a2',cardId:'class:guff_willow'}]),before=A.copy(h.store.getState());assert.throws(()=>h.send('3'),/다른 카드가 없습니다/);assert.deepEqual(h.store.getState(),before);h.send('1');assert.equal(h.user().run.deck.length,3);
});
test('candidate and paid rechecks survive reopening; duplicate input cannot charge again or remove twice',()=>{
 const h=harness(),original=A.copy(h.user().run.pending),rng=h.store.getState().rngState;h.reopen();h.send('+탐험');assert.deepEqual(h.user().run.pending,original);assert.equal(h.store.getState().rngState,rng);
 const output=h.send('3','same-inspection'),after=A.copy(h.store.getState());h.reopen();assert.equal(h.send('3','same-inspection'),output);assert.deepEqual(h.store.getState(),after);assert.throws(()=>h.send('+선택 '+original.id+' 2'),/이전 화면/);assert.deepEqual(h.store.getState(),after);
 const candidate=A.copy(h.user().run.pending.extra.removalCandidate),result=h.send('2','same-removal'),finished=A.copy(h.store.getState());h.reopen();assert.equal(h.send('2','same-removal'),result);assert.deepEqual(h.store.getState(),finished);assert.ok(!h.user().run.deck.some(x=>x.uid===candidate.uid));assert.equal(h.user().run.deck.filter(x=>x.cardId===food).length,1);
});
test('ration card is event-only, upgradeable, zero-cost and one-use at both ranks',()=>{
 assert.ok(!A.catalog.cardPool.includes(food));for(const hero of A.catalog.heroes)assert.ok(!hero.classPool.includes(food));
 for(const up of [false,true]){
  const c=A.copy(A.catalog);c.cards.blank={name:'빈 카드',element:'NEUTRAL',cost:0,effects:[]};const b=A.Battle.create({name:'나',maxHp:100,deck:[]},{name:'적',maxHp:100,deck:[]},c,()=>.2);b.enemyPlan=[];b.enemyPowerPlan=false;b.player.hand=[{uid:'food',cardId:food,upgraded:up}];b.player.deck=[{uid:'drawn',cardId:'blank'}];
  const desc=A.Battle.describeCard(b.player.hand[0],c);assert.equal(desc.cost,0);assert.equal(desc.excludeOnUse,true);A.Battle.submit(b,['food'],c,()=>.2);assert.equal(b.player.shield,up?8:5);assert.ok(b.player.hand.some(x=>x.uid==='drawn'));assert.ok(b.player.excluded.some(x=>x.uid==='food'));assert.equal(b.player.rest.length,0);
 }
 assert.match(A.UI.render(null,{kind:'encyclopedia',query:'비상식량'},A.catalog,0),/비상식량\+.*💧0/);
});
