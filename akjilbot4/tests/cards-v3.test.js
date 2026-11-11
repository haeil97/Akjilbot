'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const reference=require('../build-content.js').compileContent();
function setup(){
  const box={A4:{}};vm.createContext(box);
  ['base','catalog','combat'].forEach(n=>vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',n+'.js'),'utf8'),box));
  box.A4.content=JSON.parse(JSON.stringify(reference));
  ['cards-v3','combat-v3'].forEach(n=>vm.runInContext(fs.readFileSync(path.join(__dirname,'../src',n+'.js'),'utf8'),box));
  const A=box.A4,c=A.copy(A.catalog);c.config.engineVersion=3;A.CardRules.install(c);
  c.cards.blank={name:'무해한 카드',element:'NEUTRAL',cost:0,effects:[]};
  let sequence=1000;
  const id=name=>A.CardRules.nameToId(name)||name;
  const card=(name,upgraded=false)=>({uid:'test-'+(++sequence),cardId:id(name),upgraded});
  const rng=()=>0.371;
  function battle(){
    const deck=()=>Array.from({length:4},()=>card('blank'));
    const b=A.Battle.create({name:'플레이어',maxHp:200,deck:deck()},{name:'상대',maxHp:200,deck:deck()},c,rng);
    b.player.hand=[];b.enemy.hand=[];b.player.mana=b.player.maxMana=b.enemy.mana=b.enemy.maxMana=5;return b;
  }
  function settle(b){let count=0;while(b.pendingChoice){assert.ok(count++<40,'선택 연쇄가 끝나야 함');A.Battle.choose(b,0,c,rng);}return b;}
  function submit(b,cards=[],power=false){b.enemyPlan=[];b.enemyPowerPlan=false;A.Battle.submit(b,cards.map(x=>typeof x==='string'?x:x.uid),c,rng,{heroPower:power});return settle(b);}
  function play(b,name,up=false){const x=card(name,up);b.player.hand.push(x);submit(b,[x]);return x;}
  function runJob(b,job){b.resolution={queue:[job],entries:null};A.Battle.process(b,c,rng);settle(b);}
  function context(b,side='player'){const queued=[],ctx=A.Battle.context(b,c,rng,{side},queued);return {ctx,queued,flush(){if(queued.length)runJob(b,{module:'test',op:'none'});}};}
  return {A,c,id,card,rng,battle,submit,play,runJob,settle,context};
}

test('all 110 ordinary families and four tokens have executable base and upgrade definitions',()=>{
  const {A,c}=setup();assert.equal(c.cardPool.length,110);assert.equal(new Set(c.cardPool).size,110);
  reference.generalCards.concat(reference.tokens).forEach(ref=>{
    assert.ok(A.CardRules.supports(ref.name));A.Battle.validateCard({cardId:ref.id,upgraded:false},c);A.Battle.validateCard({cardId:ref.id,upgraded:true},c);
    assert.equal(c.cardPool.includes(ref.id),!ref.token);
  });
});

test('all ordinary rules can resolve both ranks and serialize pending choices',()=>{
  const {A,c,card,rng,battle,runJob}=setup();
  reference.generalCards.concat(reference.tokens).forEach(ref=>[false,true].forEach(up=>{
    const b=battle();b.player.hp=100;b.player.hand=[card('화염구'),card('광합성')];b.enemy.hand=[card('점화'),card('재생')];
    b.player.deck=[card('치유의 손길'),card('천둥'),card('불덩이 작렬'),card('자연화')];b.enemy.deck=[card('산사태'),card('마나 연소')];
    b.player.rest=[card('배교'),card('화염구')];b.enemy.rest=[card('점화'),card('불길')];
    const x=card(ref.name,up);b.player.inFlight.push(x);
    assert.doesNotThrow(()=>runJob(b,{kind:'card',module:'cards',side:'player',card:x,def:A.Battle.describeCard(x,c),critical:true,targets:[],free:false}),ref.name+(up?'+':''));
    assert.doesNotThrow(()=>JSON.stringify(b));
    assert.ok(b.player.hand.length<=8,ref.name+' hand cap');
  }));
});

test('draw occurs after the submitted card leaves hand and overflow is excluded',()=>{
  const {battle,card,play}=setup(),b=battle();b.player.hand=Array.from({length:7},()=>card('blank'));b.player.deck=Array.from({length:4},()=>card('blank'));
  play(b,'광합성');assert.equal(b.player.hand.length,8);assert.equal(b.player.excluded.length,1);
});

test('frostbolt critical locks only next turn and both main phases share limited ignite usage',()=>{
  const {A,c,battle,card,submit,rng}=setup(),b=battle();const one=card('점화'),two=card('점화',true);b.player.hand=[one,two];submit(b,[one]);
  assert.throws(()=>submit(b,[two]),/제한/);assert.equal(b.enemy.hp,195);
  submit(b);b.player.mana=5;submit(b,[two]);assert.equal(b.enemy.hp,185);
});

test('forbidden flame consumes remaining mana after batch costs',()=>{
  const {battle,card,submit}=setup(),b=battle();const burn=card('금단의 불꽃'),fire=card('화염구');b.player.hand=[burn,fire];
  submit(b,[burn,fire]);assert.equal(b.player.mana,0);assert.equal(b.enemy.hp,180);
});

test('countered overload card spends mana and card without overloading or dealing damage',()=>{
  const {A,c,battle,card,rng,settle}=setup(),b=battle();const lightning=card('파지직'),nature=card('광합성');b.player.hand=[lightning];b.enemy.hand=[nature];b.enemyPlan=[nature.uid];
  A.Battle.submit(b,[lightning.uid],c,rng);settle(b);assert.equal(b.player.overloadNext,0);assert.equal(b.enemy.hp,200);assert.equal(b.player.mana,4);assert.ok(b.player.rest.some(x=>x.uid===lightning.uid));
});

test('winter horn recovery cannot exceed max mana while bloom can and overload unlock cancels next turn',()=>{
  const {battle,card,submit}=setup(),b=battle();b.player.maxMana=1;b.player.mana=1;
  const bloom=card('번개 개화'),unlock=card('초과 인출');b.player.hand=[bloom,unlock];submit(b,[bloom]);assert.equal(b.player.mana,3);assert.equal(b.player.overloadNext,2);
  submit(b,[unlock]);assert.equal(b.player.overloadNext,0);assert.equal(b.player.mana,2);
});

test('complete freeze drawn cards cannot be played until the next turn',()=>{
  const {battle,card,play,submit}=setup(),b=battle();b.player.deck=[card('불길'),card('과열')];play(b,'완전 빙결');const drawn=b.player.hand[0];
  assert.throws(()=>submit(b,[drawn]),/아직/);submit(b);assert.doesNotThrow(()=>submit(b,[drawn]));
});

test('dredge preserves the displayed choice across JSON restart and pays once',()=>{
  const {A,c,battle,card,rng}=setup(),b=battle(),dredge=card('수중 동물 변신');b.player.hand=[dredge];b.player.deck=[card('불덩이 작렬'),card('광합성'),card('화염구')];
  A.Battle.submit(b,[dredge.uid],c,rng);assert.ok(b.pendingChoice);const snapshot=JSON.parse(JSON.stringify(b)),options=JSON.stringify(snapshot.pendingChoice.options);
  A.Battle.choose(snapshot,1,c,rng);assert.equal(options,JSON.stringify(b.pendingChoice.options));assert.equal(snapshot.player.rest.filter(x=>x.uid===dredge.uid).length,1);assert.equal(snapshot.player.hand.length,1);
});

test('discovery excludes itself and default pool excludes tokens treasures and upgrades',()=>{
  const {A,c,battle,card,rng}=setup(),b=battle(),prayer=card('기도');b.player.hand=[prayer];
  A.Battle.submit(b,[prayer.uid],c,rng);assert.ok(b.pendingChoice);b.pendingChoice.options.forEach(x=>{assert.notEqual(x.cardId,prayer.cardId);assert.ok(!x.upgraded);assert.equal(c.cards[x.cardId].element,'HOLY');});
  A.Battle.choose(b,0,c,rng);assert.equal(b.runChanges[0].type,'addCard');
});

test('holy-only restriction blocks nonholy cards and permits holy ones',()=>{
  const {battle,card,play,submit}=setup(),b=battle();play(b,'성전');const fire=card('화염구'),holy=card('배교');b.player.hand=[fire,holy];
  assert.throws(()=>submit(b,[fire]),/사용할 수 없/);assert.doesNotThrow(()=>submit(b,[holy]));
});

test('cold token goes to exclusion and triggers draws instead of entering rest',()=>{
  const {battle,card,play}=setup(),b=battle();b.player.deck=[card('화염구')];b.enemy.deck=[card('광합성')];const cold=play(b,'혹한');
  assert.ok(b.player.excluded.some(x=>x.uid===cold.uid));assert.equal(b.player.rest.length,0);assert.equal(b.player.hand.length,1);assert.equal(b.enemy.hand.length,1);
});

test('icicle adjacency and acceleration aura calculate effective costs without mutation',()=>{
  const {A,c,battle,card}=setup(),b=battle();const a=card('화염구'),ice=card('고드름'),z=card('불덩이 작렬'),aura=card('신의 권능: 가속');b.player.hand=[a,ice,z,aura];
  assert.equal(A.Battle.cardCost(b,'player',a,c),2);assert.equal(A.Battle.cardCost(b,'player',z,c),5);assert.equal(c.cards[z.cardId].cost,5);
});

test('deep curse token ticks until played then remains excluded',()=>{
  const {battle,card,submit}=setup(),b=battle();const curse=card('저주',true);b.player.hand=[curse];submit(b);submit(b);assert.equal(b.player.hp,195);b.player.mana=5;submit(b,[curse]);submit(b);assert.equal(b.player.hp,195);assert.ok(b.player.excluded.some(x=>x.uid===curse.uid));
});

test('delayed firebrand returns a physical card from rest, not a new copy',()=>{
  const {battle,play,submit}=setup(),b=battle();const fire=play(b,'불장난');submit(b);assert.equal(b.player.hand.filter(x=>x.uid===fire.uid).length,1);assert.equal(b.player.rest.filter(x=>x.uid===fire.uid).length,0);
});

test('charge upgrades only one turn and leaves already upgraded cards unchanged',()=>{
  const {battle,card,play,submit}=setup(),b=battle();const normal=card('화염구'),up=card('광합성',true);b.player.hand=[normal,up];play(b,'충전');submit(b);assert.equal(normal.upgraded,true);assert.equal(up.upgraded,true);submit(b);submit(b);assert.equal(normal.upgraded,false);assert.equal(up.upgraded,true);
});

test('solar threshold counts armor damage and triggers only once',()=>{
  const {A,c,battle,card,play,runJob}=setup(),b=battle();b.enemy.shield=20;play(b,'태양 작렬');
  runJob(b,{kind:'effect',side:'player',card:card('화염구'),effect:{type:'damage',amount:10}});assert.equal(b.enemy.shield,0);assert.equal(b.enemy.hp,200);
  runJob(b,{kind:'effect',side:'player',card:card('화염구'),effect:{type:'damage',amount:10}});assert.equal(b.enemy.hp,190);
});

test('grave theft moves rather than copies a selected opponent rest card',()=>{
  const {battle,card,play}=setup(),b=battle(),stolen=card('점화');b.enemy.rest=[stolen];play(b,'무덤의 지명자',true);assert.equal(b.enemy.rest.length,0);assert.ok(b.player.hand.some(x=>x.uid===stolen.uid));
});

test('randomly transformed deck excludes treasures and tokens and upgrades all eligible cards',()=>{
  const {c,battle,card,play}=setup(),b=battle();const token=card('고드름'),ordinary=card('화염구');b.player.deck=[token,ordinary];play(b,'폭풍 인도기');assert.equal(token.cardId,'general:고드름');assert.equal(ordinary.upgraded,true);assert.ok(c.cardPool.includes(ordinary.cardId));assert.equal(ordinary.costFloor,c.cards[ordinary.cardId].upgrade.cost===0?undefined:1);
});

test('fuse automatically sends excess drawn cards to rest without spending mana',()=>{
  const {battle,card,play}=setup(),b=battle(),trap=card('마법공학: 퓨즈');b.enemy.hand=[trap];b.player.deck=[card('화염구'),card('광합성'),card('초과 인출')];play(b,'광합성');assert.equal(b.enemy.mana,5);assert.equal(b.player.hand.length,1);assert.ok(b.enemy.rest.some(x=>x.uid===trap.uid));
});

test('nibiru counts direct cards across both phases and ignores hero powers',()=>{
  const {battle,card,submit}=setup(),b=battle(),trap=card('마법공학: 니비루');b.enemy.hand=[trap];b.enemy.deck=[card('blank')];const cards=[card('불길'),card('과열'),card('화염구')];b.player.hand=cards.slice();submit(b,cards.slice(0,2));submit(b,[cards[2]]);assert.equal(b.enemy.hp,200);assert.ok(b.enemy.rest.some(x=>x.uid===trap.uid));
});

test('nature absorb steals every countered lightning card instead of leaving it in rest',()=>{
  const {A,c,battle,card,rng,settle}=setup(),b=battle();const absorb=card('흡수',true),a=card('찌릿!'),z=card('전류 공급');b.player.hand=[absorb];b.enemy.hand=[a,z];b.enemyPlan=[a.uid,z.uid];A.Battle.submit(b,[absorb.uid],c,rng);settle(b);assert.ok(b.player.hand.some(x=>x.uid===a.uid));assert.ok(b.player.hand.some(x=>x.uid===z.uid));assert.equal(b.enemy.rest.length,0);
});

test('holy rest auras stack and upgraded departing aura grants its own draw',()=>{
  const {battle,card,submit}=setup(),b=battle();b.player.hp=150;const aura=card('신의 권능: 재생',true),fire=card('화염구');b.player.hand=[aura,fire];b.player.deck=[card('blank'),card('blank')];submit(b,[fire]);assert.equal(b.player.hp,155);submit(b);assert.ok(b.player.hp>=160);assert.equal(b.player.hand.length,3);
});

test('card-granted keywords do not become innate keywords on their granting card',()=>{
  const {c,id}=setup();assert.equal(c.cards[id('화염 제단')].overpower,false);assert.equal(c.cards[id('화염 제단')].upgrade.overpower,false);
  assert.equal(c.cards[id('영혼관')].temporary,false);assert.equal(c.cards[id('벼려내기')].temporary,false);assert.equal(c.cards[id('혹한')].temporary,true);assert.equal(c.cards[id('신의 권능: 성역')].temporary,true);
});

test('damage immunity and caps are applied after card damage bonuses',()=>{
  const {A,battle,card,play,runJob}=setup(),b=battle();
  A.TreasureRules={modify(ctx,what,data){if(what==='damage'&&data.card)data.value+=2;}};
  play(b,'불굴',true);const before=b.player.hp;
  runJob(b,{kind:'effect',side:'enemy',card:card('화염구'),effect:{type:'damage',amount:10}});assert.equal(b.player.hp,before);
  const b2=battle();play(b2,'확고한 알리바이');runJob(b2,{kind:'effect',side:'enemy',card:card('화염구'),effect:{type:'damage',amount:10}});assert.equal(b2.player.hp,199);
});

test('healing prevention applies after a card healing bonus',()=>{
  const {A,battle,card,play,runJob}=setup(),b=battle();b.enemy.hp=100;
  A.BossRules={modify(ctx,what,data){if(what==='heal'&&data.card)data.value+=5;}};
  play(b,'작열통',true);const after=b.enemy.hp;runJob(b,{kind:'effect',side:'enemy',card:card('치유의 손길'),effect:{type:'heal',amount:10}});assert.equal(b.enemy.hp,after);
});

test('ice mirror reflects effects without producing a physical copy or triggering unstable exile',()=>{
  const {A,c,battle,card,rng,settle}=setup(),b=battle();const mirror=card('얼음 거울'),fire=card('화염구');b.player.hand=[mirror];b.enemy.hand=[fire];b.enemyPlan=[fire.uid];
  A.Battle.submit(b,[mirror.uid],c,rng);settle(b);
  assert.equal(b.player.hp,200);assert.equal(b.enemy.hp,193);assert.equal(b.player.rest.length,1);assert.equal(b.enemy.rest.length,1);assert.equal(b.enemy.rest[0].uid,fire.uid);
});

test('a temporary card acquired during END stays until the following END',()=>{
  const {A,c,battle,card,rng,runJob}=setup(),b=battle();const aura=card('신의 권능: 가속');aura.temporaryUntil=0;b.turn=2;b.phase='END';b.player.deck=[aura];
  runJob(b,{kind:'effect',side:'player',effect:{type:'draw',amount:1}});assert.equal(b.player.hand[0].temporaryUntil,3);
});

test('a lethal flame veil reflection resolves once and does not recurse forever',()=>{
  const {A,battle,card,runJob}=setup(),b=battle();b.player.hp=b.enemy.hp=1;
  A.TreasureRules={modify(ctx,what,data){if(what==='damage'&&data.card)data.value+=2;}};
  for(const side of ['player','enemy'])b[side].status.cards.effects.push({kind:'flameVeil',until:1,amount:3,sourceCard:card('화염 장막')});
  runJob(b,{kind:'effect',side:'player',card:card('화염구'),effect:{type:'damage',amount:10}});
  assert.ok(b.player.hp<=0);assert.ok(b.enemy.hp<=0);assert.equal(b.resolution,null);
});

test('opening hands do not trigger fuse or consume turn draw allowance',()=>{
  const {A,c,card,rng}=setup();const playerDeck=Array.from({length:4},()=>card('blank')),enemyDeck=[card('마법공학: 퓨즈'),card('blank'),card('blank'),card('blank')];
  const b=A.Battle.create({name:'P',maxHp:20,deck:playerDeck},{name:'E',maxHp:20,deck:enemyDeck},c,rng);
  assert.equal(b.player.hand.length,4);assert.equal(b.enemy.hand.length,4);assert.equal(b.enemy.rest.length,0);
});

test('fate inevitability and rewind exclude unplayable cards before random casting',()=>{
  for(const name of ['운명','필연','되감기']){
    const {A,c,battle,card}=setup(),b=battle(),queued=[];
    Object.keys(c.cards).forEach(id=>{c.cards[id].unplayable=true;if(c.cards[id].upgrade)c.cards[id].upgrade.unplayable=true;});
    const allowed=A.CardRules.nameToId('불길');c.cards[allowed].unplayable=false;c.cards[allowed].upgrade.unplayable=false;
    b.player.rest=[card('마법공학: 퓨즈'),card('불길')];
    const source=card(name),ctx=A.Battle.context(b,c,()=>0,{side:'player'},queued);
    A.CardRules.run(ctx,{side:'player',module:'cards',card:source});
    const casts=queued.filter(x=>x.kind==='cast');assert.equal(casts.length,name==='필연'?2:1);
    assert.ok(casts.every(x=>x.card.cardId===allowed));
  }
});

test('automatic use pools reject cards that use other cards, including upgraded-only casting rules',()=>{
  const {A,c,battle,card}=setup(),b=battle(),ctx=A.Battle.context(b,c,()=>0,{side:'player'},[]);
  for(const name of ['운명','필연','되감기'])for(const up of [false,true])assert.equal(ctx.canAutoCast(card(name,up)),false);
  assert.equal(ctx.canAutoCast(card('전선',true)),false);
  assert.equal(ctx.canAutoCast(card('전선',false)),true);
  assert.equal(ctx.canAutoCast(card('기도')),true);
  for(const source of ['운명','필연','되감기']){
    Object.keys(c.cards).forEach(id=>{c.cards[id].unplayable=true;if(c.cards[id].upgrade)c.cards[id].upgrade.unplayable=true;});
    for(const name of ['운명','필연','되감기','전선','불길']){const d=c.cards[A.CardRules.nameToId(name)];d.unplayable=false;d.upgrade.unplayable=false;}
    if(source==='필연')c.cards[A.CardRules.nameToId('전선')].unplayable=true;
    b.player.rest=[card('운명'),card('필연'),card('되감기'),card('전선',true),card('불길')];
    const queued=[],context=A.Battle.context(b,c,()=>0,{side:'player'},queued);
    A.CardRules.run(context,{side:'player',module:'cards',card:card(source)});
    const casts=queued.filter(x=>x.kind==='cast');assert.ok(casts.length>0);
    assert.ok(casts.every(x=>x.card.cardId===A.CardRules.nameToId('불길')));
  }
});


for(const upgraded of [false,true])test('Sanctuary draws one for another resting card and only upgraded self draws one: '+upgraded,()=>{
 const {A,c,battle,card,rng,runJob}=setup(),b=battle();
 const aura=card('신의 권능: 성역',upgraded),other=card('blank');
 b.player.hand=[aura,other];b.player.deck=Array.from({length:8},()=>card('blank'));
 function move(uid){const tasks=[];A.Battle.context(b,c,rng,{side:'player'},tasks).move('player',uid,'rest');b.resolution={queue:tasks,phase:b.phase};A.Battle.process(b,c,rng);}
 move(other.uid);assert.equal(b.player.hand.length,2);assert.equal(b.player.deck.length,7);
 move(aura.uid);assert.equal(b.player.hand.length,upgraded?2:1);assert.equal(b.player.deck.length,upgraded?6:7);
});


for(const split of [false,true])test('two Nibirus counter the third and fourth direct cards separately; split='+split,()=>{
 const {battle,card,submit}=setup(),b=battle();
 const traps=[card('마법공학: 니비루'),card('마법공학: 니비루')];b.enemy.hand=traps.slice();b.enemy.deck=[card('blank'),card('blank')];
 const plays=Array.from({length:4},()=>card('blank'));b.player.hand=plays.slice();
 if(split){submit(b,plays.slice(0,3));assert.equal(b.enemy.hand.filter(x=>traps.some(t=>t.uid===x.uid)).length,1);submit(b,plays.slice(3));}
 else submit(b,plays);
 assert.deepEqual(Array.from(b.history).flatMap(h=>Array.from(h.player,x=>x.countered)),[false,false,true,true]);
 assert.equal(b.enemy.rest.filter(x=>traps.some(t=>t.uid===x.uid)).length,2);
});
test('a multi-draw triggers one Fuse, keeping another for the next separate draw',()=>{
 const {A,c,battle,card,rng}=setup(),b=battle();
 const traps=[card('마법공학: 퓨즈'),card('마법공학: 퓨즈')];b.enemy.hand=traps.slice();
 b.player.deck=Array.from({length:8},()=>card('blank'));
 function draw(n){const tasks=[];A.Battle.context(b,c,rng,{side:'player'},tasks).draw('player',n);b.resolution={queue:tasks,phase:b.phase};A.Battle.process(b,c,rng);}
 draw(4);assert.equal(b.player.hand.length,1);assert.equal(b.enemy.hand.length,1);assert.equal(b.enemy.rest.length,1);
 draw(1);assert.equal(b.player.hand.length,1);assert.equal(b.enemy.hand.length,0);assert.equal(b.enemy.rest.length,2);
});
test('upgraded Nibiru ongoing counters do not consume another held Nibiru',()=>{
 const {battle,card,submit}=setup(),b=battle();
 const first=card('마법공학: 니비루',true),second=card('마법공학: 니비루');b.enemy.hand=[first,second];
 b.player.hand=Array.from({length:4},()=>card('blank'));submit(b,b.player.hand.slice());
 assert.ok(b.enemy.hand.some(x=>x.uid===second.uid));
 assert.deepEqual(Array.from(b.history[0].player,x=>x.countered),[false,false,true,true]);
});


test('rebalanced soul jar costs zero and only base draw is temporary',()=>{
  for(const up of [false,true]){
    const {battle,card,play,submit,c,id}=setup(),b=battle();
    assert.equal((up?c.cards[id('영혼관')].upgrade:c.cards[id('영혼관')]).cost,0);
    const drawn=[card('blank'),card('blank'),card('blank')];b.player.deck=drawn.concat([card('blank')]);
    play(b,'영혼관',up);
    drawn.forEach(x=>assert.equal(b.player.hand.some(h=>h.uid===x.uid),true));
    submit(b);
    drawn.forEach(x=>assert.equal(b.player.hand.some(h=>h.uid===x.uid),up));
  }
});

test('landslide deals 4 or 8 and draws only cost two or higher with qualifying hand',()=>{
  for(const up of [false,true])for(const eligible of [false,true]){
    const {battle,card,play}=setup(),b=battle();
    b.player.hand=eligible?[card('치유의 손길')]:[];
    const cheap=card('불길'),expensive=card('치유의 손길');b.player.deck=[cheap,expensive];
    play(b,'산사태',up);
    assert.equal(b.enemy.hp,200-(up?8:4));
    assert.equal(b.player.hand.some(x=>x.uid===expensive.uid),eligible);
    assert.equal(b.player.deck.some(x=>x.uid===cheap.uid),true);
  }
});

test('consecration upgrades five rest cards before retrieval and no longer exhausts',()=>{
  for(const up of [false,true]){
    const {battle,card,play,c,id}=setup(),b=battle();
    const rest=Array.from({length:5},()=>card('화염구'));b.player.rest=rest.slice();
    const before=b.player.deck.length,x=play(b,'축성',up);
    assert.equal(b.player.deck.length,before);
    assert.equal(b.player.hand.length,1);assert.equal(b.player.hand[0].upgraded,true);
    rest.forEach(x=>assert.equal(x.upgraded,true));
    assert.equal(b.player.rest.some(y=>y.uid===x.uid),true);
    assert.equal((up?c.cards[id('축성')].upgrade:c.cards[id('축성')]).cost,1);
    assert.equal((up?c.cards[id('성지순례')].upgrade:c.cards[id('성지순례')]).cost,1);
    assert.equal(c.cards[id('성지순례')].upgrade.innate,true);
  }
});


test('Deep Curse grants the matching curse rank and its end damage',()=>{
 for(const up of [false,true]){
  const {battle,card,submit}=setup(),b=battle();const spell=card('심해 저주',up);b.player.hand=[spell];submit(b,[spell]);
  const curse=b.enemy.hand.find(x=>x.cardId===card('저주').cardId);assert.ok(curse);assert.equal(curse.upgraded,up);
  submit(b);assert.equal(b.enemy.hp,200-(up?5:3));
 }
});


test('Detox removes harmful states, counts poison once, preserves buffs and harmful hand cards',()=>{
 for(const up of [false,true]){
  const {A,c,battle,card,runJob}=setup(),b=battle(),detox=card('제독',up);
  assert.equal(A.Battle.describeCard(detox,c).cost,up?0:1);
  const curse=card('저주'),icicle=card('고드름');b.player.hand=[curse,icicle];b.player.deck=Array.from({length:12},()=>card('blank'));b.player.status.poison=8;
  b.player.status.cards.effects=[{kind:'costIncrease',from:0,until:2,amount:1},{kind:'healScale',until:2,value:0},{kind:'immune',until:2},{kind:'pilgrimage',amount:1},{kind:'manaBurn',until:-1,amount:1}];
  runJob(b,{kind:'card',module:'cards',side:'player',card:detox,def:c.cards[detox.cardId]});
  assert.equal(b.player.status.poison,0);assert.equal(b.player.hand.length,5);assert.ok(b.player.hand.some(x=>x.uid===curse.uid));assert.ok(b.player.hand.some(x=>x.uid===icicle.uid));
  assert.deepEqual(Array.from(b.player.status.cards.effects,x=>x.kind),['immune','pilgrimage','manaBurn']);
 }
});

test('Natural Detox draws one, heals based on poison and rank, then removes poison even when healing is blocked',()=>{
 for(const up of [false,true])for(const blocked of [false,true]){
  const {c,battle,card,runJob}=setup(),b=battle(),spell=card('자연의 해독',up);b.player.deck=[card('blank')];b.player.hp=150;b.player.status.poison=7;
  if(blocked)b.player.status.cards.effects.push({kind:'healScale',value:0,until:1});
  runJob(b,{kind:'card',module:'cards',side:'player',card:spell,def:c.cards[spell.cardId]});
  assert.equal(b.player.hand.length,1);assert.equal(b.player.hp,150+(blocked?0:7*(up?2:1)));assert.equal(b.player.status.poison,0);
 }
});

test('Sowing applies three or four poison, otherwise consumes triangular damage once without card damage bonuses',()=>{
 for(const up of [false,true]){
  const {c,battle,card,runJob}=setup(),b=battle(),spell=card('씨뿌리기',up);b.player.passives=[{type:'damageBonus',amount:10}];
  const cast=()=>runJob(b,{kind:'card',module:'cards',side:'player',card:spell,def:c.cards[spell.cardId]});
  cast();assert.equal(b.enemy.status.poison,up?4:3);assert.equal(b.enemy.hp,200);
  b.enemy.shield=2;cast();assert.equal(b.enemy.status.poison,0);assert.equal(b.enemy.hp,200-((up?10:6)-2));
 }
});

test('Transfer moves poison, timed debuffs and restrictions without moving buffs or harmful cards',()=>{
 for(const up of [false,true]){
  const {A,c,battle,card,runJob}=setup(),b=battle(),spell=card('전이',up),curse=card('저주');
  b.player.hand=[curse];b.enemy.hand=[card('blank'),card('blank'),card('blank')];b.player.status.poison=5;b.enemy.status.poison=2;
  b.player.status.cardLocks=[{from:1,until:2,name:'빙결'}];b.player.status.cards.effects=[{kind:'solar',until:2,amount:3,burst:10,sourceSide:'enemy'},{kind:'healScale',from:1,until:2,value:0.5},{kind:'immune',until:2}];
  runJob(b,{kind:'card',module:'cards',side:'player',card:spell,def:c.cards[spell.cardId]});
  assert.equal(A.Battle.describeCard(spell,c).cost,up?0:1);assert.equal(b.player.status.poison,0);assert.equal(b.enemy.status.poison,7);
  assert.equal(b.player.status.cardLocks.length,0);assert.equal(b.enemy.status.cardLocks[0].until,2);
  assert.deepEqual(Array.from(b.player.status.cards.effects,x=>x.kind),['immune']);assert.equal(b.enemy.status.cards.effects.find(x=>x.kind==='solar').sourceSide,'player');assert.equal(b.enemy.status.cards.effects.find(x=>x.kind==='healScale').from,1);
  assert.ok(b.player.hand.some(x=>x.uid===curse.uid));assert.ok(!b.enemy.hand.some(x=>x.uid===curse.uid));assert.equal(JSON.stringify(JSON.parse(JSON.stringify(b)).enemy.status),JSON.stringify(b.enemy.status));
 }
});

test('cleansing scheduled thunder counts its three future ticks as one harmful effect; transfer redirects them',()=>{
 for(const transfer of [false,true]){
  const {c,battle,card,runJob}=setup(),b=battle(),thunder=card('천둥'),spell=card(transfer?'전이':'제독');b.player.deck=[card('blank'),card('blank')];
  b.scheduled=[1,2,3].map(turn=>({turn,phase:'STANDBY',task:{kind:'effect',side:'enemy',card:thunder,effect:{type:'damage',amount:2}}}));
  runJob(b,{kind:'card',module:'cards',side:'player',card:spell,def:c.cards[spell.cardId]});
  if(transfer){assert.equal(b.scheduled.length,3);assert.ok(b.scheduled.every(x=>x.task.side==='player'&&x.task.effect.target==='opponent'));}
  else {assert.equal(b.scheduled.length,0);assert.equal(b.player.hand.length,1);}
 }
});


test('upgraded Sky Gift costs zero and draws only for its caster up to six cards',()=>{
  for(const up of [false,true])for(const startingHand of [2,6,7]){
    const {A,c,battle,card,play}=setup(),b=battle();
    b.player.hand=Array.from({length:startingHand},()=>card('blank'));
    b.enemy.hand=[card('blank')];
    b.player.deck=Array.from({length:10},()=>card('blank'));
    b.enemy.deck=Array.from({length:10},()=>card('blank'));
    const description=A.Battle.describeCard(card('하늘의 선물',up),c);
    assert.equal(description.cost,0);
    if(up)assert.equal(description.text,'패가 6장이 되도록 카드를 뽑습니다.');
    play(b,'하늘의 선물',up);
    assert.equal(b.player.hand.length,Math.max(6,startingHand));
    assert.equal(b.enemy.hand.length,up?1:6);
    assert.equal(b.player.mana,5);
  }
});


test('Instability adds same-element counters, including neutral and holy, while preserving normal counters and critical hits',()=>{
 for(const element of ['FIRE','NATURE','LIGHTNING','ICE','HOLY','NEUTRAL'])for(const up of [false,true]){
  const {A,c,battle,card,rng}=setup(),b=battle();
  c.cards.vul={name:'불안정 카드',element,cost:1,text:'불안정. 상대에게 피해를 20 줍니다.',effects:[{type:'damage',amount:20}],upgrade:{text:'불안정. 상대에게 피해를 30 줍니다.',effects:[{type:'damage',amount:30}]}};
  c.cards.other={name:'일반 카드',element,cost:1,effects:[{type:'damage',amount:2,critical:true}]};
  const p=card('vul',up),e=card('other');b.player.hand=[p];b.enemy.hand=[e];b.enemyPlan=[e.uid];
  assert.equal(A.Battle.describeCard(p,c).unstable,true);
  A.Battle.submit(b,[p.uid],c,rng);assert.equal(b.history[0].player[0].countered,true);assert.equal(b.history[0].enemy[0].countered,false);
  assert.equal(b.enemy.hp,200);assert.equal(b.player.hp,198);
 }
});

test('two unstable same-element cards counter each other and Instability can coexist with Overpower',()=>{
 for(const both of [true,false]){
  const {A,c,battle,card,rng}=setup(),b=battle();
  c.cards.a={name:'불안정 카드',element:'FIRE',cost:0,text:both?'불안정.':'불안정, 압도.',effects:[{type:'damage',amount:5}]};
  c.cards.z={name:'상대 카드',element:'FIRE',cost:0,text:both?'불안정.':'',effects:[{type:'damage',amount:5}]};
  const p=card('a'),e=card('z');b.player.hand=[p];b.enemy.hand=[e];b.enemyPlan=[e.uid];
  if(!both)assert.equal(A.Battle.describeCard(p,c).overpower,true);
  A.Battle.submit(b,[p.uid],c,rng);assert.ok(b.history[0].player[0].countered);assert.ok(b.history[0].enemy[0].countered);
  assert.equal(b.player.hp,200);assert.equal(b.enemy.hp,200);
 }
 const {A,c}=setup();const ref=A.content.generalCards.find(x=>x.name==='화염구');ref.text='불안정, 압도. 피해를 4 줍니다.';ref.upgrade.text='불안정. 피해를 6 줍니다.';A.CardRules.install(c);
 assert.equal(c.cards[ref.id].unstable,true);assert.equal(c.cards[ref.id].overpower,true);assert.equal(c.cards[ref.id].upgrade.unstable,true);
});

test('Instability keeps the base element relationship, and the rules list the new keyword',()=>{
 const {A,c,battle,card,rng}=setup(),b=battle();
 c.cards.a={name:'불안정',element:'NATURE',cost:0,unstable:true,effects:[{type:'damage',amount:5}]};
 c.cards.z={name:'화염',element:'FIRE',cost:0,effects:[]};const p=card('a'),e=card('z');b.player.hand=[p];b.enemy.hand=[e];b.enemyPlan=[e.uid];
 A.Battle.submit(b,[p.uid],c,rng);assert.equal(b.history[0].player[0].countered,true);
 const production=require('../../악질봇4.0.0.js');assert.ok(production.UI.render(null,{kind:'rules'},production.catalog,0).includes('불안정: 이 카드는 같은 속성의 카드에도 카운터당합니다.'));
});


test('October card costs, removal and rune normal versus critical damage match both ranks',()=>{
 const {A,c,id,card,battle,runJob}=setup();
 const costs={'벼려내기':[0,0],'소각':[1,1],'점화':[1,1],'폭발의 룬':[1,1],'냉동 캡슐':[1,0],'등산용 간식':[1,1],'먹음직스러운 덥석멜론':[1,0],'흡수':[1,1],'두꺼비집':[2,2],'하늘의 선물':[0,0]};
 for(const [name,values] of Object.entries(costs))for(const up of [false,true])assert.equal(A.Battle.describeCard(card(name,up),c).cost,values[+up],name);
 assert.equal(id('묵시록'),'묵시록');assert.equal(c.cards['general:묵시록'],undefined);
 for(const up of [false,true])for(const critical of [false,true]){
  const b=battle(),x=card('폭발의 룬',up);runJob(b,{kind:'card',module:'cards',side:'player',card:x,def:A.Battle.describeCard(x,c),critical});
  assert.equal(b.enemy.hp,200-(up?8:4)-(critical?(up?12:6):0));
 }
 for(const up of [false,true]){
  const b=battle(),x=card('벼려내기',up);runJob(b,{kind:'card',module:'cards',side:'player',card:x,def:A.Battle.describeCard(x,c)});
  assert.equal(b.enemy.hp,200-(up?8:4));assert.equal(b.player.hand.length,up?2:1);
  assert.ok(b.player.hand.every(y=>A.Battle.describeCard(y,c).element==='FIRE'&&y.temporaryUntil===b.turn));
 }
});

test('Incineration excludes one or all direct cards while base Absorb steals only one',()=>{
 const {A,c,card,battle,runJob,rng,settle}=setup();
 for(const up of [false,true]){
  const b=battle(),targets=Array.from({length:3},()=>card('blank')),automatic=card('blank');b.enemy.rest=targets.concat([automatic]);
  b.enemy.usedThisTurn=targets.map(x=>({card:x,free:false})).concat([{card:automatic,free:true}]);
  const x=card('소각',up);runJob(b,{kind:'card',module:'cards',side:'player',card:x,def:A.Battle.describeCard(x,c)});
  assert.equal(b.enemy.hp,200-(up?8:4));assert.equal(b.enemy.excluded.length,up?3:1);assert.ok(b.enemy.rest.some(x=>x.uid===automatic.uid));
  const a=battle(),absorb=card('흡수',up),hits=[card('찌릿!'),card('전류 공급')];a.player.hand=[absorb];a.enemy.hand=hits.slice();a.enemyPlan=hits.map(x=>x.uid);
  A.Battle.submit(a,[absorb.uid],c,rng);settle(a);assert.equal(a.player.hand.filter(x=>hits.some(t=>t.uid===x.uid)).length,up?2:1);
  assert.equal(a.enemy.hp,200-(up?6:4));
 }
});

test('Capsule holds damage through next END, multiplies upgrade, and Snack grants next-turn temporary mana',()=>{
 const {A,c,card,battle,runJob}=setup();
 for(const up of [false,true]){
  const b=battle(),x=card('냉동 캡슐',up);
  runJob(b,{kind:'card',module:'cards',side:'player',card:x,def:A.Battle.describeCard(x,c)});
  runJob(b,{kind:'effect',side:'enemy',effect:{type:'damage',amount:7}});
  assert.equal(b.player.status.cards.effects.find(e=>e.kind==='capsule').amount,7);
  assert.equal(b.scheduled[0].turn,b.turn+1);assert.equal(b.scheduled[0].phase,'END');
  runJob(b,{kind:'event',event:{type:'end'}});assert.equal(b.enemy.hp,200);
  b.turn++;runJob(b,{kind:'effect',side:'enemy',effect:{type:'damage',amount:3}});
  runJob(b,b.scheduled[0].task);assert.equal(b.enemy.hp,200-10*(up?2:1));
  const n=battle(),snack=card('등산용 간식',up);runJob(n,{kind:'card',module:'cards',side:'player',card:snack,def:A.Battle.describeCard(snack,c)});
  assert.equal(n.scheduled.length,up?2:1);
  const jobs=JSON.parse(JSON.stringify(n.scheduled)),maxMana=n.player.maxMana;
  jobs.forEach((job,index)=>{
   assert.equal(job.turn,n.turn+index+1);assert.equal(job.phase,'STANDBY');assert.equal(job.task.amount,1);
  });
  jobs.forEach(job=>{n.player.mana=1;n.turn=job.turn;runJob(n,job.task);assert.equal(n.player.mana,2);assert.equal(n.player.manaGrowth,0);assert.equal(n.player.maxMana,maxMana);});
  const base=A.Battle.describeCard(snack,c);assert.equal(base.cost,1);
  assert.equal(base.text,up?'다음 두 턴의 스탠바이 페이즈시에, 일시적인 마나를 1 얻습니다.':'다음 턴의 스탠바이 페이즈시에, 일시적인 마나를 1 얻습니다.');
 }
});


test('countered one-use cards rest on either side; successful uses are excluded even when instability is present',()=>{
 const {A,c,card,battle,rng}=setup();
 c.cards.once={name:'일회용 테스트',element:'FIRE',cost:0,excludeOnUse:true,effects:[{type:'damage',amount:7}]};
 c.cards.counter={name:'카운터 테스트',element:'ICE',cost:0,effects:[]};
 for(const side of ['player','enemy'])for(const countered of [false,true])for(const unstable of [false,true]){
  const b=battle(),other=side==='player'?'enemy':'player',x=Object.assign(card('once'),{unstable}),z=card('counter');
  b[side].hand=[x];b[other].hand=countered?[z]:[];
  b.enemyPlan=side==='enemy'?[x.uid]:countered?[z.uid]:[];b.enemyPowerPlan=false;
  A.Battle.submit(b,side==='player'?[x.uid]:countered?[z.uid]:[],c,rng);
  const zone=countered?'rest':'excluded';
  assert.ok(b[side][zone].some(item=>item.uid===x.uid),`${side} countered=${countered} unstable=${unstable}`);
  assert.equal(b[other].hp,countered?200:193);
 }
});
