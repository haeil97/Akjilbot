const test=require('node:test');
const assert=require('node:assert/strict');
const A=require('../../악질봇4.0.0.js');
const copy=x=>JSON.parse(JSON.stringify(x));let seq=0;
function card(name,upgraded=false){return {uid:'extra-'+(++seq),cardId:A.CardRules.nameToId(name)||name,upgraded};}
function setup(id){
 const c=copy(A.catalog);c.cards.blank={name:'빈 카드',element:'NEUTRAL',cost:0,effects:[]};
 const deck=()=>Array.from({length:30},()=>card('blank'));
 const b=A.Battle.create({name:'플레이어',maxHp:100,deck:deck(),heroPower:copy(c.heroes[0].power)},{name:id,maxHp:100,deck:deck(),bossId:id,heroPower:A.BossRules.power(id)},c,()=>0.5);
 b.player.hand=[];b.enemy.hand=[];b.player.mana=b.enemy.mana=b.player.maxMana=b.enemy.maxMana=5;b.enemyPlan=[];b.enemyPowerPlan=false;
 const tasks=q=>{b.resolution={queue:q,entries:{player:[],enemy:[]}};A.Battle.process(b,c,()=>0.5);};
 const power=()=>tasks([{kind:'power',module:'boss',side:'enemy',power:A.BossRules.power(id)}]);
 const submit=(player=[],enemy=[])=>{b.enemyPlan=enemy.map(x=>x.uid);b.enemyPowerPlan=false;A.Battle.submit(b,player.map(x=>x.uid),c,()=>0.5);};
 return {c,b,tasks,power,submit};
}
test('new opponents share proper stage pools and approved deck sizes with no forbidden upgrades',()=>{
 const ids={pikachu:20,fiora:29,piranha_plant:32,ivysaur:30,hanar:20,super_minion:40,boo:40,meltranix:30};
 for(const [id,size] of Object.entries(ids)){
  const ref=A.Opponents.get(id);const stages=id==='fiora'||id==='boo'||id==='meltranix'?[4,5]:[2,3];assert.deepEqual(ref.stages,stages);
  for(const stage of stages){const p=A.Opponents.prepare(A.newState(33),{wins:stage-1,deck:[],treasures:{}},A.catalog,id);assert.equal(p.deck.length,size);assert.equal(p.maxHp,A.content.stageHp[stage-1]);assert.ok(A.Opponents.stage(stage).candidates.includes(id));}
 }
 for(const id of ['poison_powder','hanar_truth','hanar_lie','pointing'])assert.equal(A.catalog.cards[id].upgrade,undefined);
});
test('Pikachu counts both live hands and power remains uncounterable',()=>{
 const {b,power}=setup('pikachu');b.player.hand=[card('천둥'),card('재생')];b.enemy.hand=[card('선조의 지혜'),card('파지직')];power();assert.equal(b.player.hp,97);
});
test('Fiora punishes cardless main 1 including power-only use, but not a countered submission',()=>{
 for(const played of [false,true]){const {b,submit}=setup('fiora');const p=card('blank'),e=card('완전 빙결');b.player.hand=[p];b.enemy.hand=[e];submit(played?[p]:[],[e]);assert.equal(b.player.hp,played?100:95);}
 const {b,c}=setup('fiora');A.Battle.submit(b,[],c,()=>0.5,{heroPower:true});assert.equal(b.player.hp,95);
 const lethal=setup('fiora');lethal.b.player.hp=5;lethal.submit();assert.equal(lethal.b.outcome,'defeat');
});
test('Piranha swallows element-countered cards but does not swallow Forest-protected cards',()=>{
 for(const forest of [false,true]){const {b,submit}=setup('piranha_plant'),p=card('불길'),e=card('완전 빙결');b.player.hand=[p];b.enemy.hand=[e];
  if(forest)b.player.status.cards={effects:[{kind:'forest',damage:3,selfDamage:3}],ignite:0};submit([p],[e]);
  assert.equal(b.player.excluded.some(x=>x.uid===p.uid),!forest);assert.equal(b.player.rest.some(x=>x.uid===p.uid),forest);
 }
});
test('Piranha also swallows a third card countered by held Nibiru',()=>{
 const {b,submit}=setup('piranha_plant');const p=[card('불길'),card('광합성'),card('찌릿!')];const third=p[2].uid;b.player.hand=p.slice();b.enemy.hand=[card('마법공학: 니비루')];submit(p);assert.ok(b.player.excluded.some(x=>x.uid===third));
});
test('Ivysaur applies two poison first and detonates triangular remaining damage without reapplying it',()=>{
 const {b,power}=setup('ivysaur');power();assert.equal(b.player.status.poison,2);b.player.status.poison=3;power();assert.equal(b.player.hp,94);assert.equal(b.player.status.poison,0);
});
test('Poison Powder counts basic, overflow and cast-on-draw draws, survives JSON and waits for all end draws',()=>{
 const {b,c,tasks}=setup('ivysaur');b.player.hand=[];b.player.drawnCountThisTurn=0;b.player.deck=[card('불길'),card('poisonous_mushroom'),...Array.from({length:10},()=>card('불길'))];
 tasks([{kind:'card',module:'boss',side:'enemy',card:card('poison_powder'),def:c.cards.poison_powder}]);
 const more=[];A.Battle.context(b,c,()=>0.5,{side:'player'},more).draw('player',2,null,{basic:true});tasks(more);assert.equal(b.player.drawnCountThisTurn,3);
 Object.assign(b,copy(b));tasks([{kind:'event',side:'enemy',event:{type:'afterEnd'}}]);assert.equal(b.player.status.poison,5);
});
test('Hanar discounts only discovery cards to zero and Lie counters one card and creates one discovery card',()=>{
 const {b,c,submit}=setup('hanar'),q=card('기도'),r=card('초고속');const ctx=A.Battle.context(b,c,()=>0.5,{side:'enemy'},[]);
 assert.equal(ctx.cost('enemy',q),0);assert.equal(ctx.cost('enemy',r),1);
 const lie=card('hanar_lie'),p=card('불길');b.player.hand=[p];b.enemy.hand=[lie];submit([p],[lie]);assert.ok(b.player.rest.some(x=>x.uid===p.uid));
 assert.equal(b.enemy.hand.length,1);assert.match(A.Battle.describeCard(b.enemy.hand[0],c).text,/발견/);
});
test('Truth copies only effect, preserves ice and one mana, and ignores unplayable sources',()=>{
 for(const name of ['화염구','마법공학: 니비루']){const {b,c,submit}=setup('hanar'),truth=card('hanar_truth');b.enemy.hand=[truth];b.player.lastDrawnCard=card(name);submit([],[truth]);assert.equal(b.player.hp,name==='화염구'?96:100);assert.equal(c.cards.hanar_truth.element,'ICE');assert.equal(c.cards.hanar_truth.cost,1);}
});
test('Super Minion upgrades hand deck rest once at half health and ignores shield-only damage',()=>{
 const {b,c,tasks}=setup('super_minion');b.enemy.hand=[card('화염구')];b.enemy.deck=[card('천둥')];b.enemy.rest=[card('재생')];b.enemy.shield=20;
 const runDamage=n=>{const spawned=[];A.Battle.context(b,c,()=>0.5,{side:'player'},spawned).damage('player','enemy',n);tasks(spawned);};
 runDamage(20);assert.equal(b.enemy.hp,100);assert.equal(b.enemy.hand[0].upgraded,false);runDamage(49);assert.equal(b.enemy.hp,51);assert.equal(b.enemy.hand[0].upgraded,false);runDamage(1);assert.equal(b.enemy.hp,51);for(const z of ['hand','deck','rest'])assert.equal(b.enemy[z][0].upgraded,true);
 b.enemy.hand.push(card('맹독'));runDamage(10);assert.equal(b.enemy.hp,41);assert.equal(b.enemy.hand[1].upgraded,false);
});
test('Ghost Walk reflects player-first damage in its used phase without preventing damage and spends one mana',()=>{
 for(const shield of [0,10]){
  const {b,c}=setup('boo'),hit=card('화염구');b.player.hand=[hit];b.enemy.shield=shield;b.enemyPowerPlan=true;
  A.Battle.submit(b,[hit.uid],c,()=>0.5);
  assert.equal(b.enemy.hp,shield?100:96);assert.equal(b.enemy.shield,shield?6:0);assert.equal(b.player.hp,96);assert.equal(b.enemy.mana,4);
  assert.equal(b.phase,'MAIN2');assert.equal(A.Battle.canSubmit(b,'enemy',c,null),false);
  const queued=[],ctx=A.Battle.context(b,c,()=>0.5,{side:'player'},queued);ctx.damage('player','enemy',15,{ignoreArmor:true,unblockable:true,noBonus:true});
  b.resolution={queue:queued};A.Battle.process(b,c,()=>0.5);assert.equal(b.player.hp,96);assert.equal(b.enemy.hp,shield?85:81);
 }
});

