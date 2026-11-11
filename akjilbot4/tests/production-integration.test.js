'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const A4=require('../../악질봇4.0.0.js');
const NOW=Date.UTC(2026,9,3,3,0,0);
const ID='production-test-user';
let sequence=0;
function request(text,extra={}){return Object.assign({identity:ID,name:'실제 설정 검증',room:'옥랜111',now:NOW,eventId:'production-event-'+(++sequence),text},extra);}
function harness(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'akjil4-production-'));
  const c=JSON.parse(JSON.stringify(A4.catalog));
  const h={root,c,store:null,io:null,app:null};
  h.open=function(){h.io=A4.Store.nodeIO(root,require);h.store=A4.Store.create(h.io);h.store.load(A4.newState(871236541));h.app=A4.App.create(h.store,c);return h;};
  h.reopen=function(){h.store.close();return h.open();};
  h.user=function(){const s=h.store.getState();return s.users[s.identities['identity:'+ID]];};
  h.mutate=function(fn){return h.store.transact('test-arrange',state=>{fn(state,state.users[state.identities['identity:'+ID]]);A4.validateState(state);});};
  h.send=function(text,extra){return h.app.handle(request(text,extra));};
  t.after(()=>{if(h.store)h.store.close();const target=path.resolve(root);assert.equal(path.dirname(target),path.resolve(os.tmpdir()));assert.ok(path.basename(target).startsWith('akjil4-production-'));fs.rmSync(target,{recursive:true,force:true});});
  return h.open();
}
function begin(h){h.send('+탐험');h.send('+선택 '+h.user().run.pending.id+' 1');h.send('y');assert.equal(h.user().run.phase,'BATTLE');}

test('battle opening publishes the current run deck including treasure cards and passive ownership without revealing draw order',t=>{
 const h=harness(t);h.send('+탐험');h.send('1');
 h.mutate((s,u)=>{u.run.treasures.low='mystic_coin';u.run.treasures.high='archmage_robe';u.run.deck[0].upgraded=true;u.run.deck.push({uid:A4.id(s,'known-treasure-'),cardId:'treasure_mystic_coin',upgraded:false,treasureSlot:'low'});});
 const starting=h.user().run.deck;h.send('y');const b=h.user().run.battle,snapshot=A4.AI.publicSnapshot(b,h.c);
 assert.equal(snapshot.publicPlayerDeck.length,starting.length);
 assert.ok(snapshot.publicPlayerDeck.some(x=>x.cardId==='treasure_mystic_coin'));
 assert.ok(snapshot.publicPlayerDeck.some(x=>x.cardId===starting[0].cardId&&x.upgraded));
 assert.ok(snapshot.player.treasureIds.includes('archmage_robe'));
 assert.ok(snapshot.publicPlayerDeck.every(x=>!x.uid));
 const before=JSON.parse(JSON.stringify(snapshot.publicPlayerDeck));b.player.hand.reverse();b.player.deck.reverse();
 assert.deepEqual(A4.AI.publicSnapshot(b,h.c).publicPlayerDeck,before);
 h.reopen();assert.deepEqual(h.user().run.battle.publicPlayerDeck,before);
});

test('ordinary battle deadlines pause without submitting, advancing the battle or consuming RNG',t=>{
  for(const inputDriven of [false,true]){
    const h=harness(t);begin(h);const before=h.store.getState(),b=h.user().run.battle,deadline=b.mainDeadline;
    const output=inputDriven?h.send('s',{now:deadline}):h.app.tick(deadline)[0].text;
    assert.match(output,/세션 종료/);
    const after=h.user();assert.equal(after.session,null);assert.equal(after.run.battle.mainDeadline,null);
    const expected=JSON.parse(JSON.stringify(b));expected.mainDeadline=null;
    assert.deepEqual(after.run.battle,expected);assert.equal(h.store.getState().rngState,before.rngState);
    assert.deepEqual(h.app.tick(deadline+1),[]);
    h.send('+탐험',{now:deadline+1000});
    assert.equal(h.user().run.battle.phase,b.phase);assert.ok(h.user().run.battle.mainDeadline>deadline);
  }
});

test('discovery and lamp deadlines preserve pending choices and resume with a fresh deadline',t=>{
  for(const cardId of [A4.CardRules.nameToId('수중 동물 변신'),'treasure_zephrys_lamp']){
    const h=harness(t);begin(h);
    h.mutate((state,u)=>{const b=u.run.battle;b.enemyPlan=[];b.enemyPowerPlan=false;b.player.hand=[{uid:'pause-choice',cardId}];});
    h.send('1');const b=h.user().run.battle,deadline=b.mainDeadline,choice=JSON.parse(JSON.stringify(b.pendingChoice)),rng=h.store.getState().rngState;
    const out=h.app.tick(deadline);assert.equal(out.length,1);assert.match(out[0].text,/세션 종료/);assert.doesNotMatch(out[0].text,/무작위/);
    if(choice.lamp)delete choice.lampDeadline;
    assert.deepEqual(h.user().run.battle.pendingChoice,choice);assert.equal(h.user().session,null);assert.equal(h.store.getState().rngState,rng);
    h.reopen();h.send('+탐험',{now:deadline+1000});
    assert.ok(h.user().run.battle.mainDeadline>deadline);assert.equal(h.user().run.battle.pendingChoice.continuation.op,choice.continuation.op);
  }
});
test('active hearthstone removes itself and preserves permanent additions before encounter retry',t=>{
  const h=harness(t);begin(h);const enemy=h.user().run.enemyId;
  h.mutate((state,u)=>{
    const b=u.run.battle;u.run.treasures.high='hearthstone';
    const stone={uid:A4.id(state,'stone-'),cardId:'treasure_hearthstone',upgraded:false,treasureSlot:'high'};
    u.run.deck.push(stone);b.player.hand=[{uid:A4.id(state,'cassette-'),cardId:'treasure_cassette'},Object.assign({},stone)];
    b.player.mana=5;b.enemyPlan=[];b.enemyPowerPlan=false;
    b.enemy.lastTurnCards=[{card:{uid:'old',cardId:'general:화염구',upgraded:false}}];
  });
  h.send('1 2');let r=h.user().run;
  assert.equal(r.phase,'ENCOUNTER');assert.equal(r.enemyId,enemy);assert.equal(r.wins,0);
  assert.equal(r.treasures.high,undefined);assert.ok(!r.deck.some(c=>c.cardId==='treasure_hearthstone'));
  assert.equal(r.deck.filter(c=>c.cardId==='general:화염구').length,1);
  h.reopen();assert.deepEqual(h.user().run,r);h.send('y');assert.equal(h.user().run.battle.player.hp,60);
});

