'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const A=require('../../악질봇4.0.0.js');
// Existing tactic tests assess the best-ranked action. Diversity is tested separately.
A.AI.limits.varietyEnabled=false;
const copy=x=>JSON.parse(JSON.stringify(x));
test('large action shortlist preserves exhaustive lethal ranking and reduces expensive batch evaluations',()=>{
  const {b,c}=setup();b.phase='MAIN2';b.enemy.mana=5;b.enemy.maxMana=5;
  b.enemy.hand=Array.from({length:10},(_,i)=>card(i<3?'ai-test:fire':'ai-test:ice',{cost:0}));
  b.player.hp=14;
  const oldBudget=A.AI.limits.exactCandidates,oldBatch=A.AIEvaluation.evaluateBatch;
  let evaluations=0;
  A.AIEvaluation.evaluateBatch=function(...args){evaluations++;return oldBatch(...args);};
  try{
    A.AI.limits.exactCandidates=Infinity;
    const exhaustive=A.AI.candidates(b,c,'enemy',4);const before=evaluations;evaluations=0;
    A.AI.limits.exactCandidates=oldBudget;
    const bounded=A.AI.candidates(b,c,'enemy',4);
    assert.deepEqual(bounded[0].uids,exhaustive[0].uids);
    assert.equal(bounded[0].score,exhaustive[0].score);
    assert.ok(evaluations<before/3,`${evaluations} versus ${before} expensive evaluations`);
    assert.ok(bounded.some(x=>!x.uids.length&&!x.heroPower));
  }finally{A.AI.limits.exactCandidates=oldBudget;A.AIEvaluation.evaluateBatch=oldBatch;}
});
let serial=0;
test('near-best choices use 60/25/15 and exclude worse scores, unsafe outcomes and repeated orders',()=>{
 const enabled=A.AI.limits.varietyEnabled;A.AI.limits.varietyEnabled=true;
 const choices=[{uids:['a'],heroPower:false,score:10,outcomes:'ongoing|ongoing'},{uids:['b'],heroPower:false,score:9.5,outcomes:'ongoing|ongoing'},{uids:['c'],heroPower:false,score:9,outcomes:'ongoing|ongoing'}];
 try{
  const counts={a:0,b:0,c:0};for(let i=0;i<1000;i++)counts[A.AI.chooseNearBest(choices,(i+.5)/1000).uids[0]]++;
  assert.deepEqual(counts,{a:600,b:250,c:150});
  const unsafe=[choices[0],Object.assign({},choices[1],{outcomes:'defeat|ongoing'}),Object.assign({},choices[2],{score:7})];
  assert.equal(A.AI.chooseNearBest(unsafe,.99).uids[0],'a');
  const two={a:0,b:0};for(let i=0;i<850;i++)two[A.AI.chooseNearBest(choices.slice(0,2),(i+.5)/850).uids[0]]++;
  assert.deepEqual(two,{a:600,b:250});
  assert.equal(A.AI.chooseNearBest([{uids:['x','y'],heroPower:false,score:10,outcomes:'ongoing'},{uids:['y','x'],heroPower:false,score:10,outcomes:'ongoing'},{uids:['z'],heroPower:false,score:9.5,outcomes:'ongoing'}],.99).uids[0],'z');
  const {b,c}=setup();b.enemy.mana=b.enemy.maxMana=2;b.enemy.hand=[card('ai-test:attack'),card('ai-test:attack')];
  const before=copy(b);let rngCalls=0;const first=A.AI.plan(b,c,()=>{rngCalls++;return .5;});
  assert.deepEqual(A.AI.plan(b,c,()=>.1),first);assert.deepEqual(b,before);assert.equal(rngCalls,0);
 }finally{A.AI.limits.varietyEnabled=enabled;}
});
function card(cardId,extra={}){return Object.assign({uid:'planning-'+(++serial),cardId,upgraded:false},extra);}
function setup(){
  const c=copy(A.catalog);
  Object.assign(c.cards,{
    'ai-test:blank':{name:'빈 카드',element:'NEUTRAL',cost:0,effects:[]},
    'ai-test:attack':{name:'공격',element:'NEUTRAL',cost:1,effects:[{type:'damage',amount:5}]},
    'ai-test:finisher':{name:'큰 공격',element:'NEUTRAL',cost:3,effects:[{type:'damage',amount:12}]},
    'ai-test:heal':{name:'치료',element:'NEUTRAL',cost:1,effects:[{type:'heal',amount:5}]},
    'ai-test:mana':{name:'임시 마나',element:'NEUTRAL',cost:0,effects:[{type:'mana',amount:2}]},
    'ai-test:fire':{name:'화염 공격',element:'FIRE',cost:1,effects:[{type:'damage',amount:5}]},
    'ai-test:ice':{name:'냉기 공격',element:'ICE',cost:1,effects:[{type:'damage',amount:3}]},
    'ai-test:limited':{name:'제한 공격',element:'NEUTRAL',cost:0,limited:true,effects:[{type:'damage',amount:1}]},
    'ai-test:forbidden':{name:'사용불가',element:'NEUTRAL',cost:0,unplayable:true,effects:[{type:'damage',amount:100}]}
  });
  const spec=name=>({name,maxHp:30,deck:Array.from({length:4},()=>card('ai-test:blank'))});
  const b=A.Battle.create(spec('플레이어'),spec('상대'),c,()=>0.5);
  b.player.hand=[];b.player.deck=[];b.player.rest=[];b.player.excluded=[];
  b.enemy.hand=[];b.enemy.deck=[];b.enemy.rest=[];b.enemy.excluded=[];
  b.enemyPlan=[];b.enemyPowerPlan=false;b.enemyPlanDeferred=false;
  b.player.mana=b.player.maxMana=b.enemy.mana=b.enemy.maxMana=1; // Fixed tactic fixtures specify their own mana budget.
  delete b.publicPlayerDeck; // These fixtures arrange hypothetical states after opening.
  return {b,c};
}
function plan(b,c,observed){return A.AI.plan(b,c,()=>0.5,observed);}
function apply(b,c,p,playerCards=[]){
  b.enemyPlan=p.uids;b.enemyPowerPlan=p.heroPower;b.enemyPlanDeferred=false;
  return A.Battle.submit(b,playerCards.map(x=>x.uid),c,()=>0.5,{});
}
function actions(p){return {uids:p.uids,heroPower:p.heroPower};}

test('planner uses public information, leaves live state intact and consumes no real random draws',()=>{
  const {b,c}=setup();b.enemy.mana=b.enemy.maxMana=3;
  b.enemy.hand=['ai-test:fire','ai-test:ice','ai-test:heal','ai-test:finisher'].map(id=>card(id));
  b.enemy.deck=['ai-test:heal','ai-test:attack','ai-test:finisher'].map(id=>card(id));
  b.enemy.hp=15;
  b.player.hand=[card('ai-test:attack'),card('ai-test:attack')];
  b.player.deck=[card('ai-test:heal'),card('ai-test:finisher')];
  b.player.excluded=[card('ai-test:fire')];
  b.player.rest=[card('ai-test:ice')];
  b.player.status.treasures.mirages={'hidden-original-hand':[card('ai-test:attack')]};
  b.history=[{turn:-1,phase:'MAIN2',player:[{cardId:'ai-test:ice',element:'ICE',upgraded:false}],enemy:[]}];
  const before=copy(b);let randomCalls=0;
  const first=A.AI.plan(b,c,()=>{randomCalls++;return 0.5;});
  assert.deepEqual(b,before,'candidate simulation must never mutate real hands, queues or logs');
  assert.equal(randomCalls,0,'search must not consume the RNG used by real card effects');
  b.player.hand=[card('ai-test:finisher'),card('ai-test:forbidden')];
  b.player.deck=[card('ai-test:ice'),card('ai-test:ice')];
  b.player.excluded=[card('ai-test:forbidden')];
  b.player.status.treasures.mirages={'hidden-original-hand':[card('ai-test:forbidden')]};
  b.restartSpecs.player.deck=[card('ai-test:forbidden')];
  assert.deepEqual(actions(plan(b,c)),actions(first),'unseen card identity cannot influence the action');
  b.enemy.deck.reverse();
  assert.deepEqual(actions(plan(b,c)),actions(first),'the AI may know its deck composition but not the shuffled draw order');
});