test('Ghost Walk reflects unblockable and self damage, survives saving, and expires before END',()=>{
 const {b,c,power}=setup('boo');power();const saved=copy(b),queued=[];
 const ctx=A.Battle.context(saved,c,()=>0.5,{side:'enemy'},queued);
 ctx.damage('enemy','enemy',10,{unblockable:true,ignoreArmor:true,noBonus:true});
 saved.resolution={queue:queued};A.Battle.process(saved,c,()=>0.5);assert.equal(saved.enemy.hp,90);assert.equal(saved.player.hp,90);
 saved.phase='END';const later=[],ctx2=A.Battle.context(saved,c,()=>0.5,{side:'player'},later);ctx2.damage('player','enemy',10,{unblockable:true,ignoreArmor:true,noBonus:true});
 saved.resolution={queue:later};A.Battle.process(saved,c,()=>0.5);assert.equal(saved.enemy.hp,80);assert.equal(saved.player.hp,90);
});

test('Ghost Walk reflection applies after reductions, skips zero damage, and terminates reciprocal lethal reactions',()=>{
 const reduced=setup('boo');reduced.power();reduced.b.enemy.status.cards.effects.push({kind:'damageCap',until:reduced.b.turn+1});
 reduced.tasks([{kind:'effect',side:'player',effect:{type:'damage',amount:8}}]);assert.equal(reduced.b.enemy.hp,99);assert.equal(reduced.b.player.hp,99);
 reduced.b.enemy.status.cards.effects.push({kind:'immune',until:reduced.b.turn});
 reduced.tasks([{kind:'effect',side:'player',effect:{type:'damage',amount:8}}]);assert.equal(reduced.b.player.hp,99);
 const {b,c}=setup('boo');b.player.heroPower=A.BossRules.power('boo');b.player.hp=b.enemy.hp=12;b.enemyPowerPlan=true;
 const hit=card('화염구');b.player.hand=[hit];A.Battle.submit(b,[hit.uid],c,()=>0.5,{heroPower:true});
 assert.equal(b.player.hp,4);assert.equal(b.enemy.hp,0);assert.equal(b.outcome,'victory');assert.ok(!b.lastLog.some(x=>x.includes('2,000')));
 const lethal=setup('boo');lethal.b.player.hp=lethal.b.enemy.hp=4;lethal.b.enemyPowerPlan=true;const fatal=card('화염구');lethal.b.player.hand=[fatal];
 A.Battle.submit(lethal.b,[fatal.uid],lethal.c,()=>0.5);assert.equal(lethal.b.player.hp,0);assert.equal(lethal.b.enemy.hp,0);assert.equal(lethal.b.outcome,'defeat');
});

