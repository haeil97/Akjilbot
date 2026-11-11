'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const A=require('../../악질봇4.0.0.js');
const copy=x=>JSON.parse(JSON.stringify(x));
let uid=0;
function card(name,extra={}){return Object.assign({uid:'ui-'+(++uid),cardId:A.CardRules.nameToId(name),upgraded:false},extra);}
function setup(){
  const c=copy(A.catalog),spec=name=>({name,maxHp:100,deck:Array.from({length:8},()=>card('천둥')),heroPower:copy(c.heroes[0].power)});
  const b=A.Battle.create(spec('닉네임'),spec('작은 해츨링'),c,()=>0.5);
  b.player.mana=b.player.maxMana=b.enemy.mana=b.enemy.maxMana=5;
  b.enemyPlan=[];b.enemyPowerPlan=false;
  return {b,c,submit:(cards=[],rng=()=>0.5,power=false)=>A.Battle.submit(b,cards.map(x=>x.uid),c,rng,{heroPower:power})};
}
test('opening shows turn one main 1 and health, then submissions show the next playable phase',()=>{
  const {b,c,submit}=setup();b.player.hp=b.player.maxHp=15;b.enemy.hp=b.enemy.maxHp=10;
  const initial=A.UI.messages(A.UI.render({run:{phase:'BATTLE',wins:0,battle:b}},{kind:'run'},c,0));
  assert.equal(initial[0],'⚔️ 탐험 1/8 · 1턴 · 메인 1 ⚔️\n\n■ 닉네임: ❤️ 15/15\n\n■ 작은 해츨링: ❤️ 10/10');
  assert.equal(initial.length,2);assert.match(initial[1],/^▶️ 상대 손패 4\/8 · 덱 4 · 레스트 0/);
  assert.doesNotMatch(initial.join('\n'),/대기 중|입력:|0턴/);
  const selected=b.player.hand[0];submit([selected]);
  assert.match(A.BattleUI.summary(b,1,c),/^⚔️ 탐험 1\/8 · 1턴 · 메인 2 ⚔️/);
  assert.equal(b.player.hand.length,3);assert.equal(b.phase,'MAIN2');
  assert.equal(A.BattleUI.summary(copy(b),1,c),A.BattleUI.summary(b,1,c));
  b.enemyPlan=[];b.enemyPowerPlan=false;submit();
  assert.match(A.BattleUI.summary(b,1,c),/^⚔️ 탐험 1\/8 · 2턴 · 메인 1 ⚔️/);
  b.enemyPlan=[];b.enemyPowerPlan=false;submit();
  assert.match(A.BattleUI.summary(b,1,c),/^⚔️ 탐험 1\/8 · 2턴 · 메인 2 ⚔️/);
});

