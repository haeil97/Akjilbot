const test=require('node:test');
const assert=require('node:assert/strict');
const A=require('../../악질봇4.0.0.js');
const copy=x=>JSON.parse(JSON.stringify(x));
let serial=0;
function card(name,upgraded=false){return {uid:'new-'+(++serial),cardId:A.CardRules.nameToId(name)||name,upgraded};}
function setup(){
 const c=copy(A.catalog);c.cards.blank={name:'빈 카드',element:'NEUTRAL',cost:0,effects:[]};
 const spec=name=>({name,maxHp:100,deck:Array.from({length:30},()=>card('blank')),heroPower:copy(c.heroes[0].power)});
 let b=A.Battle.create(spec('플레이어'),spec('상대'),c,()=>0.5);
 b.player.hand=[];b.enemy.hand=[];b.player.mana=b.enemy.mana=b.player.maxMana=b.enemy.maxMana=5;b.enemyPlan=[];b.enemyPowerPlan=false;
 function process(tasks){b.resolution={queue:tasks,phase:b.phase};A.Battle.process(b,c,()=>0.5);}
 function event(type){process([{kind:'event',side:'player',event:{type}}]);}
 function ctx(side='player'){const tasks=[];return {ctx:A.Battle.context(b,c,()=>0.5,{side},tasks),flush:()=>process(tasks)};}
 function play(name,upgraded=false){const x=card(name,upgraded);b.player.hand.push(x);b.enemyPlan=[];b.enemyPowerPlan=false;A.Battle.submit(b,[x.uid],c,()=>0.5);return x;}
 function power(id){process([{kind:'power',module:'boss',side:'enemy',power:A.BossRules.power(id)}]);}
 function reload(){const data=copy(b);Object.keys(b).forEach(k=>delete b[k]);Object.assign(b,data);}
 return {b,c,process,event,ctx,play,power,reload};
}

