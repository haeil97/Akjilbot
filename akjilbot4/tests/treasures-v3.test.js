'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function setup(){
  const box={A4:{}};
  ['base','combat','treasures-v3','combat-v3'].forEach(n=>vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src',n+'.js'),'utf8'),box));
  const A4=box.A4;
  const c={config:{engineVersion:3},cards:{},cardPool:[],treasures:{}};
  ['FIRE','ICE','NATURE','LIGHTNING','HOLY','NEUTRAL'].forEach((e,i)=>{
    c.cards['c'+i]={name:'시험'+i,element:e,cost:1,effects:[{type:'damage',amount:2}],upgrade:{effects:[{type:'damage',amount:3}]}};
    c.cardPool.push('c'+i);
  });
  A4.TreasureRules.install(c);
  function spec(prefix){return {name:prefix,maxHp:100,heroPower:{id:'heal',name:'치유',kind:'active',cost:1,effects:[{type:'heal',amount:3}]},deck:Array.from({length:18},(_,i)=>({uid:prefix+i,cardId:'c'+i%6,upgraded:false})),passives:[]};}
  const b=A4.Battle.create(spec('p'),spec('e'),c,()=>0.43);
  b.player.mana=5;b.player.maxMana=5;
  function context(side='player',extra={}){const tasks=[];return {ctx:A4.Battle.context(b,c,()=>0.43,Object.assign({side},extra),tasks),tasks};}
  function process(tasks){b.resolution={queue:tasks,phase:b.phase};A4.Battle.process(b,c,()=>0.43);let i=0;while(b.pendingChoice){assert.ok(++i<30);A4.Battle.choose(b,0,c,()=>0.43);}}
  function run(id){const d=c.cards['treasure_'+id];const card={uid:'treasureUse',cardId:'treasure_'+id};process([{kind:'card',module:'treasures',side:'player',card,def:d}]);}
  function event(type,data={}){process([{kind:'event',side:data.side||'player',event:Object.assign({type},data)}]);}
  return {A4,c,b,context,process,run,event};
}
test('approved 54 treasures have unique IDs, exact tier counts and no upgrades',()=>{
  const {A4,c}=setup();
  assert.equal(Object.keys(c.treasures).length,54);
  const counts={};
  Object.values(c.treasures).forEach(t=>{const k=t.tier+'_'+t.kind;counts[k]=(counts[k]||0)+1;if(t.kind==='card'){assert.equal(c.cards[t.cardId].upgrade,undefined);assert.equal(c.cards[t.cardId].treasure,true);assert.equal(A4.TreasureRules.supports(c.cards[t.cardId].rule),true);}});
  assert.deepEqual(counts,{low_passive:16,low_card:16,high_passive:8,high_card:14});
  assert.equal(c.treasures.magic_mirror_passive.name,'보석 팬던트');
  assert.equal(c.treasures.magic_mirror_card.name,'마법 거울');
});
test('all 30 card treasures resolve using the serializable battle queue',()=>{
  const listing=setup().A4.TreasureRules.definitions.filter(r=>r[2]==='card');
  for(const row of listing){
    const {b,c,run}=setup();
    b.player.rest=b.player.deck.splice(0,5);
    b.player.excluded=b.player.deck.splice(0,3);
    b.enemy.rest=b.enemy.deck.splice(0,3);
    b.enemy.lastTurnCards=[{card:{uid:'old',cardId:'c1',upgraded:false}}];
    assert.doesNotThrow(()=>run(row[0]),row[0]);
    assert.ok(b.player.hand.length<=8,row[0]);
    assert.ok(b.enemy.hand.length<=8,row[0]);
    const ids=[];
    ['player','enemy'].forEach(s=>['hand','deck','rest','excluded','inFlight'].forEach(z=>b[s][z].forEach(card=>{assert.ok(c.cards[card.cardId]);ids.push(card.uid);}))); 
    assert.equal(new Set(ids).size,ids.length,row[0]+' preserves instance uniqueness');
    assert.doesNotThrow(()=>JSON.stringify(b));
  }
});
test('wallet expands hand cap on all sources and excess cards still burn',()=>{
  const {A4,b,c,context}=setup();b.player.treasureIds=['pelgozi_wallet'];
  const {ctx}=context();ctx.draw('player',9);
  assert.equal(A4.Battle.handLimit(b,'player',c),11);
  assert.equal(b.player.hand.length,11);assert.equal(b.player.excluded.length,2);
});
test('prism compass has floor one, changes first card only and resets across empty turns',()=>{
  const {b,context,event}=setup();b.player.treasureIds=['prism_compass'];b.player.status.treasures={previousFirstElement:'ICE'};
  const {ctx}=context();b.player.hand[0].cardId='c0';b.player.hand[0].cost=3;
  assert.equal(ctx.cost('player',b.player.hand[0],true),2);
  assert.equal(ctx.cost('player',b.player.hand[0],false),3);
  b.player.hand[0].cost=1;assert.equal(ctx.cost('player',b.player.hand[0],true),1);
  b.player.hand[0].cost=0;assert.equal(ctx.cost('player',b.player.hand[0],true),0);
  b.turn=3;event('standby');assert.equal(b.player.status.treasures.previousFirstElement,null);
});
test('mana receipt refunds one actual paid card mana at main 2, not power mana',()=>{
  const {b,event}=setup();b.player.treasureIds=['mana_receipt'];b.player.mana=0;
  event('cardUsed',{side:'player',card:b.player.hand[0],def:{element:'FIRE'},free:false,paidCost:2});
  b.phase='MAIN2';event('beforeMain');assert.equal(b.player.mana,1);
  event('beforeMain');assert.equal(b.player.mana,1);
});
test('endless waves delays its extra draw until next standby',()=>{
  const {b,event,process}=setup();b.player.treasureIds=['endless_waves'];b.player.hand=b.player.hand.slice(0,1);
  event('end');assert.equal(b.player.hand.length,1);
  const job=b.scheduled.find(x=>x.task.op==='nextWaves');assert.equal(job.turn,1);assert.equal(job.phase,'STANDBY');
  process([job.task]);assert.equal(b.player.hand.length,2);
});
test('twin ring draws once per turn at the first repeated element',()=>{
  const {b,event}=setup();b.player.treasureIds=['twin_ring'];const initial=b.player.hand.length;
  ['FIRE','FIRE','ICE','ICE'].forEach(element=>event('cardUsed',{side:'player',card:b.player.hand[0],def:{element},free:false,paidCost:0}));
  assert.equal(b.player.hand.length,initial+1);
});
test('loaded dice and distiller combine into persisted element and card choices',()=>{
  const {A4,b,c,context}=setup();b.player.treasureIds=['loaded_dice','element_distiller'];
  const {ctx,tasks}=context();const data={side:'player',replace:false};A4.TreasureRules.modify(ctx,'basicDraw',data);
  assert.equal(data.replace,true);
  b.resolution={queue:tasks,phase:'STANDBY'};A4.Battle.process(b,c,()=>0.43);
  assert.equal(b.pendingChoice.options.length,4);
  const saved=JSON.parse(JSON.stringify(b));A4.Battle.choose(saved,0,c,()=>0.43);
  assert.ok(saved.pendingChoice);assert.ok(saved.pendingChoice.options.every(x=>c.cards[x.cardId].element==='FIRE'));
  A4.Battle.choose(saved,0,c,()=>0.43);assert.equal(saved.player.hand.length,b.player.hand.length+1);
});
test('magic mirror takes an unchosen discovered physical card without cloning it',()=>{
  const {b,event}=setup();b.player.treasureIds=['magic_mirror_passive'];
  const options=b.player.deck.slice(0,3),start=b.player.hand.length;
  event('discovered',{side:'player',choice:options[0],options,sourceZone:'deck'});
  assert.equal(b.player.hand.length,start+1);assert.equal(b.player.deck.length,13);
  event('discovered',{side:'player',choice:options[0],options,sourceZone:'deck'});assert.equal(b.player.hand.length,start+1);
});
test('magic mirror preserves the selected discovery card when only one hand slot remains',()=>{
  const {A4,b,c,context}=setup();b.player.treasureIds=['magic_mirror_passive'];b.player.hand.push(...b.player.deck.splice(0,3));
  const {ctx,tasks}=context();ctx.discover('player',b.player.deck.slice(),{kind:'custom',module:'treasures',side:'player',op:'basicDiscover'},{sourceZone:'deck'});
  b.resolution={queue:tasks,phase:b.phase};A4.Battle.process(b,c,()=>0.43);const chosen=b.pendingChoice.options[0];A4.Battle.choose(b,0,c,()=>0.43);
  assert.ok(b.player.hand.some(x=>x.uid===chosen.uid),'the selected card must receive the last free hand slot before the bonus');assert.equal(b.player.hand.length,8);assert.equal(b.player.excluded.length,1);
});
test('overload lightning rod, robe damage bonus and hero cost remain separate',()=>{
  const {b,event,context}=setup();b.player.treasureIds=['lightning_rod','archmage_robe','judge_ring'];
  event('overload',{side:'player',amount:2});assert.equal(b.enemy.hp,88);
  const {ctx}=context('player',{card:b.player.hand[0]});ctx.damage('player','enemy',3);assert.equal(b.enemy.hp,83);
  assert.equal(ctx.powerCost('player'),0);
});
test('codex stores at most 2 mana, first aid heals every end and retired vitality has no effect',()=>{
  const {b,event}=setup();b.player.treasureIds=['runeterra_codex','first_aid_kit','vitality_potion'];
  event('battleStart');assert.equal(b.player.maxHp,100);event('battleStart');assert.equal(b.player.maxHp,100);
  b.player.hp=70;b.player.mana=5;event('end');assert.equal(b.player.hp,73);assert.equal(b.player.status.treasures.savedMana,2);
  b.turn=1;b.player.mana=1;event('standby');assert.equal(b.player.mana,3);
});
test('enchant table skips treasures; echo and gramophone remember one card per turn',()=>{
  const {b,event,c}=setup();b.player.treasureIds=['enchant_table','echo_shard','loser_gramophone'];
  event('powerUsed',{side:'player',power:b.player.heroPower});assert.equal(b.player.hand.filter(x=>x.upgraded).length,1);
  const size=b.player.hand.length,target=b.enemy.hand[0];event('counter',{side:'player',card:b.player.hand[0],targets:[target]});event('counter',{side:'player',card:b.player.hand[0],targets:[target]});assert.equal(b.player.hand.length,size+1);
  const victim=b.player.hand.pop();b.player.rest.push(victim);event('cardUsed',{side:'player',card:victim,def:c.cards[victim.cardId],free:false,countered:true,paidCost:1});event('end');assert.ok(b.player.hand.some(x=>x.uid===victim.uid));
});
test('grandmage staff generates an ordinary unupgraded one-use card',()=>{
  const {b,event}=setup();b.player.treasureIds=['grandmage_staff'];const initial=b.player.hand.length;b.turn=1;event('standby');
  const card=b.player.hand[initial];assert.equal(card.excludeOnUse,true);assert.equal(card.upgraded,false);
});
test('hearthstone is an innate active escape and no longer rescues lethal damage',()=>{
  const {b,c,run,event}=setup();b.player.treasureIds=['hearthstone'];b.player.hp=0;
  event('beforeDeath');assert.equal(b.restartRequested,undefined);
  run('hearthstone');assert.equal(b.escapeRequested.side,'player');
  assert.equal(c.cards.treasure_hearthstone.innate,true);
  assert.ok(b.runChanges.some(x=>x.type==='removeTreasure'));
});

