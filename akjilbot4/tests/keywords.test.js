const test=require('node:test'),assert=require('node:assert/strict'),A=require('../../악질봇4.0.0.js');
function setup(){
 const c=A.copy(A.catalog);c.cards.testBlank={name:'빈 카드',element:'NEUTRAL',cost:0,effects:[]};let serial=0;
 const card=(extra={})=>Object.assign({uid:'keyword-'+(++serial),cardId:'testBlank',upgraded:false},extra);
 const spec=name=>({name,maxHp:200,deck:Array.from({length:40},()=>card())});
 const b=A.Battle.create(spec('나'),spec('상대'),c,()=>.3);
 function job(t){b.resolution={queue:[t]};A.Battle.process(b,c,()=>.3);}
 const effect=(e,side='player')=>job({kind:'effect',side,effect:e});
 const event=(type,extra={})=>job({kind:'event',event:Object.assign({type,def:extra.card?A.Battle.describeCard(extra.card,c):undefined},extra)});
 return {b,c,card,job,effect,event,ctx:()=>A.Battle.context(b,c,()=>.3,{side:'player'},[])};
}
test('opening mana is two, growth still occurs at visible five-turn milestones, and fatigue starts exactly at twenty',()=>{
 const {b,c,job}=setup();assert.equal(b.player.mana,2);assert.equal(b.enemy.maxMana,2);
 assert.equal(A.Battle.maximumMana(1),2);assert.equal(A.Battle.maximumMana(5),3);assert.equal(A.Battle.maximumMana(15),5);
 for(const turn of [19,20,21]){b.turn=turn-1;const hp=b.player.hp;b.player.shield=50;job({kind:'phase',op:'fatigue'});assert.equal(b.player.hp,hp-Math.max(0,turn-19));assert.equal(b.player.shield,50);}
 b.turn=3;job({kind:'phase',op:'standby'});assert.equal(b.turn,4);assert.equal(b.player.maxMana,3);
});
test('disarm lasts through the second future END, blocks gains but permits shield loss and cleansing',()=>{
 const {b,effect,event,ctx}=setup();effect({type:'disarm',target:'self',turns:2});ctx().shield('player',8);assert.equal(b.player.shield,0);
 b.player.shield=5;ctx().shield('player',-2);assert.equal(b.player.shield,3);
 b.turn=1;event('afterEnd');ctx().shield('player',2);assert.equal(b.player.shield,3);
 b.turn=2;ctx().shield('player',2);assert.equal(b.player.shield,3);event('afterEnd');ctx().shield('player',2);assert.equal(b.player.shield,5);
});
test('weakened and vulnerable apply floored damage for cards and powers and cannot override damage immunity',()=>{
 const {b,effect,ctx}=setup();effect({type:'weakened',target:'self'});effect({type:'vulnerable'});
 assert.equal(ctx().damage('player','enemy',7,{card:null}),7); // floor(7*.75)=5; floor(5*1.5)=7
 b.enemy.status.cards.effects.push({kind:'immune'});assert.equal(ctx().damage('player','enemy',7,{card:null}),0);
 assert.equal(ctx().damage('player','enemy',7,{card:null,unblockable:true}),7);
});
test('shock chooses distinct usable hand cards affordable by max mana, persists through save and expires after next END',()=>{
 const {b,c,card,effect,event}=setup();b.enemy.maxMana=2;b.enemy.mana=0;
 b.enemy.hand=[card({cost:0}),card({cost:2}),card({cost:3}),card({unplayable:true})];effect({type:'shock',amount:9});
 assert.equal(b.enemy.hand.filter(x=>x.shockedUntil===1).length,2);assert.equal(A.Battle.cardAllowed(b,'enemy',c,b.enemy.hand[0]),false);
 const restored=A.copy(b);assert.equal(A.Battle.cardAllowed(restored,'enemy',c,restored.enemy.hand[1]),false);
 event('afterEnd');assert.equal(b.enemy.hand[0].shockedUntil,1);b.turn=1;event('afterEnd');assert.equal(A.Battle.cardAllowed(b,'enemy',c,b.enemy.hand[0]),true);
});
test('degrade restores base definition, bottom disposal preserves order, sinking and awakening remember past thresholds',()=>{
 const {b,c,card,effect,ctx}=setup();const x=card({cardId:'healing_touch',upgraded:true});b.player.hand=[x];effect({type:'degrade',target:'self'});assert.equal(A.Battle.describeCard(x,c).name,'치유의 손길');
 const a=card(),z=card();b.player.deck=[a,z];b.player.rest=[];effect({type:'discardBottom',amount:4});assert.equal(b.player.rest[0].uid,z.uid);assert.equal(b.player.rest[1].uid,a.uid);assert.equal(b.player.status.deckEmptied,true);
 ctx().refill('player');assert.equal(b.player.deck.length,2);b.player.hp=100;effect({type:'sinking',effects:[{type:'heal',amount:3}]});assert.equal(b.player.hp,103);
 b.player.maxMana=5;A.Keywords.observe(b.player);b.player.maxMana=1;effect({type:'awakening',effects:[{type:'heal',amount:4}]});assert.equal(b.player.hp,107);
});
test('keyword dredge sees only bottom three, moves selected card to top, never draws, and survives serialized choice',()=>{
 const {b,c,card,effect}=setup();const deck=Array.from({length:5},()=>card());b.player.deck=deck.slice();const hand=b.player.hand.length;
 effect({type:'dredgeKeyword'});assert.deepEqual(b.pendingChoice.options.map(x=>x.uid),deck.slice(-3).map(x=>x.uid));
 const restored=A.copy(b);A.Battle.choose(restored,1,c,()=>.3);assert.equal(restored.player.deck[0].uid,deck[3].uid);assert.equal(restored.player.deck.length,5);assert.equal(restored.player.hand.length,hand);
});
test('execution uses strict less-than at standby, kills without shield absorption and otherwise decreases once per turn',()=>{
 const {b,effect,event}=setup();b.enemy.hp=5;b.enemy.shield=99;effect({type:'execution',amount:5});event('standby');assert.equal(b.enemy.hp,5);assert.equal(b.enemy.status.execution,4);event('standby');assert.equal(b.enemy.status.execution,4);
 b.turn++;b.enemy.hp=3;event('standby');assert.equal(b.enemy.hp,0);assert.equal(b.enemy.shield,99);
});
test('liberation gates submission until condition and orbit triggers only for other cards while held, once per stay',()=>{
 const {b,c,card,event,ctx}=setup();c.cards.orbit={name:'궤도 테스트',cost:0,element:'NEUTRAL',effects:[],liberation:{type:'awakening'},orbit:{count:2,effects:[{type:'heal',amount:4}]}};
 const x=card({cardId:'orbit'});b.player.hand=[x];b.player.hp=100;assert.equal(A.Battle.cardAllowed(b,'player',c,x),false);
 event('cardUsed',{side:'player',card:x});assert.equal(x.orbitCount,undefined);
 event('cardUsed',{side:'player',card:card()});event('cardUsed',{side:'player',card:card()});assert.equal(b.player.hp,104);
 event('cardUsed',{side:'player',card:card()});assert.equal(b.player.hp,104);
 b.player.maxMana=5;assert.equal(A.Battle.cardAllowed(b,'player',c,x),true);b.player.maxMana=2;assert.equal(A.Battle.cardAllowed(b,'player',c,x),true);
 ctx().move('player',x.uid,'rest');ctx().move('player',x.uid,'hand');assert.equal(x.orbitCount,undefined);
});
test('same-element instability counters without exile, volatile hand cards exile at END and base Alibi has instability while its upgrade does not',()=>{
 const {b,c,card,job}=setup();assert.equal(c.cards[A.CardRules.nameToId('확고한 알리바이')].unstable,true);assert.equal(c.cards[A.CardRules.nameToId('확고한 알리바이')].volatile,false);
 b.player.hand=[card({unstable:true,element:'FIRE'})];b.enemy.hand=[card({element:'FIRE'})];const x=b.player.hand[0];b.enemyPlan=[b.enemy.hand[0].uid];b.enemyPowerPlan=false;
 A.Battle.submit(b,[x.uid],c,()=>.3);assert.ok(b.player.rest.some(y=>y.uid===x.uid));
 const v=card({volatile:true});b.player.hand.push(v);job({kind:'phase',op:'cleanup'});assert.ok(b.player.excluded.some(y=>y.uid===v.uid));
});