test('Guff targets only positive effective costs, including zero-cost overrides',()=>{
 const {b,c}=setup();b.player.hand=[card('과열'),card('치유의 손길'),Object.assign(card('천둥'),{cost:0})];b.player.hp=50;
 A.Battle.submit(b,[],c,()=>0,{heroPower:true});
 assert.equal(b.player.hp,50);assert.deepEqual(b.player.hand.map(x=>A.Battle.describeCard(x,c).cost),[0,1,0]);
});
test('Patchwerk caps current and maximum HP at 100, and empty Execution is silent',()=>{
 const {b,power}=setup();b.enemy.hp=80;b.enemy.maxHp=90;power('patchwerk');assert.equal(b.enemy.hp,100);assert.equal(b.enemy.maxHp,100);
 b.report.logs=[];power('black_knight');assert.deepEqual(b.report.logs,[]);
});
test('chain lightning costs two in both ranks and heroes have their current starter deck sizes',()=>{
 assert.equal(A.catalog.heroes.length,6);
 for(const hero of A.catalog.heroes){assert.equal(hero.cards.length,10);for(const id of hero.cards)assert.ok(A.catalog.cards[id]);}
 const d=A.catalog.cards[A.CardRules.nameToId('연쇄 번개')];assert.equal(d.cost,2);assert.equal(d.upgrade.cost,2);
});
test('poison survives saves, ticks once per standby, decays and uses no card damage bonus',()=>{
 const {b,c,ctx,event,reload}=setup();b.player.treasureIds=['archmage_robe'];b.enemy.status.cosmicBonus=50;
 ctx().ctx.poison('player','enemy',3);reload();event('standby');assert.equal(b.enemy.hp,97);assert.equal(b.enemy.status.poison,2);
 b.turn++;event('standby');assert.equal(b.enemy.hp,95);assert.equal(b.enemy.status.poison,1);
 assert.match(A.BattleUI.summary(b,1,c),/중독/);
});
test('molten bone adds one, decay potion reflects once and prevents enemy poison decay',()=>{
 const {b,ctx,event}=setup();b.player.treasureIds=['molten_bone','decay_potion'];b.enemy.treasureIds=['decay_potion'];
 ctx().ctx.poison('player','enemy',3);assert.equal(b.enemy.status.poison,4);assert.equal(b.player.status.poison,4);
 event('standby');assert.equal(b.enemy.hp,96);assert.equal(b.player.hp,96);assert.equal(b.enemy.status.poison,4);assert.equal(b.player.status.poison,4);
});
for(const up of [false,true])test('new poison cards apply specified values, upgraded='+up,()=>{
 for(const [name,amount] of [['맹독',up?4:3],['차오르는 독',up?3:2],['독버섯',up?7:5],['궁극의 역병',5]]){
  const {b,play}=setup();play(name,up);assert.equal(b.enemy.status.poison,amount,name);
  if(name==='궁극의 역병'){assert.equal(b.enemy.hp,95);assert.equal(b.player.shield,5);assert.equal(b.player.hand.length,5);}
 }
 const apple=setup();apple.b.player.hp=50;apple.play('독사과',up);assert.equal(apple.b.player.hp,up?68:62);assert.equal(apple.b.player.status.poison,3);
 const rising=setup();rising.b.enemy.status.poison=1;rising.play('차오르는 독',up);assert.equal(rising.b.enemy.status.poison,up?6:5);
});
test('poison mushroom critical uses poison after application; countered poison is canceled',()=>{
 const {b,c}=setup();b.enemy.status.poison=2;b.player.hand=[card('독버섯')];b.enemy.hand=[card('천둥')];b.enemyPlan=[b.enemy.hand[0].uid];
 A.Battle.submit(b,[b.player.hand[0].uid],c,()=>0.5);assert.equal(b.enemy.status.poison,7);assert.equal(b.enemy.hp,93);
 const x=setup();x.b.player.hand=[card('맹독')];x.b.enemy.hand=[card('화염구')];x.b.enemyPlan=[x.b.enemy.hand[0].uid];
 A.Battle.submit(x.b,[x.b.player.hand[0].uid],x.c,()=>0.5);assert.equal(x.b.enemy.status.poison,undefined);
});
test('mushroom trap remains a separate token and auto-casts poison plus replacement draw',()=>{
 const {b,c,ctx,power}=setup();power('teemo');assert.equal(b.player.deck.concat(b.player.rest).filter(x=>x.cardId==='poisonous_mushroom').length,3);
 assert.equal(c.cards.poisonous_mushroom.name,'버섯 함정');assert.notEqual(A.CardRules.nameToId('독버섯'),'poisonous_mushroom');
 b.player.deck=[card('poisonous_mushroom'),card('blank')];const x=ctx();x.ctx.draw('player',1);x.flush();
 assert.equal(b.player.status.poison,2);assert.equal(b.player.hp,100);assert.equal(b.player.hand.length,1);
});
test('Silent Swift draws a card; Celeste power grants a crystal without transforming immediately',()=>{
 for(const id of ['silent','celeste']){
  const {b,c}=setup();b.player.heroPower=copy(c.heroes.find(h=>h.id===id).power);
  if(id==='silent'){A.Battle.submit(b,[],c,()=>0.5,{heroPower:true});assert.equal(b.player.mana,4);assert.equal(b.enemy.status.poison,undefined);assert.equal(b.player.hand.length,1);}
  else {b.turn=1;b.phase='STANDBY';b.resolution={queue:[{kind:'event',event:{type:'standby'}}]};A.Battle.process(b,c,()=>0.5);assert.equal(b.player.mana,5);assert.equal(b.player.hand[0].cardId,'crystal_ball');}
 }
});
test('heaven gift fills both hands to six but does not discard hands already over six',()=>{
 const {b,play}=setup();b.enemy.hand=Array.from({length:7},()=>card('blank'));play('하늘의 선물');assert.equal(b.player.hand.length,6);assert.equal(b.enemy.hand.length,7);
});
test('Antarctic Clock damages the opponent on direct zero-cost submissions even countered, not automatic casts or powers',()=>{
 const {b,c}=setup();b.player.treasureIds=['antarctic_clock'];b.player.hand=[card('과열')];b.enemy.hand=[card('급속 빙결')];b.enemyPlan=[b.enemy.hand[0].uid];
 A.Battle.submit(b,[b.player.hand[0].uid],c,()=>0.5);assert.equal(b.player.shield,0);assert.equal(b.player.hp,97);assert.equal(b.enemy.hp,96);assert.ok(b.report.logs.some(x=>x.type==='damage'&&x.side==='enemy'&&x.amount===4));assert.equal(b.history[0].player[0].countered,true);
});
test('Time Potion replaces the basic standby draw with exactly four and sends held cards to rest at END',()=>{
 const {b,c}=setup();b.player.treasureIds=['time_potion'];b.player.hand=[card('blank')];
 b.enemyPlan=[];A.Battle.submit(b,[],c,()=>0.5);b.enemyPlan=[];A.Battle.submit(b,[],c,()=>0.5);
 assert.equal(b.player.rest.length,1);assert.equal(b.player.hand.length,4);
});

