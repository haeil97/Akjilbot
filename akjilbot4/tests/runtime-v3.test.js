'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');

function device(){
  const sandbox={},files={},listeners={},timers=new Map(),replies=[],sent=[],delays=[];
  let now=100000,nextTimer=0,locks=0;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../악질봇4.0.0.js'),'utf8'),sandbox);
  const bot={addListener:(event,fn)=>{listeners[event]=fn;},removeListener:(event,fn)=>{if(listeners[event]===fn)delete listeners[event];},send:(room,text)=>sent.push({room,text})};
  sandbox.BotManager={getCurrentBot:()=>bot};sandbox.Event={MESSAGE:'message',START_COMPILE:'compile'};
  sandbox.java={lang:{Thread:{sleep:ms=>delays.push({ms,replies:replies.length,sent:sent.length})}},util:{concurrent:{TimeUnit:{MILLISECONDS:'ms'},locks:{ReentrantLock:function(){this.tryLock=()=>{locks++;return true;};this.lock=()=>locks++;this.unlock=()=>locks--;}}}}};
  sandbox.Date={now:()=>now};
  sandbox.setInterval=fn=>{const id=++nextTimer;timers.set(id,fn);return id;};
  sandbox.clearInterval=id=>timers.delete(id);
  sandbox.A4.Store.javaIO=()=>({list:()=>Object.keys(files),read:n=>files[n],writeNewDurable:(n,text)=>{assert.equal(files[n],undefined);files[n]=text;}});
  function start(){return sandbox.A4.Runtime.start(sandbox);}
  function send(room,text,id='hash-1',eventId){listeners.message({room,content:text,author:{hash:id,name:'테스터'},logId:eventId,reply:text=>replies.push(text)});}
  return {sandbox,start,send,replies,sent,delays,timers,listeners,get locks(){return locks;},advance:ms=>{now+=ms;for(const fn of timers.values())fn();}};
}

test('single-file runtime only accepts the two live rooms and one test room and shares identity',()=>{
  const d=device(),rt=d.start();
  d.send('허용 안 된 방','+탐험');assert.equal(Object.keys(rt.store.getState().users).length,0);assert.equal(d.replies.length,0);
  d.send('옥랜111','+ㅇㅂ');assert.match(d.replies.at(-1),/코인: 0C/);
  d.send('옥랜222','+탐험');d.send('개발123','+ㅇㅂ');
  assert.equal(Object.keys(rt.store.getState().users).length,1);assert.match(d.replies.at(-1),/🔑 🔑 🔑 🔑 ✔️ \[탐험 종료 후 충전\]/);
  assert.equal(d.locks,0);rt.shutdown();assert.equal(d.timers.size,0);
});

test('runtime logs processing and saving separately and clears save timing for read-only queries',()=>{
  const d=device(),logs=[];let now=100000;
  d.sandbox.Date={now:()=>now};d.sandbox.Log={i:text=>logs.push(text),e:text=>logs.push(text)};
  const baseIO=d.sandbox.A4.Store.javaIO;
  d.sandbox.A4.Store.javaIO=()=>{const io=baseIO(),write=io.writeNewDurable;io.writeNewDurable=(name,text)=>{now+=600;write(name,text);};return io;};
  const rt=d.start();d.send('옥랜111','+탐험');
  assert.match(logs.at(-1),/처리 0ms \/ 저장 1200ms \/ 전송 0ms/);
  const render=d.sandbox.A4.UI.render;
  d.sandbox.A4.UI.render=function(...args){now+=1500;return render(...args);};
  d.send('옥랜111','+통계');
  assert.match(logs.at(-1),/처리 1500ms \/ 저장 0ms \/ 전송 0ms/);
  rt.shutdown();
});

test('runtime timer expires a session once and shutdown removes both listeners and timer',()=>{
  const d=device(),rt=d.start();d.send('개발123','+탐험');
  const before=Object.values(rt.store.getState().users)[0].run;
  d.advance(60000);assert.equal(d.sent.length,1);assert.match(d.sent[0].text,/⚔️ 세션 종료:/);
  assert.deepEqual(Object.values(rt.store.getState().users)[0].run,before);
  d.advance(60000);assert.equal(d.sent.length,1);
  d.listeners.compile();assert.equal(d.timers.size,0);assert.equal(d.listeners.message,undefined);assert.equal(d.locks,0);
});