test('mana milestones follow visible turns five, ten, fifteen and twenty',()=>{
  const {b,c,submit}=setup();b.player.mana=b.player.maxMana=b.enemy.mana=b.enemy.maxMana=2;
  for(let turn=1;turn<=21;turn++){
    assert.equal(b.turn+1,turn);assert.equal(b.player.maxMana,Math.min(5,2+Math.floor(turn/5)));
    for(let main=1;main<=2;main++){
      b.enemyPlan=[];b.enemyPowerPlan=false;submit();
      assert.ok(A.BattleUI.summary(b,1,c).startsWith('⚔️ 탐험 1/8 · '+(main===2?turn+1:turn)+'턴 · 메인 '+(main===1?2:1)+' ⚔️'));
    }
  }
});
test('battle reply splits into result and controls with counter marks, source logs and hero slot zero',()=>{
  const {b,c,submit}=setup();b.player.hand=[card('급속 빙결'),card('급속 성장')];b.enemy.hand=[card('선조의 지혜')];b.enemyPlan=[b.enemy.hand[0].uid];b.enemy.maxMana=5;
  b.player.hp=90;b.player.shield=5;submit([b.player.hand[0]],()=>0.5,true);
  const output=A.UI.render({run:{phase:'BATTLE',wins:0,battle:b}},{kind:'run'},c,0),parts=A.UI.messages(output);
  assert.equal(parts.length,2);assert.match(parts[0],/^⚔️ 탐험 1\/8 · 1턴 · 메인 2 ⚔️/);
  assert.match(parts[0],/닉네임: \[🛟\] 양성, \[❄️\] 급속 빙결 ❌️/);
  assert.match(parts[0],/작은 해츨링이 \[⚡\] 선조의 지혜로 카드를 2장 뽑았다/);
  assert.match(parts[0],/❤️ 90\(\+5\)\/100/);
  assert.match(parts[1],/▶️ 상대 손패 2\/8 · 덱 2 · 레스트 1/);
  assert.match(parts[1],/마나 \| 💧💧💧➖️➖️ \(3\/5\)/);
  assert.match(parts[1],/0\. \[🛟\] 양성 \| 💧1 ❌️/);
  assert.doesNotMatch(parts[1],/입력:|예: 0 2 1|쉬기: s|포기: gg/);
  assert.doesNotMatch(output,/\+선택|\+제출|제외 \d|사용 완료/);
});
test('nested automatic casts preserve ordered parent chains and their own damage/draw sources',()=>{
  const {b,c,submit}=setup();b.player.hand=[card('필연',{upgraded:true})];
  const ctx=A.Battle.context(b,c,()=>0.5,{side:'player'},[]);
  const pool=c.cardPool.filter(id=>ctx.canAutoCast({cardId:id,upgraded:false})),picks=['급속 빙결','선조의 지혜','파지직'].map(n=>(pool.indexOf(A.CardRules.nameToId(n))+0.1)/pool.length);
  submit(b.player.hand.slice(),()=>picks.length?picks.shift():0.5);
  const summary=A.BattleUI.summary(b,8,c);
  assert.match(summary,/\[🕊️\] 필연\+ ⮕ \[❄️\] 급속 빙결, \[⚡\] 선조의 지혜, \[⚡\] 파지직/);
  assert.match(summary,/닉네임이 \[⚡\] 선조의 지혜로 카드를 2장 뽑았다/);
  assert.equal(b.report.nodes.length,4);assert.equal(b.player.playedThisTurn,1);
  assert.deepEqual(copy(b.report),b.report);
});
test('a nested discovery and its cast links survive a JSON restart without paying twice',()=>{
  const {b,c,submit}=setup();b.player.hand=[card('전선',{upgraded:true})];
  submit(b.player.hand.slice(),()=>0.5);
  assert.ok(b.pendingChoice);const mana=b.player.mana;let restored=copy(b),guard=0;
  while(restored.pendingChoice){assert.ok(++guard<30);A.Battle.choose(restored,0,c,()=>0.5);}
  assert.equal(restored.player.mana,mana);
  const summary=A.BattleUI.summary(restored,1,c);assert.match(summary,/\[⚡\] 전선\+ ⮕/);
  assert.equal(restored.player.playedThisTurn,1);assert.equal(restored.phase,'MAIN2');
});
test('ordinary standby draw is silent; source-labelled passive draws still appear',()=>{
  const {b,c,submit}=setup();b.enemy.heroPower=copy(c.enemies.antonidas.heroPower);
  b.enemy.deck=[card('화염구'),card('작열통'),card('치유의 손길')];
  submit();b.enemyPlan=[];b.enemyPowerPlan=false;submit();
  assert.equal(b.turn,1);const draws=b.report.logs.filter(e=>e.type==='draw');assert.equal(draws.length,1);
  assert.equal(draws[0].source.label.name,'설계');
  assert.match(A.BattleUI.summary(b,1,c),/^⚔️ 탐험 1\/8 · 2턴 · 메인 1 ⚔️/);
});
test('states show both fighters, effect descriptions and durations without buff-application logs',()=>{
  const {b,c,submit}=setup();b.player.hand=[card('작열통')];submit(b.player.hand.slice());
  let s=A.BattleUI.summary(b,3,c);assert.match(s,/■ 작은 해츨링:[\s\S]*• 작열통: 회복 효과가 절반으로 감소한다\. \(3턴\)/);
  assert.equal(b.report.logs.some(e=>/healScale|작열통/.test(e.text||'')),false);
  b.turn=2;s=A.BattleUI.summary(b,3,c);assert.match(s,/감소한다\. \(1턴\)/);
  b.turn=3;assert.doesNotMatch(A.BattleUI.summary(b,3,c),/• 작열통:/);
});
test('card flags ignore mana but retain effect restrictions and power cooldown',()=>{
  const {b,c}=setup();b.player.hand=[card('급속 성장'),card('마법공학: 퓨즈'),card('완전 빙결',{availableFrom:2}),card('점화',{upgraded:true}),{uid:'main1-only',cardId:'treasure_nature_hourglass'}];
  b.phase='MAIN2';b.player.mana=1;b.player.limitedUsed['general:점화']=0;b.player.heroPowerUsedTurn=0;
  const s=A.BattleUI.controls(b,c);assert.equal(s.split('\n').filter(l=>/^\d+\./.test(l)&&l.endsWith('❌️')).length,5);
  assert.doesNotMatch(s.split('\n').find(l=>l.startsWith('1. ')),/❌️/);
  assert.equal(A.Battle.canSubmit(b,'player',c,b.player.hand[0]),false);
  assert.throws(()=>A.Battle.submit(copy(b),[b.player.hand[0].uid],c,()=>0.5),/마나가 부족/);
  b.player.status.cardLocks=[{from:0,until:0}];b.player.heroPowerUsedTurn=-1;
  assert.match(A.BattleUI.controls(b,c).split('\n').find(l=>l.startsWith('1. ')),/❌️$/);
  assert.equal(A.Battle.canSubmit(b,'player',c,null),true);assert.equal(A.Battle.canSubmit(b,'player',c,b.player.hand[0]),false);
  b.player.treasureIds=['pelgozi_wallet'];assert.match(A.BattleUI.controls(b,c),/나의 손패 5\/11/);
  b.player.maxMana=1;b.player.mana=3;assert.match(A.BattleUI.controls(b,c),/💧💧💧 \(3\/1\)/);
});
test('opponent hidden card names and excluded pile counts never appear in normal controls',()=>{
  const {b,c}=setup();b.enemy.hand=[card('필연')];b.enemy.excluded=[card('불덩이 작렬')];
  const s=A.BattleUI.controls(b,c);assert.doesNotMatch(s,/필연|불덩이 작렬|제외/);
});

