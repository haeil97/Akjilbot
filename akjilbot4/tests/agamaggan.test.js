const test=require('node:test'),assert=require('node:assert/strict'),A=require('../../악질봇4.0.0.js');
function setup(){
 const c=A.copy(A.catalog),h=c.heroes.find(x=>x.id==='agamaggan');let serial=0;
 c.cards.blank={name:'빈 카드',element:'NEUTRAL',cost:0,effects:[]};
 const card=(id,upgraded=false)=>({uid:'blood-test-'+(++serial),cardId:id,upgraded});
 const spec=name=>({name,maxHp:100,deck:Array.from({length:30},()=>card('blank'))});
 let b=A.Battle.create(Object.assign(spec('나'),{heroId:h.id,heroPower:A.copy(h.power)}),spec('상대'),c,()=>.3);b.enemyPlan=[];b.enemyPowerPlan=false;
 const ctx=()=>A.Battle.context(b,c,()=>.3,{side:'player'},[]);
 const job=t=>{b.resolution={phase:b.phase,queue:[t]};A.Battle.process(b,c,()=>.3);};
 const power=()=>job({kind:'power',side:'player',module:'classes',power:b.player.heroPower});
 const play=(id,up=false)=>{const x=card(id,up);b.player.inFlight.push(x);job({kind:'card',side:'player',module:'classes',card:x,def:A.Battle.describeCard(x,c)});return x;};
 return {c,h,get b(){return b;},card,ctx,job,power,play,reload(){b=A.copy(b);}};
}
test('Agamaggan is selectable with exactly Crescendo two, Guard three, Saturation three and Blood Ritual two',()=>{
 const h=A.catalog.heroes.find(x=>x.id==='agamaggan');assert.equal(h.enabled,true);assert.deepEqual(h.cards.map(id=>A.catalog.cards[id].name),['크레센도','크레센도','수비','수비','수비','포화','포화','포화','혈석 의식','혈석 의식']);
 const files={},io={list:()=>Object.keys(files),read:n=>files[n],writeNewDurable(n,v){files[n]=v;}},store=A.Store.create(io);store.load(A.newState(42));const app=A.App.create(store,A.catalog);let event=0;
 const send=text=>app.handle({text,identity:'blood-player',name:'테스터',room:'개발123',now:1000,eventId:'blood-event-'+(++event)});send('+탐험');send('5');send('y');const u=Object.values(store.getState().users)[0];assert.equal(u.run.hero.id,'agamaggan');assert.equal(u.run.deck.length,10);assert.equal(u.run.battle.player.bloodstones,0);assert.equal(u.run.battle.player.startingTreasureId,'great_blood');
});
test('blood cards pay bloodstones instead of mana, reserve their entire batch and cannot spend stones produced by the same submission',()=>{
 const f=setup(),a=f.card('class:agamaggan_crescendo'),b=f.card('class:agamaggan_saturation');f.b.player.hand=[a,b];f.b.player.mana=0;f.b.player.bloodstones=1;
 assert.throws(()=>A.Battle.validateSubmission(f.ctx(),'player',[a.uid,b.uid],false),/혈석이 부족/);f.b.player.bloodstones=0;assert.throws(()=>A.Battle.validateSubmission(f.ctx(),'player',[a.uid],true),/혈석이 부족/);
 f.b.player.bloodstones=2;const payment=A.Battle.validateSubmission(f.ctx(),'player',[a.uid,b.uid],false);assert.equal(payment.cost,0);assert.equal(payment.bloodCost,2);A.Battle.submit(f.b,[a.uid,b.uid],f.c,()=>.3);assert.equal(f.b.player.mana,0);assert.equal(f.b.player.bloodstones,0);assert.equal(f.b.player.hand.length,2);assert.ok(f.b.runChanges.some(x=>x.type==='bloodstones'&&x.amount===0));
});
test('Crescendo uses current natural fatigue with minimum one, ignores armor and prevention and is not increased by potency',()=>{
 for(const [turn,damage] of [[0,1],[18,1],[19,1],[20,2],[24,6]])for(const up of [false,true]){
  const f=setup();f.b.turn=turn;f.b.player.hp=50;f.b.player.status.classes={powerBonus:3};f.b.enemy.shield=50;f.b.enemy.status.cards.effects=[{kind:'immune'},{kind:'damageCap',amount:1}];f.play('class:agamaggan_crescendo',up);
  assert.equal(f.b.enemy.hp,100-damage);assert.equal(f.b.enemy.shield,50);assert.equal(f.b.player.hp,50+(up?8:5)+3);
  const m=A.AIEvaluation.evaluateCard(A.Battle.describeCard(f.card('class:agamaggan_crescendo',up),f.c),f.b.player,f.b.enemy,f.b,f.c);assert.equal(m.damage,damage);
 }
});
test('countered blood cards still spend their stones and return to rest without applying their effects',()=>{
 const f=setup(),x=f.card('class:agamaggan_crescendo'),z=f.card('class:starter_guard');f.b.player.hand=[x];f.b.player.hp=50;f.b.player.mana=0;f.b.player.bloodstones=1;f.b.enemy.hand=[z];f.b.enemyPlan=[z.uid];
 A.Battle.submit(f.b,[x.uid],f.c,()=>.3);assert.equal(f.b.player.bloodstones,0);assert.equal(f.b.player.hp,50);assert.equal(f.b.enemy.hp,100);assert.ok(f.b.player.rest.some(a=>a.uid===x.uid));
});
test('Blood Ritual unlocks only for a power used while held, survives turns and reload, and resets upon moving to rest without losing its upgrade',()=>{
 const f=setup();f.power();const x=f.card('class:agamaggan_blood_ritual',true);f.b.player.hand=[x];assert.equal(A.Battle.cardAllowed(f.b,'player',f.c,x),false);
 f.power();assert.equal(A.Battle.cardAllowed(f.b,'player',f.c,x),true);f.b.turn++;f.reload();const saved=f.b.player.hand[0];assert.equal(A.Battle.cardAllowed(f.b,'player',f.c,saved),true);f.ctx().move('player',saved.uid,'rest');f.ctx().move('player',saved.uid,'hand');assert.equal(saved.upgraded,true);assert.equal(saved.liberationReady,undefined);assert.equal(A.Battle.cardAllowed(f.b,'player',f.c,saved),false);
});
test('all held liberation cards unlock separately and played-card liberation counts only other cards used while held',()=>{
 const f=setup(),a=f.card('class:agamaggan_blood_ritual'),b=f.card('class:agamaggan_blood_ritual'),surf=f.card('class:agamaggan_surf');f.b.player.hand=[a,b,surf];f.power();assert.equal(a.liberationReady,true);assert.equal(b.liberationReady,true);assert.equal(A.Battle.cardAllowed(f.b,'player',f.c,surf),false);
 for(let i=0;i<3;i++){const card=f.card('blank');f.job({kind:'event',event:{type:'cardUsed',side:'player',card,def:f.c.cards.blank,free:false}});}assert.equal(A.Battle.cardAllowed(f.b,'player',f.c,surf),true);f.b.turn++;assert.equal(A.Battle.cardAllowed(f.b,'player',f.c,surf),true);f.ctx().move('player',surf.uid,'rest');f.ctx().move('player',surf.uid,'hand');assert.equal(A.Battle.cardAllowed(f.b,'player',f.c,surf),false);
});
test('base ritual removes health payment once, the upgrade charges the opponent directly, and both are consumed by the next bloodcraft',()=>{
 for(const up of [false,true]){const f=setup();f.b.player.runWins=3;f.b.player.hp=1;f.b.enemy.shield=20;f.play('class:agamaggan_blood_ritual',up);assert.doesNotThrow(()=>A.Battle.validateSubmission(f.ctx(),'player',[],true));f.power();assert.equal(f.b.player.hp,1);assert.equal(f.b.enemy.hp,up?94:100);assert.equal(f.b.enemy.shield,20);assert.equal(f.b.player.bloodstones,1);assert.equal(f.b.player.status.classes.nextBloodPayment,undefined);assert.throws(()=>A.Battle.validateSubmission(f.ctx(),'player',[],true),/영웅 능력/);}
});
test('the last ritual replaces the previous mode; a full bloodstone pool does not consume a waiting mode and paid stones can make room before a power',()=>{
 const f=setup();f.b.player.runWins=3;f.play('class:agamaggan_blood_ritual',true);f.play('class:agamaggan_blood_ritual');assert.equal(f.b.player.status.classes.nextBloodPayment,'free');f.b.player.bloodstones=5;assert.throws(()=>A.Battle.validateSubmission(f.ctx(),'player',[],true),/영웅 능력/);assert.equal(f.b.player.status.classes.nextBloodPayment,'free');
 const x=f.card('class:agamaggan_saturation');f.b.player.hand=[x];assert.doesNotThrow(()=>A.Battle.validateSubmission(f.ctx(),'player',[x.uid],true));
});
test('bloodstone costs display with blood icons and do not count as mana receipt spending or zero-cost cards',()=>{
 const f=setup(),a=f.card('class:agamaggan_saturation'),b=f.card('class:agamaggan_saturation',true);f.b.player.treasureIds=['mana_receipt','antarctic_clock'];f.b.player.hand=[a,b];f.b.player.mana=0;f.b.player.bloodstones=2;
 assert.match(A.UI.card(a,f.c),/🩸1/);assert.match(A.BattleUI.controls(f.b,f.c),/포화 \| 🩸1/);A.Battle.submit(f.b,[a.uid,b.uid],f.c,()=>.3);assert.equal(f.b.player.status.treasures.main1Paid,0);assert.equal(f.b.player.mana,0);assert.equal(f.b.enemy.hp,100);assert.equal(f.b.player.hand.length,5);
});
test('AI enumerates independent blood and mana budgets and can select blood cards with zero mana',()=>{
 const f=setup(),a=f.card('class:agamaggan_saturation'),b=f.card('class:starter_guard');f.b.player.hand=[a,b];f.b.player.bloodstones=1;f.b.player.mana=0;
 const choices=A.AI.candidates(f.b,f.c,'player',5);assert.ok(choices.some(x=>x.uids.includes(a.uid)));assert.ok(choices.every(x=>!x.uids.includes(b.uid)));for(const x of choices)assert.doesNotThrow(()=>A.Battle.validateSubmission(f.ctx(),'player',x.uids,x.heroPower));
 f.b.player.bloodstones=0;f.b.player.mana=2;assert.ok(A.AI.candidates(f.b,f.c,'player',5).every(x=>!x.uids.includes(a.uid)));
});
test('automatic Boar Altar bloodcraft consumes the ritual mode and unlocks rituals held at the time',()=>{
 const f=setup(),x=f.card('class:agamaggan_blood_ritual');f.b.player.hand=[x];f.b.player.runWins=4;f.b.player.hp=1;f.b.player.treasureIds=['boar_altar'];f.b.player.status.classes.nextBloodPayment='free';
 f.job({kind:'event',event:{type:'beforeMain',phase:'MAIN1'}});assert.equal(f.b.player.hp,1);assert.equal(f.b.player.bloodstones,1);assert.equal(x.liberationReady,true);assert.equal(f.b.player.status.classes.nextBloodPayment,undefined);
});
test('spent stones persist through victory, durable reload, rewards and the next encounter while Great Blood heals twelve',()=>{
 const c=A.copy(A.catalog),files={},io={list:()=>Object.keys(files),read:n=>files[n],writeNewDurable(n,v){files[n]=v;}};let store,app,event=0;
 function open(){store=A.Store.create(io);store.load(A.newState(123));app=A.App.create(store,c);}open();
 const user=()=>Object.values(store.getState().users)[0],send=text=>app.handle({text,identity:'blood-carry',name:'테스터',room:'개발123',now:1000,eventId:'carry-'+(++event)});
 send('+탐험');send('5');send('y');store.transact('arrange winning fatigue',s=>{const r=Object.values(s.users)[0].run,b=r.battle;r.bloodstones=2;b.player.bloodstones=2;b.player.hp=20;b.player.mana=0;b.player.hand=[{uid:'carry-crescendo',cardId:'class:agamaggan_crescendo'}];b.enemy.hp=1;b.enemy.shield=0;b.enemyPlan=[];b.enemyPowerPlan=false;});
 send('1');assert.equal(user().run.hp,37);assert.equal(user().run.bloodstones,1);store.close();open();assert.equal(user().run.bloodstones,1);
 let guard=0;while(user().run.phase==='REWARD'){assert.ok(++guard<15);const p=user().run.pending;send(String(p.kind==='camp'?2:p.kind==='tavern'?p.options.length:1));}
 send('+탐험');send('y');assert.equal(user().run.battle.player.bloodstones,1);assert.equal(user().run.battle.player.hp,37);assert.equal(user().run.battle.player.runWins,1);
});
test('Agamaggan AI completes real battles with blood payments and repeated save reloads at early, middle and final stages',()=>{
 const c=A.catalog,hero=c.heroes.find(x=>x.id==='agamaggan');
 for(const [stage,enemyId] of [[1,'little_hatchling'],[4,'teemo'],[8,'extreme_troll']]){
  const state=A.newState(700+stage),rng=A.random(state),run={wins:stage-1,hero:A.copy(hero),deck:hero.cards.map(cardId=>({uid:A.id(state,'run-'),cardId})),treasures:{}},spec=A.Opponents.prepare(state,run,c,enemyId);
  let b=A.Battle.create({name:'아감마간',heroId:hero.id,heroName:hero.name,heroPower:A.copy(hero.power),runWins:stage-1,maxHp:60,deck:run.deck},{name:spec.name,bossId:spec.enemyId,heroPower:A.BossRules.power(spec.enemyId),maxHp:spec.maxHp,deck:A.copy(spec.deck),passives:A.copy(spec.treasurePassives),treasureIds:spec.treasures.map(x=>x.treasureId)},c,rng);
  let phases=0;
  while(b.outcome==='ongoing'&&phases++<150){
   let guard=0;while(b.pendingChoice){assert.ok(++guard<100);A.Battle.choose(b,0,c,rng);}if(b.outcome!=='ongoing')break;
   const view=A.copy(b);view.player=A.copy(b.enemy);view.enemy=A.copy(b.player);delete view.publicPlayerDeck;view.history=view.history.map(h=>({turn:h.turn,phase:h.phase,player:h.enemy,enemy:h.player}));
   const chosen=A.AI.plan(view,c,rng);assert.deepEqual(chosen.stats.errors||[],[]);A.Battle.submit(b,chosen.uids,c,rng,{heroPower:chosen.heroPower});b=A.copy(b);assert.ok(b.player.bloodstones>=0&&b.player.bloodstones<=5);
  }
  assert.ok(b.outcome==='victory'||b.outcome==='defeat',enemyId+' battle stalled');
 }
});
