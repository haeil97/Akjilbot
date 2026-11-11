'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const content=require('../build-content').compileContent();
function setup(bossId){
  const box={A4:{content:JSON.parse(JSON.stringify(content))}};
  ['base','combat','treasures-v3','bosses-v3','combat-v3'].forEach(n=>vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src',n+'.js'),'utf8'),box));
  const A4=box.A4,c={config:{engineVersion:3},cards:{},cardPool:[],treasures:{},enemies:{}};
  content.generalCards.concat(content.tokens).forEach(ref=>{
    c.cards[ref.id]={name:ref.name,element:ref.element,cost:ref.cost,effects:[],upgrade:{effects:[]}};
    if(!ref.token)c.cardPool.push(ref.id);
  });
  c.cards.blank={name:'시험 패스',element:'NEUTRAL',cost:0,effects:[]};
  content.opponentDecks.enemies.forEach(e=>c.enemies[e.id]={name:e.name});
  A4.TreasureRules.install(c);A4.BossRules.install(c);
  function spec(prefix){return {name:prefix,maxHp:100,deck:Array.from({length:16},(_,i)=>({uid:prefix+i,cardId:'blank',upgraded:false})),passives:[]};}
  const p=spec('플레이어'),e=spec('상대');if(bossId){e.heroPower=A4.BossRules.power(bossId);e.bossId=bossId;}
  const b=A4.Battle.create(p,e,c,()=>0.43);
  function context(side='enemy',extra={}){const tasks=[];return {ctx:A4.Battle.context(b,c,()=>0.43,Object.assign({side},extra),tasks),tasks};}
  function process(tasks){b.resolution={queue:tasks,phase:b.phase};A4.Battle.process(b,c,()=>0.43);let guard=0;while(b.pendingChoice){assert.ok(++guard<50);A4.Battle.choose(b,0,c,()=>0.43);}}
  function event(type,data={}){process([{kind:'event',side:data.side||'enemy',event:Object.assign({type},data)}]);}
  function power(id=bossId,side='enemy'){process([{kind:'power',module:'boss',side,power:A4.BossRules.power(id)}]);}
  function card(id,side='enemy'){process([{kind:'card',module:'boss',side,card:{uid:'cast_'+id,cardId:id},def:c.cards[id]}]);}
  return {A4,b,c,context,process,event,power,card};
}
test('all 26 boss abilities and twenty exclusive cards are installed',()=>{
  const {A4,c}=setup();assert.equal(Object.keys(c.enemies).length,26);
  Object.values(c.enemies).forEach(e=>{assert.ok(e.heroPower.id);assert.equal(e.blueprint,false);assert.equal(e.heroPower.module,'boss');});
  content.opponentAbilities.exclusiveCards.forEach(ref=>{assert.equal(c.cards[ref.id].exclusive,true);if(ref.id==='crystal_ball')assert.ok(c.cards[ref.id].upgrade);else assert.equal(c.cards[ref.id].upgrade,undefined);assert.equal(A4.BossRules.supports(ref.id),true);});
});
test('all active powers resolve with the common effect queue',()=>{
  Object.entries(content.opponentAbilities.abilities).filter(([,p])=>p.kind==='active').forEach(([id])=>{
    const {b,power}=setup(id);b.player.rest=b.player.deck.splice(0,3);assert.doesNotThrow(()=>power(id),id);
    assert.doesNotThrow(()=>JSON.stringify(b));
  });
});
test('minion standby damage and hatchling ability damage remain uncounterable powers',()=>{
  const cannon=setup('cannon_minion'),before=cannon.b.player.hp;cannon.event('standby');assert.equal(cannon.b.player.hp,before);cannon.event('end');assert.equal(cannon.b.player.hp,before-1);
  const hatch=setup('little_hatchling');hatch.power();assert.equal(hatch.b.player.hp,98);
});
test('aviana heals only itself and patchwerk doubles both current and maximum HP',()=>{
  const x=setup('aviana');x.b.player.hp=51;x.b.enemy.hp=23;x.power();assert.equal(x.b.player.hp,51);assert.equal(x.b.enemy.hp,27);
  const p=setup('patchwerk');p.b.enemy.hp=17;p.power();assert.equal(p.b.enemy.hp,34);assert.equal(p.b.enemy.maxHp,100);assert.equal(p.b.enemy.heroPower.cooldown,4);
});
test('black knight commits mana before seeing submission and counters only one card',()=>{
  const {A4,b,c}=setup('black_knight');b.player.hand=[{uid:'p-submit1',cardId:'blank'},{uid:'p-submit2',cardId:'blank'}];b.enemyPlan=[];b.enemyPowerPlan=true;b.enemy.mana=1;
  A4.Battle.submit(b,['p-submit1','p-submit2'],c,()=>0.43);assert.equal(b.enemy.mana,0);assert.equal(b.history[0].player.filter(x=>x.countered).length,1);
});
test('antonidas draws one fire card at end and trap room draws only cost 3',()=>{
  const a=setup('antonidas');
  const fire=content.generalCards.find(x=>x.name==='화염구');a.b.enemy.deck[3].cardId=fire.id;const count=a.b.enemy.hand.length;a.event('end');assert.equal(a.b.enemy.hand.length,count+1);assert.equal(a.b.enemy.hand[a.b.enemy.hand.length-1].cardId,fire.id);
  const t=setup('trap_room');const cost3=content.generalCards.find(x=>x.cost===3);t.b.enemy.deck[2].cardId=cost3.id;const size=t.b.enemy.hand.length;t.event('standby');assert.equal(t.b.enemy.hand.length,size+1);assert.equal(t.b.enemy.hand[t.b.enemy.hand.length-1].cardId,cost3.id);
});
test('teemo shuffles exactly three mushrooms and a drawn mushroom auto casts free then rests',()=>{
  const {b,power,context,process}=setup('teemo');const old=b.player.deck.length+b.player.rest.length;power();assert.equal(b.player.deck.length+b.player.rest.length,old+3);assert.equal(b.player.deck.concat(b.player.rest).filter(x=>x.cardId==='poisonous_mushroom').length,3);
  const mushrooms=b.player.deck.filter(x=>x.cardId==='poisonous_mushroom');b.player.deck=[mushrooms[0],{uid:'replacement',cardId:'blank'}];b.player.hand=[];const mana=b.player.mana;
  const {ctx,tasks}=context('player');ctx.draw('player',1);process(tasks);
  assert.equal(b.player.hp,100);assert.equal(b.player.status.poison,2);assert.equal(b.player.mana,mana);assert.equal(b.player.hand.length,1);assert.equal(b.player.rest[0].cardId,'poisonous_mushroom');assert.equal(b.player.playedThisTurn,0);
});
test('mushrooms generated directly into hand do not automatically cast',()=>{
  const {b,context,process}=setup();const {ctx,tasks}=context('player');ctx.generate('player','poisonous_mushroom');process(tasks);assert.equal(b.player.hp,100);assert.ok(b.player.hand.some(x=>x.cardId==='poisonous_mushroom'));
});
test('ivern replaces exactly one non-nature hand card on each side',()=>{
  const {b,event}=setup('ivern');const nature=content.generalCards.find(x=>x.element==='NATURE');b.player.deck[0].cardId=nature.id;b.enemy.deck[0].cardId=nature.id;
  const playerHand=b.player.hand.map(x=>x.uid),enemyHand=b.enemy.hand.map(x=>x.uid);event('end');
  assert.equal(b.player.hand.filter(x=>playerHand.includes(x.uid)).length,3);assert.equal(b.enemy.hand.filter(x=>enemyHand.includes(x.uid)).length,3);assert.equal(b.player.hand.filter(x=>x.cardId===nature.id).length,1);
});
test('yuumi only reacts to actual healing and discounts drawn card by 2 with floor 0',()=>{
  const {b,event,c}=setup('yuumi');const expensive=content.generalCards.find(x=>x.cost===3);b.enemy.deck[0].cardId=expensive.id;const n=b.enemy.hand.length;
  event('heal',{side:'player',amount:0,requested:5});assert.equal(b.enemy.hand.length,n);
  event('heal',{side:'player',amount:1,requested:5});const card=b.enemy.hand[b.enemy.hand.length-1];assert.equal(card.cardId,expensive.id);assert.equal(card.costDelta,-2);
});
test('lich king discovers and transfers an actual opponent rest card; Mida excludes three',()=>{
  const lich=setup('lich_king');lich.b.player.rest=lich.b.player.deck.splice(0,3);const uids=lich.b.player.rest.map(x=>x.uid);lich.power();assert.equal(lich.b.player.rest.length,2);assert.ok(lich.b.enemy.hand.some(x=>uids.includes(x.uid)));
  const mida=setup('mida');mida.b.player.rest=mida.b.player.deck.splice(0,5);mida.power();assert.equal(mida.b.player.rest.length,2);assert.equal(mida.b.player.excluded.length,3);
});
test('Sol stacks card damage and healing bonuses without affecting power damage',()=>{
  const {b,power,context}=setup('aurelion_sol');power();power();assert.equal(b.enemy.status.cosmicBonus,2);
  const {ctx}=context('enemy',{card:b.enemy.hand[0]});ctx.damage('enemy','player',3);assert.equal(b.player.hp,95);b.enemy.hp=50;ctx.heal('enemy',3);assert.equal(b.enemy.hp,55);ctx.damage('enemy','player',3,{card:null});assert.equal(b.player.hp,92);
});
test('only crystals held at standby transform; used transformed crystals return to rest as crystals',()=>{
  const {A4,b,c,event}=setup('aurelion_sol');b.enemy.hand=[{uid:'crystal-hand',cardId:'crystal_ball'}];b.enemy.deck=[{uid:'crystal-deck',cardId:'crystal_ball'}];event('standby');assert.notEqual(b.enemy.hand[0].cardId,'crystal_ball');assert.equal(b.enemy.hand[0].originalCardId,'crystal_ball');assert.equal(b.enemy.deck[0].cardId,'crystal_ball');
  b.enemy.mana=5;b.enemyPlan=['crystal-hand'];b.enemyPowerPlan=false;A4.Battle.submit(b,[],c,()=>0.43);assert.equal(b.enemy.rest[0].cardId,'crystal_ball');assert.equal(b.enemy.rest[0].originalCardId,undefined);
});
test('faceless power returns one player card to draw pile then draws one',()=>{
  const {b,power}=setup('faceless_manipulator');const hand=b.player.hand.length,deck=b.player.deck.length;power();assert.equal(b.player.hand.length,hand);assert.equal(b.player.deck.length,deck);
});
test('salvation reduces one base turn plus every direct Holy use by either side, including countered cards',()=>{
  const {b,card,event}=setup('mida');card('path_to_salvation');assert.equal(b.enemy.status.salvation.remaining,50);
  const holy={side:'player',card:{uid:'holy',cardId:'path_to_salvation'},def:{element:'HOLY'},paidCost:1,countered:false,free:false};
  event('cardUsed',holy);event('cardUsed',Object.assign({},holy,{side:'enemy'}));event('cardUsed',Object.assign({},holy,{side:'enemy',countered:true}));
  event('cardUsed',Object.assign({},holy,{free:true}));event('cardResolved',holy);assert.equal(b.enemy.status.salvation.remaining,50);
  card('path_to_salvation');assert.equal(b.enemy.status.salvation.remaining,50);
  event('end');assert.equal(b.enemy.status.salvation.remaining,46);event('end');assert.equal(b.enemy.status.salvation.remaining,46);
  b.turn=1;event('cardUsed',Object.assign({},holy,{free:true}));event('end');assert.equal(b.enemy.status.salvation.remaining,45);
  b.turn=2;event('cardUsed',holy);event('cardUsed',holy);event('end');assert.equal(b.enemy.status.salvation.remaining,42);
  b.enemy.status.salvation.remaining=1;b.turn=3;event('end');assert.equal(b.specialDefeat,true);
});

test('salvation waits until END for victory and restored public use counts apply to both countdowns',()=>{
 const {b,card,event}=setup('mida');card('path_to_salvation');card('path_to_salvation','player');
 b.enemy.status.salvation.remaining=3;b.player.status.salvation.remaining=10;
 const holy={side:'player',card:{uid:'direct',cardId:'path_to_salvation'},def:{element:'HOLY'},free:false,countered:true};
 event('cardUsed',holy);event('cardUsed',Object.assign({},holy,{side:'enemy'}));
 assert.equal(b.specialDefeat,undefined);assert.equal(b.specialVictory,undefined);
 b.enemy.status=JSON.parse(JSON.stringify(b.enemy.status));b.player.status=JSON.parse(JSON.stringify(b.player.status));
 event('end');assert.equal(b.enemy.status.salvation.remaining,0);assert.equal(b.player.status.salvation.remaining,7);assert.equal(b.specialDefeat,true);
});

test('real submissions count the initial path and multiple Holy cards across both main phases',()=>{
 const {A4,b,c}=setup('mida');
 b.enemy.hand=[{uid:'path',cardId:'path_to_salvation'},{uid:'prayer',cardId:'salvation_prayer'}];b.player.hand=[{uid:'player-prayer',cardId:'salvation_prayer'}];
 b.enemy.mana=b.player.mana=5;b.enemyPlan=['path'];b.enemyPowerPlan=false;
 A4.Battle.submit(b,['player-prayer'],c,()=>.5);
 assert.equal(b.enemy.status.salvation.remaining,50);assert.equal(b.phase,'MAIN2');
 b.enemyPlan=['prayer'];b.enemyPowerPlan=false;A4.Battle.submit(b,[],c,()=>.5);
 assert.equal(b.enemy.status.salvation.remaining,46);
});

test('doctor heals player each baptism, speaks 12 lines and transforms with upgraded ordinary cards',()=>{
  const {b,c,power}=setup('plague_doctor');const ordinary=content.generalCards[0].id;b.enemy.hand=[{uid:'ordinary-hand',cardId:ordinary},{uid:'prophecy-hand',cardId:'prophecy'}];b.enemy.deck=[{uid:'ordinary-deck',cardId:ordinary}];b.enemy.rest=[{uid:'ordinary-rest',cardId:ordinary}];
  for(let i=0;i<12;i++){b.player.hp=1;power();assert.equal(b.player.hp,b.player.maxHp);}
  assert.equal(b.enemy.name,'백야');assert.equal(b.enemy.hp,100);assert.equal(b.enemy.maxHp,100);assert.equal(b.enemy.heroPower.id,'white_night');assert.equal(b.mainTimeoutMs,20000);
  assert.equal(b.enemy.hand[0].upgraded,true);assert.equal(!!b.enemy.hand[1].upgraded,false);assert.equal(b.enemy.deck[0].upgraded,true);assert.equal(b.enemy.rest[0].upgraded,true);assert.ok(b.lastLog.some(x=>x.includes('열둘')));
});
test('Yogg excludes one card from each rest at every end',()=>{
  const {b,event}=setup('yogg_saron');b.player.rest=b.player.deck.splice(0,3);b.enemy.rest=b.enemy.deck.splice(0,3);event('end');assert.equal(b.player.rest.length,2);assert.equal(b.enemy.rest.length,2);assert.equal(b.player.excluded.length,1);assert.equal(b.enemy.excluded.length,1);
});
test('troll grants three deactivations, draws ice and sends a player lightning card to rest',()=>{
  const {b,power}=setup('extreme_troll');assert.equal(b.player.hand.filter(x=>x.cardId==='deactivation').length,3);assert.equal(b.player.hand.length,7);
  const ice=content.generalCards.find(x=>x.element==='ICE'),lightning=content.generalCards.find(x=>x.element==='LIGHTNING');b.enemy.deck[0].cardId=ice.id;b.player.deck[0].cardId=lightning.id;const old=b.enemy.hand.length;power();assert.equal(b.enemy.hand.length,old+1);assert.equal(b.player.rest[0].cardId,lightning.id);
});
test('three warnings cause special defeat; deactivation removes warnings; hammer cannot be excluded',()=>{
  const {b,card,context}=setup('extreme_troll');card('ban_hammer_triple');card('ban_hammer_triple');assert.equal(b.player.status.warnings,2);card('deactivation','player');assert.equal(b.player.status.warnings,0);
  card('ban_hammer_triple');card('ban_hammer_triple');card('ban_hammer_triple');assert.equal(b.specialDefeat,true);
  b.enemy.hand.push({uid:'hammer',cardId:'ban_hammer_triple'});const {ctx}=context('enemy');ctx.move('enemy','hammer','excluded');assert.ok(b.enemy.rest.some(x=>x.uid==='hammer'));assert.ok(!b.enemy.excluded.some(x=>x.uid==='hammer'));
});
test('prophecy counters every submitted card and defensive exclusives grant exact armor and draw',()=>{
  const {A4,b,c}=setup();b.player.hand=[{uid:'p-prophecy',cardId:'prophecy'}];b.player.mana=1;b.enemy.hand=[{uid:'e-a',cardId:'blank'},{uid:'e-b',cardId:'blank'}];b.enemyPlan=['e-a','e-b'];b.enemyPowerPlan=false;A4.Battle.submit(b,['p-prophecy'],c,()=>0.43);assert.ok(b.history[0].enemy.every(x=>x.countered));
  const x=setup();const old=x.b.enemy.hand.length;x.card('ominous_presence');assert.equal(x.b.enemy.shield,10);assert.equal(x.b.enemy.hand.length,old+2);x.card('bramble_root');assert.equal(x.b.enemy.shield,15);assert.equal(x.b.enemy.hand.length,old+3);
});
test('final chapter deals six damage and heals six at each of the next three standbys',()=>{
  const {A4,b,c,card}=setup();b.enemy.hp=70;card('final_chapter');assert.deepEqual(Array.from(b.scheduled,x=>x.turn),[1,1,2,2,3,3]);assert.ok(b.scheduled.every(x=>x.phase==='STANDBY'&&x.task.effect.amount===6));for(let turn=1;turn<=4;turn++){for(let main=0;main<2;main++){b.enemyPlan=[];b.enemyPowerPlan=false;A4.Battle.submit(b,[],c,()=>0.43);}assert.equal(b.player.hp,100-6*Math.min(turn,3));assert.equal(b.enemy.hp,70+6*Math.min(turn,3));}assert.equal(b.scheduled.length,0);
});

test('Ivern cannot draw nature from rest when the draw pile still has other cards',()=>{
  const {b,event}=setup('ivern');const nature=content.generalCards.find(x=>x.element==='NATURE');
  b.player.rest=[{uid:'nature-in-rest',cardId:nature.id}];
  b.enemy.deck[0].cardId=nature.id;
  const count=b.player.hand.length;event('end');
  assert.equal(b.player.hand.length,count-1);
  assert.equal(b.player.rest[0].uid,'nature-in-rest');
  assert.ok(b.enemy.hand.some(x=>x.cardId===nature.id));
});

test('Brightwing random cast skips unplayable cards and handles an empty eligible pool',()=>{
  const {A4,b,c,context}=setup('brightwing');
  c.cards.blocked={name:'사용불가',cost:0,unplayable:true};c.cards.allowed={name:'사용가능',cost:1};c.cardPool=['blocked','allowed'];
  let x=context();A4.BossRules.run(x.ctx,{kind:'power',module:'boss',side:'enemy',power:A4.BossRules.power('brightwing')});
  assert.equal(x.tasks.filter(t=>t.kind==='cast')[0].card.cardId,'allowed');
  c.cardPool=['blocked'];x=context();A4.BossRules.run(x.ctx,{kind:'power',module:'boss',side:'enemy',power:A4.BossRules.power('brightwing')});
  assert.equal(x.tasks.filter(t=>t.kind==='cast').length,0);
});


test('Salvation Prayer heals both characters and triggers Yuumi only for actual opponent recovery',()=>{
 const {b,c,card}=setup('yuumi');b.player.hp=80;b.enemy.hp=70;const before=b.enemy.hand.length;card('salvation_prayer');assert.equal(b.player.hp,85);assert.equal(b.enemy.hp,75);assert.equal(b.enemy.hand.length,before+1);
 b.player.hp=100;const held=b.enemy.hand.length;card('salvation_prayer');assert.equal(b.enemy.hand.length,held);assert.equal(c.cards.salvation_prayer.cost,0);assert.equal(c.cards.salvation_prayer.upgrade,undefined);
});



test('Teemo checks only deck traps and adds exactly three at zero through three, none at four or more',()=>{
 for(const existing of [0,1,2,3,4,6]){
  const {b,power}=setup('teemo');
  b.player.deck=Array.from({length:existing},(_,i)=>({uid:'deck-trap-'+i,cardId:'poisonous_mushroom'}));
  b.player.rest=Array.from({length:8},(_,i)=>({uid:'rest-trap-'+i,cardId:'poisonous_mushroom'}));
  const rest=JSON.stringify(b.player.rest);power();
  assert.equal(b.player.deck.length,existing+(existing<=3?3:0));assert.equal(JSON.stringify(b.player.rest),rest);
  assert.equal(new Set(b.player.deck.map(x=>x.uid)).size,b.player.deck.length);
  assert.equal(b.player.status.poison,undefined);
  assert.equal((b.report&&b.report.logs||[]).filter(x=>x.type==='powerShuffle').length,existing<=3?1:0);
 }
});


test('Yuumi draws on first positive opponent healing per turn across phases and JSON restore',()=>{
 const {b,event}=setup('yuumi');const original=b.enemy.hand.length;
 event('heal',{side:'player',amount:0});assert.equal(b.enemy.status.yuumiHealTurn,undefined);
 event('heal',{side:'enemy',amount:5});assert.equal(b.enemy.hand.length,original);
 event('heal',{side:'player',amount:1});assert.equal(b.enemy.hand.length,original+1);assert.equal(b.enemy.status.yuumiHealTurn,b.turn);
 b.phase='MAIN2';Object.assign(b,JSON.parse(JSON.stringify(b)));event('heal',{side:'player',amount:5});assert.equal(b.enemy.hand.length,original+1);
 b.turn++;event('heal',{side:'player',amount:5});assert.equal(b.enemy.hand.length,original+2);
});
