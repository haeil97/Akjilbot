const test=require('node:test'),assert=require('node:assert/strict'),A=require('../../악질봇4.0.0.js');
const title='⚔️ 이벤트 – 숲의 분실물함 ⚔️',outro='상자는 새 주인을 찾은 듯 잠잠해집니다.';
const named=name=>Object.keys(A.catalog.treasures).find(id=>A.catalog.treasures[id].name===name),oldId=named('재활용 쓰레기통'),prism=named('프리즘 증류기');
function harness({held=oldId,wins=1,starting=false,second=false}={}){
 const c=A.copy(A.catalog),files={},io={list:()=>Object.keys(files),read:n=>files[n],writeNewDurable(n,v){files[n]=v;}};let store,app,n=0;
 function open(){store=A.Store.create(io);store.load(A.newState(42));app=A.App.create(store,c);}open();
 const send=(text,id)=>app.handle({text,identity:'lost-user',name:'분실물 테스터',room:'개발123',now:1000+(++n),eventId:id||'lost-'+n});
 const user=()=>Object.values(store.getState().users)[0],mutate=fn=>store.transact('lost-fixture',s=>fn(Object.values(s.users)[0],s));
 send('+탐험');send('1');mutate((u,s)=>{const r=u.run;r.wins=wins;r.hp=40;r.maxHp=60;r.gold=5;r.phase='REWARD';r.battle=null;r.enemySpec=null;r.enemyId=null;r.turnToken=null;r.pending=null;r.queue=['event','tavern'];r.treasures={};
 if(held){r.treasures.low=held;const t=c.treasures[held];if(t.kind==='card')r.deck.push({uid:'old-card',cardId:t.cardId,upgraded:false,treasureSlot:'low'});}
 if(starting)r.hero.startingTreasureId=held;
 if(second)r.treasures.other=oldId;
 let calls=0;A.Journey.next(s,u,c,()=>calls++===1?.85:0);});
 function onlyHigh(id){for(const key of Object.keys(c.treasures))if(c.treasures[key].tier==='high')c.treasures[key].retired=key!==id;}
 return {c,get store(){return store;},send,user,mutate,onlyHigh,reopen(){store.close();open();}};
}
test('lost-and-found needs an owned general low treasure in region one, excluding class and starting treasures',()=>{
 assert.equal(harness().user().run.pending.extra.event.id,'forest_lost_and_found');
 assert.equal(harness({wins:8}).user().run.pending.extra.event.id,'forest_lost_and_found');
 assert.notEqual(harness({held:null}).user().run.pending.extra.event.id,'forest_lost_and_found');
 assert.notEqual(harness({held:prism}).user().run.pending.extra.event.id,'forest_lost_and_found');
 const classLow=Object.keys(A.catalog.treasures).find(id=>A.catalog.treasures[id].classId==='guff'&&A.catalog.treasures[id].tier==='low');assert.ok(classLow);
 assert.notEqual(harness({held:classLow}).user().run.pending.extra.event.id,'forest_lost_and_found');
 assert.notEqual(harness({starting:true}).user().run.pending.extra.event.id,'forest_lost_and_found');
 assert.equal(harness({wins:9}).user().run.pending.extra,null);
});
test('menu shows a persisted owned treasure with correct event spacing',()=>{
 const h=harness({second:true}),p=A.copy(h.user().run.pending),rng=h.store.getState().rngState;
 assert.equal(h.send('+탐험'),title+'\n\n상자 안에서 작은 종이 울립니다. 뚜껑에는 ‘주인과 닮은 물건만 받아요’라고 쓰여 있습니다.\n\n1. 내 물건을 넣는다: [✨] 재활용 쓰레기통을 덱에서 제거합니다. 무작위 상급 보물을 덱에 추가합니다.\n\n2. 떠난다: 교환하지 않고 떠납니다.');
 h.reopen();h.send('+탐험');assert.deepEqual(h.user().run.pending,p);assert.equal(h.store.getState().rngState,rng);
});
test('passive exchange grants the high treasure first in the log, removes exactly the saved slot and preserves resources',()=>{
 const h=harness({second:true});h.onlyHigh(prism);const before=A.copy(h.user().run),coins=h.user().gold,output=h.send('1','exchange-once'),r=h.user().run;
 assert.equal(A.UI.messages(output)[0],title+'\n\n'+outro+'\n\n[💫] 프리즘 증류기 획득했습니다.\n[✨] 재활용 쓰레기통을 잃었습니다.');
 assert.equal(r.treasures.low,prism);assert.equal(r.treasures.other,oldId);assert.equal(r.hp,before.hp);assert.equal(r.gold,before.gold);assert.equal(h.user().gold,coins);assert.deepEqual(r.deck,before.deck);assert.equal(r.pending.kind,'tavern');
 const after=A.copy(h.store.getState());h.reopen();assert.equal(h.send('1','exchange-once'),output);assert.deepEqual(h.store.getState(),after);
});
test('card and passive treasures exchange in all combinations without leaving stale cards in the deck',()=>{
 const lowCard=Object.keys(A.catalog.treasures).find(id=>{const t=A.catalog.treasures[id];return t.tier==='low'&&t.kind==='card'&&!t.classId&&!t.retired;});
 const highCard=Object.keys(A.catalog.treasures).find(id=>{const t=A.catalog.treasures[id];return t.tier==='high'&&t.kind==='card'&&!t.classId&&!t.retired;});
 for(const low of [oldId,lowCard])for(const high of [prism,highCard]){
  const h=harness({held:low}),before=A.copy(h.user().run.deck.filter(x=>x.treasureSlot!=='low'));h.onlyHigh(high);h.send('1');const r=h.user().run,t=h.c.treasures[high],slotted=r.deck.filter(x=>x.treasureSlot==='low');
  assert.equal(r.treasures.low,high);assert.ok(!r.deck.some(x=>x.uid==='old-card'));assert.deepEqual(r.deck.filter(x=>x.treasureSlot!=='low'),before);
  assert.equal(slotted.length,t.kind==='card'?1:0);if(t.kind==='card'){assert.equal(slotted[0].cardId,t.cardId);assert.equal(slotted[0].upgraded,false);}
 }
});
test('an unavailable offered treasure or exhausted high pool rejects atomically without losing anything',()=>{
 const h=harness();h.mutate(u=>{u.run.treasures.low=prism;});let before=A.copy(h.store.getState());assert.throws(()=>h.send('1'),/교환할 일반 하급 보물/);assert.deepEqual(h.store.getState(),before);
 const no=harness();no.onlyHigh(null);before=A.copy(no.store.getState());assert.throws(()=>no.send('1'),/획득할 상급 보물/);assert.deepEqual(no.store.getState(),before);
});
test('leaving shows only the outro and changes no treasures, cards, HP or currency',()=>{
 const h=harness(),before=A.copy(h.user().run),output=h.send('2','leave-once'),r=h.user().run;
 assert.equal(A.UI.messages(output)[0],title+'\n\n'+outro);assert.deepEqual(r.treasures,before.treasures);assert.deepEqual(r.deck,before.deck);assert.equal(r.hp,before.hp);assert.equal(r.gold,before.gold);
 const after=A.copy(h.store.getState());h.reopen();assert.equal(h.send('2','leave-once'),output);assert.deepEqual(h.store.getState(),after);
});