test('Ivern end phase replaces cards on both sides and logs the actual draw recipients',()=>{
  const {b,c,submit}=setup();b.enemy.heroPower=A.BossRules.power('ivern');
  const returned={};const drawn={};
  ['player','enemy'].forEach(side=>{
    returned[side]=card('천둥');drawn[side]=card('치유의 손길');
    b[side].hand=[returned[side]];b[side].deck=[drawn[side],card('치유의 손길'),card('치유의 손길')];b[side].rest=[];
  });
  b.phase='MAIN2';submit();
  ['player','enemy'].forEach(side=>{
    assert.ok(b[side].hand.some(x=>A.Battle.describeCard(x,c).element==='NATURE'));
    // The next ordinary standby draw can draw the returned card again.
    assert.equal(b.report.logs.filter(e=>e.type==='move'&&e.side===side&&e.text==='deck'&&e.source.label.name==='수풀 가꾸기').length,1);
    const logs=b.report.logs.filter(e=>e.type==='draw'&&e.side===side&&e.source.label.name==='수풀 가꾸기');
    assert.equal(logs.length,1);assert.equal(logs[0].amount,1);
  });
  const text=A.BattleUI.summary(b,1,c);
  assert.match(text,/닉네임이 \[🛟\] 수풀 가꾸기로 카드를 1장 뽑았다/);
  assert.match(text,/작은 해츨링이 \[🛟\] 수풀 가꾸기로 카드를 1장 뽑았다/);
  assert.doesNotMatch(text,/상대가.*닉네임의 카드를.*뽑았다/);
});