test('recompiling single-file runtime preserves choice and key and does not duplicate the timer',()=>{
  const d=device();let rt=d.start();d.send('옥랜111','+탐험','hash-1','same-command');
  const before=Object.values(rt.store.getState().users)[0];rt=d.start();assert.equal(d.timers.size,1);
  let after=Object.values(rt.store.getState().users)[0];assert.deepEqual(after.run,before.run);assert.equal(after.session,null);
  d.send('옥랜222','+탐험');after=Object.values(rt.store.getState().users)[0];assert.equal(after.items.keys,4);assert.equal(after.run.pending.id,before.run.pending.id);
  rt.shutdown();
});

test('plain numbers select heroes and submit cards; runtime sends each committed reply batch once',()=>{
  const d=device(),rt=d.start(),revision=rt.store.getRevision();d.send('옥랜111','42');assert.equal(d.replies.length,0);assert.equal(Object.keys(rt.store.getState().users).length,0);assert.equal(rt.store.getRevision(),revision);
  d.send('옥랜111','+탐험');assert.doesNotMatch(d.replies.at(-1),/\+선택/);
  let count=d.replies.length;d.send('옥랜111','1','hash-1','hero');
  assert.equal(d.replies.length,count+1);assert.match(d.replies.at(-1),/\ny \/ n$/);count=d.replies.length;d.send('옥랜111','y','hash-1','start');
  assert.equal(d.replies.length,count+2);assert.match(d.replies[count],/^⚔️/);assert.match(d.replies[count+1],/^▶️/);
  d.send('옥랜222','1');assert.equal(d.replies.length,count+2);
  rt.store.transact('arrange numeric submission',s=>{const u=Object.values(s.users)[0],b=u.run.battle;b.player.mana=5;b.player.maxMana=5;b.player.hp=8;b.enemyPlan=[];b.enemyPowerPlan=false;b.player.hand=[{uid:'n1',cardId:d.sandbox.A4.CardRules.nameToId('천둥')},{uid:'n2',cardId:d.sandbox.A4.CardRules.nameToId('치유의 손길')}];});
  count=d.replies.length;d.send('옥랜111','0 2 1','hash-1','batch');
  assert.equal(d.replies.length,count+2);const saved=rt.store.getState(),u=Object.values(saved.users)[0];
  assert.equal(u.run.battle.phase,'MAIN2');assert.equal(u.run.battle.player.playedThisTurn,2);assert.equal(u.run.battle.player.heroPowerUsedTurn,0);
  assert.deepEqual(Array.from(u.run.battle.history[0].player,x=>x.cardId),['치유의 손길','천둥'].map(n=>d.sandbox.A4.CardRules.nameToId(n)));
  d.send('옥랜111','0 2 1','hash-1','batch');assert.deepEqual(rt.store.getState(),saved);assert.equal(d.replies.length,count+2);
  rt.shutdown();
});