test('redacted draw bookkeeping remains executable after cards were already drawn this turn',()=>{
  const {b,c}=setup();c.cards['ai-test:draw']={name:'드로우',element:'NEUTRAL',cost:0,effects:[{type:'draw',amount:2}]};
  const draw=card('ai-test:draw');b.player.hand=[draw];b.player.deck=[card('ai-test:attack'),card('ai-test:heal')];
  Object.assign(b.player.status.cards,{drawCountTurn:b.turn,drawCount:1,drawnUids:['hidden-prior-draw']});
  b.enemy.hand=[card('ai-test:attack')];
  const p=plan(b,c,[{card:copy(draw),def:A.Battle.describeCard(draw,c),paidCost:0,side:'player'}]);
  assert.deepEqual(p.stats.errors||[],[],'simulated subsequent draws must not fail on redacted private UID lists');
});

test('planner searches a combined lethal instead of judging each nonlethal card alone',()=>{
  const {b,c}=setup();b.phase='MAIN2';b.player.hp=10;b.enemy.mana=b.enemy.maxMana=2;
  b.enemy.hand=[card('ai-test:attack'),card('ai-test:attack'),card('ai-test:heal')];
  const p=plan(b,c);assert.equal(p.uids.length,2);
  assert.ok(p.uids.every(uid=>b.enemy.hand.find(x=>x.uid===uid).cardId==='ai-test:attack'));
  assert.equal(apply(b,c,p).outcome,'defeat','the selected pair must actually defeat the player');
});

test('public damage caps are resolved by actual effects, making two hits better than a large burst',()=>{
  const {b,c}=setup();b.phase='MAIN2';b.enemy.mana=b.enemy.maxMana=2;b.player.hp=2;
  c.cards['ai-test:burst']={name:'큰 한 방',element:'NEUTRAL',cost:2,effects:[{type:'damage',amount:30}]};
  c.cards['ai-test:double']={name:'두 번 공격',element:'NEUTRAL',cost:2,effects:[{type:'damage',amount:1},{type:'damage',amount:1}]};
  b.player.status.cards.effects=[{kind:'damageCap',from:b.turn,until:b.turn}];
  const burst=card('ai-test:burst'),double=card('ai-test:double');b.enemy.hand=[burst,double];
  const p=plan(b,c);assert.deepEqual(p.uids,[double.uid]);
  assert.equal(apply(b,c,p).outcome,'defeat');
});

test('planner uses MAIN1 mana generation to enable MAIN2 lethal without spending it in the first batch',()=>{
  const {b,c}=setup();b.player.hp=12;b.enemy.mana=b.enemy.maxMana=1;
  const mana=card('ai-test:mana'),finisher=card('ai-test:finisher');b.enemy.hand=[finisher,mana];
  const first=plan(b,c);assert.deepEqual(first.uids,[mana.uid]);
  apply(b,c,first);assert.equal(b.phase,'MAIN2');assert.equal(b.enemy.mana,3);
  const second=plan(b,c);assert.deepEqual(second.uids,[finisher.uid]);
  assert.equal(apply(b,c,second).outcome,'defeat');
});

test('effect order can spend generated mana through Forbidden Flame without using it to pay batch costs',()=>{
  const {b,c}=setup();b.phase='MAIN2';b.player.hp=12;b.enemy.mana=b.enemy.maxMana=1;
  const flame=card(A.CardRules.nameToId('금단의 불꽃')),mana=card('ai-test:mana');b.enemy.hand=[flame,mana];
  const p=plan(b,c);assert.deepEqual(p.uids,[mana.uid,flame.uid]);
  assert.equal(apply(b,c,p).outcome,'defeat','effect execution order must produce the full 12 damage');
});

test('simultaneous lethal is evaluated using the actual player-loss tiebreak rule',()=>{
  const {b,c}=setup();b.phase='MAIN2';b.player.hp=b.enemy.hp=5;
  const attack=card('ai-test:attack'),heal=card('ai-test:heal'),response=card('ai-test:attack');
  b.enemy.hand=[attack,heal];b.player.hand=[response];
  const observed=[{card:copy(response),def:A.Battle.describeCard(response,c),paidCost:1,side:'player'}];
  const p=plan(b,c,observed);assert.deepEqual(p.uids,[attack.uid]);
  assert.equal(apply(b,c,p,[response]).outcome,'defeat');
  assert.equal(b.player.hp,0);assert.equal(b.enemy.hp,0);
});

test('MAIN2 looks through END and next STANDBY to heal against known incoming fatal damage',()=>{
  const {b,c}=setup();b.phase='MAIN2';b.enemy.hp=4;b.enemy.mana=b.enemy.maxMana=1;
  const attack=card('ai-test:attack'),heal=card('ai-test:heal');b.enemy.hand=[attack,heal];
  b.scheduled=[{turn:b.turn+1,phase:'STANDBY',task:{kind:'effect',side:'player',card:card('ai-test:attack'),effect:{type:'damage',amount:6}}}];
  const p=plan(b,c);assert.deepEqual(p.uids,[heal.uid]);
  apply(b,c,p);assert.equal(b.outcome,'ongoing');assert.equal(b.enemy.hp,3);
});

test('revealed current counter makes the AI wait, then spend the card after opposing mana is gone',()=>{
  const {b,c}=setup();const fire=card('ai-test:fire'),ice=card('ai-test:ice');
  b.enemy.hand=[fire];b.player.hand=[ice];b.player.hp=15;
  const observed=[{card:copy(ice),def:A.Battle.describeCard(ice,c),paidCost:1,side:'player'}];
  const first=plan(b,c,observed);assert.deepEqual(first.uids,[],'do not throw away a card into a publicly revealed counter');
  apply(b,c,first,[ice]);assert.equal(b.phase,'MAIN2');assert.equal(b.player.mana,0);
  const second=plan(b,c);assert.deepEqual(second.uids,[fire.uid]);
  apply(b,c,second);assert.equal(b.player.hp,10);
});

test('public counter history alone can make the AI reserve FIRE for MAIN2 without seeing the submitted card',()=>{
  const {b,c}=setup(),fire=card('ai-test:fire',{uid:'public-risk-fire'}),ice=card('ai-test:ice',{uid:'hidden-risk-ice'});
  b.turn=12;b.enemy.hand=[fire];b.player.hand=[ice];b.player.hp=15;
  b.enemy.mana=b.enemy.maxMana=b.player.maxMana=3;b.player.mana=1;b.player.overloadLocked=2;
  b.history=Array.from({length:12},(_,turn)=>({turn,phase:'MAIN1',player:[{cardId:'ai-test:ice',element:'ICE',upgraded:false}],enemy:[]}));
  const first=plan(b,c);assert.deepEqual(first.uids,[],'recent public ICE usage makes a counter risky in MAIN1');
  apply(b,c,first,[ice]);assert.equal(b.player.mana,0);assert.equal(b.phase,'MAIN2');
  const second=plan(b,c);assert.deepEqual(second.uids,[fire.uid]);
  apply(b,c,second);assert.equal(b.player.hp,10);
});