test('Passive Confession always restricts current hand edges and leaves powers usable',()=>{
 const {b,c}=setup('meltranix');assert.equal(b.enemy.heroPower.kind,'passive');const a=card('불길'),mid=card('광합성'),z=card('찌릿!');b.player.hand=[a,mid,z];
 assert.equal(A.Battle.cardAllowed(b,'player',c,mid),false);b.turn=1;assert.equal(A.Battle.cardAllowed(b,'player',c,mid),false);assert.equal(A.Battle.cardAllowed(b,'player',c,a),true);assert.equal(A.Battle.cardAllowed(b,'player',c,z),true);
 b.player.hand.shift();assert.equal(A.Battle.cardAllowed(b,'player',c,mid),true);assert.equal(A.Battle.canSubmit(b,'player',c,null),true);
 b.player.hand.unshift(a);b.turn=20;assert.equal(A.Battle.cardAllowed(b,'player',c,mid),false);b.phase='MAIN2';assert.equal(A.Battle.cardAllowed(b,'player',c,mid),false);assert.equal(A.Battle.canSubmit(b,'enemy',c,null),false);
});
test('Pointing returns only the first enemy hand card and draws one for each side',()=>{
 const {b,c,tasks}=setup('meltranix');const first=card('불길'),second=card('blank');second.cardId='blank';b.player.hand=[first,second];const before=b.enemy.hand.length;
 tasks([{kind:'card',module:'boss',side:'enemy',card:card('pointing'),def:c.cards.pointing}]);assert.equal(b.enemy.hand.length,before+1);assert.equal(b.player.hand.length,2);assert.equal(b.player.hand[0].uid,second.uid);
});