test('Shaladrassil upgrades ordinary cards and crystals in hand/deck/rest but not treasures or other exclusives',()=>{
 const {b,play}=setup();b.player.hand=[card('맹독'),card('crystal_ball'),card('treasure_wonder_wand'),card('prophecy')];b.player.deck=[card('화염구')];b.player.rest=[card('치유의 손길')];
 play('treasure_shaladrassil');assert.equal(b.player.hand[0].upgraded,true);assert.equal(b.player.hand[1].upgraded,true);assert.equal(b.player.hand[2].upgraded,false);assert.equal(b.player.hand[3].upgraded,false);
 assert.equal(b.player.deck[0].upgraded,true);assert.equal(b.player.rest[0].upgraded,true);
});
test('crystal+ rerolls upgraded cards, exposes cosmic attribute in hand, and rests as crystal+',()=>{
 const {b,c,event,reload}=setup();b.player.hand=[card('crystal_ball',true)];c.cardPool=[A.CardRules.nameToId('수중 동물 변신')];event('standby');
 assert.equal(b.player.hand[0].upgraded,true);assert.match(A.BattleUI.controls(b,c),/\[🌌🍃\] 수중 동물 변신\+/);
 reload();b.turn++;c.cardPool=[A.CardRules.nameToId('재생')];event('standby');assert.equal(b.player.hand[0].cardId,c.cardPool[0]);assert.equal(b.player.hand[0].upgraded,true);
 const uid=b.player.hand[0].uid;A.Battle.submit(b,[uid],c,()=>0.5);
 const rest=b.player.rest.find(x=>x.uid===uid);assert.equal(rest.cardId,'crystal_ball');assert.equal(rest.upgraded,true);
 assert.match(A.BattleUI.summary(b,1,c),/수정구\+ ⮕ \[🍃\] 재생\+/);
});
for(const upgraded of [false,true])test('Atlas intercepts generated discovery once and upgrade persists across saved choices: '+upgraded,()=>{
 const {b,c,play,reload}=setup();const trap=card('마법공학: 아틀라스',upgraded),spare=card('마법공학: 아틀라스');b.enemy.hand=[trap,spare];
 b.player.hand=[card('blank')];const original=b.player.hand[0].uid;
 play('전선');assert.ok(b.pendingChoice);reload();A.Battle.choose(b,0,c,()=>0.5);
 assert.equal(b.player.hand.length,1);assert.equal(b.player.hand[0].uid,original);
 assert.ok(b.enemy.rest.some(x=>x.uid===trap.uid));assert.ok(b.enemy.hand.some(x=>x.uid===spare.uid));
 assert.equal(b.enemy.hand.length,2);assert.ok(b.player.rest.length>=2);
 if(upgraded){
  const before=b.enemy.rest.length;play('전선');assert.ok(b.pendingChoice);A.Battle.choose(b,0,c,()=>0.5);
  assert.ok(b.enemy.hand.some(x=>x.uid===spare.uid));assert.ok(b.enemy.rest.length>=before);
 }
});
test('Teemo has thirty cards including all ten additions',()=>{
 const t=A.content.opponentDecks.enemies.find(x=>x.id==='teemo');assert.equal(t.deckSize,30);
 for(const name of ['차오르는 독','독버섯','마법공학: 아틀라스','마법공학: 니비루'])assert.equal(t.cards.find(x=>x.name===name).count,2);
});