test('incineration logs exclusion of cards submitted in the same phase before cleanup',()=>{
  for(const side of ['player','enemy'])for(const upgraded of [false,true]){
    const {b,c}=setup(),other=side==='player'?'enemy':'player';
    c.cards['test:neutral']={name:'시험 카드',element:'NEUTRAL',cost:0,effects:[],upgrade:{effects:[]}};
    const spell=card('소각',{upgraded});b[side].hand=[spell];
    const targets=Array.from({length:upgraded?2:1},(_,i)=>({uid:'incineration-target-'+i,cardId:'test:neutral',upgraded:i===1}));
    b[other].hand=targets;b.enemyPowerPlan=false;
    b.enemyPlan=b.enemy.hand.map(x=>x.uid);
    A.Battle.submit(b,b.player.hand.map(x=>x.uid),c,()=>0.5,{});
    assert.equal(b[other].excluded.length,upgraded?2:1);
    const entries=b.report.logs.filter(e=>e.type==='move'&&e.side===other&&e.text==='excluded');
    assert.equal(entries.reduce((n,e)=>n+e.amount,0),upgraded?2:1);
    const text=A.BattleUI.summary(b,1,c);
    assert.ok(text.includes('카드 '+(upgraded?2:1)+'장을 제외했다.'));
    assert.ok(text.includes('[🌊] 시험 카드'));
    if(upgraded)assert.ok(text.includes('[🌊] 시험 카드, [🌊] 시험 카드+ 카드 2장을 제외했다.'));
    assert.equal(A.BattleUI.summary(copy(b),1,c),text,'saved report preserves excluded card names');
    assert.equal(b.report.logs.filter(e=>e.type==='move'&&e.text==='rest').length,0,'normal played-card cleanup remains silent');
  }
});

test('chained discoveries show only choices until the final choice completes the phase',()=>{
  const {b,c,submit}=setup();
  b.player.hand=[{uid:'grave-pick-ui',cardId:'treasure_grave_pick',upgraded:false},card('점화')];
  b.player.rest=[card('천둥'),card('급속 빙결'),card('치유의 손길'),card('초고속')];
  submit(b.player.hand.slice());assert.ok(b.pendingChoice);
  let current=b,choices=0;
  const render=()=>A.UI.messages(A.UI.render({run:{phase:'BATTLE',wins:4,battle:current}},{kind:'run'},c,0));
  while(current.pendingChoice){
    const messages=render();assert.equal(messages.length,1);assert.match(messages[0],/^⚔️ 발견 -/);
    assert.doesNotMatch(messages[0],/■ |▶️|피해를 .*받았다/);
    current=copy(current);assert.deepEqual(render(),messages);
    assert.ok(++choices<=3);A.Battle.choose(current,0,c,()=>0.5);
  }
  assert.equal(choices,3);const messages=render();assert.equal(messages.length,2);
  assert.match(messages[0],/^⚔️ 탐험 5\/8/);assert.match(messages[0],/점화/);assert.match(messages[0],/피해를 .*받았다/);
  assert.match(messages[1],/^▶️/);assert.equal(current.phase,'MAIN2');
});

test('logs choose Korean particles and show actual opponent names',()=>{
  const {b,c}=setup();b.player.name='원구(D-28X)';b.enemy.name='빛나래';
  function log(actor,card){b.report={turn:0,phase:'MAIN1',submitted:true,nodes:[],logs:[{type:'gainCard',side:actor,amount:1,source:{side:actor,label:{name:card,element:'LIGHTNING'}}}]};return A.BattleUI.summary(b,1,c);}
  assert.match(log('enemy','긴급 차단'),/빛나래가 \[⚡\] 긴급 차단으로 손에 카드 1장을 가져왔다/);
  assert.match(log('player','긴급 차단+'),/원구\(D-28X\)가 \[⚡\] 긴급 차단\+으로/);
  assert.match(log('enemy','얼음 화살'),/얼음 화살로/);
  assert.match(log('enemy','선조의 지혜'),/선조의 지혜로/);
  b.enemy.name='리치 왕';assert.match(log('enemy','천둥'),/리치 왕이 \[⚡\] 천둥으로/);
  b.enemy.name='아우렐리온 솔';assert.match(log('enemy','화염구'),/아우렐리온 솔이 \[⚡\] 화염구로/);
});