test('grave pick resumes all three discoveries after serialized pause',()=>{
  const {A4,b,c}=setup();b.player.hand=[];b.player.rest=b.player.deck.splice(0,4);
  const d=c.cards.treasure_grave_pick;b.resolution={queue:[{kind:'card',module:'treasures',side:'player',card:{uid:'pick',cardId:'treasure_grave_pick'},def:d}]};A4.Battle.process(b,c,()=>0.43);
  let saved=JSON.parse(JSON.stringify(b));let n=0;while(saved.pendingChoice){A4.Battle.choose(saved,0,c,()=>0.43);saved=JSON.parse(JSON.stringify(saved));n++;}
  assert.equal(n,3);assert.equal(saved.player.hand.length,3);assert.equal(saved.player.rest.length,1);
});
test('escape key draws for cards entering rest without recurring over new draws',()=>{
  const {b,run}=setup();const start=b.player.hand.length;run('escape_key');assert.equal(b.player.hand.length,start);assert.equal(b.player.rest.length,start);
});
test('cassette permanently adds each copied card including separate duplicates',()=>{
  const {b,run}=setup();b.enemy.lastTurnCards=[{card:{cardId:'c0',uid:'old1',upgraded:true}},{card:{cardId:'c0',uid:'old2',upgraded:false}}];run('cassette');
  assert.equal(b.runChanges.length,2);assert.equal(b.runChanges[0].card.upgraded,true);assert.equal(b.runChanges[1].card.upgraded,false);
});
test('hand exchange honors each recipient hand cap; gambling conserves physical cards',()=>{
  const {b,run}=setup();b.player.hand.push(...b.player.deck.splice(0,5));run('exchange_deed');assert.equal(b.enemy.hand.length,8);assert.equal(b.enemy.excluded.length,1);
  const before=b.player.deck.length+b.enemy.deck.length+b.player.rest.length+b.enemy.rest.length;run('gambling_box');assert.equal(b.player.deck.length+b.enemy.deck.length,before);assert.equal(b.player.deck.length,Math.ceil(before/2));
});
test('mirage restores original hand and removes its generated copies from either owner',()=>{
  const {b,run,process}=setup();const original=Array.from(b.player.hand,x=>x.uid);run('mirage');assert.equal(b.player.hand.length,8);
  b.enemy.rest.push(b.player.hand.pop());const job=b.scheduled.find(x=>x.task.op==='restoreMirage');process([job.task]);
  assert.deepEqual(Array.from(b.player.hand,x=>x.uid),original);assert.equal(b.enemy.rest.length,0);
});
test('starlight counter cancels all current opposing cards before their effects',()=>{
  const {A4,b,c}=setup();b.player.hand=[{uid:'s',cardId:'treasure_starlight_disassembler'}];b.enemy.hand=[{uid:'submitted1',cardId:'c0'},{uid:'submitted2',cardId:'c1'}];b.enemy.mana=5;b.enemy.maxMana=5;b.enemyPlan=['submitted1','submitted2'];b.enemyPowerPlan=false;
  A4.Battle.submit(b,['s'],c,()=>0.43);assert.equal(b.player.hp,100);assert.equal(b.enemy.rest.length,2);assert.ok(b.history[0].enemy.every(x=>x.countered));
});
test('roasting wand bypasses shield and bonus, ends at first lethal hit',()=>{
  const {b,run}=setup();b.player.treasureIds=['archmage_robe'];b.player.hp=21;b.enemy.hp=100;b.player.shield=999;run('roasting_wand');assert.equal(b.player.hp,-9);assert.equal(b.enemy.hp,100);assert.equal(b.player.shield,999);
});