test('known submitted costs are preserved only in imagined simulations, never discounted by imaginary adjacency',()=>{
 const {b,c,card}=setup();c.cards.expensive={name:'비싼 카드',element:'NEUTRAL',cost:3,effects:[]};const x=card({cardId:'expensive'});b.player.hand=[x];b.player.mana=2;
 b._aiObservedCosts={[x.uid]:1};b._aiObservedCostTurn=b.turn;b._aiObservedCostPhase=b.phase;b.enemyPlan=[];b.enemyPowerPlan=false;
 assert.throws(()=>A.Battle.submit(b,[x.uid],c,()=>.3),/마나가 부족/);
 b._aiSimulation=true;b._aiStepsRemaining=360;A.Battle.submit(b,[x.uid],c,()=>.3);assert.equal(b.player.mana,1);
});


test('volatile excludes only cards in hand at END for both sides, leaving deck and rest cards intact',()=>{
 const {b,card,job}=setup(),saved={};
 for(const side of ['player','enemy']){
  saved[side]={hand:card({volatile:true}),deck:card({volatile:true}),rest:card({volatile:true})};
  b[side].hand=[saved[side].hand];b[side].deck.push(saved[side].deck);b[side].rest.push(saved[side].rest);
 }
 job({kind:'phase',op:'cleanup'});
 for(const side of ['player','enemy']){
  assert.ok(b[side].excluded.some(x=>x.uid===saved[side].hand.uid));
  assert.ok(b[side].deck.some(x=>x.uid===saved[side].deck.uid));
  assert.ok(b[side].rest.some(x=>x.uid===saved[side].rest.uid));
 }
});