test('overflow reveals excluded card labels in one log for each recipient and survives serialization',()=>{
  const {b,c}=setup();
  for(const side of ['player','enemy']){
    b[side].hand=Array.from({length:8},()=>card('천둥'));
    b[side].deck=[card('급속 빙결'),card('화염구',{upgraded:true}),card('급속 빙결')];
    const ctx=A.Battle.context(b,c,()=>0.5,{side},[]);ctx.draw(side,3);
    assert.equal(b[side].hand.length,8);assert.equal(b[side].excluded.length,3);
    const logs=b.report.logs.filter(e=>e.type==='overflow'&&e.side===side);
    assert.equal(logs.length,1);assert.equal(logs[0].amount,3);
    assert.deepEqual(logs[0].cards.map(x=>x.name),['급속 빙결','화염구+','급속 빙결']);
  }
  const text=A.BattleUI.summary(b,1,c);
  assert.match(text,/닉네임의 손패가 가득 차 \[❄️\] 급속 빙결, \[🔥\] 화염구\+, \[❄️\] 급속 빙결 카드 3장이 제외되었다/);
  assert.match(text,/작은 해츨링의 손패가 가득 차/);
  assert.equal((text.match(/손패가 가득 차/g)||[]).length,2);
  assert.equal(A.BattleUI.summary(copy(b),1,c),text);
});
test('generated cards also disclose overflow while cards that fit stay out of overflow logs',()=>{
  const {b,c}=setup();b.player.hand=Array.from({length:7},()=>card('천둥'));
  const ctx=A.Battle.context(b,c,()=>0.5,{side:'player'},[]);
  for(let i=0;i<3;i++)ctx.generate('player',A.CardRules.nameToId('화염구'),{upgraded:true});
  const logs=b.report.logs.filter(e=>e.type==='overflow');
  assert.equal(logs.length,1);assert.equal(logs[0].amount,2);assert.equal(logs[0].cards.length,2);
  assert.equal(b.player.hand.length,8);
});


test('crystal use shows its transformation and keeps automatic casts attached after reload',()=>{
  for(const name of ['연쇄 번개','필연']){
    const {b,c,submit}=setup();
    b.player.hand=[card(name,{originalCardId:'crystal_ball',transformed:true,noUpgrade:true})];
    submit([b.player.hand[0]]);
    const text=A.BattleUI.summary(copy(b),1,c);
    assert.ok(text.includes(name==='필연'?'[🌌] 수정구 ⮕ [🕊️] 필연 ⮕ [':'[🌌] 수정구 ⮕ [⚡] 연쇄 번개'),text);
    assert.ok(b.player.rest.some(x=>x.cardId==='crystal_ball'&&!x.originalCardId));
  }
});

test('held crystals transform again each standby including after saving; deck and rest stay crystals',()=>{
  const {b,c}=setup();
  b.enemy.hand=[{uid:'held-crystal',cardId:'crystal_ball'}];
  b.enemy.deck=[{uid:'deck-crystal',cardId:'crystal_ball'}];
  b.enemy.rest=[{uid:'rest-crystal',cardId:'crystal_ball'}];
  let battle=b;
  for(const name of ['파지직','급속 빙결','연쇄 번개']){
    c.cardPool=[A.CardRules.nameToId(name)];
    battle.resolution={queue:[{kind:'event',side:'enemy',event:{type:'standby'}}],phase:battle.phase};
    A.Battle.process(battle,c,()=>0.5);
    assert.equal(battle.enemy.hand[0].cardId,c.cardPool[0]);
    assert.equal(battle.enemy.hand[0].originalCardId,'crystal_ball');
    assert.equal(battle.enemy.deck[0].cardId,'crystal_ball');
    assert.equal(battle.enemy.rest[0].cardId,'crystal_ball');
    battle=copy(battle);battle.turn++;
  }
});