test('cassette-created card treasures are registered for later treasure replacement',t=>{
  const h=harness(t);begin(h);
  h.mutate((state,u)=>{
    const b=u.run.battle;b.player.hand=[{uid:A4.id(state,'cassette-'),cardId:'treasure_cassette',upgraded:false}];b.player.mana=5;
    b.enemyPlan=[];b.enemyPowerPlan=false;b.enemy.lastTurnCards=[{card:{uid:'enemy-treasure',cardId:'treasure_mystic_coin',upgraded:false}}];
  });
  h.send('+제출 '+h.user().run.turnToken+' 1');const r=h.user().run;
  const added=r.deck.find(c=>c.cardId==='treasure_mystic_coin');assert.ok(added);assert.equal(r.treasures[added.treasureSlot],'mystic_coin');
  const physical=r.battle.player.hand.find(c=>c.cardId==='treasure_mystic_coin');assert.equal(physical.runUid,added.uid);
});
function rewardChoices(h){let guard=0;while(h.user().run&&h.user().run.phase==='REWARD'){assert.ok(++guard<30);const p=h.user().run.pending;const index=p.kind==='tavern'?p.options.length:p.kind==='camp'?2:p.kind==='swap'?3:1;h.send('+선택 '+p.id+' '+index);}}
function prepareWinningSubmission(h){
  let guard=0;
  while(h.user().run.battle.pendingChoice){assert.ok(++guard<30);h.send('+선택 '+h.user().run.turnToken+' 1');}
  h.mutate((state,u)=>{
    const b=u.run.battle;
    // Keep the production encounter, card rules and reward flow. Arrange only
    // a deterministic final hit so this test measures settlement, not balance.
    b.player.hand.push({uid:A4.id(state,'integration-hit-'),cardId:'general:화염구',upgraded:false,cost:0});
    while(b.player.hand.length>A4.Battle.handLimit(b,'player',h.c))b.player.rest.push(b.player.hand.shift());
    b.enemy.hp=1;b.enemy.shield=0;b.enemy.status.inhibitorTriggered=true;b.enemyPlan=[];b.enemyPowerPlan=false;
  });
  const r=h.user().run;return request('+제출 '+r.turnToken+' '+r.battle.player.hand.length);
}
test('production settings enable all cards and treasures with exact rooms, timeout and inventory alias',t=>{
  const h=harness(t);assert.equal(h.c.config.enabled,true);assert.equal(h.c.config.engineVersion,3);assert.deepEqual(A4.validateCatalog(h.c),[]);
  assert.deepEqual(h.c.config.rooms,{live:['옥랜111','옥랜222'],test:['개발123']});assert.equal(h.c.config.sessionTimeoutMs,60000);
  assert.deepEqual(h.c.config.playerMaxHpByStage,Array(8).fill(60));
  assert.equal(h.c.neutralTreasurePool.length,62);assert.equal(h.c.cardPool.length,111);
  const full=h.send('+인벤'),alias=h.send('+ㅇㅂ',{room:'옥랜222'});assert.equal(full,alias);assert.match(alias,/코인/);assert.match(alias,/🔑 🔑 🔑 🔑 🔑/);assert.doesNotMatch(alias,/강화석|정수/);
  assert.equal(Object.keys(h.store.getState().users).length,1);assert.equal(h.user().items.keys,5);
  assert.match(h.send('+상점'),/준비 중|정해지지/);assert.match(h.send('+유물'),/준비 중/);assert.throws(()=>h.send('+뽑기 low'),/준비 중/);
});
test('production hero selection, committed enemy plan and all pending choices survive disk reopen',t=>{
  const h=harness(t);h.send('+탐험');assert.equal(h.user().items.keys,4);const beforeHero=h.user().run.pending;h.reopen();assert.deepEqual(h.user().run.pending,beforeHero);
  h.send('+선택 '+beforeHero.id+' 1');h.send('y');const run=h.user().run;assert.equal(run.hero.id,'guff');assert.equal(run.deck.length,10);assert.equal(run.battle.player.maxHp,60);
  assert.deepEqual(run.deck.map(x=>x.cardId),h.c.heroes[0].cards);assert.equal(run.battle.player.hand.length,4);
  const before=h.store.getState();h.reopen();assert.deepEqual(h.store.getState(),before);h.send('+탐험',{room:'개발123'});assert.deepEqual(h.user().run.battle.enemyPlan,run.battle.enemyPlan);assert.equal(h.user().run.turnToken,run.turnToken);
});
test('battle inactivity pauses after 150 seconds and remains paused across restart',t=>{
  const h=harness(t);begin(h);
  h.mutate((state,u)=>{u.run.battle.enemyPlan=[];u.run.battle.enemyPowerPlan=false;});
  assert.equal(h.user().session.until,NOW+150000);
  assert.deepEqual(h.app.tick(NOW+149999),[]);
  const messages=h.app.tick(NOW+150000);
  assert.equal(messages.length,1);assert.doesNotMatch(messages[0].text,/지나 해당 페이즈를 쉬었습니다/);
  assert.match(messages[0].text,/세션 종료/);
  assert.equal(h.user().run.battle.phase,'MAIN1');
  assert.equal(h.user().run.battle.history.length,0);
  assert.equal(h.user().session,null);
  assert.deepEqual(h.app.tick(NOW+150000),[]);
  h.reopen();assert.equal(h.user().run.battle.mainDeadline,null);
});
test('late battle input pauses the expired phase without submitting the input',t=>{
  const h=harness(t);begin(h);
  h.mutate((state,u)=>{u.run.battle.enemyPlan=[];u.run.battle.enemyPowerPlan=false;});
  const req=request('0',{now:NOW+150001});
  const output=h.app.handle(req);assert.doesNotMatch(output,/지나 해당 페이즈를 쉬었습니다/);
  assert.match(output,/세션 종료/);
  assert.equal(h.user().run.battle.phase,'MAIN1');
  assert.equal(h.user().run.battle.history.length,0);
  const state=h.store.getState();assert.equal(h.app.handle(req),output);assert.deepEqual(h.store.getState(),state);
});
test('s suspends reward selection and preserves the same choices across restart',t=>{
  const h=harness(t);begin(h);h.app.handle(prepareWinningSubmission(h));
  assert.equal(h.user().run.phase,'REWARD');
  const before=h.user().run;
  assert.equal(h.send('s'),'⚔️ 세션 종료: +탐험으로 기존 탐험을 이어갑니다.');
  assert.equal(h.user().session,null);assert.deepEqual(h.user().run,before);
  h.reopen();h.send('+탐험');assert.deepEqual(h.user().run,before);
  h.send('1');assert.notDeepEqual(h.user().run.pending,before.pending);
});

test('white night timer auto-passes exactly the expired phase and is suspended across restart',t=>{
  const h=harness(t);begin(h);h.mutate((state,u)=>{const b=u.run.battle;b.mainTimeoutMs=20000;b.enemyPlan=[];b.enemyPowerPlan=false;A4.Game.syncDeadline(u,NOW);});
  const initial=h.user().run;assert.equal(initial.battle.mainDeadline,NOW+20000);assert.deepEqual(h.app.tick(NOW+19999),[]);
  const messages=h.app.tick(NOW+20000);assert.equal(messages.length,1);assert.doesNotMatch(messages[0].text,/20초|지나 해당 페이즈를 쉬었습니다/);assert.equal(h.user().run.battle.phase,'MAIN2');assert.equal(h.user().run.battle.turn,0);assert.equal(h.user().run.battle.history[0].player.length,0);assert.equal(h.user().run.battle.mainDeadline,NOW+40000);
  h.reopen();h.app.suspendSessions();assert.equal(h.user().session,null);assert.equal(h.user().run.battle.mainDeadline,null);
  h.send('+탐험',{now:NOW+120000});assert.equal(h.user().run.battle.phase,'MAIN2');assert.equal(h.user().run.battle.mainDeadline,NOW+140000);
});
test('eight production encounters settle once after the final tavern despite shutdown after the first snapshot',t=>{
 const h=harness(t);begin(h);
 for(let win=0;win<7;win++){h.app.handle(prepareWinningSubmission(h));rewardChoices(h);h.send('+탐험');h.send('y');}
 const victory=h.app.handle(prepareWinningSubmission(h));assert.equal(h.user().run.wins,8);assert.equal(h.user().run.phase,'REWARD');const messages=A4.UI.messages(victory);assert.match(messages[0],/^⚔️ 탐험 8\/8/);assert.match(messages[1],/^⚔️ 탐험 - 승리!/);
 while(h.user().run.pending.kind!=='tavern'){const p=h.user().run.pending;h.send('+선택 '+p.id+' '+(p.kind==='camp'?2:1));}
 const r=h.user().run,command=request('+선택 '+r.pending.id+' '+r.pending.options.length),before=h.store.getState(),beforeUser=h.user(),write=h.io.writeNewDurable;
 h.io.writeNewDurable=(name,value)=>{if(name.endsWith('-b.json'))throw new Error('simulated shutdown between durable mirrors');write(name,value);};assert.throws(()=>h.app.handle(command),e=>e.code==='SAVE_BLOCKED');assert.deepEqual(h.store.getState(),before);h.reopen();
 const settled=h.user();assert.equal(settled.run,null);assert.equal(settled.lastRun.wins,8);assert.equal(settled.lastRun.reason,'clear');const reward=settled.lastRun.reward;assert.ok(reward.gold>0);assert.equal(reward.keys,0);assert.equal(reward.stones,0);assert.equal(reward.essence,0);assert.equal(settled.gold,beforeUser.gold+reward.gold);
 const state=h.store.getState(),reply=h.app.handle(command);assert.match(reply,/탐험 - 결과/);assert.deepEqual(h.store.getState(),state);assert.equal(settled.lastRun.encounterResults.length,8);
});

test('extra card treasure can be selected for sixth-win replacement without replacing the original slot',t=>{
  const h=harness(t);begin(h);
  h.mutate((state,u)=>{
    const r=u.run;r.phase='REWARD';r.wins=6;r.battle=null;r.turnToken=null;r.queue=['add','add'];r.treasures={low:'mana_receipt',high:'runeterra_codex','extra-one':'grave_pick'};
    r.deck=r.deck.filter(c=>!c.treasureSlot);r.deck.push({uid:A4.id(state,'card-'),cardId:'treasure_grave_pick',upgraded:false,treasureSlot:'extra-one'});
    r.pending={id:A4.id(state,'choice-'),kind:'swap',options:['하급 교체','상급 교체','건너뜀']};
  });
  h.send('+선택 '+h.user().run.pending.id+' 1');let p=h.user().run.pending;assert.equal(p.kind,'swapTarget');assert.deepEqual(p.options,['low','extra-one']);
  h.reopen();assert.deepEqual(h.user().run.pending,p);h.send('+선택 '+p.id+' 2');const r=h.user().run;assert.equal(r.treasures.low,'mana_receipt');assert.equal(r.treasures.high,'runeterra_codex');assert.equal(h.c.treasures[r.treasures['extra-one']].tier,'high');assert.ok(!r.deck.some(c=>c.cardId==='treasure_grave_pick'));assert.equal(r.pending.kind,'add');
});
test('forfeit pays the zero-win reward and production keys regenerate lazily after inactivity',t=>{
  const h=harness(t);begin(h);h.send('gg');assert.equal(h.user().gold,0);assert.equal(h.user().lastRun.wins,0);assert.equal(h.user().items.keys,4);
  h.send('+ㅇㅂ',{now:NOW+30*60000});assert.equal(h.user().items.keys,5);h.send('+인벤',{now:NOW+4*60*60000});assert.equal(h.user().items.keys,5);
});

test('encounter preview distinguishes passive and active powers and waits without opening effects',t=>{
  const h=harness(t);h.send('+탐험');h.send('1');
  assert.equal(h.user().run.phase,'ENCOUNTER');assert.equal(h.user().run.battle,null);assert.equal(h.user().session.until,NOW+60000);
  for(const id of ['cannon_minion','little_hatchling']){
    h.mutate((state,u)=>{u.run.enemySpec=null;const spec=A4.Opponents.prepare(state,u.run,h.c,id);u.run.enemyId=spec.enemyId;});
    const text=h.send('+탐험');assert.equal(A4.UI.messages(text).length,1);
    const expected=id==='cannon_minion'?'⚔️ 탐험 1/8 ⚔️\n대포 미니언 ❤️ 15\n[🛟] 공성 | ⏳️지속\n매 턴의 엔드 페이즈시에 상대에게 피해를 1 줍니다.\ny / n':'⚔️ 탐험 1/8 ⚔️\n작은 해츨링 ❤️ 15\n[🛟] 아기 숨결 | 💧1\n상대에게 피해를 2 줍니다.\ny / n';
    assert.equal(text,expected);assert.equal(h.user().run.battle,null);
  }
  h.mutate((state,u)=>{u.run.enemySpec=null;A4.Opponents.prepare(state,u.run,h.c,'cannon_minion');u.run.enemyId='cannon_minion';});
  h.send('y',{now:NOW+59999});assert.equal(h.user().run.phase,'BATTLE');assert.equal(h.user().run.battle.player.hp,60);assert.equal(h.user().run.battle.turn,0);
});