test('shields last through both mains and END effects, then clear for both sides including afterEnd gains',()=>{
 const {b,c,card,job}=setup();b.player.shield=9;b.enemy.shield=13;b.enemyPlan=[];b.enemyPowerPlan=false;
 A.Battle.submit(b,[],c,()=>.3);assert.equal(b.phase,'MAIN2');assert.equal(b.player.shield,9);assert.equal(b.enemy.shield,13);
 b.scheduled.push({turn:b.turn,phase:'END',task:{kind:'effect',side:'enemy',effect:{type:'damage',amount:4}}});
 const hook=A.Keywords.hook;let endShield;
 A.Keywords.hook=function(ctx,e){hook(ctx,e);if(ctx.battle!==b)return;if(e.type==='end')endShield=ctx.fighter('player').shield;if(e.type==='afterEnd'){ctx.shield('player',8);ctx.shield('enemy',6);}};
 try{b.enemyPlan=[];b.enemyPowerPlan=false;A.Battle.submit(b,[],c,()=>.3);}finally{A.Keywords.hook=hook;}
 assert.equal(endShield,5);assert.equal(b.player.hp,200);assert.equal(b.player.shield,0);assert.equal(b.enemy.shield,0);assert.equal(b.turn,1);
});

test('dusk effects fire only in MAIN2, including the recorded resolution phase, and sunrise remains MAIN1-only',()=>{
 const {b,c,effect}=setup();b.player.hp=100;
 assert.equal(A.Keywords.descriptions.dusk,'어스름: 메인 페이즈 2에 추가 효과가 발동합니다.');
 effect({type:'dusk',effects:[{type:'heal',amount:7}]});assert.equal(b.player.hp,100);
 b.phase='MAIN2';effect({type:'dusk',effects:[{type:'heal',amount:7}]});assert.equal(b.player.hp,107);
 effect({type:'sunrise',effects:[{type:'heal',amount:7}]});assert.equal(b.player.hp,107);
 b.phase='END';b.resolution={phase:'MAIN2',queue:[{kind:'effect',side:'player',effect:{type:'dusk',effects:[{type:'heal',amount:7}]}}]};A.Battle.process(b,c,()=>.3);assert.equal(b.player.hp,114);
 assert.match(A.UI.render(null,{kind:'rules'},c,0),/어스름: 메인 페이즈 2에 추가 효과가 발동합니다/);
});