test('numeric discovery resumes after restart and a winning hit sends result before numeric rewards',()=>{
  const d=device();let rt=d.start();d.send('개발123','+탐험');d.send('개발123','1');d.send('개발123','y');
  rt.store.transact('arrange discovery',s=>{const b=Object.values(s.users)[0].run.battle;b.enemyPlan=[];b.enemyPowerPlan=false;b.player.hand=[{uid:'discover1',cardId:d.sandbox.A4.CardRules.nameToId('수중 동물 변신')}];});
  const beforeChoiceReplies=d.replies.length;d.send('개발123','1');
  assert.equal(d.replies.length,beforeChoiceReplies+1);assert.match(d.replies.at(-1),/^⚔️ 인양 -/);assert.doesNotMatch(d.replies.at(-1),/■ |▶️/);
  const before=Object.values(rt.store.getState().users)[0].run.battle.pendingChoice;assert.ok(before);
  rt=d.start();d.send('개발123','+탐험');assert.deepEqual(Object.values(rt.store.getState().users)[0].run.battle.pendingChoice,before);
  const beforeResolveReplies=d.replies.length;d.send('개발123','1');assert.equal(Object.values(rt.store.getState().users)[0].run.battle.pendingChoice,null);
  assert.equal(d.replies.length,beforeResolveReplies+2);assert.match(d.replies.at(-2),/^⚔️ 탐험/);assert.match(d.replies.at(-1),/^▶️/);
  rt.store.transact('arrange final hit',s=>{const b=Object.values(s.users)[0].run.battle;b.enemy.hp=1;b.enemyPlan=[];b.enemyPowerPlan=false;b.player.hand=[{uid:'final-hit',cardId:'general:화염구',cost:0}];});
  const count=d.replies.length;d.send('개발123','1');assert.equal(d.replies.length,count+3);
  assert.match(d.replies[count],/❤️ -3\/15/);assert.match(d.replies[count],/화염구/);assert.match(d.replies[count+1],/^⚔️ 탐험 - 승리! ⚔️\n.+ ✅️$/);assert.match(d.replies[count+2],/보물 획득/);assert.doesNotMatch(d.replies[count+2],/\+선택/);
  let u=Object.values(rt.store.getState().users)[0];assert.equal(u.run.pending.kind,'treasure');d.send('개발123','1');
  u=Object.values(rt.store.getState().users)[0];assert.equal(u.run.pending.kind,'bundles');rt.shutdown();
});

test('white night timer delivers result and controls as separate messages',()=>{
  const d=device(),rt=d.start();d.send('옥랜111','+탐험');d.send('옥랜111','1');d.send('옥랜111','y');
  rt.store.transact('arrange deadline',s=>{const b=Object.values(s.users)[0].run.battle;b.mainTimeoutMs=15000;b.mainDeadline=115000;b.enemyPlan=[];b.enemyPowerPlan=false;});
  d.advance(15000);assert.equal(d.sent.length,2);assert.match(d.sent[0].text,/⚔️/);assert.match(d.sent[1].text,/^▶️/);assert.ok(d.sent.every(m=>!m.text.includes('\u001e')));rt.shutdown();
});

test('occupied room silently rejects all outsider commands, including malformed input and admin acquisition',()=>{
  const d=device(),rt=d.start();d.send('옥랜111','+인벤','other','old-inventory');d.send('옥랜111','++관리자획득','admin');
  d.send('옥랜111','+탐험','owner');const before=rt.store.getState(),revision=rt.store.getRevision(),count=d.replies.length;
  const token=before.users[before.identities['identity:owner']].run.pending.id;
  for(const id of ['other','new-user'])for(const cmd of ['+탐험','+인벤','+ㅇㅂ','+도움말','+덱','+상점','++관리자획득','++아이템지급 테스터 정수 1','1','0 1','s','gg','y','n','+선택 '+token+' 1','+제출','+제출 old 영웅 영웅'])d.send('옥랜111',cmd,id);
  d.send('옥랜111','+인벤','other','old-inventory');
  for(const cmd of ['+ㅌㅎ','+ㅅㅌ '+token+' 1','+ㅈㅊ','+탐험','1','0 1','s','gg','y','n','+선택 '+token+' 1','+제출','+제출 old 영웅 영웅'])d.send('옥랜111',cmd,'admin');
  assert.equal(d.replies.length,count);assert.deepEqual(rt.store.getState(),before);assert.equal(rt.store.getRevision(),revision);
  d.send('옥랜111','+인벤','admin');assert.equal(d.replies.length,count+1);assert.match(d.replies.at(-1),/코인:/);
  d.send('옥랜111','++관리자획득','admin');assert.match(d.replies.at(-1),/이미 관리자/);
  d.send('옥랜111','1','owner');let s=rt.store.getState();assert.equal(s.users[s.identities['identity:owner']].run.phase,'ENCOUNTER');
  d.send('옥랜111','y','owner');s=rt.store.getState();assert.equal(s.users[s.identities['identity:owner']].run.phase,'BATTLE');rt.shutdown();
});