test('Nurture discounts exactly one remaining hand card to a minimum of zero without healing',()=>{
  const {b,c,submit}=setup();b.player.hp=50;
  b.player.hand=[card('급속 성장'),card('파지직')];
  const before=b.player.hand.map(x=>A.Battle.describeCard(x,c).cost);
  submit([],()=>0.99,true);
  assert.equal(b.player.hp,50);assert.equal(b.player.mana,4);
  assert.deepEqual(b.player.hand.map(x=>A.Battle.describeCard(x,c).cost),[before[0],0]);
  assert.throws(()=>submit([],()=>0.5,true),/이번 턴/);
  const restored=copy(b);
  assert.equal(A.Battle.describeCard(restored.player.hand[1],c).cost,0);
});


test('hero powers log actual results without generic use messages or exposing enemy hand',()=>{
 const {b,c,submit}=setup();b.enemy.name='작은 해츨링';
 b.enemy.heroPower=A.BossRules.power('little_hatchling');b.enemyPowerPlan=true;
 b.player.hand=[card('치유의 손길')];
 submit([],()=>0.5,true);
 const text=A.BattleUI.summary(copy(b),1,c);
 assert.ok(text.includes('닉네임이 [🛟] 양성으로 [🍃] 치유의 손길의 비용을 1 줄였다. (💧2 → 1)'),text);
 assert.ok(text.includes('닉네임이 [🛟] 아기 숨결로 피해를 2 받았다.'),text);
 assert.doesNotMatch(text,/사용했다/);
});

for(const id of ['aurelion_sol','patchwerk','teemo','black_knight'])test('boss power result is explicit: '+id,()=>{
 const {b,c,submit}=setup();b.enemy.heroPower=A.BossRules.power(id);b.enemyPowerPlan=true;
 b.player.hand=[card('파지직')];submit([b.player.hand[0]]);
 const kinds={aurelion_sol:'powerScaling',patchwerk:'doubleHealth',teemo:'powerShuffle',black_knight:'powerCounter'};
 assert.ok(b.report.logs.some(x=>x.type===kinds[id]));
 assert.doesNotMatch(A.BattleUI.summary(copy(b),1,c),/사용했다/);
});
test('enemy Nurture logs discounted amount but keeps card identity hidden',()=>{
 const {b,c,submit}=setup();b.enemy.hand=[card('치유의 손길')];b.enemyPowerPlan=true;
 submit();const text=A.BattleUI.summary(b,1,c);
 assert.ok(text.includes('손에 있는 카드 1장의 비용을 1 줄였다.'),text);
 assert.doesNotMatch(text,/치유의 손길/);
});


test('hero power X ignores insufficient mana but retains turn use and cooldown restrictions',()=>{
 const {b,c}=setup();b.player.mana=0;b.player.heroPowerUsedTurn=-1;b.player.heroPowerReadyTurn=0;
 const line=()=>A.BattleUI.controls(b,c).split('\n').find(x=>x.startsWith('0. '));
 assert.doesNotMatch(line(),/❌️/);assert.equal(A.Battle.canSubmit(b,'player',c,null),false);
 b.player.heroPowerUsedTurn=b.turn;assert.match(line(),/❌️/);
 b.player.heroPowerUsedTurn=-1;b.player.heroPowerReadyTurn=b.turn+1;assert.match(line(),/❌️/);
});


