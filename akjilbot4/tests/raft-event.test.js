const test=require('node:test'),assert=require('node:assert/strict'),A=require('../../악질봇4.0.0.js');
const title='⚔️ 이벤트 – 뗏목을 빌려 드립니다 ⚔️',rowing='event:rowing';
function harness({hp=40,gold=5,wins=1}={}){
 const c=A.copy(A.catalog),files={},io={list:()=>Object.keys(files),read:n=>files[n],writeNewDurable(n,v){files[n]=v;}};let store,app,n=0;
 function open(){store=A.Store.create(io);store.load(A.newState(42));app=A.App.create(store,c);}open();
 const send=(text,id)=>app.handle({text,identity:'raft-user',name:'뗏목 테스터',room:'개발123',now:1000+(++n),eventId:id||'raft-'+n});
 const user=()=>Object.values(store.getState().users)[0],mutate=fn=>store.transact('raft-fixture',s=>fn(Object.values(s.users)[0],s));
 send('+탐험');send('1');mutate((u,s)=>{const r=u.run;r.wins=wins;r.hp=hp;r.maxHp=60;r.gold=gold;r.phase='REWARD';r.battle=null;r.enemySpec=null;r.enemyId=null;r.turnToken=null;r.pending=null;r.queue=['event','tavern'];let calls=0;A.Journey.next(s,u,c,()=>calls++===1?.999:0);});
 return {c,get store(){return store;},send,user,mutate,reopen(){store.close();open();}};
}
test('raft event belongs to region one and uses standard event spacing',()=>{
 for(const wins of [1,8]){
  const h=harness({wins});assert.equal(h.user().run.pending.extra.event.id,'raft_rental');
  assert.equal(h.send('+탐험'),title+'\n\n물에 뜨지도 않는 뗏목 옆에서 노인이 표를 팝니다.\n“돌아오는 길에는 뜹니다. 늘 그랬어요.”\n\n1. 노를 빌린다: 2골드를 잃습니다. 덱에 [🍃] 노 젓기를 추가합니다.\n\n2. 뗏목을 고친다: 체력 10을 잃고 하급 보물을 얻습니다.\n\n3. 물만 마신다: 체력을 5 회복합니다.');
 }
 assert.equal(harness({wins:9}).user().run.pending.extra,null);
});
test('renting an oar adds its basic card, spends two run gold and logs the card first',()=>{
 const h=harness(),coins=h.user().gold,len=h.user().run.deck.length;
 const output=h.send('1','oar-once');assert.equal(A.UI.messages(output)[0],title+'\n\n뗏목과 노를 살펴봅니다.\n\n[🍃] 노 젓기를 덱에 추가했습니다.\n골드를 2 잃었습니다.');
 assert.equal(h.user().run.gold,3);assert.equal(h.user().gold,coins);assert.equal(h.user().run.hp,40);assert.equal(h.user().run.deck.length,len+1);assert.equal(h.user().run.deck.at(-1).cardId,rowing);assert.equal(h.user().run.deck.at(-1).upgraded,false);
 const after=A.copy(h.store.getState());h.reopen();assert.equal(h.send('1','oar-once'),output);assert.deepEqual(h.store.getState(),after);
});
test('insufficient gold leaves the complete oar selection and RNG unchanged',()=>{
 for(const gold of [0,1]){const h=harness({gold}),before=A.copy(h.store.getState());assert.throws(()=>h.send('1'),/골드가 부족/);assert.deepEqual(h.store.getState(),before);}
});
test('repair grants an additional low treasure and loses ten HP with the requested log order',()=>{
 const h=harness();for(const id of Object.keys(h.c.treasures))if(id!=='lucky_shovel')h.c.treasures[id].retired=true;
 const before=A.copy(h.user().run.treasures),coins=h.user().gold,output=h.send('2','repair-once');
 assert.equal(A.UI.messages(output)[0],title+'\n\n돌아보니 뗏목이 정말 조금 떠 있습니다.\n\n[✨] 행운의 삽을 획득했습니다.\n체력을 10 잃었습니다.');
 assert.equal(h.user().run.hp,30);assert.equal(h.user().run.gold,5);assert.equal(h.user().gold,coins);assert.ok(Object.values(h.user().run.treasures).includes('lucky_shovel'));for(const key of Object.keys(before))assert.equal(h.user().run.treasures[key],before[key]);
 const after=A.copy(h.store.getState());h.reopen();assert.equal(h.send('2','repair-once'),output);assert.deepEqual(h.store.getState(),after);
});
test('repair with no available low treasure does not consume HP',()=>{
 const h=harness();for(const id of Object.keys(h.c.treasures))h.c.treasures[id].retired=true;const before=A.copy(h.store.getState());assert.throws(()=>h.send('2'),/하급 보물/);assert.deepEqual(h.store.getState(),before);
});
test('water heals five capped at maximum HP and gives the exact result',()=>{
 for(const hp of [40,59]){const h=harness({hp}),before=A.copy(h.user().run);
 assert.equal(A.UI.messages(h.send('3'))[0],title+'\n\n갈증이 조금 가십니다.\n\n체력을 5 회복했습니다.');assert.equal(h.user().run.hp,Math.min(60,hp+5));assert.equal(h.user().run.gold,before.gold);assert.deepEqual(h.user().run.deck,before.deck);}
});
test('lethal repair HP settles existing kills without recording a new battle defeat',()=>{
 for(const hp of [1,10]){const h=harness({hp});h.send('2','fatal-repair');assert.equal(h.user().run,null);assert.equal(h.user().lastRun.reason,'defeat');assert.equal(h.user().lastRun.wins,1);assert.ok(h.user().lastRun.encounterResults.every(x=>x.stage<=1));
 const after=A.copy(h.store.getState());h.reopen();h.send('2','fatal-repair');assert.deepEqual(h.store.getState(),after);}
 const h=harness({hp:11});h.send('2');assert.equal(h.user().run.hp,1);
});
test('rowing at both ranks dredges only the bottom three, preserves physical duplicate choices and does not draw',()=>{
 for(const upgraded of [false,true]){
  const c=A.copy(A.catalog);c.cards.blank={name:'빈 카드',element:'NEUTRAL',cost:0,effects:[]};
  let b=A.Battle.create({name:'나',maxHp:100,deck:[]},{name:'적',maxHp:100,deck:[]},c,()=>.2);
  b.enemyPlan=[];b.enemyPowerPlan=false;b.player.hand=[{uid:'oar',cardId:rowing,upgraded}];b.player.deck=['top','bottom-a','bottom-b','bottom-c'].map(uid=>({uid,cardId:'blank',upgraded:false}));
  const d=A.Battle.describeCard(b.player.hand[0],c);assert.equal(d.cost,0);assert.equal(d.element,'NATURE');
  A.Battle.submit(b,['oar'],c,()=>.2);assert.equal(b.pendingChoice.kind,'choice');assert.equal(b.pendingChoice.discover,false);assert.deepEqual(b.pendingChoice.options.map(x=>x.uid),['bottom-a','bottom-b','bottom-c']);
  const selected=b.pendingChoice.options[1].uid;b=JSON.parse(JSON.stringify(b));A.Battle.choose(b,1,c,()=>.2);
  assert.equal(b.player.deck[0].uid,selected);assert.equal(b.player.deck.length,4);assert.equal(b.player.hand.length,0);assert.equal(b.player.shield,upgraded?12:8);assert.ok(b.player.rest.some(x=>x.uid==='oar'));
 }
});
test('rowing handles empty and short decks and stays event-only and upgradeable',()=>{
 for(const count of [0,1,2]){
  const c=A.copy(A.catalog);c.cards.blank={name:'빈 카드',element:'NEUTRAL',cost:0,effects:[]};
  const b=A.Battle.create({name:'나',maxHp:100,deck:[]},{name:'적',maxHp:100,deck:[]},c,()=>.2);b.enemyPlan=[];b.enemyPowerPlan=false;b.player.hand=[{uid:'oar',cardId:rowing,upgraded:false}];b.player.deck=Array.from({length:count},(_,i)=>({uid:'bottom-'+i,cardId:'blank',upgraded:false}));
  A.Battle.submit(b,['oar'],c,()=>.2);if(count){assert.equal(b.pendingChoice.options.length,count);A.Battle.choose(b,0,c,()=>.2);}else assert.ok(!b.pendingChoice);assert.equal(b.player.shield,8);
 }
 assert.ok(A.catalog.cards[rowing].upgrade);assert.ok(!A.catalog.cardPool.includes(rowing));for(const h of A.catalog.heroes)assert.ok(!h.classPool.includes(rowing));assert.match(A.UI.render(null,{kind:'encyclopedia',query:'노 젓기'},A.catalog,0),/노 젓기\+.*💧0/);
});