for(const wallet of [false,true])test(`mirage keeps new draws first, restores originals in order and excludes trailing overflow (wallet=${wallet})`,()=>{
  const {b,run,process,context}=setup();
  if(wallet)b.player.treasureIds=['pelgozi_wallet'];
  const original=Array.from(b.player.hand,x=>x.uid);
  run('mirage');
  // Use three mirage cards to make space; real deck cards drawn by their
  // effects have their own identities and do not belong to the mirage group.
  b.player.rest.push(...b.player.hand.splice(0,3));
  let draw=context();draw.ctx.draw('player',3);process(draw.tasks);
  const fresh=Array.from(b.player.hand.filter(x=>!x.mirageGroup),x=>x.uid);
  assert.equal(fresh.length,3);
  // Independent generation also remains in hand at restoration.
  b.player.rest.push(...b.player.hand.splice(0,2));
  draw=context();draw.ctx.generate('player','c0');draw.ctx.generate('player','c1');process(draw.tasks);
  const kept=Array.from(b.player.hand.filter(x=>!x.mirageGroup),x=>x.uid);
  assert.equal(kept.length,5);
  const restored=JSON.parse(JSON.stringify(b));Object.keys(b).forEach(k=>delete b[k]);Object.assign(b,restored);
  const job=b.scheduled.find(x=>x.task.op==='restoreMirage');process([job.task]);
  const fits=(wallet?11:8)-kept.length;
  assert.deepEqual(Array.from(b.player.hand,x=>x.uid),kept.concat(original.slice(0,fits)));
  assert.deepEqual(Array.from(b.player.excluded,x=>x.uid),original.slice(fits));
  for(const side of ['player','enemy'])for(const zone of ['hand','deck','rest','excluded'])assert.ok(b[side][zone].every(x=>!x.mirageGroup));
  const overflows=b.report.logs.filter(x=>x.type==='overflow');
  assert.equal(overflows.reduce((n,x)=>n+x.amount,0),wallet?0:1);
});