test('planner respects card locks, unavailable cards, shared limited names and hero cooldown together',()=>{
  const {b,c}=setup();b.phase='MAIN2';b.enemy.mana=b.enemy.maxMana=5;
  const a=card('ai-test:limited'),z=card('ai-test:limited',{upgraded:true});
  b.enemy.hand=[a,z,card('ai-test:forbidden'),card('ai-test:fire'),card('ai-test:finisher',{availableFrom:b.turn+1})];
  b.enemy.status.cardLocks=[{from:b.turn,until:b.turn,elements:['FIRE']}];
  b.enemy.heroPower={id:'test-power',name:'치유',kind:'active',cost:0,effects:[{type:'heal',amount:100}]};
  b.enemy.heroPowerUsedTurn=b.turn;b.enemy.hp=1;
  const p=plan(b,c);assert.equal(p.heroPower,false);assert.equal(p.uids.length,1);
  assert.ok([a.uid,z.uid].includes(p.uids[0]));
  assert.doesNotThrow(()=>apply(b,c,p),'an AI plan must be accepted by the actual batch validator');
});

test('full hand search obeys a deterministic simulation budget and produces a legal action',()=>{
  const {b,c}=setup();b.enemy.mana=b.enemy.maxMana=5;b.enemy.treasureIds=['pelgozi_wallet'];
  b.enemy.hand=Array.from({length:10},(_,i)=>card(i%2?'ai-test:attack':'ai-test:heal'));
  b.enemy.hp=12;b.player.hand=Array.from({length:8},()=>card('ai-test:ice'));
  const started=Date.now(),p=plan(b,c);
  assert.ok(p.stats.simulations>0,'the bounded planner must exercise the real engine');
  assert.ok(p.stats.simulations<=A.AI.limits.simulations);
  assert.ok(Date.now()-started<10000,'one crowded-hand decision must finish within the chat response window');
  assert.doesNotThrow(()=>apply(b,c,p));
});

test('discovery values healing against actual health rather than a fixed generic opponent',()=>{
  const {b,c}=setup(),options=[card('ai-test:attack'),card('ai-test:heal')];
  b.enemy.hp=2;b.enemy.mana=1;b.enemy.maxMana=1;
  const low=A.AIChoices.choose(options,b,c,{}, {side:'enemy',op:'generateChoice'});
  assert.equal(low.cardId,'ai-test:heal');
  b.enemy.hp=b.enemy.maxHp;b.player.hp=5;
  const lethal=A.AIChoices.choose(options,b,c,{}, {side:'enemy',op:'generateChoice'});
  assert.equal(lethal.cardId,'ai-test:attack');
});

test('element choices use public enemy history and the owner deck contents instead of the first option',()=>{
  const {b,c}=setup(),options=['FIRE','NATURE','LIGHTNING','ICE','HOLY'].map(id=>({id}));
  b.player.mana=3;b.player.hand=[card('ai-test:attack')];
  b.history=Array.from({length:6},(_,turn)=>({turn,phase:'MAIN1',player:[{cardId:A.CardRules.nameToId('천둥'),element:'LIGHTNING'}],enemy:[]}));
  assert.equal(A.AIChoices.choose(options,b,c,{}, {side:'enemy',op:'iceTrap'}).id,'LIGHTNING');
  b.enemy.deck=[card('ai-test:ice'),card('ai-test:ice')];
  assert.equal(A.AIChoices.choose(options.filter(o=>o.id!=='HOLY'),b,c,{}, {side:'enemy',op:'elementChoice'}).id,'ICE');
});

test('sampled opponent zones conserve a known starter inventory instead of duplicating a recently played card',()=>{
  const {b,c}=setup(),hero=c.heroes[0],thunder=A.CardRules.nameToId('천둥');
  hero.cards=['aquatic_form','ancestral_knowledge','foresight','general:살아 움직이는 숲','general:산사태','thunder','crackle','flash_freeze','wild_growth','healing_touch'].flatMap(id=>[id,id]); // Historical starter inventory remains supported.
  b.player.heroName=hero.name;b.player.heroPower=copy(hero.power);
  b.player.hand=Array.from({length:3},()=>card('ai-test:blank'));
  b.player.deck=Array.from({length:hero.cards.length-4},(_,i)=>i<4?card('ai-test:blank'):{uid:'starter-reserve-'+i,cardId:'ai-test:blank',upgraded:false});b.player.rest=[card('ai-test:blank')];
  b.history=[{turn:0,phase:'MAIN1',player:[{cardId:thunder,element:'LIGHTNING',upgraded:false}],enemy:[]}];
  const snapshot=A.AI.publicSnapshot(b,c),before=copy(snapshot);
  for(let scenario=0;scenario<3;scenario++){
    const {fighter}=A.AIOpponentModel.sample(snapshot,c,scenario,A.random({rngState:13579+scenario}));
    const all=['hand','deck','rest','excluded'].flatMap(zone=>fighter[zone]);
    assert.deepEqual(all.map(x=>x.cardId).sort(),hero.cards.slice().sort());
    assert.equal(all.filter(x=>x.cardId===thunder).length,hero.cards.filter(id=>id===thunder).length);
    assert.equal(new Set(all.map(x=>x.uid)).size,hero.cards.length);
  }
  assert.deepEqual(snapshot,before);
});

test('a revealed submission preserves unknown remaining hand cards and identifies only the submitted cards',()=>{
  const {b,c}=setup(),hero=c.heroes[0];b.player.heroName=hero.name;b.player.heroPower=copy(hero.power);
  b.player.hand=Array.from({length:3},()=>card('ai-test:blank'));
  b.player.deck=Array.from({length:5},()=>card('ai-test:blank'));
  const shown=card(A.CardRules.nameToId('천둥'),{uid:'revealed-thunder'}),observed=[{card:shown,def:A.Battle.describeCard(shown,c)}];
  const sampled=A.AIOpponentModel.sample(A.AI.publicSnapshot(b,c),c,0,A.random({rngState:98765}),observed);
  assert.equal(sampled.fighter.hand.length,3);
  assert.deepEqual(sampled.observedUids,[shown.uid]);
  assert.equal(sampled.fighter.hand.filter(x=>x.cardId===shown.cardId).length,1);
  assert.equal(sampled.fighter.deck.length,5);
});

test('simulation restart setup cannot replenish an exhausted execution budget',()=>{
  const spec={name:'budget',maxHp:10,deck:[]};
  assert.throws(()=>A.Battle.create(spec,spec,A.catalog,()=>0.5,{simulation:true,steps:0}),/AI_SIMULATION_LIMIT/);
});

test('adaptive planner avoids simulations for forced pass and stops early on a clear choice',()=>{
  const {b,c}=setup();
  let p=plan(b,c);assert.equal(p.stats.simulations,0);assert.deepEqual(p.uids,[]);
  b.phase='MAIN2';b.enemy.mana=3;b.enemy.hand=[card('ai-test:finisher')];
  p=plan(b,c);assert.equal(p.stats.expanded,false);assert.equal(p.stats.simulations,2);
  assert.deepEqual(p.uids,[b.enemy.hand[0].uid]);
});
test('adaptive planner expands close decisions but never exceeds its bounded phase simulations',()=>{
  const {b,c}=setup();b.enemy.hand=[card('ai-test:ice')];
  const p=plan(b,c);assert.equal(p.stats.expanded,true);
  assert.ok(p.stats.simulations>4);assert.ok(p.stats.simulations<=A.AI.limits.simulations);
  assert.deepEqual(p.stats.errors||[],[]);
});


test('Sol prioritizes permanent scaling over a small attack but takes immediate lethal',()=>{
  const {b,c}=setup();b.phase='MAIN2';
  b.enemy.heroPower=A.BossRules.power('aurelion_sol');
  b.enemy.mana=b.enemy.maxMana=1;
  b.enemy.hand=[card('ai-test:attack')];
  b.enemy.deck=Array.from({length:16},()=>card('crystal_ball'));
  assert.equal(plan(b,c).heroPower,true);
  b.player.hp=5;
  const lethal=plan(b,c);
  assert.equal(lethal.heroPower,false);
  assert.deepEqual(lethal.uids,[b.enemy.hand[0].uid]);
});