test('stacked base and upgraded pilgrimage share one state line and one emphasized damage log',()=>{
 for(const stacks of [[1],[1,2]]){
  const {b,c}=setup();b.enemy.name='악질';b.enemy.shield=stacks.length>1?2:0;
  b.player.status.cards.effects=stacks.map((amount,i)=>({kind:'pilgrimage',name:i?'성지순례+':'성지순례',amount,sourceCard:card('성지순례',{upgraded:!!i})}));
  delete b.report;b.resolution={queue:[{kind:'event',side:'player',event:{type:'end'}}]};A.Battle.process(b,c,()=>0.5);
  const total=stacks.reduce((a,z)=>a+z,0),text=A.BattleUI.summary(b,1,c);
  assert.equal(text.split('\n').filter(x=>x.startsWith('• 성지순례:')).length,1);
  assert.ok(text.includes('• 성지순례: 엔드 페이즈마다 상대에게 '+total+'의 피해를 준다. (이번 전투)'));
  const logs=text.split('\n').filter(x=>x.includes('성지순례로 피해를'));
  assert.equal(logs.length,1);assert.ok(logs[0].includes('• 악질이 [🕊️] 성지순례로 피해를 '+(total>=2?'*'+total+'*':total)+' 받았다.'));
  assert.equal(b.enemy.hp,99);assert.equal(b.report.logs.filter(x=>x.type==='damage').length,stacks.length);
 }
});


test('damage changes are emphasized while unchanged damage stays plain, including reduction to zero',()=>{
 for(const mode of ['normal','bonus','cap','immune']){
  const {b,c}=setup();b.enemy.shield=0;b.enemy.status.cards.effects=[];
  if(mode==='bonus')b.player.treasureIds=['archmage_robe'];
  if(mode==='cap')b.enemy.status.cards.effects=[{kind:'damageCap',amount:1}];
  if(mode==='immune')b.enemy.status.cards.effects=[{kind:'immune'}];
  delete b.report;const spawned=[],x=card('화염구');const ctx=A.Battle.context(b,c,()=>0.5,{side:'player',card:x},spawned);ctx.damage('player','enemy',4);
  const expected={normal:'4',bonus:'*6*',cap:'*1*',immune:'*0*'}[mode];assert.ok(A.BattleUI.summary(b,1,c).includes('피해를 '+expected+' 받았다.'));
 }
});
test('First Aid blocked by upgraded Scorch logs an emphasized zero heal',()=>{
 const {b,c}=setup();b.player.hp=50;b.player.treasureIds=['first_aid_kit'];b.player.status.cards.effects=[{kind:'healScale',value:0}];
 delete b.report;b.resolution={queue:[{kind:'event',side:'player',event:{type:'end'}}]};A.Battle.process(b,c,()=>0.5);
 assert.ok(A.BattleUI.summary(b,1,c).includes('[✨] 응급 치료 키트로 체력을 *0* 회복했다.'));assert.equal(b.player.hp,50);
});
test('stacked Dew Process draws share one sum per recipient without merging different effects',()=>{
 const {b,c}=setup();b.player.status.cards.effects=[{kind:'extraDraw',amount:1,sourceCard:card('이슬 절차')},{kind:'extraDraw',amount:1,sourceCard:card('이슬 절차')}];
 b.player.hand=[];b.player.deck=Array.from({length:8},()=>card('천둥'));delete b.report;
 b.resolution={queue:[{kind:'event',side:'player',event:{type:'standby'}}]};A.Battle.process(b,c,()=>0.5);
 const logs=A.BattleUI.summary(b,1,c).split('\n').filter(x=>x.includes('이슬 절차로 카드를'));
 assert.deepEqual(logs,['• 닉네임이 [🍃] 이슬 절차로 카드를 2장 뽑았다.']);assert.equal(b.player.hand.length,2);
});


test('Ice Trap hides the bot selection from the player but keeps the player own selection visible',()=>{
 const {b,c}=setup();b.player.status.cards.effects=[{kind:'iceTrap',name:'얼음 덫',element:'HOLY',sourceSide:'enemy',from:0,until:1}];
 b.enemy.status.cards.effects=[{kind:'iceTrap',name:'얼음 덫',element:'FIRE',sourceSide:'player',from:0,until:1}];
 const text=A.BattleUI.summary(b,1,c);const player=text.split('■ 닉네임:')[1].split('■ 작은 해츨링:')[0];
 assert.match(player,/얼음 덫: 비공개 속성의 카드 첫 1장을 차단한다/);assert.doesNotMatch(player,/🕊️/);
 assert.match(text.split('■ 작은 해츨링:')[1],/얼음 덫: 🔥 카드 첫 1장을 차단한다/);
 const view=A.Battle.publicView(b);assert.equal(view.player.status.cards.effects[0].element,undefined);
 assert.equal(b.player.status.cards.effects[0].element,'HOLY');
});