test('foresight samples keep observed Confession submissions at legal hand edges without reading hidden cards',()=>{
 const {b,c}=setup('meltranix');b.turn=1;b.player.status.confession={from:1,until:1};b.player.hand=Array.from({length:6},()=>card('불길'));
 const observed=[{card:b.player.hand[0]},{card:b.player.hand[5]}];const snapshot=A.AI.publicSnapshot(b,c);
 assert.equal(snapshot.player.lastDrawnCard,undefined);
 const sample=A.AIOpponentModel.sample(snapshot,c,0,()=>0.5,observed);
 assert.equal(sample.fighter.hand[0].uid,observed[0].card.uid);assert.equal(sample.fighter.hand[sample.fighter.hand.length-1].uid,observed[1].card.uid);
});
test('Truth copies counter effects, and a later unplayable draw cannot reuse an old copied effect',()=>{
 const {b,c,submit}=setup('hanar'),truth=card('hanar_truth'),p=card('불길');b.enemy.hand=[truth];b.player.hand=[p];b.player.lastDrawnCard=card('자연화');b.player.lastDrawnCard.cardId='general:자연화';submit([p],[truth]);assert.ok(b.player.rest.some(x=>x.uid===p.uid));
 b.enemy.hand=[truth];b.enemy.rest=b.enemy.rest.filter(x=>x.uid!==truth.uid);b.player.lastDrawnCard=card('마법공학: 니비루');b.enemy.mana=5;
 const before=b.player.hp;submit([],[truth]);assert.equal(b.player.hp,before);
});

test('Ivysaur AI applies initial poison with its power, saves one or two stacks, and detonates from three',()=>{
 for(const poison of [0,1,2,3]){
  const {b,c}=setup('ivysaur');b.player.status.poison=poison;
  const candidates=A.AI.candidates(A.AI.publicSnapshot(b,c),c,'enemy',3);
  assert.equal(candidates.some(x=>x.heroPower),poison===0||poison>=3);
  if(poison>0&&poison<3)assert.equal(A.Battle.plan(b,c,()=>0.5).heroPower,false);
 }
});


test('Doctor AI prefers Baptism when available, respects cooldown, and chooses an immediate win over healing',()=>{
 for(const phase of ['MAIN1','MAIN2']){
  const {b,c}=setup('plague_doctor');b.phase=phase;b.enemy.mana=1;
  const plan=A.Battle.plan(b,c,()=>0.5);assert.equal(plan.heroPower,true);
  b.enemy.heroPowerReadyTurn=b.turn+1;assert.equal(A.Battle.plan(b,c,()=>0.5).heroPower,false);
 }
 const {b,c}=setup('plague_doctor');b.player.hp=2;b.enemy.mana=1;b.enemy.hand=[card('화염구')];
 const plan=A.Battle.plan(b,c,()=>0.5);assert.equal(plan.heroPower,false);assert.deepEqual(Array.from(plan.uids),[b.enemy.hand[0].uid]);
});


test('Patchwerk and Aurelion can reuse their powers only four turns after use',()=>{
 for(const id of ['patchwerk','aurelion_sol']){
  const {b,c}=setup(id);b.player.heroPower=A.BossRules.power(id);b.enemyPlan=[];b.enemyPowerPlan=false;
  A.Battle.submit(b,[],c,()=>0.5,{heroPower:true});assert.equal(b.player.heroPowerReadyTurn,4);
  for(const turn of [1,2,3,4]){b.turn=turn;b.player.mana=5;assert.equal(A.Battle.canSubmit(b,'player',c,null),turn===4);}
 }
});


test('hidden Ice Trap still counters its actual selected element after save restore',()=>{
 const {b,c,submit}=setup('fiora');b.player.status.cards.effects=[{kind:'iceTrap',name:'얼음 덫',element:'FIRE',from:0,until:1,sourceSide:'enemy'}];
 const p=card('불길');b.player.hand=[p];Object.assign(b,copy(b));const live=b.player.hand[0];submit([live]);
 assert.equal(b.history[0].player[0].countered,true);assert.equal(b.player.status.cards.effects[0].element,'FIRE');
});