test('mirage is a low-tier nature card treasure',()=>{
 const {c}=setup();assert.equal(c.treasures.mirage.tier,'low');assert.equal(c.treasures.mirage.kind,'card');
 assert.equal(c.cards.treasure_mirage.element,'NATURE');assert.equal(c.cards.treasure_mirage.displayIcon,'🍃✨');
});


test('distiller offers only basic elements present in the current draw pile, refilling only an empty pile',()=>{
 for(const refill of [false,true])for(const dice of [false,true]){
  const {A4,b,c}=setup();b.player.treasureIds=['element_distiller'].concat(dice?['loaded_dice']:[]);
  const available=[{uid:'fire-choice',cardId:'c0'},{uid:'nature-choice',cardId:'c2'},{uid:'holy-choice',cardId:'c4'}];
  b.player.deck=refill?[]:available;b.player.rest=refill?available:[{uid:'ice-rest',cardId:'c1'}];
  b.resolution={queue:[{module:'treasures',op:'askElement',side:'player'}]};A4.Battle.process(b,c,()=>0.43);
  assert.deepEqual(Array.from(b.pendingChoice.options,x=>x.id),['FIRE','NATURE']);
  const saved=JSON.parse(JSON.stringify(b));A4.Battle.choose(saved,0,c,()=>0.43);
  if(dice){assert.ok(saved.pendingChoice.options.every(x=>c.cards[x.cardId].element==='FIRE'));A4.Battle.choose(saved,0,c,()=>0.43);}
  assert.ok(saved.player.hand.some(x=>x.uid==='fire-choice'));
 }
 const {A4,b,c}=setup();b.player.deck=[{uid:'holy-only',cardId:'c4'}];b.player.rest=[];
 b.resolution={queue:[{module:'treasures',op:'askElement',side:'player'}]};A4.Battle.process(b,c,()=>0.43);assert.equal(b.pendingChoice,null);assert.equal(b.resolution,null);
});