test('declining preserves the same encounter, run, keys and rewards across resume',t=>{
  const h=harness(t);h.send('+탐험');h.send('1');const before=h.user(),spec=before.run.enemySpec;
  assert.match(h.send('n'),/⚔️ 세션 종료:/);assert.equal(h.user().session,null);assert.deepEqual(h.user().run,before.run);
  assert.equal(h.user().gold,before.gold);assert.deepEqual(h.user().items,before.items);assert.equal(h.user().lastRun,null);
  assert.equal(h.send('y'),null);h.send('+탐험',{room:'옥랜222'});assert.deepEqual(h.user().run.enemySpec,spec);
  assert.equal(h.send('y',{room:'옥랜111'}),null);h.send('y',{room:'옥랜222'});assert.equal(h.user().run.battle.enemy.bossId,spec.enemyId);assert.equal(h.user().items.keys,before.items.keys);
});

test('confirmation expires at exactly one minute even if timer has not run',t=>{
  const h=harness(t);h.send('+탐험');h.send('1');const before=h.user().run;
  assert.match(h.send('y',{now:NOW+60000}),/⚔️ 세션 종료:/);assert.equal(h.user().session,null);assert.deepEqual(h.user().run,before);
  h.send('+탐험',{now:NOW+70000});assert.deepEqual(h.app.tick(NOW+129999),[]);
  assert.equal(h.app.tick(NOW+130000).length,1);assert.equal(h.user().session,null);assert.deepEqual(h.user().run,before);
  assert.equal(h.send('y',{now:NOW+130001}),null);assert.equal(h.user().run.battle,null);
});

test('restart preserves preview and y replay cannot trigger opening damage twice',t=>{
  const h=harness(t);h.send('+탐험');h.send('1');const before=h.user().run;
  h.reopen();h.app.suspendSessions();assert.deepEqual(h.user().run,before);assert.equal(h.send('y'),null);
  h.send('+탐험');assert.deepEqual(h.user().run,before);
  const command=request('y'),output=h.app.handle(command),state=h.store.getState();assert.equal(A4.UI.messages(output).length,2);
  assert.equal(h.app.handle(command),output);assert.deepEqual(h.store.getState(),state);
  h.reopen();assert.equal(h.app.handle(command),output);assert.deepEqual(h.store.getState(),state);
  assert.equal(h.send('n'),null);assert.equal(h.user().run.phase,'BATTLE');
});

test('a crash between snapshot copies recovers one accepted battle start',t=>{
  const h=harness(t);h.send('+탐험');h.send('1');const spec=h.user().run.enemySpec,command=request('y'),write=h.io.writeNewDurable;
  h.io.writeNewDurable=(name,value)=>{if(name.endsWith('-b.json'))throw new Error('shutdown after accepted y');write(name,value);};
  assert.throws(()=>h.app.handle(command),e=>e.code==='SAVE_BLOCKED');h.reopen();
  const saved=h.store.getState();assert.equal(h.user().run.phase,'BATTLE');assert.equal(h.user().run.battle.enemy.bossId,spec.enemyId);
  assert.equal(A4.UI.messages(h.app.handle(command)).length,2);assert.deepEqual(h.store.getState(),saved);
});

test('result lists the won and lost opponents in order and survives restart and duplicate delivery',t=>{
  const h=harness(t);begin(h);const first=h.user().run.battle.enemy.name;
  h.app.handle(prepareWinningSubmission(h));assert.deepEqual(h.user().run.encounterResults.map(x=>[x.name,x.won]),[[first,true]]);
  h.reopen();rewardChoices(h);h.send('+탐험');h.send('y');const second=h.user().run.battle.enemy.name;
  h.mutate((state,u)=>{const b=u.run.battle;b.player.hp=1;b.player.shield=0;b.enemy.hand=[{uid:A4.id(state,'final-loss-'),cardId:'general:불덩이 작렬',cost:0}];b.enemyPlan=[b.enemy.hand[0].uid];b.enemyPowerPlan=false;});
  const command=request('s'),output=h.app.handle(command),result=A4.UI.messages(output).at(-1),last=h.user().lastRun;
  assert.equal(last.wins,1);assert.deepEqual(last.encounterResults.map(x=>[x.name,x.won]),[[first,true],[second,false]]);
  assert.equal(result,'⚔️ 탐험 - 결과 ⚔️\n'+first+' ✅️\n'+second+' ❌️\n보상: '+last.reward.gold+'C');
  h.reopen();assert.deepEqual(h.user().lastRun,last);const gold=h.user().gold;assert.equal(h.app.handle(command),output);assert.equal(h.user().gold,gold);
});

test('forfeit during rewards does not mark the defeated opponent as failed',t=>{
  const h=harness(t);begin(h);const first=h.user().run.battle.enemy.name;
  h.app.handle(prepareWinningSubmission(h));const text=h.send('gg');
  assert.equal(text,'⚔️ 탐험 - 결과 ⚔️\n'+first+' ✅️\n보상: '+h.user().lastRun.reward.gold+'C');
  assert.equal(h.user().lastRun.encounterResults.length,1);assert.doesNotMatch(text,/❌️| 0개/);
});

const ADMIN={identity:'operator-hash',name:'운영자',room:'개발123'};
function operator(h,text,extra={}){return h.send(text,Object.assign({},ADMIN,extra));}
test('admin acquisition is open but other double-plus commands require the stable account permission',t=>{
  const h=harness(t);h.send('+인벤');const before=h.store.getState();
  assert.throws(()=>operator(h,'++아이템지급 실제 설정 검증 강화석 2'),/관리자 권한/);assert.deepEqual(h.store.getState(),before);
  operator(h,'++관리자획득');h.reopen();
  assert.match(operator(h,'++아이템지급 실제 설정 검증 강화석 2',{name:'새 운영자 이름',room:'옥랜222'}),/지급 완료/);assert.equal(h.user().items.stones,2);
  assert.throws(()=>h.send('++아이템회수 실제 설정 검증 강화석 1'),/관리자 권한/);
  assert.throws(()=>h.send('++없는명령'),/관리자 권한/);
  h.send('++관리자획득');assert.equal(h.user().isAdmin,true);assert.match(h.send('++관리자획득'),/이미 관리자/);
});
test('admin grants and removes all inventory currencies with spaced nicknames and exact amounts',t=>{
  const h=harness(t);h.send('+인벤');operator(h,'++관리자획득');
  for(const [item,key,amount] of [['미궁 열쇠','keys',7],['강화석','stones',12],['정수','essence',3],['골드','gold',123]]){
    const before=key==='gold'?h.user().gold:h.user().items[key];
    operator(h,'++아이템지급 실제 설정 검증 '+item+' '+amount);assert.equal(key==='gold'?h.user().gold:h.user().items[key],before+amount);
    assert.match(operator(h,'++아이템회수 실제 설정 검증 '+item+' 2'),/회수 완료/);assert.equal(key==='gold'?h.user().gold:h.user().items[key],before+amount-2);
  }
  const inv=h.send('+ㅇㅂ');assert.match(inv,/코인: 121C/);assert.match(inv,/🔑 🔑 🔑 🔑 🔑 \(\+5\)/);assert.match(inv,/\[1\] 강화석 x10/);assert.match(inv,/\[2\] 정수 x1/);
  h.reopen();assert.equal(h.user().items.keys,10);assert.equal(h.store.getState().adminHistory.length,9);
});
test('admin rejects insufficient inventory, invalid amounts, unknown items and ambiguous recipients atomically',t=>{
  const h=harness(t);h.send('+인벤');operator(h,'++관리자획득');const before=h.store.getState();
  for(const cmd of ['++아이템회수 실제 설정 검증 강화석 1','++아이템지급 실제 설정 검증 강화석 0','++아이템지급 실제 설정 검증 강화석 -1','++아이템지급 실제 설정 검증 강화석 1.5','++아이템지급 실제 설정 검증 강화석 1e3','++아이템지급 실제 설정 검증 강화석 9007199254740992','++아이템지급 실제 설정 검증 없는아이템 1','++아이템지급 없는유저 정수 1']){
    assert.throws(()=>operator(h,cmd));assert.deepEqual(h.store.getState(),before);
  }
  h.send('+인벤',{identity:'duplicate-name',name:'실제 설정 검증'});const duplicate=h.store.getState();
  assert.throws(()=>operator(h,'++아이템지급 실제 설정 검증 정수 1'),/동일한 닉네임/);assert.deepEqual(h.store.getState(),duplicate);
});
test('key removal below the cap starts regeneration without banking time spent above the cap',t=>{
  const h=harness(t);h.send('+인벤');operator(h,'++관리자획득');operator(h,'++아이템지급 실제 설정 검증 미궁열쇠 5');
  const later=NOW+3600000;operator(h,'++아이템회수 실제 설정 검증 미궁 열쇠 8',{now:later});assert.equal(h.user().items.keys,2);assert.equal(h.user().keyUpdatedAt,later);
  h.send('+인벤',{now:later+1799999});assert.equal(h.user().items.keys,2);h.send('+인벤',{now:later+1800000});assert.equal(h.user().items.keys,3);
});
test('admin operations persist once even if shutdown occurs between snapshot copies',t=>{
  const h=harness(t);begin(h);operator(h,'++관리자획득');const run=h.user().run,command=request('++아이템지급 실제 설정 검증 정수 9',ADMIN),write=h.io.writeNewDurable;
  h.io.writeNewDurable=(name,value)=>{if(name.endsWith('-b.json'))throw new Error('shutdown after admin commit');write(name,value);};
  assert.throws(()=>h.app.handle(command),e=>e.code==='SAVE_BLOCKED');h.reopen();
  assert.equal(h.user().items.essence,9);assert.deepEqual(h.user().run,run);const saved=h.store.getState();assert.match(h.app.handle(command),/지급 완료/);assert.deepEqual(h.store.getState(),saved);
  assert.equal(saved.adminHistory.filter(x=>x.command==='++아이템지급').length,1);
});