test('Ice Trap choices are visible only to their caster, and hidden player selections cannot influence AI plans',()=>{
 const {b,c}=setup();b.enemy.mana=b.enemy.maxMana=3;b.enemy.hand=[card('ai-test:fire'),card('ai-test:ice')];b.player.mana=0;
 b.enemy.status.cards.effects=[{kind:'iceTrap',name:'얼음 덫',element:'FIRE',from:0,until:1,sourceSide:'player'}];
 b.player.status.cards.effects=[{kind:'iceTrap',name:'얼음 덫',element:'NATURE',from:0,until:1,sourceSide:'enemy'}];
 const first=A.AI.publicSnapshot(b,c),one=plan(b,c);
 assert.equal(first.enemy.status.cards.effects[0].element,undefined);assert.equal(first.player.status.cards.effects[0].element,'NATURE');
 b.enemy.status.cards.effects[0].element='ICE';const second=A.AI.publicSnapshot(b,c),two=plan(b,c);
 assert.deepEqual(second,first);assert.deepEqual(two,one);assert.equal(b.enemy.status.cards.effects[0].element,'ICE');
});


test('AI never batches two Forbidden Flames, including base and upgraded copies',()=>{
 for(const phase of ['MAIN1','MAIN2'])for(const upgraded of [false,true]){
  const {b,c}=setup();b.phase=phase;b.enemy.mana=b.enemy.maxMana=5;b.player.hp=100;b.player.maxHp=100;
  const id=A.CardRules.nameToId('금단의 불꽃');b.enemy.hand=[card(id),card(id,{upgraded})];
  const candidates=A.AI.candidates(A.AI.publicSnapshot(b,c),c,'enemy',5);assert.ok(candidates.every(x=>x.uids.length<=1));
  assert.ok(plan(b,c).uids.length<=1);assert.ok(A.Battle.legacyPlan(b,c,()=>0.5).uids.length<=1);
 }
});

test('AI only considers Unstable Element when it is the sole card in hand',()=>{
 for(const phase of ['MAIN1','MAIN2'])for(const upgraded of [false,true])for(const handSize of [1,2,3]){
  const {b,c}=setup();b.phase=phase;b.enemy.mana=b.enemy.maxMana=5;
  const unstable=card(A.CardRules.nameToId('불안정한 원소'),{upgraded});
  b.enemy.hand=[unstable];while(b.enemy.hand.length<handSize)b.enemy.hand.push(card('ai-test:blank'));
  b.enemy.deck=Array.from({length:6},()=>card('ai-test:attack'));
  const candidates=A.AI.candidates(A.AI.publicSnapshot(b,c),c,'enemy',5);
  if(handSize===1)assert.ok(candidates.some(x=>x.uids.includes(unstable.uid)));
  else {
   assert.ok(candidates.every(x=>!x.uids.includes(unstable.uid)));
   assert.ok(!plan(b,c).uids.includes(unstable.uid));
   assert.ok(!A.Battle.legacyPlan(b,c,()=>0.5).uids.includes(unstable.uid));
  }
  assert.ok(A.Battle.cardAllowed(b,'enemy',c,unstable));
 }
});


test('full-health AI conserves pure healing but still values hybrid draw and damage',()=>{
 const {b,c}=setup();b.phase='MAIN2';b.enemy.hand=[card('ai-test:heal')];
 const heal=b.enemy.hand[0];assert.ok(!plan(b,c).uids.includes(heal.uid));assert.ok(!A.Battle.legacyPlan(b,c,()=>0.5).uids.includes(heal.uid));
 let def=A.Battle.describeCard(heal,c),full=A.AIEvaluation.evaluateCard(def,b.enemy,b.player,b,c);assert.equal(full.fullHealthPenalty,3);
 b.enemy.hp=15;assert.ok(plan(b,c).uids.includes(heal.uid));assert.equal(A.AIEvaluation.evaluateCard(def,b.enemy,b.player,b,c).fullHealthPenalty,0);
 b.enemy.hp=b.enemy.maxHp;b.enemy.deck=[card('ai-test:attack'),card('ai-test:attack')];
 for(const name of ['풍요','굽이치는 파도']){
  def=A.Battle.describeCard(card(A.CardRules.nameToId(name)),c);const mixed=A.AIEvaluation.evaluateCard(def,b.enemy,b.player,b,c);assert.equal(mixed.fullHealthPenalty,0);assert.equal(mixed.heal,0);assert.ok(mixed.shield>0);assert.ok(mixed.score>0);
 }
 const retaliation=card(A.CardRules.nameToId('신의 권능: 응징'));b.enemy.hand.push(retaliation);assert.equal(A.AIEvaluation.evaluateCard(A.Battle.describeCard(heal,c),b.enemy,b.player,b,c).fullHealthPenalty,0);
});


test('AI holds poison cleansers at 0-2 stacks and considers them from 3 in both main phases',()=>{
  for(const phase of ['MAIN1','MAIN2'])for(const id of ['제독','자연의 해독','전이'])for(const upgraded of [false,true])for(const poison of [0,1,2,3,4,5]){
    const {b,c}=setup();b.phase=phase;b.enemy.status.poison=poison;
    b.enemy.hp=20;b.enemy.mana=b.enemy.maxMana=5;
    const cleanse=card('general:'+id,{upgraded});b.enemy.hand=[cleanse];b.enemy.deck=[card('ai-test:attack')];
    const possible=A.AI.candidates(b,c,'enemy',4).some(x=>x.uids.includes(cleanse.uid));
    assert.equal(possible,poison>=3,phase+' '+id+' '+upgraded+' '+poison);
    if(poison<=2){assert.ok(!plan(b,c).uids.includes(cleanse.uid));assert.ok(!A.Battle.legacyPlan(b,c,()=>0.5).uids.includes(cleanse.uid));}
  }
});

test('other harmful effects still permit general cleansers at low poison, and 5 stacks raise preference',()=>{
  for(const id of ['제독','전이']){
    const {b,c}=setup();b.enemy.status.poison=2;
    b.enemy.status.cards.effects.push({kind:'costIncrease',from:b.turn,until:b.turn+2,amount:1});
    const cleanse=card('general:'+id);b.enemy.hand=[cleanse];b.enemy.mana=5;
    assert.ok(A.AI.candidates(b,c,'enemy',4).some(x=>x.uids.includes(cleanse.uid)));
  }
  for(const id of ['제독','자연의 해독','전이']){
    const {b,c}=setup();b.enemy.hp=20;b.enemy.deck=[card('ai-test:attack')];
    const d=A.Battle.describeCard(card('general:'+id),c);
    b.enemy.status.poison=4;const low=A.AIEvaluation.evaluateCard(d,b.enemy,b.player,b,c);
    b.enemy.status.poison=5;const high=A.AIEvaluation.evaluateCard(d,b.enemy,b.player,b,c);
    assert.equal(low.cleanseBonus,0);assert.equal(high.cleanseBonus,3);assert.ok(high.score>low.score);
  }
});