test('Doctor skips the entire turn after Baptism even when a saved ready turn is stale',()=>{
 const {b,c}=setup('plague_doctor');b.enemy.heroPowerUsedTurn=0;b.enemy.heroPowerReadyTurn=0;b.enemy.mana=5;
 for(const phase of ['MAIN1','MAIN2']){
  b.turn=1;b.phase=phase;
  assert.ok(A.AI.candidates(A.AI.publicSnapshot(b,c),c,'enemy',3).every(x=>!x.heroPower));
  assert.equal(A.Battle.plan(b,c,()=>0.5).heroPower,false);
  assert.equal(A.Battle.legacyPlan(b,c,()=>0.5).heroPower,false);
 }
 b.turn=2;assert.equal(A.Battle.plan(b,c,()=>0.5).heroPower,true);
});


test('Scare casts on draw, draws for Boo, discards only opponent hand, and rests without mana payment',()=>{
 const {b,c,tasks}=setup('boo');const scare=card('boo_scare'),replacement=card('blank');replacement.cardId='blank';
 b.enemy.deck=[scare,replacement];b.player.hand=[card('재생'),card('광합성')];
 tasks([{kind:'effect',side:'enemy',effect:{type:'draw',amount:1}}]);
 assert.equal(b.enemy.mana,5);assert.equal(b.enemy.hand.length,1);assert.equal(b.enemy.hand[0].uid,replacement.uid);
 assert.equal(b.player.hand.length,1);assert.equal(b.player.rest.length,1);assert.ok(b.enemy.rest.some(x=>x.uid===scare.uid));
 assert.equal(c.cards.boo_scare.upgrade,undefined);assert.equal(c.cards.boo_scare.castOnDraw,true);
 const saved=copy(b);assert.deepEqual(saved.enemy.hand,b.enemy.hand);
});

test('Boo deck removes Acceleration and Foresight, and AI values the power as damage rather than immunity',()=>{
 const deck=A.Opponents.get('boo');assert.equal(deck.deckSize,40);assert.ok(!deck.cards.some(x=>x.name==='신의 권능: 가속'||x.name==='예지'));
 const {b,c}=setup('boo');b.player.hand=[card('화염구')];b.player.mana=2;
 const m=A.AIEvaluation.evaluateCard(A.BossRules.power('boo'),b.enemy,b.player,b,c);assert.ok(m.damage>0);assert.equal(m.shield,0);
 b.enemy.status.ghostWalkReflectTurn=b.turn;b.enemy.status.ghostWalkReflectPhase=b.phase;
 assert.equal(A.AIEvaluation.damageAfter(b.player,b.enemy,{element:'FIRE'},4,b,{noBonus:true}),4);
});

test('Ivysaur only considers Poison Powder after the opponent has drawn at least two cards this turn',()=>{
 for(const phase of ['MAIN1','MAIN2'])for(const drawn of [0,1,2,3]){
  const {b,c}=setup('ivysaur');b.phase=phase;b.player.drawnCountThisTurn=drawn;const powder=card('poison_powder');b.enemy.hand=[powder];
  const candidates=A.AI.candidates(A.AI.publicSnapshot(b,c),c,'enemy',5);
  if(drawn<2){assert.ok(candidates.every(x=>!x.uids.includes(powder.uid)));assert.ok(!A.AI.plan(b,c,()=>0.5).uids.includes(powder.uid));assert.ok(!A.Battle.legacyPlan(b,c,()=>0.5).uids.includes(powder.uid));}
  else {assert.ok(candidates.some(x=>x.uids.includes(powder.uid)));assert.ok(A.Battle.legacyPlan(b,c,()=>0.5).uids.includes(powder.uid));}
  assert.equal(A.Battle.cardAllowed(b,'enemy',c,powder),true);
 }
});