test('rooms run independently and moving or declining a session releases its previous room',()=>{
  const d=device(),rt=d.start();d.send('옥랜111','+탐험','a');d.send('옥랜222','+탐험','b');
  const before=rt.store.getState(),count=d.replies.length;d.send('옥랜222','+탐험','a');assert.deepEqual(rt.store.getState(),before);assert.equal(d.replies.length,count);
  d.send('개발123','+탐험','a');d.send('옥랜111','+탐험','c');let s=rt.store.getState();
  assert.equal(s.users[s.identities['identity:a']].session.room,'개발123');assert.equal(s.users[s.identities['identity:c']].session.room,'옥랜111');
  d.send('옥랜222','1','b');d.send('옥랜222','n','b');d.send('옥랜222','+탐험','d');s=rt.store.getState();
  assert.equal(s.users[s.identities['identity:b']].session,null);assert.ok(s.users[s.identities['identity:d']].run);rt.shutdown();
});

test('timeout and restart release occupancy without allowing another user to control the saved game',()=>{
  const d=device();let rt=d.start();d.send('옥랜111','+탐험','a');const run=rt.store.getState().users[rt.store.getState().identities['identity:a']].run;
  d.advance(60000);d.send('옥랜111','+탐험','b');let before=rt.store.getState();assert.deepEqual(before.users[before.identities['identity:a']].run,run);
  const count=d.replies.length;d.send('옥랜111','+탐험','a');assert.equal(d.replies.length,count);assert.deepEqual(rt.store.getState(),before);
  rt=d.start();d.send('옥랜111','+탐험','a');before=rt.store.getState();assert.deepEqual(before.users[before.identities['identity:a']].run,run);
  d.send('옥랜111','1','b');assert.deepEqual(rt.store.getState(),before);d.send('옥랜111','1','a');assert.equal(rt.store.getState().users[before.identities['identity:a']].run.phase,'ENCOUNTER');rt.shutdown();
});

test('split combat replies wait 150ms after the first message, including timer replies',()=>{
  const d=device(),rt=d.start();
  d.send('옥랜111','+인벤');assert.equal(d.delays.length,0);
  d.send('옥랜111','+탐험');d.send('옥랜111','1');d.send('옥랜111','y');
  let count=d.replies.length,waits=d.delays.length;
  d.send('옥랜111','s');
  assert.equal(d.replies.length,count+2);assert.equal(d.delays.length,waits+1);
  assert.equal(d.delays.at(-1).ms,150);assert.equal(d.delays.at(-1).replies,count+1);
  rt.store.transact('unpausable timer',s=>{Object.values(s.users)[0].run.battle.enemy.heroPower=d.sandbox.A4.BossRules.power('white_night');});
  count=d.sent.length;waits=d.delays.length;d.advance(150000);
  assert.equal(d.sent.length,count+2);assert.equal(d.delays.length,waits+1);
  assert.equal(d.delays.at(-1).ms,150);assert.equal(d.delays.at(-1).sent,count+1);
  assert.equal(d.locks,0);rt.shutdown();
});

test('compile shutdown fails promptly when an old task holds the runtime lock',()=>{
  const d=device();
  d.sandbox.java.util.concurrent.locks.ReentrantLock=function(){this.lock=()=>{};this.unlock=()=>{};this.tryLock=(ms,unit)=>{assert.equal(ms,3000);assert.equal(unit,'ms');return false;};};
  const rt=d.start();
  assert.throws(()=>d.listeners.compile(),/기존 봇 작업이 종료되지/);
  assert.equal(rt.store.isBlocked(),false);
});

test('outsiders can search named cards during another run without changing any account or session',()=>{
  const d=device(),rt=d.start();d.send('옥랜222','++관리자획득','admin');
  d.send('옥랜111','+탐험','owner');d.send('옥랜111','1','owner');d.send('옥랜111','y','owner');
  const before=rt.store.getState(),revision=rt.store.getRevision();
  for(const id of ['new-user','admin']){
    let count=d.replies.length;
    d.send('옥랜111','+도감 불길',id);assert.equal(d.replies.length,count+1);assert.match(d.replies.at(-1),/불길/);
    d.send('옥랜111','+ㄷㄱ 신비한 동전',id);assert.equal(d.replies.length,count+2);assert.match(d.replies.at(-1),/신비한 동전/);
    count=d.replies.length;
    for(const text of ['+도감','+ㄷㄱ','+탐험','1','S'])d.send('옥랜111',text,id);
    assert.equal(d.replies.length,count);
  }
  assert.deepEqual(rt.store.getState(),before);assert.equal(rt.store.getRevision(),revision);rt.shutdown();
});


