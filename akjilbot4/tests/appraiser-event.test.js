const test=require('node:test'),assert=require('node:assert/strict'),A=require('../../악질봇4.0.0.js');
const title='⚔️ 이벤트 – 떠돌이 감정사 ⚔️',outro='두더지는 털어 낸 흙도 소중하게 챙깁니다.';
function harness({hp=40,gold=10,wins=1,limited=false}={}){
 const c=A.copy(A.catalog),files={},io={list:()=>Object.keys(files),read:n=>files[n],writeNewDurable(n,v){files[n]=v;}};let store,app,n=0;
 function open(){store=A.Store.create(io);store.load(A.newState(42));app=A.App.create(store,c);}open();
 const send=(text,id)=>app.handle({text,identity:'appraiser-user',name:'감정 테스터',room:'개발123',now:1000+(++n),eventId:id||'appraiser-'+n});
 const user=()=>Object.values(store.getState().users)[0],mutate=fn=>store.transact('appraiser-fixture',s=>fn(Object.values(s.users)[0],s));
 send('+탐험');send('1');mutate((u,s)=>{const r=u.run;r.wins=wins;r.hp=hp;r.maxHp=60;r.gold=gold;r.phase='REWARD';r.battle=null;r.enemySpec=null;r.enemyId=null;r.turnToken=null;r.pending=null;r.queue=['event','tavern'];if(limited){const low=Object.keys(c.treasures).filter(id=>{const t=c.treasures[id];return t.tier==='low'&&!t.classId&&!Object.values(r.treasures).includes(id)&&!t.retired;}).slice(0,limited);for(const id of Object.keys(c.treasures))if(!low.includes(id))c.treasures[id].retired=true;}let calls=0;A.Journey.next(s,u,c,()=>calls++===1?.45:0);});
 return {c,get store(){return store;},send,user,mutate,reopen(){store.close();open();}};
}
test('appraiser shows two distinct eligible low treasures and standard menu spacing in region one',()=>{
 for(const wins of [1,8]){
  const h=harness({wins}),p=h.user().run.pending,ids=p.extra.treasureCandidates;
  assert.equal(p.extra.event.id,'wandering_appraiser');assert.equal(ids.length,2);assert.notEqual(ids[0],ids[1]);
  for(const id of ids){const t=h.c.treasures[id];assert.equal(t.tier,'low');assert.ok(!t.retired);assert.ok(!t.classId||t.classId===h.user().run.hero.id);assert.ok(!Object.values(h.user().run.treasures).includes(id));}
  const text=h.send('+탐험');assert.ok(text.startsWith(title+'\n\n두더지가 천 보따리를 펼칩니다.\n“흙을 털었으니 새 물건이나 마찬가지죠.”\n\n1. 하나 고른다: 4골드를 잃습니다. '));for(const id of ids)assert.ok(text.includes(h.c.treasures[id].name));assert.match(text,/\n\n2\. 다른 것을 고른다: 6골드/);assert.match(text,/\n\n3\. 다른 보따리: 체력을 2 잃고/);assert.match(text,/\n\n4\. 흙만 털어 준다: 떠납니다\./);
 }
 assert.equal(harness({wins:9}).user().run.pending.extra,null);
});
test('both purchases spend the stated run gold and grant the exact displayed passive without replacing slots',()=>{
 for(const index of [1,2]){
  const h=harness(),coins=h.user().gold;h.mutate(u=>{u.run.pending.extra.treasureCandidates[index-1]='lucky_shovel';});
  const old=A.copy(h.user().run.treasures),output=h.send(String(index),'buy-once'),r=h.user().run,cost=index===1?4:6;
  assert.equal(A.UI.messages(output)[0],title+'\n\n'+outro+'\n\n골드를 '+cost+' 잃었습니다.\n[✨] 행운의 삽을 획득했습니다.');
  assert.equal(r.gold,10-cost);assert.equal(h.user().gold,coins);assert.equal(r.hp,40);assert.ok(Object.values(r.treasures).includes('lucky_shovel'));for(const slot of Object.keys(old))assert.equal(r.treasures[slot],old[slot]);assert.equal(r.pending.kind,'tavern');
  const after=A.copy(h.store.getState());h.reopen();assert.equal(h.send(String(index),'buy-once'),output);assert.deepEqual(h.store.getState(),after);
 }
});
test('card treasure purchase adds a slotted card to the exploration deck',()=>{
 const h=harness(),id=Object.keys(h.c.treasures).find(id=>{const t=h.c.treasures[id];return t.kind==='card'&&t.tier==='low'&&!t.classId&&!t.retired;});
 h.mutate(u=>{u.run.pending.extra.treasureCandidates[0]=id;});h.send('1');const r=h.user().run,slot=Object.keys(r.treasures).find(k=>r.treasures[k]===id);assert.ok(slot);assert.ok(r.deck.some(x=>x.cardId===h.c.treasures[id].cardId&&x.treasureSlot===slot));
});
test('rerolls cost 2, 6 and 10 HP and replace both candidates with a saved new token',()=>{
 const h=harness(),coins=h.user().gold;let old=A.copy(h.user().run.pending),expectedHp=40;
 for(const cost of [2,6,10]){
  const output=h.send('3'),p=h.user().run.pending;expectedHp-=cost;
  assert.equal(h.user().run.hp,expectedHp);assert.equal(h.user().run.gold,10);assert.equal(h.user().gold,coins);assert.notEqual(p.id,old.id);
  assert.ok(p.extra.treasureCandidates.every(id=>!old.extra.treasureCandidates.includes(id)));assert.notEqual(p.extra.treasureCandidates[0],p.extra.treasureCandidates[1]);
  assert.ok(output.startsWith(title+'\n\n두더지의 보따리를 살펴봅니다.\n\n체력을 '+cost+' 잃었습니다.\n하급 보물 후보 2개를 교체했습니다.\n\n1.'));
  assert.ok(output.includes('3. 다른 보따리: 체력을 '+(cost+4)+' 잃고'));
  const rng=h.store.getState().rngState;h.reopen();assert.equal(h.send('+탐험'),output);assert.deepEqual(h.user().run.pending,p);assert.equal(h.store.getState().rngState,rng);old=A.copy(p);
 }
});
test('replaying a reroll cannot charge HP or increase the next price twice; stale tokens cannot buy',()=>{
 const h=harness(),old=h.user().run.pending.id,output=h.send('3','reroll-once'),after=A.copy(h.store.getState());
 h.reopen();assert.equal(h.send('3','reroll-once'),output);assert.deepEqual(h.store.getState(),after);assert.throws(()=>h.send('+선택 '+old+' 1'),/이전 화면/);assert.deepEqual(h.store.getState(),after);
});
test('insufficient run gold and too few replacement treasures leave the whole state unchanged',()=>{
 for(const index of [1,2]){const h=harness({gold:index===1?3:5}),before=A.copy(h.store.getState());assert.throws(()=>h.send(String(index)),/골드가 부족/);assert.deepEqual(h.store.getState(),before);}
 const h=harness({limited:3}),before=A.copy(h.store.getState());assert.equal(h.user().run.pending.extra.event.id,'wandering_appraiser');assert.throws(()=>h.send('3'),/후보가 부족/);assert.deepEqual(h.store.getState(),before);
 assert.notEqual(harness({limited:1}).user().run.pending.extra.event.id,'wandering_appraiser');
});
test('leaving adds no treasure and changes neither gold nor HP',()=>{
 const h=harness(),before=A.copy(h.user().run);h.send('4');const r=h.user().run;
 assert.equal(r.gold,before.gold);assert.equal(r.hp,before.hp);assert.deepEqual(r.treasures,before.treasures);assert.deepEqual(r.deck,before.deck);assert.equal(r.pending.kind,'tavern');
});
test('paying lethal reroll HP ends the exploration once and settles existing kills',()=>{
 for(const hp of [1,2,8]){
  const h=harness({hp});if(hp===8)h.send('3');h.send('3','fatal-reroll');assert.equal(h.user().run,null);assert.equal(h.user().lastRun.reason,'defeat');assert.equal(h.user().lastRun.wins,1);assert.ok(h.user().lastRun.encounterResults.every(x=>x.stage<=1));
  const after=A.copy(h.store.getState());h.reopen();h.send('3','fatal-reroll');assert.deepEqual(h.store.getState(),after);
 }
});