test('Atlas sends a discovered automatic-cast card to rest before it can resolve',()=>{
 const {b,c,play,reload}=setup();b.enemy.hand=[card('마법공학: 아틀라스')];play('전선',true);assert.ok(b.pendingChoice);
 const id=A.CardRules.nameToId('파지직');b.pendingChoice.options=[{cardId:id,upgraded:false}];reload();A.Battle.choose(b,0,c,()=>0.5);
 assert.equal(b.enemy.hp,100);assert.ok(b.player.rest.some(x=>x.cardId===id));
});
test('Atlas also removes the additional Magic Mirror discovery but leaves preexisting hand intact',()=>{
 const {b,c,play}=setup();b.player.treasureIds=['magic_mirror_passive'];b.player.hand=[card('blank')];b.enemy.hand=[card('마법공학: 아틀라스')];
 play('전선');A.Battle.choose(b,0,c,()=>0.5);assert.equal(b.player.hand.length,1);assert.equal(b.player.rest.length,3);
});


test('recycling shields once per countered card, and philosopher discounts only after costly manual submissions',()=>{
 const {b,c,play}=setup();b.player.treasureIds=['recycling_bin','philosopher_stone'];
 const held=card('치유의 손길'),attack=Object.assign(card('화염구'),{cost:2}),ice=card('급속 빙결');b.player.hand=[held,attack];b.enemy.hand=[ice];b.enemyPlan=[ice.uid];
 A.Battle.submit(b,[attack.uid],c,()=>0.5);
 assert.equal(A.Battle.describeCard(held,c).cost,1);assert.ok(b.report.logs.some(x=>x.type==='shield'&&x.amount===5));
});

test('lucky shovel copies the chosen card, discounts both to zero, and coexists with mirror',()=>{
 const {b,c,play,reload}=setup();b.player.treasureIds=['lucky_shovel','magic_mirror_passive'];
 b.player.rest=[card('천둥'),card('맹독'),card('재생')];play('축성',true);assert.ok(b.pendingChoice);const id=b.pendingChoice.options[0].cardId;reload();
 A.Battle.choose(b,0,c,()=>0.5);const chosen=b.player.hand.filter(x=>x.cardId===id);
 assert.equal(chosen.length,2);chosen.forEach(x=>assert.equal(A.Battle.describeCard(x,c).cost,0));assert.equal(b.player.hand.length,3);
});

test('infinity stone floors all four halves and sends hand and deck cards to rest',()=>{
 const {b,play}=setup();b.enemy.hp=51;b.enemy.hand=Array.from({length:5},()=>card('blank'));b.enemy.deck=Array.from({length:7},()=>card('blank'));b.enemy.rest=[];
 play('treasure_infinity_stone');assert.equal(b.enemy.maxMana,3);assert.equal(b.enemy.hp,26);assert.equal(b.enemy.hand.length,3);assert.equal(b.enemy.deck.length,4);assert.equal(b.enemy.rest.length,5);
});

test('innate talent discovers upgraded zero-cost cards and executes their effect as a one-mana power',()=>{
 const {b,c,play,reload}=setup();
 c.cardPool=['general:독사과'];b.player.hp=50;play('treasure_innate_talent');assert.ok(b.pendingChoice);
 assert.ok(b.pendingChoice.options.every(x=>x.upgraded&&A.Battle.describeCard(x,c).cost===0));reload();A.Battle.choose(b,0,c,()=>0.5);
 assert.equal(b.player.heroPower.name,'독사과+');assert.equal(b.player.heroPower.cost,1);
 const before=b.player.playedThisTurn;b.enemyPlan=[];b.enemyPowerPlan=false;
 A.Battle.submit(b,[],c,()=>0.5,{heroPower:true});assert.equal(b.player.hp,65);assert.equal(b.player.status.poison,2);
 assert.ok(b.player.excluded.some(x=>x.cardId==='treasure_innate_talent'));assert.ok(b.player.playedThisTurn<=before);
});