test('Yuumi saves Salvation Prayer for real power draws or urgent self healing in both main phases',()=>{
  for(const phase of ['MAIN1','MAIN2'])for(const situation of ['healthy','draw','urgent','blocked','empty']){
    const {b,c}=setup();b.phase=phase;b.enemy.heroPower=A.BossRules.power('yuumi');
    b.enemy.hp=situation==='urgent'?8:25;b.player.hp=situation==='draw'||situation==='blocked'||situation==='empty'?29:30;
    b.enemy.deck=situation==='empty'?[]:[card('ai-test:attack')];
    if(situation==='blocked')b.player.status.cards.effects.push({kind:'healScale',value:0,until:b.turn+2});
    const prayer=card('salvation_prayer');b.enemy.hand=[prayer];
    const allowed=situation==='draw'||situation==='urgent';
    assert.equal(A.AI.candidates(b,c,'enemy',4).some(x=>x.uids.includes(prayer.uid)),allowed,phase+' '+situation);
    if(!allowed){assert.ok(!plan(b,c).uids.includes(prayer.uid));assert.ok(!A.Battle.legacyPlan(b,c,()=>0.5).uids.includes(prayer.uid));}
    if(situation==='draw'){assert.ok(plan(b,c).uids.includes(prayer.uid));const m=A.AIEvaluation.evaluateCard(A.Battle.describeCard(prayer,c),b.enemy,b.player,b,c);assert.equal(m.draw,1);assert.equal(m.prayerBonus,3);}
  }
});

test('Yuumi does not spend extra prayers once the first prayer fills the opponent health',()=>{
  const {b,c}=setup();b.enemy.heroPower=A.BossRules.power('yuumi');b.enemy.hp=25;b.player.hp=29;
  b.enemy.deck=[card('ai-test:attack'),card('ai-test:attack')];b.enemy.hand=[card('salvation_prayer'),card('salvation_prayer')];
  assert.ok(A.AI.candidates(b,c,'enemy',6).every(x=>x.uids.length<=1));
  assert.equal(plan(b,c).uids.length,1);assert.equal(A.Battle.legacyPlan(b,c,()=>0.5).uids.length,1);
});


test('Ivysaur prefers its initial poison power over same-cost poison cards in both main phases',()=>{
  for(const phase of ['MAIN1','MAIN2'])for(const name of ['맹독','차오르는 독'])for(const up of [false,true]){
    const {b,c}=setup();b.phase=phase;b.enemy.heroPower=A.BossRules.power('ivysaur');b.enemy.mana=b.enemy.maxMana=1;
    b.enemy.hand=[card('general:'+name,{upgraded:up})];
    const p=plan(b,c);if(!(name==='맹독'&&up)){assert.equal(p.heroPower,true,phase+' '+name+' '+up);assert.equal(p.uids.length,0);}else assert.ok(p.heroPower||p.uids.length===1);
    const fallback=A.Battle.legacyPlan(b,c,()=>0.5);assert.equal(fallback.heroPower,true);assert.equal(fallback.uids.length,0);
    apply(b,c,p);assert.ok(b.player.status.poison>0);if(p.heroPower)assert.equal(b.enemy.heroPowerUsedTurn,b.turn-(phase==='MAIN2'?1:0));
  }
});

test('Ivysaur can apply power poison before Rising Poison while preserving the opening card, and respects usage and mana restrictions',()=>{
  const {b,c}=setup();b.enemy.heroPower=A.BossRules.power('ivysaur');b.enemy.mana=b.enemy.maxMana=2;
  const rising=card('general:차오르는 독');b.enemy.hand=[rising];
  const p=plan(b,c);assert.equal(p.heroPower,true);
  assert.ok(A.AI.candidates(b,c,'enemy',6).some(x=>x.heroPower&&x.uids.includes(rising.uid)));
  apply(b,c,p);
  if(!p.uids.includes(rising.uid)){assert.equal(b.player.status.poison,2);const next=plan(b,c);assert.ok(next.uids.includes(rising.uid));apply(b,c,next);assert.equal(b.player.status.poison,5);}
  else assert.equal(b.player.status.poison,6);
  for(const situation of ['used','no-mana','cooldown']){
    const s=setup();s.b.enemy.heroPower=A.BossRules.power('ivysaur');s.b.enemy.hand=[card('general:맹독')];s.b.enemy.mana=1;
    if(situation==='used')s.b.enemy.heroPowerUsedTurn=s.b.turn;
    if(situation==='no-mana')s.b.enemy.mana=0;
    if(situation==='cooldown')s.b.enemy.heroPowerReadyTurn=s.b.turn+1;
    assert.equal(plan(s.b,s.c).heroPower,false);assert.equal(A.Battle.legacyPlan(s.b,s.c,()=>0.5).heroPower,false);
  }
});

test('Ivysaur still takes immediate lethal instead of opening with poison',()=>{
  const {b,c}=setup();b.enemy.heroPower=A.BossRules.power('ivysaur');b.enemy.mana=1;b.player.hp=4;b.enemy.hand=[card('ai-test:attack')];
  const p=plan(b,c);assert.equal(p.heroPower,false);assert.equal(p.uids.length,1);
});

test('useful early powers gain card-preservation value but ineffective powers do not',()=>{
 const {b,c}=setup();b.enemy.hand=[card('ai-test:attack')];b.player.hand=[card('ai-test:fire')];
 for(const id of ['black_knight','ivysaur','pikachu','brightwing','teemo']){
   const own=copy(b.enemy),opp=copy(b.player);if(id==='pikachu')own.hand=[card('general:찌릿!')];
   const m=A.AIEvaluation.evaluateCard(A.BossRules.power(id),own,opp,b,c);assert.ok(m.cardSavingBonus>0,id);
   const late=A.AIEvaluation.evaluateCard(A.BossRules.power(id),own,opp,Object.assign({},b,{turn:6}),c);assert.ok(m.cardSavingBonus>late.cardSavingBonus,id);
 }
 b.enemy.heroPower=A.BossRules.power('aviana');b.enemy.hp=26;b.enemy.mana=b.enemy.maxMana=1;
 b.enemy.deck=Array.from({length:4},()=>card('ai-test:blank'));
 c.cards['power:heal']={name:'동등한 치료',element:'NATURE',cost:1,effects:[{type:'heal',amount:4}]};b.enemy.hand=[card('power:heal')];
 b.player.hp=10;const choice=plan(b,c);assert.equal(choice.heroPower,true);assert.equal(choice.uids.length,0);apply(b,c,choice);assert.equal(b.enemy.hp,30);assert.equal(b.player.hp,10);
 assert.equal(A.AIEvaluation.evaluateCard(A.BossRules.power('aviana'),b.enemy,b.player,b,c).cardSavingBonus,0);
 b.enemy.heroPower=A.BossRules.power('pikachu');b.enemy.hand=[card('ai-test:attack')];b.publicPlayerDeck=[{cardId:'ai-test:fire'}];
 assert.equal(A.AIEvaluation.evaluateCard(b.enemy.heroPower,b.enemy,b.player,b,c).cardSavingBonus,0);
});


test('AI avoids repeated non-stacking defenses in a batch and across both main phases, while allowing duration renewal',()=>{
 for(const phase of ['MAIN1','MAIN2'])for(const name of ['얼음 방패','확고한 알리바이','불굴']){
  const {b,c}=setup();b.phase=phase;b.enemy.mana=b.enemy.maxMana=5;b.enemy.hand=[card('general:'+name),card('general:'+name,{upgraded:true})];
  b.player.hand=[card('ai-test:attack')];b.player.mana=3;
  for(const x of A.AI.candidates(b,c,'enemy',6))assert.ok(x.uids.length<=1,phase+' '+name);
  const p=plan(b,c);assert.ok(p.uids.length<=1);assert.ok(A.Battle.legacyPlan(b,c,()=>0.5).uids.length<=1);
 }
 for(const [name,kind,duration] of [['얼음 방패','iceShield',1],['확고한 알리바이','damageCap',2]]){
  const {b,c}=setup(),x=card('general:'+name);b.enemy.hand=[x];b.enemy.mana=3;
  b.enemy.status.cards.effects=[{kind,until:b.turn+duration,amount:1}];
  assert.ok(A.AI.candidates(b,c,'enemy',4).every(a=>!a.uids.includes(x.uid)));
  b.enemy.status.cards.effects[0].until=b.turn;
  assert.ok(A.AI.candidates(b,c,'enemy',4).some(a=>a.uids.includes(x.uid)),name+' renewal');
 }
});