const RECEIVER={identity:'receiver-hash',name:'수신 계정',room:'옥랜222'};
function linkCode(h){const text=h.send('+연동코드');const code=/연동 코드: (\d{4}) \(5분/.exec(text)[1];return code;}
test('link confirmation replaces existing inventory and run without merging and retains the original run',t=>{
  const h=harness(t);begin(h);h.send('+탐험',RECEIVER);h.mutate((s,u)=>{u.gold=750;s.users[s.identities['identity:receiver-hash']].gold=300;});
  const source=h.user(),oldId=h.store.getState().identities['identity:receiver-hash'],code=linkCode(h);
  assert.equal(h.send('+연동 '+code,RECEIVER),'실제 설정 검증의 데이터로 덮어씌울까요? (y/n)');assert.equal(h.store.getState().identities['identity:receiver-hash'],oldId);
  h.reopen();h.app.suspendSessions();source.run.battle.mainDeadline=null;assert.match(h.send('y',RECEIVER),/데이터로 연동/);
  assert.equal(h.store.getState().identities['identity:receiver-hash'],source.id);assert.equal(h.user().gold,750);assert.deepEqual(h.user().run,source.run);
  assert.equal(h.store.getState().users[oldId].session,null);assert.equal(h.store.getState().linkCodes[code],undefined);
});
test('link cancellation and five-minute expiry preserve receiver data and same-room use is rejected',t=>{
  const h=harness(t);h.send('+인벤');h.send('+인벤',RECEIVER);const oldId=h.store.getState().identities['identity:receiver-hash'],code=linkCode(h);
  assert.throws(()=>h.send('+연동 '+code),/다른 방/);h.send('+연동 '+code,RECEIVER);assert.match(h.send('n',RECEIVER),/취소/);assert.equal(h.store.getState().identities['identity:receiver-hash'],oldId);
  h.send('+연동 '+code,RECEIVER);assert.match(h.send('y',Object.assign({},RECEIVER,{now:NOW+300000})),/만료/);assert.equal(h.store.getState().identities['identity:receiver-hash'],oldId);
  assert.throws(()=>h.send('+연동 '+code,Object.assign({},RECEIVER,{now:NOW+300001})),/만료/);
});
test('accepted link survives a crash after first snapshot and confirmation replay is harmless',t=>{
  const h=harness(t);h.send('+인벤');const sourceId=h.user().id,code=linkCode(h);h.send('+연동 '+code,RECEIVER);
  const command=request('y',RECEIVER),write=h.io.writeNewDurable;
  h.io.writeNewDurable=(name,value)=>{if(name.endsWith('-b.json'))throw new Error('shutdown during link');write(name,value);};
  assert.throws(()=>h.app.handle(command),e=>e.code==='SAVE_BLOCKED');h.reopen();const saved=h.store.getState();assert.equal(saved.identities['identity:receiver-hash'],sourceId);
  assert.match(h.app.handle(command),/데이터로 연동/);assert.deepEqual(h.store.getState(),saved);
});

test('initial commands preserve arguments and signed admin money persists exactly once',t=>{
  const h=harness(t);h.send('+ㅇㅂ');
  assert.throws(()=>operator(h,'++ㄷㅈㄱ 실제 설정 검증 100'),/관리자 권한/);
  operator(h,'++ㄱㄹㅈㅎㄷ');
  operator(h,'++ㄷㅈㄱ 실제 설정 검증 +100',{eventId:'cash-once'});
  operator(h,'++ㄷㅈㄱ 실제 설정 검증 +100',{eventId:'cash-once'});
  assert.equal(h.user().gold,100);
  operator(h,'++돈지급 실제 설정 검증 -30');h.reopen();assert.equal(h.user().gold,70);
  for(const amount of ['-71','1.5','1e3','9007199254740992']){
    const before=h.store.getState();assert.throws(()=>operator(h,'++ㄷㅈㄱ 실제 설정 검증 '+amount));assert.deepEqual(h.store.getState(),before);
  }
  operator(h,'++ㅇㅇㅌㅈㄱ 실제 설정 검증 강화석 2');assert.equal(h.user().items.stones,2);
  const pairs=[['+ㅌㅎ','+탐험'],['+ㄷ','+덱'],['+ㄷㅇㅁ','+도움말'],['+ㅅㅈ','+상점'],['+ㅃㄱ p','+뽑기 p'],['+ㄱㅎ r','+강화 r'],['+ㄱㅎㅎㅇ t','+강화확인 t'],['+ㅅㄹㅎㅈ','+슬롯확장'],['+ㅇㅁ ㅈㅊ r 1','+유물 장착 r 1'],['+ㅇㅁ ㅎㅈ 1','+유물 해제 1'],['+ㅇㄷㅋㄷ','+연동코드'],['+ㅇㄷ 1234','+연동 1234'],['+ㅇㄷㅅㅇ','+연동승인'],['+ㅅㅌ t 1','+선택 t 1'],['+ㅈㅊ t ㅇㅇ 1','+제출 t 영웅 1']];
  for(const [short,long] of pairs)assert.deepEqual(A4.App.parse(short),A4.App.parse(long));
});

test('encyclopedia groups all ordinary cards and sorts each family by base cost then Korean name',t=>{
  const h=harness(t),text=h.send('+도감');
  assert.ok(text.startsWith('⚔️ 탐험 카드 도감 ⚔️\n'+'\u200b'.repeat(1000)+'\n\n• ❄️ → 🔥 → 🍃 → ⚡️ → ❄️'));
  for(const element of ['FIRE','ICE','NATURE','LIGHTNING','HOLY']){
    const entries=h.c.cardPool.map(id=>({id,d:h.c.cards[id]})).filter(x=>x.d.element===element).sort((a,b)=>a.d.cost-b.d.cost||(a.d.name<b.d.name?-1:a.d.name>b.d.name?1:0));
    let previous=-1;
    for(const {id,d} of entries){
      const base=A4.UI.card({cardId:id,upgraded:false},h.c).replace(' — ','\n');
      const upgrade=A4.UI.card({cardId:id,upgraded:true},h.c).replace(' — ','\n');
      const at=text.indexOf(base+'\n'+upgrade);assert.ok(at>previous,d.name+' ordered pair missing');previous=at;
    }
  }
  assert.equal(h.send('+ㄷㄱ'),text);
});
test('encyclopedia exact and partial search includes both treasure types and upgraded queries',t=>{
  const h=harness(t);
  const flame=h.send('+도감 불길');
  assert.equal(flame,'⚔️ 탐험 카드 도감 ⚔️\n[🔥] 불길 | 💧0\n화염 카드를 뽑습니다.\n[🔥] 불길+ | 💧0\n화염 카드를 2장 뽑습니다.');
  assert.equal(h.send('+ㄷㄱ 불길+'),flame);
  assert.match(h.send('+도감 곡괭'),/\[❄️✨\] 도굴꾼의 곡괭이 \| 💧1\n/);
  assert.match(h.send('+도감 쌍둥이'),/\[✨\] 쌍둥이 반지\n/);
  assert.match(h.send('+도감 보석 팬던트'),/\[✨\] 보석 팬던트/);
  const mirrors=h.send('+도감 마법 거울');assert.doesNotMatch(mirrors,/\[✨\] 마법 거울/);assert.match(mirrors,/\[❄️✨\] 마법 거울/);
  assert.match(h.send('+도감 존재하지않는카드'),/검색 결과가 없습니다/);
});
test('encyclopedia leaves active reward options, random state and session intact',t=>{
  const h=harness(t);begin(h);h.app.handle(prepareWinningSubmission(h));assert.equal(h.user().run.phase,'REWARD');const before=h.user();const rng=h.store.getState().rngState;
  h.send('+ㄷㄱ 수중 동물');assert.deepEqual(h.user().run,before.run);assert.deepEqual(h.user().session,before.session);assert.equal(h.store.getState().rngState,rng);
});

test('unpausable discovery timeout selects a random option once and persists through a failed mirror write',t=>{
  const h=harness(t);begin(h);
  h.mutate((state,u)=>{const b=u.run.battle;b.enemy.heroPower=A4.BossRules.power('white_night');b.enemyPlan=[];b.enemyPowerPlan=false;b.player.hand=[{uid:'timed-discover',cardId:A4.CardRules.nameToId('수중 동물 변신'),upgraded:false}];});
  h.send('1');const before=h.user().run.battle;
  assert.ok(before.pendingChoice);assert.equal(before.mainDeadline,NOW+150000);
  assert.deepEqual(h.app.tick(NOW+149999),[]);
  const write=h.io.writeNewDurable;
  h.io.writeNewDurable=(name,value)=>{if(name.endsWith('-b.json'))throw new Error('interrupt timeout commit');write(name,value);};
  assert.throws(()=>h.app.tick(NOW+150000),e=>e.code==='SAVE_BLOCKED');
  h.reopen();assert.equal(h.user().run.battle.pendingChoice,null);
  assert.equal(h.user().run.battle.phase,'MAIN2');
  assert.equal(h.user().session.until,NOW+300000);
  const saved=h.store.getState();assert.deepEqual(h.app.tick(NOW+150000),[]);assert.deepEqual(h.store.getState(),saved);
});

test('existing-account queries, ordinary chat, duplicate receipts and idle timer cause no disk IO',t=>{
  const h=harness(t);h.send('+인벤');const command=request('++관리자획득');const response=h.app.handle(command);
  const before=h.store.getState(),revision=h.store.getRevision();let reads=0,writes=0,lists=0;
  const read=h.io.read,write=h.io.writeNewDurable,list=h.io.list,get=h.store.getState;
  h.io.read=n=>{reads++;return read(n);};h.io.writeNewDurable=(n,s)=>{writes++;return write(n,s);};h.io.list=()=>{lists++;return list();};
  h.store.getState=()=>{throw new Error('fast paths must not copy full state');};
  for(const text of ['+인벤','+도감','+덱','+도움말','+유물','+상점'])assert.equal(typeof h.send(text),'string');
  assert.equal(h.send('일반 채팅'),null);assert.equal(h.app.handle(command),response);assert.deepEqual(h.app.tick(NOW+1000),[]);
  h.store.getState=get;assert.equal(reads,0);assert.equal(writes,0);assert.equal(lists,0);
  assert.equal(h.store.getRevision(),revision);assert.deepEqual(h.store.getState(),before);
});
test('receipt compaction preserves old event IDs so a replay cannot repeat a grant',t=>{
  const h=harness(t);h.send('++관리자획득');
  h.mutate((s,u)=>{u.receipts=Array.from({length:100},(_,i)=>({id:'old-'+i,text:'이전 응답'.repeat(500)}));});
  h.send('++돈지급 실제 설정 검증 50');
  assert.equal(h.user().receipts.length,101);assert.ok(h.user().receipts.reduce((n,r)=>n+r.text.length,0)<70000);
  const gold=h.user().gold,revision=h.store.getRevision();
  assert.match(h.send('++돈지급 실제 설정 검증 50',{eventId:'old-0'}),/이미 처리된 입력/);
  assert.equal(h.user().gold,gold);assert.equal(h.store.getRevision(),revision);
  h.reopen();assert.match(h.send('++돈지급 실제 설정 검증 50',{eventId:'old-0'}),/이미 처리된 입력/);
  assert.equal(h.user().gold,gold);
});

test('treasure acquisition and chosen replacement offer four distinct unowned treasures',t=>{
  const h=harness(t);begin(h);h.app.handle(prepareWinningSubmission(h));
  assert.equal(h.user().run.pending.kind,'treasure');assert.equal(h.user().run.pending.options.length,4);
  for(const step of ['high','replaceHigh']){
    h.mutate((state,u)=>{
      u.run.queue=[step];u.run.pending={id:'four-treasures',kind:'offerRemove',options:['제거한다','제거하지 않는다']};
      u.run.treasures.high='hearthstone';
    });
    h.send('2');const p=h.user().run.pending;
    assert.equal(p.kind,'treasure');assert.equal(p.options.length,4);assert.equal(new Set(p.options).size,4);
    assert.ok(p.options.every(id=>h.c.treasures[id].tier==='high'&&id!=='hearthstone'));
  }
});

test('rules command and initial alias show one message with exactly 1000 folding characters',t=>{
  const h=harness(t),text=h.send('+규칙'),before=h.store.getState(),revision=h.store.getRevision();
  assert.ok(text.startsWith('⚔️ 탐험 규칙 ⚔️\n'+'\u200b'.repeat(1000)+'\n\n+탐험:'));
  assert.equal((text.match(/\u200b/g)||[]).length,1000);
  assert.equal(A4.UI.messages(text).length,1);
  assert.match(text,/직업 카드 3장으로 된 묶음 3개/);assert.match(text,/선술집/);assert.match(text,/해오름: 메인 페이즈 1/);
  assert.equal(h.send('+ㄱㅊ'),text);assert.equal(h.store.getRevision(),revision);assert.deepEqual(h.store.getState(),before);
});

test('admin inventory uses the normal format, supports spaced nicknames and alias without mutations',t=>{
  const h=harness(t);h.send('++관리자획득');
  const target={identity:'inventory-target',name:'대상 닉네임'};
  h.send('+인벤',target);
  h.mutate((s,u)=>{const v=s.users[s.identities['identity:inventory-target']];v.gold=750;v.items.keys=3;v.items.stones=4;v.items.essence=2;});
  const expected=h.send('+인벤',target),before=h.store.getState(),revision=h.store.getRevision();
  assert.equal(h.send('++인벤 대상 닉네임'),expected);assert.equal(h.send('++ㅇㅂ 대상 닉네임'),expected);
  assert.match(expected,/📓 대상 닉네임의 인벤토리/);assert.equal(h.store.getRevision(),revision);assert.deepEqual(h.store.getState(),before);
  assert.throws(()=>h.send('++인벤 실제 설정 검증',target),/관리자 권한/);
  assert.throws(()=>h.send('++인벤'),/사용법/);assert.throws(()=>h.send('++인벤 없는 유저'),/유저가 없습니다/);
  h.send('+탐험',target);assert.equal(h.send('++인벤 대상 닉네임'),h.send('+인벤',target));
});

test('encyclopedia searches hero and boss powers by exact and partial names including transformations',t=>{
  const h=harness(t);
  assert.equal(h.send('+도감 양성'),'⚔️ 탐험 카드 도감 ⚔️\n[🛟] 양성 | 💧1\n내 손에 있는 무작위 카드의 비용이 (1) 감소합니다.');
  assert.match(h.send('+ㄷㄱ 빌드업'),/\[🛟\] 빌드업 \| 💧1/);
  assert.match(h.send('+도감 수풀'),/\[🛟\] 수풀 가꾸기 \| ⏳️지속/);
  assert.match(h.send('+도감 하얀 밤'),/\[🛟\] 하얀 밤 \| ⏳️지속\n메인 페이즈의 제한 시간이 15초로 감소합니다\./);
  assert.match(h.send('+도감 불길'),/\[🔥\] 불길/);
});

test('random and chosen treasure swaps announce old and new treasures before the next reward',t=>{
  for(const mode of [1,2]){
    const h=harness(t);begin(h);
    h.mutate((state,u)=>{const r=u.run;r.phase='REWARD';r.wins=6;r.battle=null;r.turnToken=null;r.queue=['add','add'];r.treasures={low:'mana_receipt',high:'runeterra_codex'};r.pending={id:'swap-notice',kind:'swap',options:['하급 교체','상급 교체','교체하지 않음']};});
    let text=h.send(String(mode));
    if(mode===2){assert.doesNotMatch(text,/변신합니다/);h.reopen();text=h.send('1');}
    const parts=A4.UI.messages(text),r=h.user().run;
    assert.equal(parts.length,2);assert.match(parts[0],/ 카드가 .* 카드로 변신합니다!$/);
    assert.ok(parts[0].includes(mode===1?'마나 영수증':'룬테라의 비전서'));
    assert.ok(parts[0].includes(h.c.treasures[r.treasures[mode===1?'low':'high']].name));
    assert.match(parts[1],/^⚔️ 카드 추가/);
    assert.doesNotMatch(h.send('+탐험'),/변신합니다/);
  }
});


test('nickname arguments resolve unique substrings, prefer exact names and reject ambiguous mutations',t=>{
  const h=harness(t);h.send('++관리자획득');
  const target={identity:'partial-target',name:'원구(D-28X)'};
  h.send('+인벤',target);
  assert.equal(h.send('++ㅇㅂ 원구'),h.send('+인벤',target));
  assert.match(h.send('++돈지급 D-28 500'),/원구\(D-28X\).*지급 완료/);
  assert.match(h.send('++아이템지급 원구 강화석 3'),/지급 완료/);
  assert.match(h.send('++아이템회수 원구 강화석 1'),/회수 완료/);
  assert.match(h.send('++돈지급 원구 -50'),/회수 완료/);
  h.send('+인벤',{identity:'partial-other',name:'원구 친구'});
  const before=h.store.getState();
  for(const command of ['++인벤 원구','++돈지급 원구 100','++아이템지급 원구 정수 1','++아이템회수 원구 강화석 1']){
    assert.throws(()=>h.send(command),e=>/여러 명/.test(e.message)&&e.message.includes('원구(D-28X)')&&e.message.includes('원구 친구'));
    assert.deepEqual(h.store.getState(),before);
  }
  h.send('+인벤',{identity:'partial-exact',name:'원구'});
  assert.match(h.send('++돈지급 원구 50'),/^원구님에게/);
  const s=h.store.getState();
  assert.equal(s.users[s.identities['identity:partial-target']].gold,450);
  assert.equal(s.users[s.identities['identity:partial-exact']].gold,50);
  assert.equal(s.users[s.identities['identity:partial-target']].items.stones,2);
  assert.throws(()=>h.send('++인벤 D-28',target),/관리자 권한/);
});


test('p pauses a battle durably, stops its timer and resumes the same phase and plan',t=>{
 const h=harness(t);begin(h);
 assert.ok(A4.BattleUI.controls(h.user().run.battle,h.c).endsWith('s / p / gg'));
 const before=h.user().run;
 assert.equal(h.send('p'),'⚔️ 세션 종료: +탐험으로 기존 탐험을 이어갑니다.');
 assert.equal(h.user().session,null);before.battle.mainDeadline=null;
 assert.deepEqual(h.user().run,before);
 assert.deepEqual(h.app.tick(NOW+300000),[]);
 h.reopen();assert.deepEqual(h.user().run,before);
 h.send('+탐험',{now:NOW+300000});
 assert.equal(h.user().run.battle.phase,before.battle.phase);
 assert.deepEqual(h.user().run.battle.enemyPlan,before.battle.enemyPlan);
 assert.equal(h.user().run.battle.mainDeadline,NOW+450000);
 assert.equal(h.send('P',{now:NOW+300001}),'⚔️ 세션 종료: +탐험으로 기존 탐험을 이어갑니다.');
});
test('White Night refuses p with only its quote and does not extend twenty-second deadline',t=>{
 const h=harness(t);begin(h);
 h.mutate((state,u)=>{u.run.battle.enemy.heroPower=A4.BossRules.power('white_night');u.run.battle.enemyPlan=[];u.run.battle.enemyPowerPlan=false;u.run.battle.mainTimeoutMs=15000;A4.Game.syncDeadline(u,NOW);});
 const before=h.user().run.battle;
 assert.equal(before.mainDeadline,NOW+20000);
 assert.equal(h.send('p',{now:NOW+10000}),'시간을 신뢰하지 말라. 내가 너를 지도할 것이다.');
 assert.deepEqual(h.user().run.battle,before);assert.ok(h.user().session);
 assert.equal(h.app.tick(NOW+19999).length,0);
 assert.equal(h.app.tick(NOW+20000).length,1);
 assert.match(h.send('+도감 하얀 밤'),/15초/);
});


test('hero selection omits decks, partial hero-deck query and rule poison text work without an active run',t=>{
 const h=harness(t);
 const query=h.send('+덱 셀레');assert.match(query,/⚔️ 영웅 - 운룡 셀레스테 ⚔️/);assert.match(query,/도약/);assert.match(query,/탐구/);
 assert.equal(query,h.send('+ㄷ 셀레스테'));assert.match(h.send('+덱 사일'),/⚔️ 영웅 - 사일런트 ⚔️/);
 assert.throws(()=>h.send('+덱 없는영웅'),/일치하는 영웅/);
 assert.match(h.send('+규칙'),/중독이 부여된 캐릭터는 매 스탠바이 페이즈시마다 중독만큼 피해를 받고, 중독이 1 감소합니다./);
 const hero=h.send('+탐험');for(const text of ['거프','사일런트','셀레스테','양성','신속','탐구'])assert.ok(hero.includes(text));
 for(const card of ['수중 동물 변신','찌릿!','불길'])assert.ok(!hero.includes(card));
 h.send('3');h.reopen();h.send('+탐험');h.send('y');assert.equal(h.user().run.hero.id,'celeste');assert.equal(h.user().run.battle.player.heroPower.id,'inquiry');
});
test('deck presentation sorts cost then element then treasure without mutating saved order',t=>{
 const h=harness(t);begin(h);
 h.mutate((s,u)=>{u.run.deck=['treasure_wonder_wand','general:맹독','general:화염구','crackle','flash_freeze','general:필연','general:과열'].map(id=>({uid:A4.id(s,'sort-'),cardId:id,upgraded:false}));});
 const before=h.user().run.deck,text=h.send('+덱');
 const order=['과열','화염구','불가사의한 마법봉','맹독','파지직','급속 빙결','필연'];
 let at=-1;for(const name of order){const next=text.indexOf(name);assert.ok(next>at,text);at=next;}
 assert.deepEqual(h.user().run.deck,before);
});
test('item grants and removals accept partial item names and partial nicknames',t=>{
 const h=harness(t);h.send('++관리자획득');h.send('+인벤',{identity:'items-target',name:'아이템 받는 유저'});
 assert.match(h.send('++아이템지급 받는 강 3'),/강화석 3개 지급/);
 assert.match(h.send('++아이템회수 받는 강화 1'),/강화석 1개 회수/);
 assert.match(h.send('++아이템지급 받는 열쇠 2'),/미궁 열쇠 2개 지급/);
 assert.match(h.send('++아이템지급 받는 정 1'),/정수 1개 지급/);
 assert.match(h.send('++아이템지급 받는 골 50'),/코인 50C 지급/);
 const before=h.store.getState();assert.throws(()=>h.send('++아이템지급 받는 없는아이템 1'),/일치하는 아이템/);assert.deepEqual(h.store.getState(),before);
});


test('lamp searches ordinary base cards, supports n, keeps total deadline and resumes after disk reload',t=>{
 const h=harness(t);begin(h);
 h.mutate((state,u)=>{const b=u.run.battle;b.player.hand=[{uid:'lamp',cardId:'treasure_zephrys_lamp'}];b.enemyPlan=[];b.enemyPowerPlan=false;});
 const first=h.send('1');assert.equal(first,'⚔️ 제피르스의 램프 ⚔️\n\n+카드명으로 원하는 카드명을 검색하세요.');
 const deadline=h.user().run.battle.mainDeadline;assert.equal(deadline,NOW+120000);
 assert.equal(h.send('+독',{identity:'outsider',now:NOW+1000}),null);
 const found=h.send('+독',{now:NOW+10000});assert.match(found,/자연의 해독/);assert.match(found,/1 \/ 2 \/ n/);assert.doesNotMatch(found,/⚔️ 탐험 1/);
 let p=h.user().run.battle.pendingChoice;assert.equal(p.options.length,2);assert.ok(p.options.every(x=>!x.upgraded&&h.c.cardPool.includes(x.cardId)));
 h.reopen();assert.equal(h.user().run.battle.mainDeadline,deadline);
 assert.equal(h.send('n',{now:NOW+20000}),first);assert.equal(h.user().run.battle.mainDeadline,deadline);
 h.send('+독',{now:NOW+30000});const selected=h.user().run.battle.pendingChoice.options[0].cardId;
 const final=h.send('1',{now:NOW+40000});assert.equal(h.user().run.battle.pendingChoice,null);assert.ok(h.user().run.battle.player.hand.some(x=>x.cardId===selected));
 assert.equal(A4.UI.messages(final).length,2);
});

test('unpausable lamp total 120-second timeout grants one random ordinary card even with no search result',t=>{
 const h=harness(t);begin(h);
 h.mutate((state,u)=>{const b=u.run.battle;b.enemy.heroPower=A4.BossRules.power('white_night');b.player.hand=[{uid:'lamp',cardId:'treasure_zephrys_lamp'}];b.enemyPlan=[];b.enemyPowerPlan=false;});
 h.send('1');h.send('+없는카드',{now:NOW+110000});h.reopen();
 assert.equal(h.app.tick(NOW+119999).length,0);const out=h.app.tick(NOW+120000);assert.equal(out.length,1);
 const b=h.user().run.battle;assert.equal(b.pendingChoice,null);assert.equal(b.player.hand.length,1);assert.ok(h.c.cardPool.includes(b.player.hand[0].cardId));
});


test('hero selection and starter deck show ability effect on its own line',t=>{
 const h=harness(t),text=h.send('+탐험');
 for(const hero of h.c.heroes)assert.ok(text.includes('[🛟] '+hero.power.name+(hero.power.kind==='active'?' | 💧'+hero.power.cost:' | ⏳️지속')+'\n'+hero.power.text));
 const query=h.send('+덱 셀레');assert.ok(query.startsWith('⚔️ 영웅 - 운룡 셀레스테 ⚔️\n[🛟] 탐구 | ⏳️지속\n'+h.c.heroes[2].power.text));
 assert.ok(query.includes('도약'));
});


test('White Night transform logs the power change and announces the passive after both battle messages once',t=>{
 const h=harness(t);begin(h);
 h.mutate((state,u)=>{const b=u.run.battle;b.enemy.heroPower=A4.BossRules.power('plague_doctor');b.enemy.status.baptisms=11;b.enemy.heroPowerReadyTurn=0;b.enemy.mana=5;b.enemyPlan=[];b.enemyPowerPlan=true;});
 const req=request('s'),text=h.app.handle(req),parts=A4.UI.messages(text);
 assert.equal(parts.length,3);assert.match(parts[0],/\[🛟\] 세례가 \[🛟\] 하얀 밤으로 변신합니다\./);assert.match(parts[1],/^▶️ 상대 손패/);
 assert.equal(parts[2],'[🛟] 하얀 밤 | 지속형\n메인 페이즈의 제한 시간이 15초로 감소합니다.');
 assert.equal(h.user().run.battle.mainTimeoutMs,20000);assert.deepEqual(h.user().run.battle.pendingPowerAnnouncements,[]);
 h.reopen();assert.equal(h.app.handle(req),text);assert.equal(A4.UI.messages(h.send('+탐험')).length,2);
});

test('White Night announcement waits through a pending discovery and disk restart',t=>{
 const h=harness(t);begin(h);
 h.mutate((state,u)=>{
  const b=u.run.battle;b.enemy.heroPower=A4.BossRules.power('plague_doctor');b.enemy.status.baptisms=11;
  const x={uid:'after-transform-discover',cardId:'general:믹스테이프',upgraded:false};b.player.inFlight.push(x);
  b.resolution={queue:[{kind:'power',module:'boss',side:'enemy',power:A4.BossRules.power('plague_doctor')},{kind:'card',module:'cards',side:'player',card:x,def:A4.Battle.describeCard(x,h.c)}]};
  A4.Battle.process(b,h.c,A4.random(state));A4.Game.syncDeadline(u,NOW);
 });
 assert.equal(h.user().run.battle.pendingPowerAnnouncements.length,1);h.reopen();
 const choice=h.send('+탐험');assert.equal(A4.UI.messages(choice).length,1);assert.doesNotMatch(choice,/하얀 밤/);
 const final=A4.UI.messages(h.send('1'));assert.equal(final.length,3);assert.equal(final[2],'[🛟] 하얀 밤 | 지속형\n메인 페이즈의 제한 시간이 15초로 감소합니다.');
 assert.deepEqual(h.user().run.battle.pendingPowerAnnouncements,[]);
});


test('Doctor speech appears only in the battle log and persists as one receipt',t=>{
 const h=harness(t);begin(h);
 h.mutate((state,u)=>{const b=u.run.battle;b.enemy.name='역병 의사';b.enemy.heroPower=A4.BossRules.power('plague_doctor');b.enemy.status.baptisms=0;b.enemy.mana=5;b.enemy.heroPowerReadyTurn=0;b.enemyPlan=[];b.enemyPowerPlan=true;});
 const req=request('s'),out=h.app.handle(req),parts=A4.UI.messages(out);
 const quote=A4.content.opponentAbilities.doctorQuotes[0].replace(/\(플레이어 닉네임\)/g,h.user().name);
 assert.equal(parts.length,2);assert.ok(parts[0].includes('• '+quote));assert.match(parts[1],/^▶️ 상대 손패/);
 h.reopen();assert.equal(h.app.handle(req),out);assert.equal(A4.UI.messages(h.send('+탐험')).length,2);assert.equal(h.user().run.battle.pendingDoctorSpeeches,undefined);
});


test('named deck lookup displays boss powers and full sorted fixed decks without creating or changing accounts',t=>{
 const h=harness(t),before=h.store.getState(),revision=h.store.getRevision();
 for(const id of ['cannon_minion','boo','meltranix','aurelion_sol']){
  const ref=A4.Opponents.get(id),text=h.send('+덱 '+ref.name),power=h.c.enemies[id].heroPower;
  assert.ok(text.startsWith('⚔️ 상대 - '+ref.name+' ⚔️\n[🛟] '+power.name));assert.ok(text.includes('\n'+power.text+'\n\n'));
  assert.doesNotMatch(text,/^\d+\. /m);assert.equal(Array.from(text.matchAll(/^x(\d+) /gm),x=>Number(x[1])).reduce((n,x)=>n+x,0),ref.deckSize);
  assert.ok(text.includes(power.kind==='passive'?'| ⏳️지속':'| 💧'+power.cost));
 }
 assert.equal(h.send('+덱 아우솔'),h.send('+덱 아우렐리온 솔'));
 assert.equal(h.send('+ㄷ 부끄'),h.send('+덱 부끄부끄'));
 assert.match(h.send('+덱 역병 의사'),/일반 카드 무작위 37장/);
 assert.match(h.send('+덱 얼굴 없는 배후자'),/플레이어의 탐험 덱과 보물을 복제합니다/);
 assert.deepEqual(h.store.getState(),before);assert.equal(h.store.getRevision(),revision);
 begin(h);const saved=h.store.getState();h.send('+덱 유미');assert.deepEqual(h.store.getState(),saved);
});


test('deck displays group identical copies with x counts and keep upgrades and costs separate',t=>{
 const h=harness(t);const hero=h.send('+덱 사일런트');assert.equal((hero.match(/^x3 /gm)||[]).length,2);assert.equal((hero.match(/^x2 /gm)||[]).length,2);assert.doesNotMatch(hero,/^\d+\. /m);
 const boss=h.send('+덱 아우솔');assert.match(boss,/^x14 \[🌌\] 수정구 \| 💧0$/m);assert.match(boss,/^x4 \[🌊\] 불길한 존재감 \| 💧1$/m);assert.match(boss,/^x2 \[🔥\] 제독 \| 💧1$/m);
 begin(h);h.mutate((state,u)=>{u.run.deck=[{uid:A4.id(state,'count-'),cardId:'general:화염구',upgraded:false},{uid:A4.id(state,'count-'),cardId:'general:화염구',upgraded:true},{uid:A4.id(state,'count-'),cardId:'general:화염구',upgraded:false},{uid:A4.id(state,'count-'),cardId:'general:화염구',upgraded:false,cost:0}];});
 const saved=h.store.getState(),text=h.send('+덱');assert.doesNotMatch(text,/^\d+\. /m);assert.match(text,/^x2 \[🔥\] 화염구 \| 💧1$/m);assert.match(text,/^x1 \[🔥\] 화염구\+ \| 💧1$/m);assert.match(text,/^x1 \[🔥\] 화염구 \| 💧0$/m);assert.deepEqual(h.store.getState(),saved);
});


test('Celeste old active power migrates in the run, battle and restart specifications on resume',t=>{
 const h=harness(t);h.send('+탐험');h.send('3');h.send('y');
 h.mutate((state,u)=>{
  const old={id:'inquiry',name:'탐구',kind:'active',cost:1,usesPerTurn:1,text:'old',effects:[{type:'generate',cardId:'crystal_ball',amount:1}]};
  u.run.hero.power=Object.assign({},old);u.run.battle.player.heroPower=Object.assign({},old);u.run.battle.restartSpecs.player.heroPower=Object.assign({},old);
 });
 h.reopen();h.send('+탐험');const r=h.user().run;
 for(const p of [r.hero.power,r.battle.player.heroPower,r.battle.restartSpecs.player.heroPower]){
  assert.equal(p.kind,'passive');assert.equal(p.cost,0);assert.equal(p.usesPerTurn,undefined);assert.deepEqual(p.effects,[]);assert.match(p.text,/2턴마다/);
 }
});


test('statistics and its initial alias are pure queries even without an account or during a reward',t=>{
 const h=harness(t),before=h.store.getState(),revision=h.store.getRevision();
 const output=h.send('+통계');assert.match(output,/📊 탐험 통계 📊/);assert.match(output,/■ 속성별 통계/);assert.match(output,/■ 카드별 통계/);assert.match(output,/■ 보물별 통계/);assert.match(output,/■ 봇별 격파율/);
 assert.equal(h.send('+ㅌㄱ'),output);assert.deepEqual(h.store.getState(),before);assert.equal(h.store.getRevision(),revision);
 begin(h);h.app.handle(prepareWinningSubmission(h));const active=h.store.getState(),rev=h.store.getRevision();
 h.send('+통계');assert.deepEqual(h.store.getState(),active);assert.equal(h.store.getRevision(),rev);
});

test('stats persist choices, settle run averages once and do not count reward abandonment as another opponent loss',t=>{
 const h=harness(t);begin(h);const enemy=h.user().run.enemyId;
 const winning=prepareWinningSubmission(h);h.app.handle(winning);h.app.handle(winning);
 assert.equal(h.store.getState().stats.bots[enemy].win,1);
 const treasure=h.user().run.pending,treasureId=treasure.options[0];assert.equal(treasure.kind,'treasure');
 const chosen=request('+선택 '+treasure.id+' 1');h.app.handle(chosen);h.app.handle(chosen);
 let stats=h.store.getState().stats;for(const id of treasure.options)assert.equal(stats.treasures[id].offered,1);
 assert.equal(stats.treasures[treasureId].picked,1);assert.equal(stats.treasures[treasureId].runs,0);
 const add=h.user().run.pending,id=add.options[0][0];assert.equal(add.kind,'bundles');h.send('+선택 '+add.id+' 1');
 assert.equal(h.store.getState().stats.cards[id].picked,1);assert.equal(h.store.getState().stats.cards[id].runs,0);
 const quitting=request('gg');h.app.handle(quitting);const saved=h.store.getState().stats;
 assert.equal(saved.treasures[treasureId].runs,1);assert.equal(saved.treasures[treasureId].totalWins,1);
 assert.equal(saved.cards[id].runs,1);assert.equal(saved.cards[id].totalWins,1);assert.equal(saved.bots[enemy].loss,0);
 h.app.handle(quitting);assert.deepEqual(h.store.getState().stats,saved);h.reopen();assert.deepEqual(h.store.getState().stats,saved);
 assert.match(h.send('+통계'),/평균 승수 1.00승/);
});

test('forfeiting an active battle records one opponent loss and zero final wins',t=>{
 const h=harness(t);begin(h);const enemy=h.user().run.enemyId,cardId=h.user().run.deck[0].cardId;
 h.send('gg');const stats=h.store.getState().stats;assert.equal(stats.bots[enemy].loss,1);assert.equal(stats.bots[enemy].win,0);
 assert.equal(stats.cards[cardId].runs,1);assert.equal(stats.cards[cardId].totalWins,0);
});


test('public play style persists without hidden zones, deduplicates input and reaches the next opening plan',t=>{
 const h=harness(t);begin(h);const winning=prepareWinningSubmission(h);h.app.handle(winning);h.app.handle(winning);
 const history=h.user().aiPublicHistory;assert.equal(history.length,1);assert.equal(history[0].phase,'MAIN1');assert.equal(history[0].player.length,1);
 assert.deepEqual(Object.keys(history[0].player[0]).sort(),['cardId','countered','element','upgraded']);assert.equal(history[0].player[0].cardId,'general:화염구');
 h.reopen();assert.deepEqual(h.user().aiPublicHistory,history);rewardChoices(h);h.send('+탐험');h.send('y');
 assert.deepEqual(h.user().run.battle.publicPlayerHistory,history);
 const before=h.store.getState();A4.AI.plan(before.users[before.identities['identity:'+ID]].run.battle,h.c,()=>{throw Error('must not use live RNG');});
 assert.deepEqual(h.store.getState(),before);
 h.mutate((state,u)=>{u.aiPublicHistory=Array.from({length:48},()=>JSON.parse(JSON.stringify(history[0])));});
 const next=prepareWinningSubmission(h);h.app.handle(next);assert.equal(h.user().aiPublicHistory.length,48);
});


test('admin restart returns the room battle to the same encounter with current stage HP without recording a loss or rerolling',t=>{
 const h=harness(t);begin(h);operator(h,'++관리자획득');
 h.mutate((s,u)=>{const r=u.run;r.wins=3;r.enemySpec.stage=4;r.enemySpec.maxHp=30;r.battle.enemy.hp=2;r.battle.enemy.maxHp=30;});
 const before=h.store.getState(),saved=h.user(),spec=saved.run.enemySpec;
 const command=request('++재시작',Object.assign({},ADMIN,{room:'옥랜111'}));
 const out=h.app.handle(command),u=h.user();
 assert.match(out,/❤️ 35/);assert.match(out,/\ny \/ n$/);
 assert.equal(u.run.phase,'ENCOUNTER');assert.equal(u.run.battle,null);assert.equal(u.run.turnToken,null);assert.equal(u.run.wins,3);
 assert.equal(u.run.enemyId,saved.run.enemyId);assert.equal(u.run.enemySpec.maxHp,35);assert.deepEqual(u.run.enemySpec.deck,spec.deck);
 assert.deepEqual(u.run.deck,saved.run.deck);assert.deepEqual(u.run.treasures,saved.run.treasures);assert.deepEqual(u.items,saved.items);assert.equal(u.gold,saved.gold);
 assert.deepEqual(u.run.encounterResults,saved.run.encounterResults);assert.deepEqual(h.store.getState().stats,before.stats);assert.equal(h.store.getState().rngState,before.rngState);
 const audit=h.store.getState().adminHistory.at(-1);assert.equal(audit.command,'++재시작');assert.equal(audit.targetId,u.id);assert.notEqual(audit.actorId,u.id);
 const durable=h.store.getState();h.reopen();assert.equal(h.app.handle(command),out);assert.deepEqual(h.store.getState(),durable);
 h.send('y');assert.equal(h.user().run.battle.enemy.baseMaxHp,35);assert.equal(h.user().run.battle.enemy.maxHp,35);
});

test('restart requires admin permission and a battle, preserves pending-choice data on rejection, and clears it on success',t=>{
 const h=harness(t);begin(h);const before=h.store.getState();
 assert.throws(()=>h.send('++재시작'),/관리자 권한/);assert.deepEqual(h.store.getState(),before);
 h.send('++관리자획득');
 h.mutate((s,u)=>{const b=u.run.battle;b.enemyPlan=[];b.enemyPowerPlan=false;b.player.hand=[{uid:'restart-discovery',cardId:A4.CardRules.nameToId('수중 동물 변신'),upgraded:false}];});
 h.send('1');assert.ok(h.user().run.battle.pendingChoice);
 const choiceState=h.store.getState();assert.throws(()=>h.send('++재시작 1'),/사용법/);assert.deepEqual(h.store.getState(),choiceState);
 h.send('++재시작');assert.equal(h.user().run.battle,null);assert.equal(h.user().run.pending,null);assert.equal(h.user().run.phase,'ENCOUNTER');
 h.send('y');assert.equal(h.user().run.battle.pendingChoice,null);assert.equal(h.user().run.battle.turn,0);
 const idle=harness(t);idle.send('++관리자획득');const unchanged=idle.store.getState();assert.throws(()=>idle.send('++재시작'),/진행 중인 전투/);assert.deepEqual(idle.store.getState(),unchanged);
});


test('Silent receives its exact ten-card starter and deck lookup groups duplicate copies',t=>{
 const h=harness(t);h.send('+탐험');h.send('2');
 const expected=['타격','타격','타격','수비','수비','수비','무력화','무력화','연결','연결'];
 assert.equal(h.user().run.hero.id,'silent');assert.deepEqual(h.user().run.deck.map(x=>h.c.cards[x.cardId].name),expected);
 h.send('y');assert.equal(h.user().run.battle.player.hand.length,6);assert.equal(h.user().run.deck.length,10);
 const text=h.send('+덱 사일런트');assert.equal((text.match(/^x2 /gm)||[]).length,2);assert.equal((text.match(/^x3 /gm)||[]).length,2);
 h.reopen();assert.deepEqual(h.user().run.deck.map(x=>h.c.cards[x.cardId].name),expected);
});


test('Celeste receives its exact ten-card starter, costs and grouped lookup without changing its passive',t=>{
 const h=harness(t);h.send('+탐험');h.send('3');
 const expected=['연쇄 타격','연쇄 타격','연쇄 타격','수비','수비','수비','도약','도약','연결','연결'];
 const run=h.user().run;assert.equal(run.hero.id,'celeste');assert.equal(run.hero.power.kind,'passive');
 assert.deepEqual(run.deck.map(x=>h.c.cards[x.cardId].name),expected);
 assert.deepEqual(run.deck.map(x=>h.c.cards[x.cardId].cost),Array(10).fill(1));
 h.send('y');assert.equal(h.user().run.battle.player.hand.length,4);assert.equal(h.user().run.deck.length,10);
 const text=h.send('+덱 셀레스테');assert.equal((text.match(/^x2 /gm)||[]).length,2);assert.equal((text.match(/^x3 /gm)||[]).length,2);assert.doesNotMatch(text,/^x1 /m);
 h.reopen();assert.deepEqual(h.user().run.deck.map(x=>h.c.cards[x.cardId].name),expected);
});


test('retired Vitality Potion is removed from saved ownership, offers and mirror specs before rendering, exactly once',t=>{
 const h=harness(t);begin(h);
 h.mutate((state,u)=>{const r=u.run,b=r.battle;r.treasures.high='vitality_potion';
  for(const side of ['player','enemy']){const f=b[side];f.maxHp*=2;f.hp*=2;f.baseMaxHp*=2;f.status.treasures.vitalityApplied=true;f.treasureIds.push('vitality_potion');f.passives.push({type:'treasurePassive',id:'vitality_potion'});b.restartSpecs[side].treasureIds=['vitality_potion'];}
  r.enemySpec.treasures.push({treasureId:'vitality_potion'});
 });
 const doubled=h.user().run.battle;h.reopen();const r=h.user().run;
 assert.equal(r.treasures.high,undefined);assert.equal(r.battle.player.maxHp,doubled.player.maxHp/2);assert.equal(r.battle.player.hp,doubled.player.hp/2);
 assert.ok(!JSON.stringify(r).includes('vitality_potion'));assert.doesNotThrow(()=>h.send('+덱'));assert.doesNotThrow(()=>h.send('+탐험'));
 const hp=r.battle.player.maxHp;h.reopen();assert.equal(h.user().run.battle.player.maxHp,hp);
 h.mutate((state,u)=>{u.run.phase='REWARD';u.run.battle=null;u.run.pending={id:'retired-offer',kind:'treasure',options:['vitality_potion'],extra:{slot:'high'}};});
 h.reopen();assert.ok(h.user().run.pending.options.length);assert.ok(!h.user().run.pending.options.includes('vitality_potion'));
 assert.doesNotMatch(h.send('+도감 활력의 물약'),/내 시작하는 생명력/);
});


test('victory carries exact remaining HP through rewards, reload, encounter and admin restart without healing or increasing maximum HP',t=>{
 const h=harness(t);begin(h);h.send('++관리자획득');
 const winning=prepareWinningSubmission(h);
 h.mutate((s,u)=>{u.run.battle.player.hp=7;u.run.battle.player.shield=9;});
 h.app.handle(winning);assert.equal(h.user().run.hp,7);assert.equal(h.user().run.wins,1);
 h.reopen();assert.equal(h.user().run.hp,7);rewardChoices(h);h.send('+탐험');assert.equal(h.user().run.phase,'ENCOUNTER');h.send('y');
 let b=h.user().run.battle;assert.equal(b.player.maxHp,60);assert.equal(b.player.hp,7);assert.equal(b.player.shield,0);assert.equal(b.restartSpecs.player.hp,7);
 h.send('++재시작');h.send('y');b=h.user().run.battle;assert.equal(b.player.hp,7);assert.equal(b.player.maxHp,60);
 // A subsequent victory uses the actual ending HP, including healing during combat.
 const next=prepareWinningSubmission(h);h.mutate((s,u)=>{u.run.battle.player.hp=12;});h.app.handle(next);assert.equal(h.user().run.hp,12);
 rewardChoices(h);h.send('+탐험');h.send('y');b=h.user().run.battle;assert.equal(b.player.hp,12);assert.equal(b.player.maxHp,60);
});

test('account currency is displayed and administered as coins C without changing saved balances or run gold',t=>{
 const h=harness(t);h.send('+인벤');h.send('++관리자획득');h.mutate((s,u)=>{u.gold=1234;});
 assert.match(h.send('+인벤'),/코인: 1234C/);assert.match(h.send('++아이템지급 실제 설정 검증 코인 10'),/코인 10C 지급/);
 assert.match(h.send('++아이템회수 실제 설정 검증 C 4'),/코인 4C 회수/);assert.equal(h.user().gold,1240);
 h.reopen();assert.match(h.send('++인벤 실제 설정 검증'),/코인: 1240C/);
 h.send('+탐험');h.send('1');h.send('y');h.app.handle(prepareWinningSubmission(h));h.send('1');assert.match(h.send('+탐험'),/골드/);assert.equal(h.user().gold,1240);
});