test('Detox and Transfer cannot cleanse or transfer Confession, including old saved cleanse flags',()=>{
 for(const transfer of [false,true]){
  const {b,c}=setup('meltranix'),spell=card(transfer?'전이':'제독'),mid=card('재생'),last=card('광합성');
  b.player.hand=[spell,mid,last];b.enemy.hand=[card('재생'),card('광합성'),card('재생')];b.player.deck=[];b.player.rest=[];
  b.player.status.cleansedConfession=true;b.player.status.poison=4;
  assert.equal(A.Battle.cardAllowed(b,'player',c,mid),false);
  assert.deepEqual(A.CardRules.harmfulEffects(b,'player').map(x=>x.type),['poison']);
  A.Battle.submit(b,[spell.uid],c,()=>0.5);assert.equal(b.player.status.poison,0);
  b.player.hand.unshift(card('blank'));assert.equal(A.Battle.cardAllowed(b,'player',c,mid),false);
  assert.equal(b.enemy.heroPower.id,'meltranix');assert.equal(b.enemy.status.confession,undefined);
  assert.equal(A.Battle.cardAllowed(b,'enemy',c,b.enemy.hand[1]),true);
  if(transfer)assert.equal(b.enemy.status.poison,4);
  Object.assign(b,copy(b));assert.equal(A.Battle.cardAllowed(b,'player',c,mid),false);
  assert.match(A.BattleUI.summary(b,1,c),/자백: 손패의 첫 번째와 마지막 카드만 낼 수 있다/);
 }
});

test('Natural Detox waits for draw-triggered mushroom poison before healing and cleansing',()=>{
 for(const up of [false,true]){
  const {b,c}=setup('teemo'),spell=card('자연의 해독',up);b.player.hand=[spell];b.player.hp=80;b.player.status.poison=1;
  b.player.deck=[card('poisonous_mushroom'),card('blank')];A.Battle.submit(b,[spell.uid],c,()=>0.5);
  assert.equal(b.player.status.poison,0);assert.equal(b.player.hp,80+3*(up?2:1));assert.ok(b.player.rest.some(x=>x.cardId==='poisonous_mushroom'));
 }
});


test('Hanar discovery discount is active only in MAIN1 for both card ranks',()=>{
  const {b,c}=setup('hanar');
  for(const up of [false,true]){
    const discovery=card('발굴',up),normal=card('재생',up);b.enemy.hand=[discovery,normal];
    for(const phase of ['MAIN1','MAIN2']){
      b.phase=phase;
      assert.equal(A.Battle.cardCost(b,'enemy',discovery,c),phase==='MAIN1'?0:1);
      assert.equal(A.Battle.cardCost(b,'enemy',normal,c),1);
    }
  }
  assert.equal(A.BossRules.power('hanar').text,'메인 페이즈 1에 내 발견 카드들의 비용이 (1) 감소합니다.');
});

test('each weakness has Overpower, draws any element, and only critical hits apply its extra effect',()=>{
  for(const el of ['nature','ice','lightning','fire'])for(const critical of [false,true]){
    const {b,c,tasks}=setup('fiora');const id='fiora_weakness_'+el,x=card(id);b.enemy.hp=60;
    b.enemy.deck=[card('blank'),card('fiora_weakness_fire')];
    const handCard=card('재생'),restCard=card('파지직');b.player.hand=[handCard];b.player.rest=[restCard];
    assert.equal(c.cards[id].overpower,true);assert.equal(c.cards[id].cost,1);assert.equal(c.cards[id].upgrade,undefined);
    tasks([{kind:'card',module:'boss',side:'enemy',card:x,def:c.cards[id],critical}]);
    assert.equal(b.enemy.hand.filter(x=>x.cardId==='fiora_weakness_fire').length,1);
    assert.equal(b.enemy.deck.length,1);assert.equal(b.enemy.deck[0].cardId,'blank');
    if(el==='nature'){
      assert.equal(b.scheduled.length,critical?2:0);
      if(critical){assert.deepEqual(b.scheduled.map(x=>x.turn),[1,2]);tasks(b.scheduled.map(x=>x.task));assert.equal(b.enemy.hp,70);}
    }
    if(el==='ice')assert.equal(b.player.hand.length,critical?0:1);
    if(el==='lightning')assert.equal(b.enemy.hand.some(x=>x.uid===restCard.uid),critical);
    if(el==='fire')assert.equal(b.player.hp,critical?92:100);
  }
});

