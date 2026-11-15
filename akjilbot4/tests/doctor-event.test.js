const offerEvent=require('./event-fixture.js');
const test=require('node:test'),assert=require('node:assert/strict'),A=require('../../악질봇4.0.0.js');
const title='⚔️ 이벤트 – 의사 키노피오 ⚔️',outro='키노피오가 처방전을 접어 줍니다. 글씨는 읽을 수 없습니다.';
function harness({hp=20,gold=5,curse=false,wins=1,roll=.4}={}){
 const c=A.copy(A.catalog),files={},io={list:()=>Object.keys(files),read:n=>files[n],writeNewDurable(n,v){files[n]=v;}};let store,app,n=0;
 function open(){store=A.Store.create(io);store.load(A.newState(42));app=A.App.create(store,c);}open();
 const send=(text,id)=>app.handle({text,identity:'doctor-user',name:'진료 테스터',room:'개발123',now:1000+(++n),eventId:id||'doctor-'+n});
 const user=()=>Object.values(store.getState().users)[0],mutate=fn=>store.transact('doctor-fixture',s=>fn(Object.values(s.users)[0],s));
 send('+탐험');send('1');mutate((u,s)=>{const r=u.run;r.wins=wins;r.hp=hp;r.maxHp=60;r.gold=gold;r.phase='REWARD';r.battle=null;r.enemySpec=null;r.enemyId=null;r.turnToken=null;r.pending=null;r.queue=['event','tavern'];if(curse)r.deck.push({uid:'stone-one',cardId:'event:stone',upgraded:false},{uid:'stone-two',cardId:'event:stone',upgraded:false});offerEvent(A,s,u,c,'doctor_kinopio');});
 return {c,get store(){return store;},send,user,mutate,reopen(){store.close();open();}};
}
test('doctor eligibility is curse OR HP at most 30, and is restricted to region one',()=>{
 for(const hp of [1,30])assert.equal(harness({hp}).user().run.pending.extra.event.id,'doctor_kinopio');
 assert.notEqual(harness({hp:31}).user().run.pending.extra.event.id,'doctor_kinopio');
 assert.equal(harness({hp:60,curse:true}).user().run.pending.extra.event.id,'doctor_kinopio');
 assert.equal(harness({hp:60,curse:true,wins:8}).user().run.pending.extra.event.id,'doctor_kinopio');
 assert.equal(harness({hp:20,curse:true,wins:9}).user().run.pending.extra,null);
});
test('doctor menu follows event spacing, stores the actual curse, and hides removal without curses',()=>{
 const h=harness({curse:true});
 assert.equal(h.send('+탐험'),title+'\n\n버섯 갓 아래에서 작은 안경이 번쩍입니다.\n“얼굴이 안 좋네요. 얼굴이 원래 그런 건 아니죠?”\n\n1. 상처를 보여 준다: 체력을 12 회복합니다.\n\n2. 약값을 낸다: 3골드로 체력을 20 회복합니다.\n\n3. 아픈 기억을 보여 준다: [💔] 돌을 덱에서 제거합니다.');
 const no=harness();assert.equal(no.user().run.pending.options.length,2);assert.doesNotMatch(no.send('+탐험'),/아픈 기억/);const before=A.copy(no.store.getState());assert.throws(()=>no.send('3'),/선택 번호/);assert.deepEqual(no.store.getState(),before);
});
test('free treatment heals 12 with the exact simple result and preserves both currencies',()=>{
 const h=harness(),coins=h.user().gold,deck=A.copy(h.user().run.deck),output=A.UI.messages(h.send('1'));
 assert.equal(output[0],title+'\n\n'+outro+'\n\n체력을 12 회복했습니다.');assert.match(output[1],/선술집/);assert.equal(h.user().run.hp,32);assert.equal(h.user().run.gold,5);assert.equal(h.user().gold,coins);assert.deepEqual(h.user().run.deck,deck);
});
test('paid treatment spends three run gold, heals 20, and caps HP',()=>{
 for(const hp of [20,59]){const h=harness({hp,gold:3,curse:true}),coins=h.user().gold;
 assert.equal(A.UI.messages(h.send('2'))[0],title+'\n\n'+outro+'\n\n골드를 3 잃었습니다.\n체력을 20 회복했습니다.');
 assert.equal(h.user().run.hp,Math.min(60,hp+20));assert.equal(h.user().run.gold,0);assert.equal(h.user().gold,coins);}
});
test('insufficient gold leaves the complete state and candidate unchanged',()=>{
 for(const gold of [0,2]){const h=harness({gold,curse:true}),before=A.copy(h.store.getState());assert.throws(()=>h.send('2'),/골드가 부족/);assert.deepEqual(h.store.getState(),before);}
});
test('memory removes only the saved physical curse and heals six once across receipt replay',()=>{
 const h=harness({curse:true}),p=A.copy(h.user().run.pending),len=h.user().run.deck.length,rng=h.store.getState().rngState;
 h.reopen();h.send('+탐험');assert.deepEqual(h.user().run.pending,p);assert.equal(h.store.getState().rngState,rng);
 const output=h.send('3','memory-once');
 assert.equal(A.UI.messages(output)[0],title+'\n\n'+outro+'\n\n[💔] 돌을 덱에서 제거했습니다.\n체력을 6 회복했습니다.');
 assert.equal(h.user().run.hp,26);assert.equal(h.user().run.deck.length,len-1);assert.ok(!h.user().run.deck.some(x=>x.uid===p.extra.removalCandidate.uid));assert.equal(h.user().run.deck.filter(x=>x.cardId==='event:stone').length,1);
 const after=A.copy(h.store.getState());h.reopen();assert.equal(h.send('3','memory-once'),output);assert.deepEqual(h.store.getState(),after);assert.throws(()=>h.send('+선택 '+p.id+' 3'),/이전 화면/);
});
test('stale or changed curse candidates cannot delete a normal card or heal',()=>{
 const h=harness({curse:true});h.mutate(u=>{const uid=u.run.pending.extra.removalCandidate.uid;u.run.deck.find(x=>x.uid===uid).cardId='class:guff_willow';});
 const before=A.copy(h.store.getState());assert.throws(()=>h.send('3'),/제거할 저주/);assert.deepEqual(h.store.getState(),before);
});
test('doctor eligibility does not bypass the existing 20 percent event roll',()=>{
 const h=harness({curse:true});h.mutate((u,s)=>{u.run.pending=null;u.run.queue=['event','tavern'];A.Journey.next(s,u,h.c,()=>.2);});assert.equal(h.user().run.pending.kind,'tavern');
});