test('a redundant defensive play remains an option when held Smite makes resting it deal damage',()=>{
 const {b,c}=setup();b.enemy.hand=[card('general:얼음 방패'),card('general:얼음 방패'),card('general:신의 권능: 징벌')];b.enemy.mana=3;
 b.player.hp=8;b.player.hand=[card('ai-test:attack')];b.player.mana=3;
 assert.ok(A.AI.candidates(b,c,'enemy',6).some(a=>a.uids.length===2));
 const p=plan(b,c);assert.equal(p.uids.length,2);apply(b,c,p);assert.equal(b.outcome,'defeat');assert.ok(b.enemy.hp>0);
});

test('Forbidden Flame never wastes a batch after other card or power costs leave zero mana',()=>{
 for(const phase of ['MAIN1','MAIN2']){
  const {b,c}=setup();b.phase=phase;b.enemy.mana=b.enemy.maxMana=1;
  const attack=card('ai-test:attack'),flame=card('general:금단의 불꽃');b.enemy.hand=[attack,flame];
  assert.ok(A.AI.candidates(b,c,'enemy',8).every(a=>!(a.uids.includes(attack.uid)&&a.uids.includes(flame.uid))));
  const p=plan(b,c);assert.ok(!(p.uids.includes(attack.uid)&&p.uids.includes(flame.uid)));
  assert.ok(!(A.Battle.legacyPlan(b,c,()=>0.5).uids.length===2));
  b.enemy.heroPower=A.BossRules.power('little_hatchling');b.enemy.hand=[flame];
  assert.ok(A.AI.candidates(b,c,'enemy',8).every(a=>!(a.heroPower&&a.uids.includes(flame.uid))));
 }
});

test('batch estimates include all paid costs, recovery before Flame, and order alternatives',()=>{
 const {b,c}=setup();b.enemy.mana=b.enemy.maxMana=3;
 const hit=card('ai-test:attack'),flame=card('general:금단의 불꽃'),horn=card('general:겨울의 뿔피리');b.enemy.hand=[hit,horn,flame];
 const entry=x=>({card:x,def:A.Battle.describeCard(x,c)});
 const paid=A.AIEvaluation.evaluateBatch([entry(hit),entry(flame)],b.enemy,b.player,b,c,1);
 assert.equal(paid.metrics[1].damage,8);
 const restored=A.AIEvaluation.evaluateBatch([entry(hit),entry(horn),entry(flame)],b.enemy,b.player,b,c,1);
 assert.equal(restored.metrics[2].damage,12);
 b.enemy.mana=1;b.enemy.hand=[hit,horn,flame];
 const choices=A.AI.candidates(b,c,'enemy',8);
 for(const a of choices){
  if(a.uids.includes(hit.uid)&&a.uids.includes(flame.uid))assert.ok(a.uids.includes(horn.uid)&&a.uids.indexOf(horn.uid)<a.uids.indexOf(flame.uid));
 }
 const live=copy(b);const action=choices.find(a=>a.uids.includes(hit.uid)&&a.uids.includes(horn.uid)&&a.uids.includes(flame.uid));
 assert.ok(action);apply(live,c,action);assert.equal(live.player.hp,17);
});


test('Ghost Raider requires twelve damage, counts both direct histories and its entire paid batch',()=>{
 for(const phase of ['MAIN1','MAIN2'])for(const previous of [0,1,2]){
  const {b,c}=setup();b.phase=phase;b.enemy.mana=0;b.enemy.hand=[card('boo_ghost_raider')];b.player.playedThisTurn=previous;
  assert.equal(A.AI.candidates(b,c,'enemy',6).some(x=>x.uids.length>0),previous===2);
  assert.equal(plan(b,c).uids.length,previous===2?1:0);
  assert.equal(A.Battle.legacyPlan(b,c,()=>0.5).uids.length,previous===2?1:0);
 }
 const {b,c}=setup();b.enemy.mana=0;b.enemy.hand=Array.from({length:3},()=>card('boo_ghost_raider'));
 const entry=x=>({card:x,def:A.Battle.describeCard(x,c)});
 const batch=A.AIEvaluation.evaluateBatch(b.enemy.hand.map(entry),b.enemy,b.player,b,c,0);
 assert.equal(batch.allowed,true);assert.deepEqual(batch.metrics.map(m=>m.damage),[12,12,12]);
 const p=plan(b,c);assert.equal(p.uids.length,3);apply(b,c,p);assert.equal(b.player.hp,-6);
});

test('Ghost Raider uses current observed submissions but ignores stale phase knowledge and reduced damage',()=>{
 const {b,c}=setup();const x=card('boo_ghost_raider');b.enemy.hand=[x];b.enemy.playedThisTurn=1;
 const entry={card:x,def:A.Battle.describeCard(x,c)};
 b.player.knownSubmission=[c.cards['ai-test:blank']];b.player.knownSubmissionTurn=b.turn;b.player.knownSubmissionPhase=b.phase;
 assert.equal(A.AIEvaluation.evaluateBatch([entry],b.enemy,b.player,b,c,0).allowed,true);
 b.player.knownSubmissionPhase='MAIN2';assert.equal(A.AIEvaluation.evaluateBatch([entry],b.enemy,b.player,b,c,0).allowed,false);
 b.player.playedThisTurn=1;b.player.status.cards.effects=[{kind:'damageCap',until:b.turn+2}];
 assert.equal(A.AIEvaluation.evaluateBatch([entry],b.enemy,b.player,b,c,0).allowed,false);
});


test('Teemo avoids its power above three deck traps, counts neither rest traps nor other cards',()=>{
 for(const phase of ['MAIN1','MAIN2'])for(const n of [0,2,3,4,6]){
  const {b,c}=setup();b.phase=phase;b.enemy.heroPower=A.BossRules.power('teemo');b.enemy.mana=1;
  b.player.deck=Array.from({length:n},()=>card('poisonous_mushroom')).concat([card('ai-test:blank')]);
  b.player.rest=Array.from({length:8},()=>card('poisonous_mushroom'));
  const snapshot=A.AI.publicSnapshot(b,c);
  assert.equal(A.AI.candidates(snapshot,c,'enemy',3).some(x=>x.heroPower),n<=3);
  assert.equal(A.AI.candidates(b,c,'enemy',3).some(x=>x.heroPower),n<=3);
  if(n>3){assert.equal(plan(b,c).heroPower,false);assert.equal(A.Battle.legacyPlan(b,c,()=>0.5).heroPower,false);}
 }
});


test('public element overrides dominate old history, and permitted elements apply to the effective element',()=>{
 const {b,c}=setup();b.player.hand=[card('ai-test:attack')];b.player.mana=3;
 b.history=Array.from({length:20},()=>({turn:0,phase:'MAIN1',player:[{cardId:'ai-test:fire',element:'FIRE'}]}));
 b.player.status.cards.effects=[{kind:'elementOverride',element:'LIGHTNING',from:0,until:1}];
 let m=A.AIEvaluation.predict(A.AI.publicSnapshot(b,c),c);assert.equal(m.elements.LIGHTNING,1);assert.equal(m.elements.FIRE,0);assert.equal(m.constrained,true);
 b.player.status.cardLocks=[{from:0,until:1,elements:['FIRE','NATURE','LIGHTNING','HOLY','NEUTRAL','COSMIC']}];
 m=A.AIEvaluation.predict(A.AI.publicSnapshot(b,c),c);assert.equal(m.passChance,1);assert.equal(m.meanCards,0);assert.equal(m.elements.LIGHTNING,0);
 b.player.status.cards.effects=[];m=A.AIEvaluation.predict(A.AI.publicSnapshot(b,c),c);assert.equal(m.elements.ICE,1);
 b.player.status.cards.effects=[{kind:'forbiddenElements',elements:['ICE'],from:0,until:1}];
 m=A.AIEvaluation.predict(A.AI.publicSnapshot(b,c),c);assert.equal(m.passChance,1);
 b.turn=2;m=A.AIEvaluation.predict(A.AI.publicSnapshot(b,c),c);assert.ok(m.elements.FIRE>m.elements.ICE);assert.equal(m.constrained,false);
 b.player.status.cards.effects=[{kind:'elementOverride',element:'LIGHTNING',from:3,until:3}];
 assert.equal(A.AIEvaluation.predict(A.AI.publicSnapshot(b,c),c).constrained,false);
});