test('foresight warns for enemy only and cancels all displays and reactions when shared',()=>{
  const {b,c,submit}=setup();
  b.enemy.status.foresightTurns=[b.turn];b.enemyPlanDeferred=true;
  assert.ok(A.BattleUI.controls(b,c).includes('👁 상대가 예지 중입니다.'));
  b.player.status.foresightTurns=[b.turn];
  const v=A.Battle.publicView(b);
  assert.equal(v.enemyReacting,false);assert.equal(v.foreseenCards,undefined);
  const output=A.BattleUI.summary(b,1,c)+'\n'+A.BattleUI.controls(b,c);
  assert.doesNotMatch(output,/👁|예지:/);
  const original=A.AI.plan;let observedCalls=0;
  A.AI.plan=function(battle,catalog,rng,observed){if(observed)observedCalls++;return original(battle,catalog,rng,observed);};
  try{submit();}finally{A.AI.plan=original;}
  assert.equal(observedCalls,0);assert.equal(b.enemyPlanDeferred,false);
  b.enemy.status.foresightTurns=[];
  assert.ok(A.Battle.publicView(b).foreseenCards);
  assert.ok(A.BattleUI.controls(b,c).includes('👁 상대의 예정 카드:'));
});


test('Dew Process stacks appear as one total state for each fighter without changing effect data',()=>{
 const {b,c}=setup();
 for(const side of ['player','enemy'])b[side].status.cards.effects=[{kind:'extraDraw',amount:1,name:'이슬 절차'},{kind:'extraDraw',amount:1,name:'이슬 절차+'}];
 const before=JSON.stringify(b);const text=A.BattleUI.summary(b,1,c);
 assert.equal((text.match(/• 이슬 절차: 스탠바이 페이즈에 카드를 2장 더 뽑는다./g)||[]).length,2);
 assert.ok(!text.includes('이슬 절차+:'));assert.equal(JSON.stringify(b),before);
});


test('identical non-stacking statuses collapse per fighter while different durations and stacked values remain visible',()=>{
 const {b,c}=setup();const t=b.turn;
 const locks=[{name:'성전',elements:['FIRE','ICE','NATURE','LIGHTNING'],from:t,until:t},{name:'성전',from:t,until:t},{name:'성전+',from:t,until:t},{name:'성전',from:t,until:t+1},{name:'성전',from:t+1,until:t+1}];
 b.player.status.cardLocks=copy(locks);b.enemy.status.cardLocks=copy(locks.slice(0,3));
 b.player.status.cards.effects=[{kind:'immune',until:t},{kind:'immune',until:t},{kind:'immune',until:t+1},{kind:'flameVeil',amount:3,until:t},{kind:'flameVeil',amount:3,until:t},{kind:'extraDraw',amount:1,until:t},{kind:'extraDraw',amount:1,until:t}];
 const before=copy(b),text=A.BattleUI.summary(b,1,c);
 assert.equal(text.split('• 성전: 신성 카드만 사용할 수 있다. (1턴)').length-1,2,'one row for each fighter');
 assert.equal(text.split('• 성전: 신성 카드만 사용할 수 있다. (2턴)').length-1,1);
 assert.match(text,/성전: 신성 카드만 사용할 수 있다\. \(다음 턴부터 · 1턴\)/);
 assert.equal(text.split('• 면역: 피해를 받지 않는다. (1턴)').length-1,1);
 assert.match(text,/면역: 피해를 받지 않는다\. \(2턴\)/);
 assert.equal(text.split('• 화염 장막:').length-1,2,'stacking effects retain their multiplicity');
 assert.match(text,/이슬 절차: 스탠바이 페이즈에 카드를 2장 더 뽑는다/);
 assert.deepEqual(b,before,'display never removes actual effect instances');
});