test('lucky shovel triggers once across main phases and serialization, then resets next turn for each owner',()=>{
  const {b,c,A4,event}=setup();
  b.player.treasureIds=['lucky_shovel'];b.enemy.treasureIds=['lucky_shovel'];
  b.player.hand=[{uid:'first',cardId:'c0'},{uid:'second',cardId:'c1'},{uid:'third',cardId:'c2'}];
  b.enemy.hand=[{uid:'enemy-first',cardId:'c3'}];
  const discover=(side,uid)=>event('discovered',{side,choice:JSON.parse(JSON.stringify(b[side].hand.find(x=>x.uid===uid))),beforeHandUids:[]});
  assert.match(c.treasures.lucky_shovel.text,/^한 턴에 한 번,/);
  discover('player','first');assert.equal(b.player.hand.length,4);
  b.player.hand.filter(x=>x.cardId==='c0').forEach(x=>assert.equal(A4.Battle.describeCard(x,c).cost,0));
  const saved=JSON.parse(JSON.stringify(b));Object.keys(b).forEach(k=>delete b[k]);Object.assign(b,saved);
  b.phase='MAIN2';discover('player','second');assert.equal(b.player.hand.length,4);
  assert.equal(A4.Battle.describeCard(b.player.hand.find(x=>x.uid==='second'),c).cost,1);
  discover('enemy','enemy-first');assert.equal(b.enemy.hand.length,2);
  b.turn++;b.phase='MAIN1';discover('player','third');assert.equal(b.player.hand.length,5);
  b.player.hand.filter(x=>x.cardId==='c2').forEach(x=>assert.equal(A4.Battle.describeCard(x,c).cost,0));
});


test('updated treasure costs, tiers, flags and echo discount are installed',()=>{
 const {b,c,event,A4}=setup();
 assert.equal(c.treasures.judge_ring.tier,'high');assert.equal(c.treasures.loser_gramophone.tier,'low');
 for(const id of ['thief_hook','tolins_cup','full_bag','nether_portal'])assert.equal(c.cards['treasure_'+id].cost,0);
 assert.equal(c.cards.treasure_infinity_stone.cost,4);assert.ok(!c.cards.treasure_zephrys_lamp.innate);assert.equal(c.cards.treasure_destruction_orb.excludeOnUse,true);
 b.player.treasureIds=['echo_shard'];const target=b.enemy.hand[0],size=b.player.hand.length;
 event('counter',{side:'player',targets:[target]});const acquired=b.player.hand[size];assert.equal(A4.Battle.describeCard(acquired,c).cost,0);
 assert.equal(A4.Battle.describeCard(target,c).cost,1);event('counter',{side:'player',targets:[target]});assert.equal(b.player.hand.length,size+1);
});