test('Grand Duel returns all four weaknesses, adds exactly one of each to deck, and is excluded on use',()=>{
  const {b,c,submit}=setup('fiora'),duel=card('fiora_grand_duel');
  b.enemy.hand=[duel];b.enemy.deck=[card('blank')];
  b.enemy.rest=['nature','ice','lightning','fire'].map(el=>card('fiora_weakness_'+el));
  const prior=b.enemy.rest.map(x=>x.uid);assert.equal(c.cards.fiora_grand_duel.overpower,true);
  submit([],[duel]);assert.equal(b.enemy.hand.length,4);assert.ok(prior.every(uid=>b.enemy.hand.some(x=>x.uid===uid)));
  for(const el of ['nature','ice','lightning','fire'])assert.equal(b.enemy.deck.filter(x=>x.cardId==='fiora_weakness_'+el).length,1);
  assert.ok(b.enemy.excluded.some(x=>x.uid===duel.uid));
});

test('weakness Overpower counters same-element cards and critical discovery keeps same-name elements distinct',()=>{
  const {b,c,submit,tasks}=setup('fiora');
  const x=card('fiora_weakness_fire'),p=card('화염구');b.enemy.hand=[x];b.player.hand=[p];b.enemy.deck=[];
  submit([p],[x]);assert.equal(b.player.hp,87);assert.equal(b.enemy.hp,100);assert.equal(b.history[0].player[0].countered,true);
  const q=setup('fiora');q.b.player.hand=['nature','ice','lightning','fire'].map(el=>card('fiora_weakness_'+el));
  // Ask from the player's side so choices stay pending for inspection and reload.
  q.b.enemy.hand=['nature','ice','lightning','fire'].map(el=>card('fiora_weakness_'+el));
  q.tasks([{kind:'card',module:'boss',side:'player',card:card('fiora_weakness_ice'),def:q.c.cards.fiora_weakness_ice,critical:true}]);
  assert.ok(q.b.pendingChoice);assert.equal(q.b.pendingChoice.options.length,3);
  assert.equal(new Set(q.b.pendingChoice.options.map(x=>x.cardId)).size,3);
  const restored=copy(q.b);A.Battle.choose(restored,0,q.c,()=>0.5);assert.equal(restored.enemy.hand.length,3);
});


test('Boo has four unupgradeable Ghost Raiders in its forty card deck',()=>{
 const ref=A.Opponents.get('boo');assert.equal(ref.deckSize,40);
 const plan=A.Opponents.prepare(A.newState(33),{wins:3,deck:[],treasures:{}},A.catalog,'boo');
 assert.equal(plan.deck.filter(x=>x.cardId==='boo_ghost_raider').length,4);
 assert.equal(A.catalog.cards.boo_ghost_raider.cost,0);assert.equal(A.catalog.cards.boo_ghost_raider.upgrade,undefined);
});

test('Ghost Raider counts both simultaneous direct submissions, including countered cards',()=>{
 const {b,c,submit}=setup('boo');c.cards.testFire={name:'Fire',element:'FIRE',cost:0,effects:[]};c.cards.testIce={name:'Ice',element:'ICE',cost:0,effects:[]};
 const p=card('testFire'),e=card('testIce'),r=card('boo_ghost_raider');b.player.hand=[p];b.enemy.hand=[e,r];
 submit([p],[e,r]);assert.equal(b.player.hp,88);assert.equal(b.history[0].player[0].countered,true);
 assert.equal(b.enemy.playedThisTurn,2);assert.equal(b.player.playedThisTurn,1);
});

test('automatic cards and powers do not increase Ghost Raider damage',()=>{
 const {b,c,tasks}=setup('boo');b.player.playedThisTurn=1;b.enemy.playedThisTurn=1;
 tasks([{kind:'cast',side:'enemy',card:card('blank'),copy:true},{kind:'power',module:'boss',side:'enemy',power:A.BossRules.power('boo')}]);
 assert.equal(b.enemy.playedThisTurn,1);
 const r=card('boo_ghost_raider');tasks([{kind:'card',module:'boss',side:'enemy',card:r,def:c.cards.boo_ghost_raider}]);
 assert.equal(b.player.hp,92);
});