test('victory announcement precedes rewards by two seconds, including timer victories and replay',()=>{
  for(const timed of [false,true]){
    const d=device(),rt=d.start();d.send('개발123','+탐험');d.send('개발123','1');d.send('개발123','y');
    let enemyName;
    rt.store.transact('arrange victory announcement',s=>{
      const b=Object.values(s.users)[0].run.battle;enemyName=b.enemy.name;
      b.enemy.hp=1;b.enemy.shield=0;b.enemyPlan=[];b.enemyPowerPlan=false;
      if(timed){b.enemy.heroPower=d.sandbox.A4.BossRules.power('white_night');b.phase='MAIN2';b.enemy.status.poison=1;b.mainDeadline=100001;}
      else b.player.hand=[{uid:'victory-hit',cardId:'general:화염구',cost:0}];
    });
    const count=timed?d.sent.length:d.replies.length;
    if(timed)d.advance(1);else d.send('개발123','1','hash-1','victory');
    const messages=timed?d.sent.map(x=>x.text):d.replies;
    assert.equal(messages.length,count+3);
    assert.match(messages[count],/■ /);assert.match(messages[count],timed?/❤️ 0\/15/:/❤️ -3\/15/);
    assert.equal(messages[count+1],'⚔️ 탐험 - 승리! ⚔️\n'+enemyName+' ✅️');
    assert.match(messages[count+2],/보물/);
    assert.equal(d.delays.at(-1).ms,2000);
    assert.equal(d.delays.at(-1)[timed?'sent':'replies'],count+2);
    assert.equal(Object.values(rt.store.getState().users)[0].run.wins,1);
    if(!timed){const saved=rt.store.getState(),delayCount=d.delays.length;d.send('개발123','1','hash-1','victory');assert.deepEqual(rt.store.getState(),saved);assert.equal(d.delays.length,delayCount);assert.equal(d.replies.length,count+3);}
    rt.shutdown();
  }
});


test('duplicate encyclopedia events reply once while new messages with identical text still reply',()=>{
  const d=device(),rt=d.start();
  d.send('개발123','+도감 화염구','hash-1','lookup-1');const count=d.replies.length;
  assert.equal(count,1);const revision=rt.store.getRevision();
  d.send('개발123','+도감 화염구','hash-1','lookup-1');assert.equal(d.replies.length,count);
  d.send('개발123','+도감 화염구','hash-1','lookup-2');assert.equal(d.replies.length,count+1);
  assert.equal(rt.store.getRevision(),revision);rt.shutdown();
});

test('empty log IDs fall back to message IDs, repeated message objects are suppressed, and compile keeps delivery history',()=>{
  const d=device();let rt=d.start();
  const message={room:'개발123',content:'+도감 불길',author:{hash:'hash-1',name:'테스터'},logId:null,messageId:'fallback-1',reply:text=>d.replies.push(text)};
  d.listeners.message(message);d.listeners.message(Object.assign({},message));assert.equal(d.replies.length,1);
  rt=d.start();d.listeners.message(Object.assign({},message));assert.equal(d.replies.length,1);
  const emptyId=Object.assign({},message,{logId:'',messageId:'fallback-2'});
  d.listeners.message(emptyId);d.listeners.message(Object.assign({},emptyId));assert.equal(d.replies.length,2);
  const noId=Object.assign({},message,{logId:undefined,messageId:undefined});
  d.listeners.message(noId);d.listeners.message(noId);assert.equal(d.replies.length,3);
  // Without an ID, separate message objects may be genuine repeated commands.
  d.listeners.message(Object.assign({},noId));assert.equal(d.replies.length,4);
  rt.shutdown();
});
