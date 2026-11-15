const test=require('node:test'),assert=require('node:assert/strict'),A=require('../../악질봇4.0.0.js');
const title='⚔️ 이벤트 - 오늘의 수프 ⚔️',outro='요리사는 빈 그릇을 보고서야 자기 몫을 뜹니다.';
function harness(wins=1,hp=20,gold=5){
 const c=A.copy(A.catalog),files={},io={list:()=>Object.keys(files),read:n=>files[n],writeNewDurable(n,v){files[n]=v;}};let store,app,n=0;
 function open(){store=A.Store.create(io);store.load(A.newState(42));app=A.App.create(store,c);}open();
 function send(text,eventId){return app.handle({text,identity:'soup-user',name:'수프 테스터',room:'개발123',now:1000+n,eventId:eventId||'soup-'+(++n)});}
 function user(){return Object.values(store.getState().users)[0];}
 function mutate(fn){store.transact('arrange-soup',s=>fn(Object.values(s.users)[0],s));}
 send('+탐험');send('1');mutate((u,s)=>{const r=u.run;r.wins=wins;r.hp=hp;r.gold=gold;r.phase='REWARD';r.battle=null;r.enemySpec=null;r.enemyId=null;r.turnToken=null;r.pending=null;r.queue=['event','tavern'];A.Journey.next(s,u,c,()=>0);});
 return {c,get store(){return store;},send,user,mutate,reopen(){store.close();open();}};
}
test('Elwynn event presents the exact story and three soup choices',()=>{
 const h=harness();assert.equal(h.send('+탐험'),title+'\n\n나무 그루터기 위에서 솥 세 개가 끓고 있습니다. 요리사는 국자를 든 채 당신을 기다립니다.\n당신의 배가 꼬르륵거립니다...\n\n1. 맑은 수프: 체력을 6 회복합니다.\n\n2. 뿌리 수프: 골드를 2 잃습니다. 체력을 12 회복합니다.\n\n3. 걸쭉한 수프: 내 직업의 무작위 카드를 내 덱에 추가합니다. 체력을 10 회복합니다.');
});
test('clear soup heals six, logs before and after HP, and then presents the tavern',()=>{
 const h=harness(),coins=h.user().gold,deck=A.copy(h.user().run.deck),messages=A.UI.messages(h.send('1'));
 assert.equal(messages[0],title+'\n\n'+outro+'\n\n체력을 6 회복했습니다. (20/60) → (26/60)');assert.match(messages[1],/선술집/);assert.equal(h.user().run.pending.kind,'tavern');assert.equal(h.user().run.hp,26);assert.equal(h.user().run.gold,5);assert.equal(h.user().gold,coins);assert.deepEqual(h.user().run.deck,deck);
});
test('root soup loses only exploration gold and logs the twelve-point heal',()=>{
 const h=harness(),coins=h.user().gold,messages=A.UI.messages(h.send('2'));
 assert.equal(messages[0],title+'\n\n'+outro+'\n\n골드를 2 잃었습니다. 5 → 3\n체력을 12 회복했습니다. (20/60) → (32/60)');assert.equal(h.user().run.gold,3);assert.equal(h.user().run.hp,32);assert.equal(h.user().gold,coins);
});
test('thick soup adds one unupgraded class card and logs its element without cost or description',()=>{
 const h=harness();h.c.heroes[0].classPool=['class:guff_willow'];const before=h.user().run.deck.length,messages=A.UI.messages(h.send('3'));
 assert.equal(messages[0],title+'\n\n'+outro+'\n\n[🍃] 버드나무를 내 덱에 추가했습니다.\n체력을 10 회복했습니다. (20/60) → (30/60)');assert.equal(h.user().run.deck.length,before+1);const card=h.user().run.deck.at(-1);assert.equal(card.cardId,'class:guff_willow');assert.equal(card.upgraded,false);assert.equal(h.user().run.gold,5);
});
test('all healing choices cap HP and record the actual before and after values',()=>{
 for(const choice of [1,2,3]){const h=harness(1,59);const messages=A.UI.messages(h.send(String(choice)));assert.equal(h.user().run.hp,60);assert.match(messages[0],/\(59\/60\) → \(60\/60\)/);}
});
test('root soup cannot be selected without two gold and does not mutate the saved event or RNG',()=>{
 for(const gold of [0,1]){const h=harness(1,20,gold),before=A.copy(h.store.getState());assert.throws(()=>h.send('2'),/골드가 부족/);assert.deepEqual(h.store.getState(),before);assert.equal(h.user().run.pending.kind,'event');}
 const h=harness(1,20,2);h.send('2');assert.equal(h.user().run.gold,0);
});
test('event and random-card result survive durable reopen and receipt replay without double rewards',()=>{
 const h=harness(),before=A.copy(h.user().run.pending),rng=h.store.getState().rngState;h.reopen();assert.deepEqual(h.user().run.pending,before);h.send('+탐험');assert.equal(h.store.getState().rngState,rng);
 const token=h.user().run.pending.id,output=h.send('3','same-soup-input'),after=A.copy(h.store.getState());h.reopen();assert.equal(h.send('3','same-soup-input'),output);assert.deepEqual(h.store.getState(),after);assert.throws(()=>h.send('+선택 '+token+' 3'),/이전 화면/);assert.deepEqual(h.store.getState(),after);
});
test('soup is scoped to all eight first-region event steps, including the boss reward; other regions keep placeholders',()=>{
 for(const wins of [1,7,8]){const h=harness(wins);assert.equal(h.user().run.pending.extra.event.id,'today_soup');}
 for(const wins of [9,16,17,24,25,32]){const h=harness(wins);assert.deepEqual(h.user().run.pending.options,['continue']);assert.equal(h.user().run.pending.extra,null);}
});
test('legacy event placeholders remain usable and invalid choices do not consume the soup',()=>{
 const h=harness();const before=A.copy(h.store.getState());assert.throws(()=>h.send('4'),/선택 번호/);assert.deepEqual(h.store.getState(),before);
 h.mutate((u,s)=>{delete u.run.regionVersion;u.run.queue=['event','tavern'];A.Journey.next(s,u,h.c,A.random(s));});assert.deepEqual(h.user().run.pending.options,['continue']);h.send('1');assert.equal(h.user().run.pending.kind,'tavern');assert.equal(h.user().run.hp,20);
});