test('Thief Hook exposes two ordered discoveries and resumes the second choice after saving',()=>{
 const {b,c,A4}=setup();
 const hook={uid:'hook-use',cardId:'treasure_thief_hook'};b.player.hand=[hook];b.player.rest=[{uid:'own0',cardId:'c0'},{uid:'own1',cardId:'c1'}];
 b.enemy.hand=[{uid:'foe2',cardId:'c2'},{uid:'foe3',cardId:'c3'},{uid:'foe4',cardId:'c4'}];b.enemyPlan=[];b.enemyPowerPlan=false;
 A4.Battle.submit(b,[hook.uid],c,()=>0.43);assert.equal(b.pendingChoice.continuation.op,'hookDiscard');
 const discarded=b.pendingChoice.options[1].uid;A4.Battle.choose(b,1,c,()=>0.43);
 assert.ok(b.enemy.rest.some(x=>x.uid===discarded));assert.equal(b.enemy.hand.length,2);
 assert.equal(b.pendingChoice.continuation.op,'discoverMove');const recovered=b.pendingChoice.options[1].uid;
 const saved=JSON.parse(JSON.stringify(b));A4.Battle.choose(saved,1,c,()=>0.43);
 assert.ok(saved.player.hand.some(x=>x.uid===recovered));assert.equal(saved.player.mana,5);assert.equal(saved.pendingChoice,null);
});

test('Thief Hook still recovers a rest card when the opposing hand is empty',()=>{
 const {b,run}=setup();b.enemy.hand=[];b.player.rest=[{uid:'rest-only',cardId:'c0'}];run('thief_hook');
 assert.ok(b.player.hand.some(x=>x.uid==='rest-only'));
});

test('Nether Portal zero cost persists across turns in hand, then resets when the card leaves hand',()=>{
 const {b,c,run,event,context,A4}=setup();const original={uid:'portal-return',cardId:'c0'};b.player.excluded=[original];run('nether_portal');
 const returned=b.player.hand.find(x=>x.uid===original.uid);assert.equal(A4.Battle.describeCard(returned,c).cost,0);
 assert.equal(returned.treasureCostRestore,undefined);b.turn++;event('afterEnd');assert.equal(A4.Battle.describeCard(returned,c).cost,0);
 context().ctx.move('player',returned.uid,'rest');assert.equal(A4.Battle.describeCard(returned,c).cost,1);
});

test('Endless Waves triggers at two cards and Pickpocket Gloves steals exactly two physical cards',()=>{
 const waves=setup();waves.b.player.treasureIds=['endless_waves'];waves.b.player.hand=waves.b.player.hand.slice(0,2);waves.event('end');
 assert.equal(waves.b.scheduled.filter(x=>x.task.op==='nextWaves').length,1);
 const gloves=setup();const uids=gloves.b.enemy.hand.map(x=>x.uid),old=gloves.b.player.hand.length;gloves.run('pickpocket_gloves');
 assert.equal(gloves.b.enemy.hand.length,2);assert.equal(gloves.b.player.hand.length,old+2);assert.equal(gloves.b.player.hand.filter(x=>uids.includes(x.uid)).length,2);
});

test('Destruction Orb is excluded on use and the lamp no longer forces an opening slot',()=>{
 const {b,c,A4}=setup();const orb={uid:'orb-use',cardId:'treasure_destruction_orb'};b.player.hand=[orb];b.enemyPlan=[];b.enemyPowerPlan=false;
 A4.Battle.submit(b,[orb.uid],c,()=>0.43);assert.ok(b.player.excluded.some(x=>x.uid===orb.uid));assert.ok(!b.player.rest.some(x=>x.uid===orb.uid));
 const spec=name=>({name,maxHp:100,deck:Array.from({length:4},(_,i)=>({uid:name+i,cardId:'c0'}))});const p=spec('p'),e=spec('e');p.deck.push({uid:'lamp-last',cardId:'treasure_zephrys_lamp'});
 const opening=A4.Battle.create(p,e,c,()=>0.999);assert.ok(!opening.player.hand.some(x=>x.uid==='lamp-last'));
});
