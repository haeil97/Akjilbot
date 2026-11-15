const offerEvent=require('./event-fixture.js');
const test=require('node:test'),assert=require('node:assert/strict'),A=require('../../악질봇4.0.0.js');
const title='⚔️ 이벤트 – 까마귀 ⚔️';
function harness({hp=20,wins=1,deck}={}){
 const c=A.copy(A.catalog),files={},io={list:()=>Object.keys(files),read:n=>files[n],writeNewDurable(n,v){files[n]=v;}};let store,app,n=0;
 function open(){store=A.Store.create(io);store.load(A.newState(42));app=A.App.create(store,c);}open();
 const send=(text,id)=>app.handle({text,identity:'crow-user',name:'까마귀 테스터',room:'개발123',now:1000+(++n),eventId:id||'crow-'+n});
 const user=()=>Object.values(store.getState().users)[0],mutate=fn=>store.transact('crow-fixture',s=>fn(Object.values(s.users)[0],s));
 send('+탐험');send('1');mutate((u,s)=>{const r=u.run;r.wins=wins;r.hp=hp;r.maxHp=60;r.gold=5;r.phase='REWARD';r.battle=null;r.enemySpec=null;r.enemyId=null;r.turnToken=null;r.pending=null;r.queue=['event','tavern'];if(deck)r.deck=A.copy(deck).map(x=>Object.assign({upgraded:false},x));offerEvent(A,s,u,c,'knot_crow');});
 return {c,get store(){return store;},send,user,mutate,reopen(){store.close();open();}};
}
test('crow appears in region one with the exact story and standard spacing',()=>{
 for(const wins of [1,8]){const h=harness({wins});assert.equal(h.user().run.pending.extra.event.id,'knot_crow');
 assert.equal(h.send('+탐험'),title+'\n\n까마귀가 꼬인 밧줄을 발로 누릅니다.\n“풀고 싶은 건 여기 놓고 가. 다시 묶는 건 안 해.”\n\n1. 푼다: 덱에서 카드를 발견하여 제거합니다.\n\n2. 그만한다: 체력을 5 회복하고 떠납니다.');}
 assert.equal(harness({wins:9}).user().run.pending.extra,null);
});
test('untie presents three actual cards, changes no resources, and removes only after the card selection',()=>{
 const deck=[{uid:'willow',cardId:'class:guff_willow'},{uid:'growth',cardId:'class:guff_growth'},{uid:'wall',cardId:'class:guff_root_wall'}],h=harness({deck}),before=A.copy(h.user().run),coins=h.user().gold;
 const screen=h.send('1'),p=h.user().run.pending;assert.equal(p.kind,'eventRemove');assert.equal(p.options.length,3);assert.equal(new Set(p.options).size,3);assert.deepEqual(h.user().run.deck,before.deck);assert.equal(h.user().run.hp,before.hp);assert.equal(h.user().run.gold,before.gold);assert.ok(screen.startsWith(title+'\n\n덱에서 제거할 카드를 선택하세요.\n\n1. '));assert.match(screen,/\n\n2\./);assert.match(screen,/\n\n3\./);
 const index=p.options.indexOf('willow')+1,output=A.UI.messages(h.send(String(index)));
 assert.equal(output[0],title+'\n\n까마귀가 매듭을 풀었습니다.\n\n[🍃] 버드나무를 덱에서 제거했습니다.');assert.match(output[1],/선술집/);
 assert.equal(h.user().run.deck.length,2);assert.ok(!h.user().run.deck.some(x=>x.uid==='willow'));assert.equal(h.user().gold,coins);assert.equal(h.user().run.hp,20);assert.equal(h.user().run.gold,5);
});
test('saved discovery survives reopening and receipt replay without rerolling or double removal',()=>{
 const h=harness(),oldToken=h.user().run.pending.id,output=h.send('1','discover-once'),after=A.copy(h.store.getState());
 h.reopen();assert.equal(h.send('1','discover-once'),output);assert.deepEqual(h.store.getState(),after);assert.equal(h.send('+탐험'),output);assert.throws(()=>h.send('+선택 '+oldToken+' 1'),/이전 화면/);
 const selected=h.user().run.pending.options[0],done=h.send('1','remove-once'),finished=A.copy(h.store.getState());h.reopen();assert.equal(h.send('1','remove-once'),done);assert.deepEqual(h.store.getState(),finished);assert.ok(!h.user().run.deck.some(x=>x.uid===selected));
});
test('short decks show one or two options and empty eligible decks reject untie while healing remains usable',()=>{
 for(const count of [1,2]){const h=harness({deck:Array.from({length:count},(_,i)=>({uid:'copy-'+i,cardId:'class:guff_willow'}))});h.send('1');assert.equal(h.user().run.pending.options.length,count);h.send('1');assert.equal(h.user().run.deck.length,count-1);}
 const h=harness({deck:[]}),before=A.copy(h.store.getState());assert.throws(()=>h.send('1'),/제거할 수 있는 카드가 없습니다/);assert.deepEqual(h.store.getState(),before);h.send('2');assert.equal(h.user().run.hp,25);
});
test('discovery includes curses and upgrades, excludes treasures, and distinguishes physical duplicate cards',()=>{
 const deck=[{uid:'copy1',cardId:'class:guff_willow',upgraded:true},{uid:'copy2',cardId:'class:guff_willow',upgraded:true},{uid:'curse',cardId:'event:stone'},{uid:'treasure',cardId:'treasure_wonder_wand',treasureSlot:'extra'}],h=harness({deck});
 const screen=h.send('1'),p=h.user().run.pending;assert.equal(p.options.length,3);assert.ok(!p.options.includes('treasure'));assert.ok(p.options.includes('curse'));assert.ok(screen.includes('버드나무+'));assert.ok(screen.includes('[💔] 돌'));
 const index=p.options.indexOf('copy1')+1;h.send(String(index));assert.ok(!h.user().run.deck.some(x=>x.uid==='copy1'));assert.ok(h.user().run.deck.some(x=>x.uid==='copy2'));assert.ok(h.user().run.deck.some(x=>x.uid==='treasure'));
});
test('invalid or stale removal candidates cannot change the deck or consume the saved discovery',()=>{
 const h=harness();h.send('1');let before=A.copy(h.store.getState());assert.throws(()=>h.send('4'),/선택 번호/);assert.deepEqual(h.store.getState(),before);
 h.mutate(u=>{u.run.deck=u.run.deck.filter(x=>x.uid!==u.run.pending.options[0]);});before=A.copy(h.store.getState());assert.throws(()=>h.send('1'),/제거할 카드가 없습니다/);assert.deepEqual(h.store.getState(),before);
});
test('stopping heals five up to maximum HP using its distinct result title',()=>{
 for(const hp of [20,59]){const h=harness({hp}),before=A.copy(h.user().run),output=h.send('2','stop-once');
 assert.equal(A.UI.messages(output)[0],'⚔️ 이벤트 – 매듭을 푸는 까마귀 ⚔️\n\n까마귀는 풀린 끈을 짧은 둥지 재료로 만듭니다.\n\n체력을 5 회복했습니다.');
 assert.equal(h.user().run.hp,Math.min(60,hp+5));assert.equal(h.user().run.gold,5);assert.deepEqual(h.user().run.deck,before.deck);
 const after=A.copy(h.store.getState());h.reopen();assert.equal(h.send('2','stop-once'),output);assert.deepEqual(h.store.getState(),after);}
});