test('AI prefers Nature against public Lightning conversion and Lightning against Ice-only submissions without reading hidden hands',()=>{
 for(const phase of ['MAIN1','MAIN2'])for(const restriction of ['override','ice-only']){
  const {b,c}=setup();b.phase=phase;b.enemy.mana=b.enemy.maxMana=1;b.player.mana=1;
  c.cards['restriction:nature']={name:'Nature',element:'NATURE',cost:1,effects:[{type:'damage',amount:5}]};
  c.cards['restriction:lightning']={name:'Lightning',element:'LIGHTNING',cost:1,effects:[{type:'damage',amount:5}]};
  const counter=card(restriction==='override'?'restriction:nature':'restriction:lightning'),other=card('ai-test:fire');
  b.enemy.hand=[other,counter];b.player.hand=[card('ai-test:fire')];
  if(restriction==='override')b.player.status.cards.effects=[{kind:'elementOverride',element:'LIGHTNING',from:0,until:2}];
  else b.player.status.cardLocks=[{from:0,until:2,elements:['FIRE','NATURE','LIGHTNING','HOLY','NEUTRAL','COSMIC']}];
  const before=copy(b),snapshot=A.AI.publicSnapshot(b,c);
  assert.equal(A.AI.candidates(snapshot,c,'enemy',3)[0].uids[0],counter.uid);
  assert.deepEqual(A.Battle.legacyPlan(b,c,()=>0.5).uids,[counter.uid]);
  const action=plan(b,c);assert.deepEqual(action.uids,[counter.uid],phase+' '+restriction);
  assert.deepEqual(b,before);
  const hidden=copy(b);hidden.player.hand=[card('ai-test:finisher')];hidden.player.deck=[card('ai-test:heal')];
  b.player.deck=[card('ai-test:attack')];
  assert.deepEqual(plan(b,c),plan(hidden,c));
 }
});


test('phase-specific public behavior predicts different elements and pass patterns within one turn',()=>{
 const {b,c}=setup();b.player.hand=[card('ai-test:blank'),card('ai-test:blank')];b.player.mana=2;
 b.publicPlayerHistory=Array.from({length:12},()=>[{turn:-1,phase:'MAIN1',player:[]},{turn:-1,phase:'MAIN2',player:[{cardId:'ai-test:ice',element:'ICE'}]}]).flat();
 const early=A.AIEvaluation.predict(A.AI.publicSnapshot(b,c),c);b.phase='MAIN2';const late=A.AIEvaluation.predict(A.AI.publicSnapshot(b,c),c);
 assert.ok(early.passChance>0.65);assert.ok(late.passChance<0.3);assert.ok(late.elements.ICE>early.elements.ICE);assert.ok(late.meanCards>early.meanCards);
});

test('AI splits counter cards across both main phases against a publicly observed split style',()=>{
 const {b,c}=setup();b.enemy.mana=b.enemy.maxMana=b.player.mana=b.player.maxMana=2;
 c.cards['split:lightning']={name:'Lightning',element:'LIGHTNING',cost:1,effects:[{type:'damage',amount:5}]};
 const ice=card('ai-test:ice'),lightning=card('split:lightning'),fire=card('ai-test:fire'),playerIce=card('ai-test:ice');
 b.enemy.hand=[ice,lightning];b.player.hand=[fire,playerIce];
 b.publicPlayerHistory=Array.from({length:12},()=>[{turn:-1,phase:'MAIN1',player:[{cardId:'ai-test:fire',element:'FIRE'}]},{turn:-1,phase:'MAIN2',player:[{cardId:'ai-test:ice',element:'ICE'}]}]).flat();
 const first=plan(b,c);assert.deepEqual(first.uids,[ice.uid]);assert.ok(first.stats.splitEvaluations>0);assert.ok(first.stats.simulations<=A.AI.limits.simulations);
 apply(b,c,first,[fire]);assert.equal(b.phase,'MAIN2');assert.equal(b.enemy.hp,30);assert.equal(b.enemy.mana,1);
 const second=plan(b,c);assert.deepEqual(second.uids,[lightning.uid]);apply(b,c,second,[playerIce]);assert.equal(b.enemy.hp,30);
});

test('AI can spend a card in MAIN1 while reserving a situational power for MAIN2',()=>{
 const {b,c}=setup();b.enemy.heroPower=A.BossRules.power('boo');b.enemy.mana=b.enemy.maxMana=2;b.player.mana=b.player.maxMana=1;
 const attack=card('ai-test:attack'),playerAttack=card('ai-test:attack');b.enemy.hand=[attack];b.player.hand=[playerAttack];
 b.publicPlayerHistory=Array.from({length:12},()=>[{turn:-1,phase:'MAIN1',player:[]},{turn:-1,phase:'MAIN2',player:[{cardId:'ai-test:attack',element:'NEUTRAL'}]}]).flat();
 const first=plan(b,c);assert.deepEqual(first.uids,[attack.uid]);assert.equal(first.heroPower,false);
 apply(b,c,first);assert.equal(b.phase,'MAIN2');assert.equal(b.enemy.mana,1);
 const second=plan(b,c);assert.equal(second.heroPower,true);apply(b,c,second,[playerAttack]);assert.equal(b.enemy.hp,25);assert.equal(b.player.hp,20);
});

test('a quiet opening gently splits useful cards while still finishing an immediate lethal',()=>{
 const {b,c}=setup();b.enemy.mana=b.enemy.maxMana=2;b.player.mana=1;
 const first=card('ai-test:attack'),second=card('ai-test:attack');b.enemy.hand=[first,second];
 let p=plan(b,c);assert.equal(p.uids.length,1);apply(b,c,p);assert.equal(b.phase,'MAIN2');
 p=plan(b,c);assert.equal(p.uids.length,1);apply(b,c,p);assert.equal(b.player.hp,20);
 const lethal=setup();lethal.b.enemy.mana=lethal.b.enemy.maxMana=2;lethal.b.enemy.hand=[card('ai-test:attack'),card('ai-test:attack')];lethal.b.player.hp=9;
 const finish=plan(lethal.b,lethal.c);assert.equal(finish.uids.length,2);apply(lethal.b,lethal.c,finish);assert.equal(lethal.b.outcome,'defeat');
});

test('without hand pressure AI does not spray every equivalent zero-cost attack and carries cards into next turn',()=>{
 const {b,c}=setup();b.enemy.mana=b.enemy.maxMana=4;b.enemy.hand=Array.from({length:4},()=>card('ai-test:attack',{cost:0}));
 b.player.hp=30;b.player.mana=1;
 const first=plan(b,c);apply(b,c,first);assert.equal(b.phase,'MAIN2');
 const second=plan(b,c);assert.ok(first.uids.length+second.uids.length>0&&first.uids.length+second.uids.length<4);apply(b,c,second);assert.ok(b.enemy.hand.length>0);assert.ok(b.player.hp<30&&b.player.hp>10);
 assert.ok(first.stats.simulations<=A.AI.limits.simulations);assert.ok(second.stats.simulations<=A.AI.limits.simulations);
});