test('Super Minion blocks its entire first threshold-crossing hit including lethal damage and keeps armor',()=>{
 for(const lethal of [false,true]){
  const {b,c,tasks}=setup('super_minion');b.enemy.hp=60;b.enemy.shield=10;
  const held=card('화염구'),flight=card('맹독'),excluded=card('천둥');b.enemy.hand=[held];b.enemy.inFlight=[flight];b.enemy.excluded=[excluded];
  const spawned=[],amount=lethal?1000:25;
  A.Battle.context(b,c,()=>0.5,{side:'player'},spawned).damage('player','enemy',amount);tasks(spawned);
  assert.equal(b.enemy.hp,60);assert.equal(b.enemy.shield,10);assert.equal(b.enemy.damageTakenThisTurn,0);
  assert.equal(b.enemy.status.inhibitorTriggered,true);assert.equal(held.upgraded,true);assert.equal(flight.upgraded,false);assert.equal(excluded.upgraded,false);
  const saved=JSON.parse(JSON.stringify(b));Object.assign(b,saved);
  const again=[];A.Battle.context(b,c,()=>0.5,{side:'player'},again).damage('player','enemy',25);tasks(again);
  assert.equal(b.enemy.hp,45);assert.equal(b.enemy.shield,0);
 }
 const enemy=A.Opponents.get('super_minion');assert.equal(enemy.deckSize,40);
 assert.ok(!enemy.cards.some(x=>x.name==='연쇄 번개'));assert.equal(enemy.cards.find(x=>x.name==='재생').count,2);
});


test('Fiora deals five per unique countered opposing card in both phases and supports copied powers',()=>{
 for(const phase of ['MAIN1','MAIN2'])for(const duplicated of [false,true]){
  const {b,c,submit}=setup('fiora');b.phase=phase;c.cards.counterIce={name:'Ice',element:'ICE',cost:0,effects:[]};c.cards.targetFire={name:'Fire',element:'FIRE',cost:0,effects:[]};
  const p=[card('targetFire'),card('targetFire')],e=Array.from({length:duplicated?2:1},()=>card('counterIce'));
  b.player.hand=p.slice();b.enemy.hand=e.slice();submit(p,e);assert.equal(b.player.hp,90);assert.equal(b.enemy.hp,100);
 }
 const {b,c,submit}=setup('fiora');b.player.heroPower=A.BossRules.power('fiora');
 c.cards.counterIce={name:'Ice',element:'ICE',cost:0,effects:[]};c.cards.targetFire={name:'Fire',element:'FIRE',cost:0,effects:[]};
 const p=card('counterIce'),e=card('targetFire');b.player.hand=[p];b.enemy.hand=[e];submit([p],[e]);assert.equal(b.enemy.hp,95);
});

test('Fiora counter damage is power damage, respects reductions and resets deduplication each phase after saving',()=>{
 const {b,tasks}=setup('fiora');b.enemy.treasureIds=['archmage_robe'];b.enemy.status.cosmicBonus=100;b.player.shield=4;
 const event={kind:'event',side:'enemy',event:{type:'counter',side:'enemy',targets:[{uid:'same-card'}]}};
 tasks([event]);assert.equal(b.player.hp,99);assert.equal(b.player.shield,0);
 Object.assign(b,copy(b));tasks([event]);assert.equal(b.player.hp,99);
 b.phase='MAIN2';tasks([event]);assert.equal(b.player.hp,94);
 b.turn++;b.player.status.cards.effects=[{kind:'damageCap',amount:1,until:b.turn}];tasks([event]);assert.equal(b.player.hp,93);
});


test('Poison Powder excludes the four opening cards but counts subsequent first-turn draws',()=>{
 const c=copy(A.catalog);c.cards.openingBlank={name:'Blank',element:'NEUTRAL',cost:0,effects:[]};
 const spec=name=>({name,maxHp:100,deck:Array.from({length:12},()=>card('openingBlank'))});
 const b=A.Battle.create(spec('Player'),Object.assign(spec('Ivysaur'),{heroPower:A.BossRules.power('ivysaur')}),c,()=>0.5);
 assert.equal(b.player.hand.length,4);assert.equal(b.player.drawnCountThisTurn||0,0);assert.equal(b.enemy.drawnCountThisTurn||0,0);
 const powder=card('poison_powder');b.resolution={queue:[{kind:'card',module:'boss',side:'enemy',card:powder,def:c.cards.poison_powder}],entries:{player:[],enemy:[]}};A.Battle.process(b,c,()=>0.5);
 const spawned=[];A.Battle.context(b,c,()=>0.5,{side:'player'},spawned).draw('player',2);
 b.resolution={queue:spawned.concat([{kind:'event',event:{type:'afterEnd'}}]),entries:{player:[],enemy:[]}};A.Battle.process(b,c,()=>0.5);
 assert.equal(b.player.drawnCountThisTurn,2);assert.equal(b.player.status.poison,2);
});