test('AI spends mana on useful paid attacks instead of preserving them solely for sharing an element',()=>{
 const {b,c}=setup();b.phase='MAIN2';b.enemy.mana=b.enemy.maxMana=2;b.player.mana=0;
 b.enemy.hand=[card('ai-test:attack'),card('ai-test:attack')];
 const p=plan(b,c);assert.equal(p.uids.length,2);apply(b,c,p);assert.equal(b.player.hp,20);
 const idle=setup();idle.b.phase='MAIN2';idle.b.enemy.mana=1;idle.b.enemy.hand=[card('ai-test:attack')];idle.b.player.mana=0;
 assert.equal(plan(idle.b,idle.c).uids.length,1);
});

test('public opening deck replaces starter guesses and conserves exact card and upgrade counts across sampled zones',()=>{
 const {b,c}=setup();b.publicPlayerDeck=[{cardId:'ai-test:fire',upgraded:false},{cardId:'ai-test:fire',upgraded:true},{cardId:'treasure_mystic_coin',upgraded:false},{cardId:'ai-test:ice',upgraded:false}];
 b.player.hand=[card('ai-test:blank'),card('ai-test:blank')];b.player.deck=[card('ai-test:blank')];b.player.rest=[card('ai-test:blank')];
 const snapshot=A.AI.publicSnapshot(b,c),prediction=A.AIEvaluation.predict(snapshot,c);
 assert.ok(prediction.knownCards.some(x=>x.cardId==='treasure_mystic_coin'));
 for(let scenario=0;scenario<2;scenario++){
  const f=A.AIOpponentModel.sample(snapshot,c,scenario,()=>.5).fighter;
  const keys=list=>list.map(x=>x.cardId+'|'+!!x.upgraded).sort();
  assert.deepEqual(keys(f.hand.concat(f.deck,f.rest,f.excluded)),keys(b.publicPlayerDeck));
 }
});

test('useful draw opens MAIN1 without spending the whole hand and unnecessary draw gets no opening bonus',()=>{
 const {b,c}=setup();c.cards['tempo:draw']={name:'Draw',element:'NEUTRAL',cost:0,effects:[{type:'draw',amount:2}]};
 const draw=card('tempo:draw'),attack=card('ai-test:attack');b.enemy.mana=b.enemy.maxMana=2;b.enemy.hand=[draw,attack];
 b.enemy.deck=[card('ai-test:attack'),card('ai-test:fire'),card('ai-test:ice')];
 const choices=A.AI.candidates(b,c,'enemy',4);assert.ok(choices.some(x=>x.uids.length===1&&x.uids[0]===draw.uid&&x.earlyDraw>0));
 const p=plan(b,c);assert.ok(p.uids.includes(draw.uid));assert.equal(p.uids.length,1);apply(b,c,p);assert.equal(b.phase,'MAIN2');assert.ok(b.enemy.hand.length>=3);
 b.phase='MAIN1';b.enemy.hand=Array.from({length:8},()=>card('ai-test:attack'));b.enemy.hand[0]=draw;b.enemy.mana=0;
 const full=A.AI.candidates(b,c,'enemy',4).find(x=>x.uids.length===1&&x.uids[0]===draw.uid);assert.ok(full);assert.equal(full.earlyDraw,0);assert.equal(full.openingValue,0);
 b.enemy.deck=[];b.enemy.rest=[];b.enemy.hand=[draw];b.enemy.mana=2;
 assert.equal(A.AI.candidates(b,c,'enemy',4).find(x=>x.uids.length).openingValue,0);
});


test('Yuumi does not spend further prayers solely for already consumed healing draws, including a multi-prayer batch',()=>{
 const {b,c}=setup();b.enemy.heroPower=A.BossRules.power('yuumi');b.enemy.hp=25;b.player.hp=15;
 b.enemy.deck=[card('ai-test:attack'),card('ai-test:attack')];b.enemy.hand=[card('salvation_prayer'),card('salvation_prayer')];
 assert.ok(A.AI.candidates(b,c,'enemy',6).every(x=>x.uids.length<=1));
 b.enemy.status.yuumiHealTurn=b.turn;
 assert.equal(plan(b,c).uids.length,0);assert.equal(A.Battle.legacyPlan(b,c,()=>0.5).uids.length,0);
 b.enemy.hp=5;assert.ok(A.AIEvaluation.prayerPolicy(c.cards.salvation_prayer,b.enemy,b.player,b,c).allowed);
 assert.equal(A.AIEvaluation.prayerPolicy(c.cards.salvation_prayer,b.enemy,b.player,b,c).draw,0);
});


test('five-second deadline returns the highest evaluated action without near-best randomization',()=>{
  const {b,c}=setup();b.phase='MAIN2';b.enemy.mana=b.enemy.maxMana=1;b.enemy.hand=[card('ai-test:attack')];
  const before=copy(b),now=Date.now,position=A.AIEvaluation.position,submit=A.Battle.submit,enabled=A.AI.limits.varietyEnabled;
  let clock=0,positions=0,actions=[],randomDraws=0;
  Date.now=()=>clock;A.AI.limits.varietyEnabled=true;
  A.Battle.submit=function(sim,...args){if(sim._aiSimulation)actions.push({uids:sim.enemyPlan.slice(),heroPower:sim.enemyPowerPlan});return submit(sim,...args);};
  A.AIEvaluation.position=function(){positions++;if(positions===2)clock=5000;return positions===1?100:10;};
  try{
    const result=A.AI.plan(b,c,()=>{randomDraws++;return .99;});
    assert.equal(result.stats.timeLimited,true);assert.equal(positions,2);assert.equal(result.score,100.35);
    assert.deepEqual(result.uids,actions[0].uids);assert.equal(result.heroPower,actions[0].heroPower);
    assert.deepEqual(b,before);assert.equal(randomDraws,0);
  }finally{Date.now=now;A.AIEvaluation.position=position;A.Battle.submit=submit;A.AI.limits.varietyEnabled=enabled;}
  assert.equal(plan(b,c).stats.timeLimited,undefined,'deadline is cleared after the interrupted plan');
});

test('deadline interrupts inside virtual battle processing and retains a legal heuristic fallback',()=>{
  const {b,c}=setup();b.phase='MAIN2';b.enemy.mana=b.enemy.maxMana=1;b.enemy.hand=[card('ai-test:attack')];
  const before=copy(b),now=Date.now,submit=A.Battle.submit;let clock=0;
  Date.now=()=>clock;
  A.Battle.submit=function(sim,...args){if(sim._aiSimulation)clock=5000;return submit(sim,...args);};
  try{
    const result=plan(b,c);assert.equal(result.stats.timeLimited,true);assert.equal(result.stats.simulations,1);
    assert.equal(result.stats.errors,undefined);assert.deepEqual(result.uids,[b.enemy.hand[0].uid]);
    A.Battle.validateSubmission(A.Battle.context(b,c,()=>.5,{side:'enemy'},[]),'enemy',result.uids,result.heroPower);
    assert.deepEqual(b,before);
  }finally{Date.now=now;A.Battle.submit=submit;}
});

test('deadline during candidate search keeps already scored legal actions',()=>{
  const {b,c}=setup();b.phase='MAIN2';b.enemy.mana=b.enemy.maxMana=1;b.enemy.hand=[card('ai-test:attack'),card('ai-test:attack')];
  const now=Date.now,batch=A.AIEvaluation.evaluateBatch;let clock=0,calls=0;
  Date.now=()=>clock;
  A.AIEvaluation.evaluateBatch=function(...args){const result=batch(...args);if(++calls===2)clock=5000;return result;};
  try{
    const result=plan(b,c);assert.equal(result.stats.timeLimited,true);assert.equal(result.stats.simulations,0);
    assert.deepEqual(result.uids,[b.enemy.hand[0].uid]);
    A.Battle.validateSubmission(A.Battle.context(b,c,()=>.5,{side:'enemy'},[]),'enemy',result.uids,result.heroPower);
  }finally{Date.now=now;A.AIEvaluation.evaluateBatch=batch;}
});
